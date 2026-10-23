-- Imora — Row Level Security.
-- Principle: reads are scoped by policy; sensitive writes go through
-- SECURITY DEFINER functions (see 0006) and have no direct write policy.

do $$
declare t text;
begin
  foreach t in array array[
    'app_settings','profiles','profile_contacts','owners','agencies','agents','agency_reviews',
    'developers','projects','project_units','properties','property_locations','property_features',
    'property_media','property_price_history','property_nearby','property_3d_tours','property_floor_plans',
    'property_rooms','property_360_scenes','property_hotspots','favorites','saved_searches','comparisons',
    'property_views','property_contact_events','property_leads','conversations','messages','visits',
    'notifications','push_tokens','verifications','property_documents','reports','audit_logs',
    'commission_rules','transactions','commission_payments','subscription_plans','subscriptions','payments',
    'ai_searches','ai_embeddings','ai_recommendations','ai_conversations','ai_suggestions','ai_usage'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Extra helpers used by policies --------------------------------------------
create or replace function public.can_view_tour(p_tour_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.property_3d_tours t
    join public.properties p on p.id = t.property_id
    where t.id = p_tour_id and t.status = 'published' and p.status = 'published'
  ) or public.can_manage_property(public.tour_property_id(p_tour_id))
$$;

create or replace function public.can_manage_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects pr
    join public.developers d on d.id = pr.developer_id
    where pr.id = p_project_id and d.profile_id = auth.uid()
  ) or public.is_admin()
$$;

-- Guard platform-owned columns on organizations
create or replace function public.guard_org_columns()
returns trigger language plpgsql as $$
begin
  if public.is_privileged_context() then
    return new;
  end if;
  new.is_verified := old.is_verified;
  if tg_table_name = 'agencies' then
    new.rating_avg := old.rating_avg;
    new.rating_count := old.rating_count;
    new.is_demo := old.is_demo;
  end if;
  return new;
end $$;
create trigger agencies_guard before update on public.agencies for each row execute function public.guard_org_columns();
create trigger developers_guard before update on public.developers for each row execute function public.guard_org_columns();

-- Keep agency rating in sync with reviews
create or replace function public.refresh_agency_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_agency uuid := coalesce(new.agency_id, old.agency_id);
begin
  perform set_config('imora.bypass_guard', 'on', true);
  update public.agencies a set
    rating_avg = coalesce((select round(avg(rating), 1) from public.agency_reviews where agency_id = v_agency), 0),
    rating_count = (select count(*) from public.agency_reviews where agency_id = v_agency)
  where a.id = v_agency;
  perform set_config('imora.bypass_guard', '', true);
  return null;
end $$;
create trigger agency_reviews_rating after insert or update or delete on public.agency_reviews
  for each row execute function public.refresh_agency_rating();

-- Settings & plans -----------------------------------------------------------
create policy "settings readable" on public.app_settings for select using (true);
create policy "settings admin" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

create policy "plans readable" on public.subscription_plans for select using (true);
create policy "plans admin" on public.subscription_plans for all using (public.is_admin()) with check (public.is_admin());

-- Profiles -------------------------------------------------------------------
create policy "profiles public read" on public.profiles for select using (true);
create policy "profiles self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles admin" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- Phone numbers: owner of the row and admins only. Everyone else goes through reveal_contact().
create policy "contacts self" on public.profile_contacts for select using (profile_id = auth.uid() or public.is_admin());
create policy "contacts self update" on public.profile_contacts for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "owners self" on public.owners for select using (profile_id = auth.uid() or public.is_admin());

-- Agencies, agents, reviews --------------------------------------------------
create policy "agencies public read" on public.agencies for select using (true);
create policy "agencies admin update" on public.agencies for update using (public.is_agency_admin(id)) with check (public.is_agency_admin(id));
create policy "agencies admin all" on public.agencies for all using (public.is_admin()) with check (public.is_admin());

create policy "agents public read" on public.agents for select using (is_active or public.is_agency_admin(agency_id));
create policy "agents manage" on public.agents for update using (public.is_agency_admin(agency_id)) with check (public.is_agency_admin(agency_id));
create policy "agents remove" on public.agents for delete using (public.is_agency_admin(agency_id) and profile_id <> auth.uid());

create policy "reviews public read" on public.agency_reviews for select using (true);
create policy "reviews own insert" on public.agency_reviews for insert to authenticated with check (author_id = auth.uid());
create policy "reviews own update" on public.agency_reviews for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "reviews own delete" on public.agency_reviews for delete using (author_id = auth.uid() or public.is_admin());

-- Developers & projects ------------------------------------------------------
create policy "developers public read" on public.developers for select using (true);
create policy "developers self update" on public.developers for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "developers admin" on public.developers for all using (public.is_admin()) with check (public.is_admin());

