-- Imora — business logic. Sensitive operations are SECURITY DEFINER functions
-- that validate the caller (auth.uid()) themselves; clients never write
-- commissions, leads, verification flags or roles directly.

-- ===========================================================================
-- Auth helpers
-- ===========================================================================
create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.user_agency_id()
returns uuid language sql stable security definer set search_path = public as $$
  select agency_id from public.agents where profile_id = auth.uid() and is_active limit 1
$$;

create or replace function public.is_agency_admin(p_agency_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.agents
    where profile_id = auth.uid() and agency_id = p_agency_id and is_agency_admin and is_active
  ) or public.is_admin()
$$;

create or replace function public.user_developer_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.developers where profile_id = auth.uid()
$$;

create or replace function public.can_manage_property(p_property_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.properties p
    where p.id = p_property_id
      and (
        p.owner_id = auth.uid()
        or (p.agency_id is not null and p.agency_id = public.user_agency_id())
        or public.is_admin()
      )
  )
$$;

create or replace function public.can_view_property(p_property_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.properties where id = p_property_id and status = 'published')
      or public.can_manage_property(p_property_id)
$$;

create or replace function public.tour_property_id(p_tour_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select property_id from public.property_3d_tours where id = p_tour_id
$$;

create or replace function public.scene_property_id(p_scene_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select t.property_id from public.property_360_scenes s
  join public.property_3d_tours t on t.id = s.tour_id
  where s.id = p_scene_id
$$;

create or replace function public.setting(p_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select value from public.app_settings where key = p_key
$$;

-- Internal escape hatch so SECURITY DEFINER functions can update guarded columns.
create or replace function public.guard_bypassed()
returns boolean language sql stable as $$
  select coalesce(current_setting('imora.bypass_guard', true), '') = 'on'
$$;

create or replace function public.is_privileged_context()
returns boolean language sql stable security definer set search_path = public as $$
  -- service role / SQL editor (no end-user JWT), admins, or internal functions
  select auth.uid() is null or public.is_admin() or public.guard_bypassed()
$$;

create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text, p_data jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, data)
  values (p_user, p_type, p_title, p_body, p_data)
$$;

create or replace function public.audit(p_action text, p_entity_type text, p_entity_id text, p_data jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, data)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_data)
$$;

-- ===========================================================================
-- Profiles: creation on sign-up, role selection, column guards
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- The role is ALWAYS 'client' at creation: never trust user-supplied metadata.
  insert into public.profiles (id, full_name, avatar_url, preferred_locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    case when new.raw_user_meta_data ->> 'locale' in ('fr', 'ar', 'en') then new.raw_user_meta_data ->> 'locale' else 'fr' end
  )
  on conflict (id) do nothing;

  insert into public.profile_contacts (profile_id, phone, email)
  values (new.id, coalesce(new.phone, new.raw_user_meta_data ->> 'phone'), new.email)
  on conflict (profile_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.guard_profile_columns()
returns trigger language plpgsql as $$
begin
  if public.is_privileged_context() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.role_selected is distinct from old.role_selected
     or new.is_verified is distinct from old.is_verified
     or new.is_demo is distinct from old.is_demo then
    raise exception 'forbidden_column_update' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_columns();

/**
 * Role selection after sign-up. Only self-assignable roles are accepted; the
 * agent role is granted by an agency admin and admin is granted manually.
 */
create or replace function public.choose_role(
  p_role public.app_role,
  p_organization_name text default null,
  p_phone text default null
) returns public.profiles
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_slug text;
  v_agency_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.role_selected and v_profile.role <> 'client' then
    raise exception 'role_already_selected' using errcode = '42501';
  end if;
  if p_role not in ('client', 'proprietaire', 'agency_admin', 'developer') then
    raise exception 'role_not_self_assignable' using errcode = '42501';
  end if;
  if p_role in ('agency_admin', 'developer') and coalesce(trim(p_organization_name), '') = '' then
    raise exception 'organization_name_required' using errcode = '22023';
  end if;

  perform set_config('imora.bypass_guard', 'on', true);

  if p_phone is not null then
    update public.profile_contacts set phone = p_phone, whatsapp = coalesce(whatsapp, p_phone)
    where profile_id = v_uid;
  end if;

  if p_role = 'proprietaire' then
    insert into public.owners (profile_id) values (v_uid) on conflict do nothing;
  elsif p_role = 'agency_admin' then
    v_slug := lower(regexp_replace(extensions.unaccent(p_organization_name), '[^a-zA-Z0-9]+', '-', 'g'))
              || '-' || substr(md5(random()::text), 1, 5);
    insert into public.agencies (slug, name, created_by, phone, whatsapp)
    values (v_slug, trim(p_organization_name), v_uid, p_phone, p_phone)
    returning id into v_agency_id;
    insert into public.agents (agency_id, profile_id, title, is_agency_admin)
    values (v_agency_id, v_uid, 'Directeur', true);
    insert into public.subscriptions (agency_id, plan_code) values (v_agency_id, 'agency_basic');
  elsif p_role = 'developer' then
    v_slug := lower(regexp_replace(extensions.unaccent(p_organization_name), '[^a-zA-Z0-9]+', '-', 'g'))
              || '-' || substr(md5(random()::text), 1, 5);
    insert into public.developers (profile_id, slug, company_name, phone)
    values (v_uid, v_slug, trim(p_organization_name), p_phone);
  end if;

  update public.profiles set role = p_role, role_selected = true where id = v_uid
  returning * into v_profile;

  perform public.audit('choose_role', 'profile', v_uid::text, jsonb_build_object('role', p_role));
  return v_profile;
end $$;

/** Agency admins attach an existing user (by e-mail) to their agency as an agent. */
create or replace function public.add_agency_agent(p_agency_id uuid, p_email text, p_title text default 'Agent')
returns public.agents
language plpgsql security definer set search_path = public as $$
declare
  v_profile_id uuid;
  v_agent public.agents;
begin
  if not public.is_agency_admin(p_agency_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select profile_id into v_profile_id from public.profile_contacts where lower(email) = lower(p_email);
  if v_profile_id is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.agents where profile_id = v_profile_id) then
    raise exception 'already_agent' using errcode = '23505';
  end if;
  perform set_config('imora.bypass_guard', 'on', true);
  insert into public.agents (agency_id, profile_id, title) values (p_agency_id, v_profile_id, p_title)
  returning * into v_agent;
  update public.profiles set role = 'agent', role_selected = true where id = v_profile_id;
  perform public.audit('add_agent', 'agency', p_agency_id::text, jsonb_build_object('profile_id', v_profile_id));
  return v_agent;
end $$;

-- ===========================================================================
-- Properties: guards, price history, rich-media flags
-- ===========================================================================
create or replace function public.guard_property()
returns trigger language plpgsql as $$
declare
  v_auto_publish boolean := coalesce((public.setting('auto_publish'))::boolean, false);
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := coalesce(new.published_at, now());
  end if;

  if public.is_privileged_context() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(public.current_app_role()::text, 'client') not in ('proprietaire', 'agent', 'agency_admin', 'developer') then
      raise exception 'role_cannot_publish' using errcode = '42501';
    end if;
    new.owner_id := auth.uid();
    new.is_verified := false;
    new.documents_verified := false;
    new.featured_until := null;
    new.views_count := 0;
    new.favorites_count := 0;
    new.is_demo := false;
    new.has_360 := false;
    new.has_3d := false;
  else
    -- Columns owned by the platform
    new.owner_id := old.owner_id;
    new.is_verified := old.is_verified;
    new.documents_verified := old.documents_verified;
    new.featured_until := old.featured_until;
    new.views_count := old.views_count;
    new.favorites_count := old.favorites_count;
    new.is_demo := old.is_demo;
    new.has_360 := old.has_360;
    new.has_3d := old.has_3d;
    new.reference := old.reference;
    -- A material change on a verified listing removes the badge until re-review
    if old.is_verified and (new.price <> old.price or new.area_m2 is distinct from old.area_m2
        or new.bedrooms is distinct from old.bedrooms) then
      new.is_verified := false;
    end if;
  end if;

  if new.agency_id is not null and new.agency_id is distinct from public.user_agency_id() then
    raise exception 'agency_mismatch' using errcode = '42501';
  end if;

  -- Moderation: owners submit, admins publish (unless auto_publish is enabled)
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') and not v_auto_publish then
    new.status := 'pending_review';
    new.published_at := null;
  end if;
  if new.status = 'rejected' and (tg_op = 'INSERT' or old.status <> 'rejected') then
    raise exception 'forbidden_status' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger properties_guard before insert or update on public.properties
  for each row execute function public.guard_property();

create or replace function public.track_price_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.price <> old.price or new.price_period <> old.price_period then
    insert into public.property_price_history (property_id, price, price_period)
    values (new.id, new.price, new.price_period);
  end if;
  return null;
end $$;

create trigger properties_price_history after insert or update of price, price_period on public.properties
  for each row execute function public.track_price_history();

create or replace function public.refresh_property_media_flags(p_property_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('imora.bypass_guard', 'on', true);
  update public.properties p set
    has_360 = exists (
      select 1 from public.property_3d_tours t
      join public.property_360_scenes s on s.tour_id = t.id
      where t.property_id = p.id and t.status = 'published'
    ),
    -- 3D = an uploaded glTF model, or enough dimensioned rooms to build the dollhouse view
    has_3d = exists (
      select 1 from public.property_3d_tours t
      where t.property_id = p.id and t.status = 'published'
        and (t.model_url is not null or (
          select count(*) from public.property_rooms r
          where r.tour_id = t.id and r.plan_rect is not null and r.floor_plan_id is not null
        ) >= 2)
    )
  where p.id = p_property_id;
  perform set_config('imora.bypass_guard', '', true);
end $$;

create or replace function public.on_tour_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_property_media_flags(coalesce(new.property_id, old.property_id));
  return null;
end $$;

create trigger tours_flags after insert or update or delete on public.property_3d_tours
  for each row execute function public.on_tour_change();

create or replace function public.on_scene_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_property_media_flags(public.tour_property_id(coalesce(new.tour_id, old.tour_id)));
  return null;
end $$;

create trigger scenes_flags after insert or delete on public.property_360_scenes
  for each row execute function public.on_scene_change();
create trigger rooms_flags after insert or update or delete on public.property_rooms
  for each row execute function public.on_scene_change();

create or replace function public.guard_tour()
returns trigger language plpgsql as $$
begin
  if not public.is_privileged_context() then
    new.is_verified := case when tg_op = 'UPDATE' then old.is_verified else false end;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at := now();
  end if;
  return new;
end $$;

create trigger tours_guard before insert or update on public.property_3d_tours
  for each row execute function public.guard_tour();

-- ===========================================================================
-- Search
-- ===========================================================================

/** Shared predicate used by search, map and saved-search matching. Inlinable SQL. */
create or replace function public.property_matches_filters(p public.properties, f jsonb)
returns boolean language sql stable as $$
  select
    (f ->> 'listing_type' is null
      or (f ->> 'listing_type' = 'investment' and (p.listing_type = 'investment' or p.estimated_yield is not null))
      or p.listing_type::text = f ->> 'listing_type')
    and (coalesce(jsonb_array_length(f -> 'property_types'), 0) = 0
      or p.property_type::text in (select jsonb_array_elements_text(f -> 'property_types')))
    and (f ->> 'city' is null or extensions.unaccent(p.city) ilike extensions.unaccent(f ->> 'city'))
    and (f ->> 'district' is null or extensions.unaccent(coalesce(p.district, '')) ilike extensions.unaccent(f ->> 'district'))
    and (f ->> 'q' is null
      or p.search_tsv @@ websearch_to_tsquery('simple', f ->> 'q')
      or extensions.unaccent(p.title || ' ' || coalesce(p.district, '') || ' ' || p.city)
           ilike '%' || extensions.unaccent(f ->> 'q') || '%')
    and (f ->> 'price_min' is null or p.price >= (f ->> 'price_min')::bigint)
    and (f ->> 'price_max' is null or p.price <= (f ->> 'price_max')::bigint)
    and (f ->> 'area_min' is null or p.area_m2 >= (f ->> 'area_min')::numeric)
    and (f ->> 'area_max' is null or p.area_m2 <= (f ->> 'area_max')::numeric)
    and (f ->> 'bedrooms_min' is null or p.bedrooms >= (f ->> 'bedrooms_min')::int)
    and (f ->> 'bathrooms_min' is null or p.bathrooms >= (f ->> 'bathrooms_min')::int)
    and (coalesce((f ->> 'parking')::boolean, false) = false or p.parking_spaces > 0)
    and (coalesce((f ->> 'pool')::boolean, false) = false or p.has_pool)
    and (coalesce((f ->> 'garden')::boolean, false) = false or p.has_garden)
    and (coalesce((f ->> 'furnished')::boolean, false) = false or p.furnished)
    and (coalesce((f ->> 'has_360')::boolean, false) = false or p.has_360)
    and (coalesce((f ->> 'has_3d')::boolean, false) = false or p.has_3d)
    and (coalesce((f ->> 'verified')::boolean, false) = false or p.is_verified)
$$;

/** Public coordinates: exact, or deterministically offset (~150 m) when the owner asked for privacy. */
create or replace function public.public_point(l public.property_locations)
returns double precision[] language sql immutable as $$
  select case when l.geog is null then null else array[
    extensions.st_x(l.geog::extensions.geometry)
      + case when l.is_approximate then (((('x' || substr(md5(l.property_id::text), 1, 4))::bit(16)::int) % 200) - 100) / 75000.0 else 0 end,
    extensions.st_y(l.geog::extensions.geometry)
      + case when l.is_approximate then (((('x' || substr(md5(l.property_id::text), 5, 4))::bit(16)::int) % 200) - 100) / 75000.0 else 0 end
  ] end
$$;

create or replace function public.search_properties(
  p_filters jsonb default '{}',
  p_limit integer default 20,
  p_offset integer default 0,
  p_bbox double precision[] default null, -- [min_lng, min_lat, max_lng, max_lat]
  p_ids uuid[] default null                -- restrict to these listings (favorites, comparisons, recommendations)
)
returns table (
  id uuid, slug text, reference text, title text, title_ar text,
  listing_type public.listing_type, property_type public.property_type,
  price bigint, price_period public.price_period,
  city text, district text, bedrooms smallint, bathrooms smallint, area_m2 numeric,
  parking_spaces smallint, has_pool boolean, has_360 boolean, has_3d boolean,
  is_verified boolean, is_demo boolean, estimated_yield numeric,
  cover_url text, agency_name text, agency_verified boolean,
  lng double precision, lat double precision, published_at timestamptz, total_count bigint
)
language sql stable security definer set search_path = public, extensions as $$
  with f as (select coalesce(p_filters, '{}'::jsonb) as v),
  base as (
    select p.*, public.public_point(l) as pt
    from public.properties p
    left join public.property_locations l on l.property_id = p.id, f
    where p.status = 'published'
      and public.property_matches_filters(p, f.v)
      and (p_ids is null or p.id = any (p_ids))
      and (p_bbox is null or (l.geog is not null and extensions.st_intersects(
        l.geog, extensions.st_makeenvelope(p_bbox[1], p_bbox[2], p_bbox[3], p_bbox[4], 4326)::extensions.geography)))
  )
  select
    b.id, b.slug, b.reference, b.title, b.title_ar, b.listing_type, b.property_type,
    b.price, b.price_period, b.city, b.district, b.bedrooms, b.bathrooms, b.area_m2,
    b.parking_spaces, b.has_pool, b.has_360, b.has_3d, b.is_verified, b.is_demo, b.estimated_yield,
    (select m.url from public.property_media m
      where m.property_id = b.id and m.kind = 'image'
      order by m.is_cover desc, m.position limit 1) as cover_url,
    a.name, a.is_verified,
    b.pt[1], b.pt[2], b.published_at,
    count(*) over () as total_count
  from base b
  left join public.agencies a on a.id = b.agency_id, f
  order by
    case when f.v ->> 'sort' = 'price_asc' then b.price end asc nulls last,
    case when f.v ->> 'sort' = 'price_desc' then b.price end desc nulls last,
    case when f.v ->> 'sort' = 'area_desc' then b.area_m2 end desc nulls last,
    case when f.v ->> 'sort' = 'newest' then b.published_at end desc nulls last,
    case when coalesce(f.v ->> 'sort', 'relevance') = 'relevance' and f.v ->> 'q' is not null
      then ts_rank(b.search_tsv, websearch_to_tsquery('simple', f.v ->> 'q')) end desc nulls last,
    (b.featured_until is not null and b.featured_until > now()) desc,
    b.is_verified desc,
    (b.has_3d or b.has_360) desc,
    b.published_at desc nulls last
  limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0)
$$;

create or replace function public.properties_in_bbox(
  p_min_lng double precision, p_min_lat double precision,
  p_max_lng double precision, p_max_lat double precision,
  p_filters jsonb default '{}',
  p_limit integer default 500
)
returns table (
  id uuid, slug text, lng double precision, lat double precision, price bigint,
  price_period public.price_period, listing_type public.listing_type,
  property_type public.property_type, has_3d boolean, has_360 boolean
)
language sql stable security definer set search_path = public, extensions as $$
  select p.id, p.slug, pt[1], pt[2], p.price, p.price_period, p.listing_type, p.property_type, p.has_3d, p.has_360
  from public.properties p
  join public.property_locations l on l.property_id = p.id
  cross join lateral (select public.public_point(l) as pt) x
  where p.status = 'published'
    and extensions.st_intersects(l.geog,
      extensions.st_makeenvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::extensions.geography)
    and public.property_matches_filters(p, coalesce(p_filters, '{}'::jsonb))
  order by (p.featured_until is not null and p.featured_until > now()) desc, p.published_at desc
  limit least(greatest(p_limit, 1), 2000)
$$;

/** Public location of one property (approximate when requested by the owner). */
create or replace function public.property_location(p_property_id uuid)
returns table (lng double precision, lat double precision, is_approximate boolean)
language sql stable security definer set search_path = public, extensions as $$
  select pt[1], pt[2], l.is_approximate
  from public.property_locations l
  cross join lateral (select public.public_point(l) as pt) x
  where l.property_id = p_property_id and public.can_view_property(p_property_id)
$$;

/** Exact location, for the listing's managers only (editing). */
create or replace function public.property_location_exact(p_property_id uuid)
returns table (lng double precision, lat double precision, is_approximate boolean)
language sql stable security definer set search_path = public, extensions as $$
  select extensions.st_x(l.geog::extensions.geometry), extensions.st_y(l.geog::extensions.geometry), l.is_approximate
  from public.property_locations l
  where l.property_id = p_property_id and public.can_manage_property(p_property_id)
$$;

/** Write/replace a property's location. Coordinates are validated to Mauritania's bounding box. */
create or replace function public.set_property_location(
  p_property_id uuid, p_lng double precision, p_lat double precision, p_is_approximate boolean default false
) returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.can_manage_property(p_property_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_lng not between -17.2 and -4.7 or p_lat not between 14.6 and 27.4 then
    raise exception 'location_outside_mauritania' using errcode = '22023';
  end if;
  insert into public.property_locations (property_id, geog, is_approximate)
  values (p_property_id, extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography, p_is_approximate)
  on conflict (property_id) do update
    set geog = excluded.geog, is_approximate = excluded.is_approximate, updated_at = now();
end $$;

/** Number of published listings per tab, used by the home hero CTA. */
create or replace function public.count_properties(p_filters jsonb default '{}')
returns bigint language sql stable security definer set search_path = public, extensions as $$
  select count(*) from public.properties p
  where p.status = 'published' and public.property_matches_filters(p, coalesce(p_filters, '{}'::jsonb))
$$;

-- ===========================================================================
-- Views & favorites
-- ===========================================================================
create or replace function public.record_property_view(p_property_id uuid, p_session_id text default null, p_source text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.properties where id = p_property_id and status = 'published') then
    return;
  end if;
  -- De-duplicate: one view per user/session per property per 30 minutes
  if exists (
    select 1 from public.property_views
    where property_id = p_property_id
      and created_at > now() - interval '30 minutes'
      and ((auth.uid() is not null and user_id = auth.uid()) or (p_session_id is not null and session_id = p_session_id))
  ) then
    return;
  end if;
  insert into public.property_views (property_id, user_id, session_id, source)
  values (p_property_id, auth.uid(), left(p_session_id, 64), left(p_source, 32));
  perform set_config('imora.bypass_guard', 'on', true);
  update public.properties set views_count = views_count + 1 where id = p_property_id;
  perform set_config('imora.bypass_guard', '', true);
end $$;

create or replace function public.on_favorite_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_prop public.properties;
begin
  perform set_config('imora.bypass_guard', 'on', true);
  if tg_op = 'INSERT' then
    update public.properties set favorites_count = favorites_count + 1 where id = new.property_id
    returning * into v_prop;
    if v_prop.owner_id <> new.user_id then
      insert into public.property_leads (property_id, buyer_id, owner_id, agency_id, source)
      values (v_prop.id, new.user_id, v_prop.owner_id, v_prop.agency_id, 'favorite')
      on conflict (property_id, buyer_id) do update
        set interactions_count = property_leads.interactions_count + 1, last_activity_at = now();
    end if;
  else
    update public.properties set favorites_count = greatest(favorites_count - 1, 0) where id = old.property_id;
  end if;
  perform set_config('imora.bypass_guard', '', true);
  return null;
end $$;

create trigger favorites_change after insert or delete on public.favorites
  for each row execute function public.on_favorite_change();

-- ===========================================================================
-- Contact, leads
-- ===========================================================================
create or replace function public.on_contact_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_lead_id uuid;
  v_is_new boolean;
begin
  insert into public.property_leads (property_id, buyer_id, owner_id, agency_id, source, status)
  values (
    new.property_id, new.user_id, new.owner_id, new.agency_id,
    new.event_type::text::public.lead_source,
    case when new.event_type = 'visit_requested' then 'visit_scheduled'::public.lead_status else 'new' end
  )
  on conflict (property_id, buyer_id) do update set
    interactions_count = property_leads.interactions_count + 1,
    last_activity_at = now(),
    -- Promote the lead when a visit is requested, never downgrade it
    status = case
      when excluded.status = 'visit_scheduled' and property_leads.status in ('new', 'contacted', 'qualified')
        then 'visit_scheduled'::public.lead_status
      else property_leads.status end
  returning id, (xmax = 0) into v_lead_id, v_is_new;

  if v_is_new then
    perform public.notify(new.owner_id, 'new_lead', 'Nouveau contact',
      'Un utilisateur s''intéresse à votre bien.',
      jsonb_build_object('property_id', new.property_id, 'lead_id', v_lead_id, 'source', new.event_type));
  end if;
  return null;
end $$;

create trigger contact_events_lead after insert on public.property_contact_events
  for each row execute function public.on_contact_event();

/**
 * Reveals the listing's contact phone to an authenticated user after explicit
 * confirmation in the UI. Every reveal is logged as a lead event and rate-limited.
 */
create or replace function public.reveal_contact(p_property_id uuid)
returns table (contact_name text, phone text, whatsapp text, is_agency boolean, agency_name text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_prop public.properties;
  v_limit int := coalesce((public.setting('phone_reveal_daily_limit'))::int, 30);
  v_count int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_prop from public.properties where id = p_property_id and status = 'published';
  if not found then
    raise exception 'property_not_found' using errcode = 'P0002';
  end if;

  if v_prop.owner_id <> v_uid then
    select count(*) into v_count from public.property_contact_events
    where user_id = v_uid and event_type = 'phone_reveal' and created_at > now() - interval '24 hours';
    if v_count >= v_limit then
      raise exception 'reveal_limit_reached' using errcode = '54000';
    end if;

    -- Only log once per user/property/day to keep lead stats honest
    if not exists (
      select 1 from public.property_contact_events
      where user_id = v_uid and property_id = p_property_id and event_type = 'phone_reveal'
        and created_at > now() - interval '24 hours'
    ) then
      insert into public.property_contact_events (user_id, property_id, owner_id, agency_id, event_type)
      values (v_uid, p_property_id, v_prop.owner_id, v_prop.agency_id, 'phone_reveal');
    end if;
  end if;

  if v_prop.agent_id is not null then
    return query
      select pr.full_name, coalesce(pc.phone, a.phone), coalesce(pc.whatsapp, pc.phone, a.whatsapp, a.phone), true, a.name
      from public.agents ag
      join public.profiles pr on pr.id = ag.profile_id
      left join public.profile_contacts pc on pc.profile_id = ag.profile_id
      join public.agencies a on a.id = ag.agency_id
      where ag.id = v_prop.agent_id;
  elsif v_prop.agency_id is not null then
    return query
      select a.name, a.phone, coalesce(a.whatsapp, a.phone), true, a.name
      from public.agencies a where a.id = v_prop.agency_id;
  else
    return query
      select pr.full_name, pc.phone, coalesce(pc.whatsapp, pc.phone), false, null::text
      from public.profiles pr
      left join public.profile_contacts pc on pc.profile_id = pr.id
      where pr.id = v_prop.owner_id;
  end if;
end $$;

/** Logs WhatsApp/call clicks (after a reveal) and information requests. */
create or replace function public.log_contact_event(p_property_id uuid, p_event public.contact_event_type, p_metadata jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_prop public.properties;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_event not in ('whatsapp_click', 'call_click') then
    raise exception 'event_not_loggable_directly' using errcode = '22023';
  end if;
  select * into v_prop from public.properties where id = p_property_id and status = 'published';
  if not found or v_prop.owner_id = auth.uid() then
    return;
  end if;
  insert into public.property_contact_events (user_id, property_id, owner_id, agency_id, event_type, metadata)
  values (auth.uid(), p_property_id, v_prop.owner_id, v_prop.agency_id, p_event, p_metadata);
end $$;

create or replace function public.update_lead_status(p_lead_id uuid, p_status public.lead_status, p_notes text default null)
returns public.property_leads language plpgsql security definer set search_path = public as $$
declare
  v_lead public.property_leads;
begin
  select * into v_lead from public.property_leads where id = p_lead_id;
  if not found or not public.can_manage_property(v_lead.property_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.property_leads
    set status = p_status, notes = coalesce(p_notes, notes), last_activity_at = now()
  where id = p_lead_id returning * into v_lead;
  return v_lead;
end $$;

-- ===========================================================================
-- Visits
-- ===========================================================================
create or replace function public.visit_slots()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array(select jsonb_array_elements_text(public.setting('visit_slots'))),
                  array['10:00', '11:30', '15:00', '17:00'])
$$;

/** Slots already booked for a property (no personal data returned). */
create or replace function public.taken_visit_slots(p_property_id uuid, p_from date, p_to date)
returns table (date date, "time" time)
language sql stable security definer set search_path = public as $$
  select v.date, v.time from public.visits v
  where v.property_id = p_property_id
    and v.date between p_from and least(p_to, p_from + 62)
    and v.status in ('requested', 'confirmed')
    and public.can_view_property(p_property_id)
$$;

create or replace function public.request_visit(p_property_id uuid, p_date date, p_time time, p_notes text default null)
returns public.visits language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prop public.properties;
  v_visit public.visits;
  v_tz text := coalesce(public.setting('timezone') #>> '{}', 'Africa/Nouakchott');
  v_today date := (now() at time zone v_tz)::date;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_prop from public.properties where id = p_property_id and status = 'published';
  if not found then
    raise exception 'property_not_found' using errcode = 'P0002';
  end if;
  if v_prop.owner_id = v_uid then
    raise exception 'cannot_visit_own_property' using errcode = '22023';
  end if;
  if p_date < v_today or p_date > v_today + 60 then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  if p_date = v_today and p_time <= (now() at time zone v_tz)::time + interval '1 hour' then
    raise exception 'slot_too_soon' using errcode = '22023';
  end if;
  if to_char(p_time, 'HH24:MI') <> all (public.visit_slots()) then
    raise exception 'invalid_slot' using errcode = '22023';
  end if;
  if (select count(*) from public.visits where user_id = v_uid and property_id = p_property_id
      and status in ('requested', 'confirmed')) >= 2 then
    raise exception 'too_many_pending_visits' using errcode = '54000';
  end if;

  begin
    insert into public.visits (property_id, user_id, owner_id, agency_id, date, time, notes)
    values (p_property_id, v_uid, v_prop.owner_id, v_prop.agency_id, p_date, p_time, nullif(trim(p_notes), ''))
    returning * into v_visit;
  exception when unique_violation then
    raise exception 'slot_taken' using errcode = '23505';
  end;

  insert into public.property_contact_events (user_id, property_id, owner_id, agency_id, event_type, metadata)
  values (v_uid, p_property_id, v_prop.owner_id, v_prop.agency_id, 'visit_requested',
          jsonb_build_object('visit_id', v_visit.id));

  perform public.notify(v_prop.owner_id, 'visit_requested', 'Nouvelle demande de visite',
    v_prop.title || ' — ' || to_char(p_date, 'DD/MM') || ' ' || to_char(p_time, 'HH24:MI'),
    jsonb_build_object('visit_id', v_visit.id, 'property_id', p_property_id));
  if v_prop.agent_id is not null then
    perform public.notify((select profile_id from public.agents where id = v_prop.agent_id), 'visit_requested',
      'Nouvelle demande de visite', v_prop.title,
      jsonb_build_object('visit_id', v_visit.id, 'property_id', p_property_id));
  end if;
  return v_visit;
end $$;

create or replace function public.update_visit_status(p_visit_id uuid, p_status public.visit_status, p_reason text default null)
returns public.visits language plpgsql security definer set search_path = public as $$
declare
  v_visit public.visits;
  v_is_manager boolean;
begin
  select * into v_visit from public.visits where id = p_visit_id;
  if not found then
    raise exception 'visit_not_found' using errcode = 'P0002';
  end if;
  v_is_manager := public.can_manage_property(v_visit.property_id);

  if v_visit.user_id = auth.uid() and not v_is_manager then
    if p_status <> 'cancelled' then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  elsif not v_is_manager then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_visit.status in ('cancelled', 'completed', 'no_show') then
    raise exception 'visit_closed' using errcode = '22023';
  end if;

  update public.visits set status = p_status, cancelled_reason = case when p_status = 'cancelled' then p_reason end
  where id = p_visit_id returning * into v_visit;

  perform public.notify(
    case when auth.uid() = v_visit.user_id then v_visit.owner_id else v_visit.user_id end,
    'visit_' || p_status::text, 'Visite mise à jour', null,
    jsonb_build_object('visit_id', v_visit.id, 'property_id', v_visit.property_id, 'status', p_status));
  return v_visit;
end $$;

-- ===========================================================================
-- Messaging
-- ===========================================================================
create or replace function public.start_conversation(p_property_id uuid, p_message text)
returns public.conversations language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prop public.properties;
  v_counterpart uuid;
  v_conv public.conversations;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if coalesce(trim(p_message), '') = '' then
    raise exception 'empty_message' using errcode = '22023';
  end if;
  select * into v_prop from public.properties where id = p_property_id and status = 'published';
  if not found then
    raise exception 'property_not_found' using errcode = 'P0002';
  end if;
  v_counterpart := coalesce((select profile_id from public.agents where id = v_prop.agent_id), v_prop.owner_id);
  if v_counterpart = v_uid then
    raise exception 'cannot_message_self' using errcode = '22023';
  end if;

  insert into public.conversations (property_id, client_id, counterpart_id)
  values (p_property_id, v_uid, v_counterpart)
  on conflict (property_id, client_id, counterpart_id) do update set property_id = excluded.property_id
  returning * into v_conv;

  insert into public.messages (conversation_id, sender_id, body) values (v_conv.id, v_uid, trim(p_message));
  return v_conv;
end $$;

create or replace function public.on_message_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_conv public.conversations;
  v_prop public.properties;
  v_recipient uuid;
begin
  update public.conversations
    set last_message_at = new.created_at, last_message_preview = left(coalesce(new.body, '📎'), 140)
  where id = new.conversation_id returning * into v_conv;

  v_recipient := case when new.sender_id = v_conv.client_id then v_conv.counterpart_id else v_conv.client_id end;
  perform public.notify(v_recipient, 'new_message', 'Nouveau message', left(new.body, 140),
    jsonb_build_object('conversation_id', v_conv.id, 'property_id', v_conv.property_id));

  -- First client message on a conversation counts as a lead event
  if new.sender_id = v_conv.client_id and not exists (
    select 1 from public.messages where conversation_id = v_conv.id and id <> new.id and sender_id = v_conv.client_id
  ) then
    select * into v_prop from public.properties where id = v_conv.property_id;
    insert into public.property_contact_events (user_id, property_id, owner_id, agency_id, event_type)
    values (new.sender_id, v_prop.id, v_prop.owner_id, v_prop.agency_id, 'message_sent');
  end if;
  return null;
end $$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_insert();

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.messages m set read_at = now()
  from public.conversations c
  where c.id = p_conversation_id and m.conversation_id = c.id
    and auth.uid() in (c.client_id, c.counterpart_id)
    and m.sender_id <> auth.uid() and m.read_at is null
$$;

-- ===========================================================================
-- Saved searches: notify matching users when a listing gets published
-- ===========================================================================
create or replace function public.on_property_published()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    insert into public.notifications (user_id, type, title, body, data)
    select s.user_id, 'saved_search_match', 'Nouveau bien pour « ' || s.name || ' »', new.title,
           jsonb_build_object('property_id', new.id, 'slug', new.slug, 'saved_search_id', s.id)
    from public.saved_searches s
    where s.notify and s.user_id <> new.owner_id
      and public.property_matches_filters(new, s.filters);
    update public.saved_searches s set last_notified_at = now()
    where s.notify and public.property_matches_filters(new, s.filters);
  end if;
  return null;
end $$;

create trigger properties_published after insert or update of status on public.properties
  for each row execute function public.on_property_published();

-- ===========================================================================
-- Recommendations (deterministic, based only on the user's own signals)
-- ===========================================================================
create or replace function public.recommend_properties(p_limit integer default 8)
returns table (property_id uuid, score numeric, reasons text[])
language plpgsql stable security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;
  return query
  with signals as (
    -- favorites weigh 3, visit/contact 2, views 1 (last 120 days)
    select f.property_id, 3 as w from public.favorites f where f.user_id = v_uid
    union all
    select e.property_id, 2 from public.property_contact_events e
      where e.user_id = v_uid and e.created_at > now() - interval '120 days'
    union all
    select v.property_id, 1 from public.property_views v
      where v.user_id = v_uid and v.created_at > now() - interval '120 days'
  ),
  sp as (
    select p.*, s.w from signals s join public.properties p on p.id = s.property_id
  ),
  prefs as (
    select
      (select district from sp where district is not null group by district order by sum(w) desc limit 1) as district,
      (select city from sp group by city order by sum(w) desc limit 1) as city,
      (select property_type from sp group by property_type order by sum(w) desc limit 1) as ptype,
      (select listing_type from sp group by listing_type order by sum(w) desc limit 1) as ltype,
      (select percentile_cont(0.5) within group (order by price) from sp) as median_price,
      (select round(avg(bedrooms)) from sp where bedrooms is not null) as beds,
      (select avg(e.embedding) from public.ai_embeddings e
        where e.entity_type = 'property_text' and e.property_id in (select s2.property_id from signals s2 where s2.w >= 2)) as centroid
  ),
  scored as (
    select p.id,
      (case when p.district = pr.district then 3 else 0 end
       + case when p.city = pr.city then 1 else 0 end
       + case when p.property_type = pr.ptype then 2 else 0 end
       + case when p.listing_type = pr.ltype then 2 else 0 end
       + case when pr.median_price is not null and p.price between pr.median_price * 0.7 and pr.median_price * 1.3 then 2 else 0 end
       + case when pr.beds is not null and p.bedrooms between pr.beds - 1 and pr.beds + 1 then 1 else 0 end
       + coalesce((select 3 * (1 - (e.embedding <=> pr.centroid)) from public.ai_embeddings e
                   where e.entity_type = 'property_text' and e.property_id = p.id and pr.centroid is not null limit 1), 0)
      )::numeric as score,
      array_remove(array[
        case when p.district = pr.district then 'district' end,
        case when p.property_type = pr.ptype then 'type' end,
        case when pr.median_price is not null and p.price between pr.median_price * 0.7 and pr.median_price * 1.3 then 'budget' end,
        case when pr.beds is not null and p.bedrooms between pr.beds - 1 and pr.beds + 1 then 'bedrooms' end
      ], null) as reasons
    from public.properties p, prefs pr
    where p.status = 'published'
      and p.owner_id <> v_uid
      and pr.city is not null
      and p.id not in (select f.property_id from public.favorites f where f.user_id = v_uid)
      and p.listing_type = pr.ltype
  )
  select s.id, round(s.score, 2), s.reasons from scored s
  where s.score >= 4
  order by s.score desc
  limit least(greatest(p_limit, 1), 30);
end $$;

/** Similar listings for a property page: embedding similarity when available, attributes otherwise. */
create or replace function public.similar_properties(p_property_id uuid, p_limit integer default 6)
returns setof uuid language sql stable security definer set search_path = public, extensions as $$
  with src as (select * from public.properties where id = p_property_id),
  src_emb as (select embedding from public.ai_embeddings where entity_type = 'property_text' and property_id = p_property_id limit 1)
  select p.id from public.properties p, src
  left join src_emb on true
  where p.status = 'published' and p.id <> src.id and p.listing_type = src.listing_type
  order by
    (select e.embedding <=> src_emb.embedding from public.ai_embeddings e
      where e.entity_type = 'property_text' and e.property_id = p.id limit 1) asc nulls last,
    (p.property_type = src.property_type) desc,
    (p.district is not distinct from src.district) desc,
    abs(p.price - src.price) asc
  limit least(greatest(p_limit, 1), 24)
$$;

/** Vector search used by the image-search edge function (service role only). */
create or replace function public.match_properties_by_embedding(p_embedding extensions.vector, p_limit integer default 12, p_filters jsonb default '{}')
returns table (property_id uuid, similarity double precision)
language sql stable security definer set search_path = public, extensions as $$
  select e.property_id, max(1 - (e.embedding <=> p_embedding)) as similarity
  from public.ai_embeddings e
  join public.properties p on p.id = e.property_id
  where p.status = 'published' and public.property_matches_filters(p, coalesce(p_filters, '{}'::jsonb))
  group by e.property_id
  order by similarity desc
  limit least(greatest(p_limit, 1), 50)
$$;

-- ===========================================================================
-- Indicative valuation from comparables (no AI guesswork)
-- ===========================================================================
create or replace function public.estimate_property_value(
  p_city text, p_district text, p_property_type public.property_type, p_area_m2 numeric,
  p_listing_type public.listing_type default 'sale'
) returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_scope text := 'district';
  v_n int;
  v_p25 numeric; v_p50 numeric; v_p75 numeric;
begin
  if p_area_m2 is null or p_area_m2 <= 0 then
    raise exception 'area_required' using errcode = '22023';
  end if;
  select count(*), percentile_cont(0.25) within group (order by price / area_m2),
         percentile_cont(0.5) within group (order by price / area_m2),
         percentile_cont(0.75) within group (order by price / area_m2)
    into v_n, v_p25, v_p50, v_p75
  from public.properties
  where status in ('published', 'sold', 'rented') and area_m2 > 0
    and property_type = p_property_type and listing_type = p_listing_type
    and extensions.unaccent(city) ilike extensions.unaccent(p_city)
    and p_district is not null and extensions.unaccent(coalesce(district, '')) ilike extensions.unaccent(p_district);

  if v_n < 3 then
    v_scope := 'city';
    select count(*), percentile_cont(0.25) within group (order by price / area_m2),
           percentile_cont(0.5) within group (order by price / area_m2),
           percentile_cont(0.75) within group (order by price / area_m2)
      into v_n, v_p25, v_p50, v_p75
    from public.properties
    where status in ('published', 'sold', 'rented') and area_m2 > 0
      and property_type = p_property_type and listing_type = p_listing_type
      and extensions.unaccent(city) ilike extensions.unaccent(p_city);
  end if;

  if v_n < 3 then
    return jsonb_build_object('available', false, 'comparables', v_n);
  end if;

  return jsonb_build_object(
    'available', true,
    'low', round(v_p25 * p_area_m2, -4),
    'median', round(v_p50 * p_area_m2, -4),
    'high', round(v_p75 * p_area_m2, -4),
    'price_per_m2', round(v_p50),
    'comparables', v_n,
    'scope', v_scope,
    'confidence', case when v_n >= 15 then 'high' when v_n >= 6 then 'medium' else 'low' end
  );
end $$;

-- ===========================================================================
-- Transactions & commissions
-- ===========================================================================
create or replace function public.compute_commission(
  p_type public.transaction_type, p_property_type public.property_type, p_amount bigint, p_monthly_rent bigint
) returns table (rule_id uuid, rate numeric, amount bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  r public.commission_rules;
  v_amount numeric;
begin
  select * into r from public.commission_rules c
  where c.is_active and c.transaction_type = p_type
    and (c.property_type is null or c.property_type = p_property_type)
    and c.valid_from <= now() and (c.valid_to is null or c.valid_to > now())
  order by (c.property_type is not null) desc, c.priority desc, c.created_at desc
  limit 1;
  if not found then
    return;
  end if;
  v_amount := case r.method
    when 'percentage' then p_amount * r.rate
    when 'fixed' then r.fixed_amount
    when 'rent_fraction' then coalesce(p_monthly_rent, p_amount) * r.rent_fraction
  end;
  if r.min_amount is not null then v_amount := greatest(v_amount, r.min_amount); end if;
  if r.max_amount is not null then v_amount := least(v_amount, r.max_amount); end if;
  return query select r.id, r.rate, round(v_amount)::bigint;
end $$;

/**
 * Declare a transaction. The declarer's side is auto-confirmed; the other
 * party must confirm before the transaction is completed.
 * - Buyer/tenant: p_counterparty_id is ignored (seller = listing owner).
 * - Owner/agency: p_counterparty_id is the buyer and must be an existing lead.
 */
create or replace function public.declare_transaction(
  p_property_id uuid, p_type public.transaction_type, p_amount bigint, p_counterparty_id uuid default null
) returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prop public.properties;
  v_tx public.transactions;
  v_is_seller boolean;
  v_buyer uuid;
  v_lead uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  select * into v_prop from public.properties where id = p_property_id and status in ('published', 'sold', 'rented');
  if not found then
    raise exception 'property_not_found' using errcode = 'P0002';
  end if;
  if (p_type = 'sale' and v_prop.listing_type = 'rent') or (p_type = 'rent' and v_prop.listing_type <> 'rent') then
    raise exception 'type_mismatch' using errcode = '22023';
  end if;

  v_is_seller := public.can_manage_property(p_property_id) and not public.is_admin();
  v_buyer := case when v_is_seller then p_counterparty_id else v_uid end;
  if v_buyer is null then
    raise exception 'counterparty_required' using errcode = '22023';
  end if;
  select id into v_lead from public.property_leads where property_id = p_property_id and buyer_id = v_buyer;
  if v_is_seller and v_lead is null then
    raise exception 'counterparty_not_a_lead' using errcode = '22023';
  end if;

  insert into public.transactions (
    property_id, buyer_id, seller_id, agency_id, lead_id, transaction_type, amount, monthly_rent,
    confirmed_by_buyer, confirmed_by_seller, buyer_confirmed_at, seller_confirmed_at, declared_by
  ) values (
    p_property_id, v_buyer, v_prop.owner_id, v_prop.agency_id, v_lead, p_type, p_amount,
    case when p_type = 'rent' then p_amount end,
    not v_is_seller, v_is_seller,
    case when not v_is_seller then now() end, case when v_is_seller then now() end,
    v_uid
  ) returning * into v_tx;

  perform public.notify(case when v_is_seller then v_buyer else v_prop.owner_id end,
    'transaction_declared', 'Transaction à confirmer',
    'Cette transaction a-t-elle été finalisée ?',
    jsonb_build_object('transaction_id', v_tx.id, 'property_id', p_property_id));
  perform public.audit('declare', 'transaction', v_tx.id::text,
    jsonb_build_object('amount', p_amount, 'type', p_type, 'by', case when v_is_seller then 'seller' else 'buyer' end));
  return v_tx;
end $$;

create or replace function public.confirm_transaction(p_transaction_id uuid, p_confirm boolean, p_reason text default null)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tx public.transactions;
  v_prop public.properties;
  v_side text;
  v_c record;
begin
  select * into v_tx from public.transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'transaction_not_found' using errcode = 'P0002';
  end if;
  if v_tx.status not in ('pending', 'confirmed') then
    raise exception 'transaction_closed' using errcode = '22023';
  end if;
  v_side := case
    when v_uid = v_tx.buyer_id then 'buyer'
    when v_uid = v_tx.seller_id or (v_tx.agency_id is not null and v_tx.agency_id = public.user_agency_id()) then 'seller'
  end;
  if v_side is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not p_confirm then
    update public.transactions set status = 'disputed', dispute_reason = left(p_reason, 1000)
    where id = v_tx.id returning * into v_tx;
    perform public.audit('dispute', 'transaction', v_tx.id::text, jsonb_build_object('side', v_side, 'reason', p_reason));
    return v_tx;
  end if;

  if v_side = 'buyer' then
    update public.transactions set confirmed_by_buyer = true, buyer_confirmed_at = now()
    where id = v_tx.id returning * into v_tx;
  else
    update public.transactions set confirmed_by_seller = true, seller_confirmed_at = now()
    where id = v_tx.id returning * into v_tx;
  end if;

  if v_tx.confirmed_by_buyer and v_tx.confirmed_by_seller then
    select * into v_prop from public.properties where id = v_tx.property_id;
    select * into v_c from public.compute_commission(v_tx.transaction_type, v_prop.property_type, v_tx.amount, v_tx.monthly_rent);

    update public.transactions set
      status = 'completed', completed_at = now(),
      commission_rule_id = v_c.rule_id, commission_rate = v_c.rate, commission_amount = v_c.amount
    where id = v_tx.id returning * into v_tx;

    if v_c.amount is not null then
      insert into public.commission_payments (transaction_id, payer_id, amount, due_date)
      values (v_tx.id,
        case when coalesce(public.setting('commission_payer') #>> '{}', 'seller') = 'buyer' then v_tx.buyer_id else v_tx.seller_id end,
        v_c.amount, (now() + interval '30 days')::date);
    end if;

    perform set_config('imora.bypass_guard', 'on', true);
    update public.properties
      set status = case when v_tx.transaction_type = 'sale' then 'sold'::public.property_status else 'rented'::public.property_status end
    where id = v_tx.property_id;
    update public.property_leads set status = 'converted', last_activity_at = now()
    where property_id = v_tx.property_id and buyer_id = v_tx.buyer_id;
    perform set_config('imora.bypass_guard', '', true);

    perform public.notify(v_tx.buyer_id, 'transaction_completed', 'Transaction finalisée', null,
      jsonb_build_object('transaction_id', v_tx.id));
    perform public.notify(v_tx.seller_id, 'transaction_completed', 'Transaction finalisée', null,
      jsonb_build_object('transaction_id', v_tx.id, 'commission_amount', v_c.amount));
  end if;

  perform public.audit('confirm', 'transaction', v_tx.id::text, jsonb_build_object('side', v_side, 'status', v_tx.status));
  return v_tx;
end $$;

-- ===========================================================================
-- Verifications (admin)
-- ===========================================================================
create or replace function public.review_verification(p_verification_id uuid, p_approve boolean, p_notes text default null)
returns public.verifications language plpgsql security definer set search_path = public as $$
declare
  v public.verifications;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.verifications set
    status = case when p_approve then 'approved'::public.verification_status else 'rejected'::public.verification_status end,
    notes = p_notes, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_verification_id returning * into v;
  if not found then
    raise exception 'verification_not_found' using errcode = 'P0002';
  end if;

  perform set_config('imora.bypass_guard', 'on', true);
  case v.subject_type
    when 'property' then update public.properties set is_verified = p_approve where id = v.subject_id;
    when 'documents' then update public.properties set documents_verified = p_approve where id = v.subject_id;
    when 'agency' then update public.agencies set is_verified = p_approve where id = v.subject_id;
    when 'developer' then update public.developers set is_verified = p_approve where id = v.subject_id;
    when 'tour' then update public.property_3d_tours set is_verified = p_approve where id = v.subject_id;
    when 'owner' then
      update public.profiles set is_verified = p_approve where id = v.subject_id;
      update public.owners set kyc_status = v.status, verified_at = case when p_approve then now() end
      where profile_id = v.subject_id;
  end case;
  perform set_config('imora.bypass_guard', '', true);

  perform public.audit(case when p_approve then 'approve' else 'reject' end, 'verification', v.id::text,
    jsonb_build_object('subject_type', v.subject_type, 'subject_id', v.subject_id));
  if v.requested_by is not null then
    perform public.notify(v.requested_by, 'verification_' || v.status::text, 'Vérification mise à jour', p_notes,
      jsonb_build_object('verification_id', v.id, 'subject_type', v.subject_type));
  end if;
  return v;
end $$;

create or replace function public.moderate_property(p_property_id uuid, p_status public.property_status, p_reason text default null)
returns public.properties language plpgsql security definer set search_path = public as $$
declare
  v_prop public.properties;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.properties set status = p_status where id = p_property_id returning * into v_prop;
  perform public.audit('moderate', 'property', p_property_id::text, jsonb_build_object('status', p_status, 'reason', p_reason));
  perform public.notify(v_prop.owner_id, 'listing_' || p_status::text, 'Annonce mise à jour', p_reason,
    jsonb_build_object('property_id', p_property_id));
  return v_prop;
end $$;

-- ===========================================================================
-- Analytics
-- ===========================================================================
/** Listing performance for an owner (p_agency_id null) or an agency, last p_days days. */
create or replace function public.listing_stats(p_agency_id uuid default null, p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_since timestamptz := now() - make_interval(days => least(greatest(p_days, 1), 365));
  v_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_agency_id is not null then
    if p_agency_id is distinct from public.user_agency_id() and not public.is_admin() then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    select array_agg(id) into v_ids from public.properties where agency_id = p_agency_id;
  else
    select array_agg(id) into v_ids from public.properties where owner_id = auth.uid();
  end if;
  v_ids := coalesce(v_ids, '{}');

  return jsonb_build_object(
    'listings', (select count(*) from public.properties where id = any (v_ids) and status = 'published'),
    'views', (select count(*) from public.property_views where property_id = any (v_ids) and created_at >= v_since),
    'favorites', (select count(*) from public.favorites where property_id = any (v_ids) and created_at >= v_since),
    'phone_reveals', (select count(*) from public.property_contact_events where property_id = any (v_ids) and event_type = 'phone_reveal' and created_at >= v_since),
    'calls', (select count(*) from public.property_contact_events where property_id = any (v_ids) and event_type = 'call_click' and created_at >= v_since),
    'whatsapp', (select count(*) from public.property_contact_events where property_id = any (v_ids) and event_type = 'whatsapp_click' and created_at >= v_since),
    'messages', (select count(*) from public.property_contact_events where property_id = any (v_ids) and event_type = 'message_sent' and created_at >= v_since),
    'leads', (select count(*) from public.property_leads where property_id = any (v_ids) and created_at >= v_since),
    'visits', (select count(*) from public.visits where property_id = any (v_ids) and created_at >= v_since),
    'conversions', (select count(*) from public.property_leads where property_id = any (v_ids) and status = 'converted' and last_activity_at >= v_since)
  );
end $$;

create or replace function public.admin_kpis(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_since timestamptz := now() - make_interval(days => least(greatest(p_days, 1), 3650));
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'new_users', (select count(*) from public.profiles where created_at >= v_since),
    'properties', (select count(*) from public.properties),
    'active_listings', (select count(*) from public.properties where status = 'published'),
    'verified_listings', (select count(*) from public.properties where status = 'published' and is_verified),
    'pending_review', (select count(*) from public.properties where status = 'pending_review'),
    'open_reports', (select count(*) from public.reports where status in ('open', 'reviewing')),
    'pending_verifications', (select count(*) from public.verifications where status = 'pending'),
    'leads', (select count(*) from public.property_leads where created_at >= v_since),
    'visits', (select count(*) from public.visits where created_at >= v_since),
    'sales', (select count(*) from public.transactions where status = 'completed' and transaction_type = 'sale' and completed_at >= v_since),
    'rentals', (select count(*) from public.transactions where status = 'completed' and transaction_type = 'rent' and completed_at >= v_since),
    'transaction_volume', (select coalesce(sum(amount), 0) from public.transactions where status = 'completed' and completed_at >= v_since),
    'commissions_total', (select coalesce(sum(commission_amount), 0) from public.transactions where status = 'completed' and completed_at >= v_since),
    'commissions_paid', (select coalesce(sum(amount), 0) from public.commission_payments where status = 'paid' and paid_at >= v_since),
    'commissions_unpaid', (select coalesce(sum(amount), 0) from public.commission_payments where status in ('unpaid', 'pending')),
    'disputes', (select count(*) from public.transactions where status = 'disputed'),
    'subscription_revenue', (select coalesce(sum(amount), 0) from public.payments where status = 'succeeded' and subscription_id is not null and created_at >= v_since)
  );
end $$;

-- ===========================================================================
-- Audit triggers on sensitive tables
-- ===========================================================================
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, data)
  values (auth.uid(), lower(tg_op), tg_table_name, coalesce(new.id, old.id)::text,
          case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return null;
end $$;

create trigger audit_commission_rules after insert or update or delete on public.commission_rules
  for each row execute function public.audit_row_change();
create trigger audit_commission_payments after update on public.commission_payments
  for each row execute function public.audit_row_change();
create trigger audit_reports after update on public.reports
  for each row execute function public.audit_row_change();