create policy "projects read" on public.projects for select using (is_published or public.can_manage_project(id));
create policy "projects insert" on public.projects for insert to authenticated with check (developer_id = public.user_developer_id());
create policy "projects update" on public.projects for update using (public.can_manage_project(id)) with check (public.can_manage_project(id));
create policy "projects delete" on public.projects for delete using (public.can_manage_project(id));

create policy "units read" on public.project_units for select
  using (exists (select 1 from public.projects p where p.id = project_id and p.is_published) or public.can_manage_project(project_id));
create policy "units write" on public.project_units for all
  using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));

-- Properties -----------------------------------------------------------------
create policy "properties read" on public.properties for select
  using (status = 'published' or owner_id = auth.uid() or (agency_id is not null and agency_id = public.user_agency_id()) or public.is_admin());
-- The guard trigger checks the role, forces owner_id and moderation status.
create policy "properties insert" on public.properties for insert to authenticated with check (owner_id = auth.uid());
create policy "properties update" on public.properties for update using (public.can_manage_property(id)) with check (public.can_manage_property(id));
create policy "properties delete" on public.properties for delete using (public.can_manage_property(id) and status in ('draft', 'rejected', 'archived'));

-- Exact coordinates are private to managers; the public reads them through RPCs.
create policy "locations managers" on public.property_locations for select using (public.can_manage_property(property_id));
create policy "locations delete" on public.property_locations for delete using (public.can_manage_property(property_id));

create policy "features read" on public.property_features for select using (public.can_view_property(property_id));
create policy "features write" on public.property_features for all using (public.can_manage_property(property_id)) with check (public.can_manage_property(property_id));

create policy "media read" on public.property_media for select using (public.can_view_property(property_id));
create policy "media write" on public.property_media for all using (public.can_manage_property(property_id)) with check (public.can_manage_property(property_id));

create policy "nearby read" on public.property_nearby for select using (public.can_view_property(property_id));
create policy "nearby write" on public.property_nearby for all using (public.can_manage_property(property_id)) with check (public.can_manage_property(property_id));

create policy "price history read" on public.property_price_history for select using (public.can_view_property(property_id));

-- Tours ----------------------------------------------------------------------
create policy "tours read" on public.property_3d_tours for select using (public.can_view_tour(id));
create policy "tours write" on public.property_3d_tours for all using (public.can_manage_property(property_id)) with check (public.can_manage_property(property_id));

create policy "plans read" on public.property_floor_plans for select using (public.can_view_tour(tour_id));
create policy "plans write" on public.property_floor_plans for all
  using (public.can_manage_property(public.tour_property_id(tour_id))) with check (public.can_manage_property(public.tour_property_id(tour_id)));

create policy "rooms read" on public.property_rooms for select using (public.can_view_tour(tour_id));
create policy "rooms write" on public.property_rooms for all
  using (public.can_manage_property(public.tour_property_id(tour_id))) with check (public.can_manage_property(public.tour_property_id(tour_id)));

create policy "scenes read" on public.property_360_scenes for select using (public.can_view_tour(tour_id));
create policy "scenes write" on public.property_360_scenes for all
  using (public.can_manage_property(public.tour_property_id(tour_id))) with check (public.can_manage_property(public.tour_property_id(tour_id)));

create policy "hotspots read" on public.property_hotspots for select
  using (public.can_view_tour((select tour_id from public.property_360_scenes where id = scene_id)));
create policy "hotspots write" on public.property_hotspots for all
  using (public.can_manage_property(public.scene_property_id(scene_id))) with check (public.can_manage_property(public.scene_property_id(scene_id)));

-- User collections -----------------------------------------------------------
create policy "favorites own" on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "saved searches own" on public.saved_searches for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "comparisons own" on public.comparisons for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Analytics / leads (read only; written by functions) -------------------------
create policy "views managers" on public.property_views for select using (public.can_manage_property(property_id));
create policy "contact events read" on public.property_contact_events for select
  using (user_id = auth.uid() or owner_id = auth.uid() or (agency_id is not null and agency_id = public.user_agency_id()) or public.is_admin());
create policy "leads read" on public.property_leads for select
  using (owner_id = auth.uid() or (agency_id is not null and agency_id = public.user_agency_id()) or public.is_admin());

-- Messaging ------------------------------------------------------------------
create policy "conversations participants" on public.conversations for select
  using (auth.uid() in (client_id, counterpart_id) or public.is_admin());
create policy "messages participants read" on public.messages for select
  using (exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.client_id, c.counterpart_id)));
create policy "messages participants send" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and read_at is null and
    exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.client_id, c.counterpart_id)));

-- Visits ---------------------------------------------------------------------
create policy "visits read" on public.visits for select
  using (user_id = auth.uid() or owner_id = auth.uid() or (agency_id is not null and agency_id = public.user_agency_id()) or public.is_admin());

-- Notifications --------------------------------------------------------------
create policy "notifications own read" on public.notifications for select using (user_id = auth.uid());
create policy "notifications own update" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications own delete" on public.notifications for delete using (user_id = auth.uid());
create policy "push tokens own" on public.push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Trust ----------------------------------------------------------------------
create or replace function public.can_request_verification(p_subject public.verification_subject, p_subject_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_subject
    when 'owner' then p_subject_id = auth.uid()
    when 'property' then public.can_manage_property(p_subject_id)
    when 'documents' then public.can_manage_property(p_subject_id)
    when 'tour' then public.can_manage_property(public.tour_property_id(p_subject_id))
    when 'agency' then public.is_agency_admin(p_subject_id)
    when 'developer' then exists (select 1 from public.developers where id = p_subject_id and profile_id = auth.uid())
  end
$$;

create policy "verifications read" on public.verifications for select using (requested_by = auth.uid() or public.is_admin());
create policy "verifications request" on public.verifications for insert to authenticated
  with check (requested_by = auth.uid() and status = 'pending' and reviewed_by is null
              and public.can_request_verification(subject_type, subject_id));

create policy "documents read" on public.property_documents for select
  using (uploaded_by = auth.uid() or public.can_manage_property(property_id));
create policy "documents upload" on public.property_documents for insert to authenticated
  with check (uploaded_by = auth.uid() and status = 'pending' and public.can_manage_property(property_id));
create policy "documents delete" on public.property_documents for delete using (uploaded_by = auth.uid() and status = 'pending');
create policy "documents admin" on public.property_documents for all using (public.is_admin()) with check (public.is_admin());

create policy "reports insert" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open' and resolved_by is null);
create policy "reports read" on public.reports for select using (reporter_id = auth.uid() or public.is_admin());
create policy "reports admin" on public.reports for update using (public.is_admin()) with check (public.is_admin());

create policy "audit admin" on public.audit_logs for select using (public.is_admin());

-- Business -------------------------------------------------------------------
create policy "commission rules admin" on public.commission_rules for all using (public.is_admin()) with check (public.is_admin());

create policy "transactions parties" on public.transactions for select
  using (auth.uid() in (buyer_id, seller_id) or (agency_id is not null and agency_id = public.user_agency_id()) or public.is_admin());
create policy "transactions admin" on public.transactions for update using (public.is_admin()) with check (public.is_admin());

create policy "commission payments read" on public.commission_payments for select using (payer_id = auth.uid() or public.is_admin());
create policy "commission payments admin" on public.commission_payments for update using (public.is_admin()) with check (public.is_admin());

create policy "subscriptions read" on public.subscriptions for select using (
  profile_id = auth.uid()
  or (agency_id is not null and public.is_agency_admin(agency_id))
  or developer_id = public.user_developer_id()
  or public.is_admin());
create policy "subscriptions admin" on public.subscriptions for all using (public.is_admin()) with check (public.is_admin());

create policy "payments read" on public.payments for select using (payer_id = auth.uid() or public.is_admin());
create policy "payments admin" on public.payments for all using (public.is_admin()) with check (public.is_admin());

-- AI -------------------------------------------------------------------------
-- ai_embeddings and ai_usage: no policy => only the service role (edge functions) can access them.
create policy "ai searches own" on public.ai_searches for select using (user_id = auth.uid() or public.is_admin());
create policy "ai recommendations own" on public.ai_recommendations for select using (user_id = auth.uid());
create policy "ai conversations own" on public.ai_conversations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai suggestions managers read" on public.ai_suggestions for select using (public.can_manage_property(property_id));
create policy "ai suggestions managers review" on public.ai_suggestions for update
  using (public.can_manage_property(property_id)) with check (public.can_manage_property(property_id));

-- Function privileges --------------------------------------------------------
revoke execute on function public.match_properties_by_embedding(extensions.vector, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.notify(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.audit(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.refresh_property_media_flags(uuid) from public, anon, authenticated;
grant execute on function public.match_properties_by_embedding(extensions.vector, integer, jsonb) to service_role;

-- Realtime -------------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.conversations, public.notifications;

-- Business phone numbers are only handed out through reveal_contact() (which records a lead):
-- hide the columns from the API roles even though the rows are public.
revoke select on public.agencies from anon, authenticated;
grant select (id, slug, name, name_ar, logo_url, cover_url, description, description_ar, city, address, email, website,
  is_verified, rating_avg, rating_count, avg_response_minutes, created_by, is_demo, created_at, updated_at)
  on public.agencies to anon, authenticated;
revoke select on public.developers from anon, authenticated;
grant select (id, profile_id, slug, company_name, logo_url, description, website, is_verified, is_demo, created_at, updated_at)
  on public.developers to anon, authenticated;
