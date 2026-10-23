-- Imora — core tables: profiles, organizations, properties and their media/tours.

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- App settings (configurable from the admin; never hard-coded in the apps)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  role public.app_role not null default 'client',
  role_selected boolean not null default false,
  preferred_locale text not null default 'fr' check (preferred_locale in ('fr', 'ar', 'en')),
  is_verified boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Private contact data. Never exposed through a public policy: phone numbers
-- are only handed out by the reveal_contact() function, which logs a lead.
create table public.profile_contacts (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  phone text,
  whatsapp text,
  email text,
  updated_at timestamptz not null default now()
);
create trigger profile_contacts_updated_at before update on public.profile_contacts
  for each row execute function public.set_updated_at();

-- Owner extension (KYC state for private sellers/landlords)
create table public.owners (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  kyc_status public.verification_status not null default 'pending',
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Agencies & agents
-- ---------------------------------------------------------------------------
create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_ar text,
  logo_url text,
  cover_url text,
  description text,
  description_ar text,
  city text,
  address text,
  phone text,
  whatsapp text,
  email text,
  website text,
  is_verified boolean not null default false,
  rating_avg numeric(2, 1) not null default 0,
  rating_count integer not null default 0,
  avg_response_minutes integer,
  created_by uuid references public.profiles (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger agencies_updated_at before update on public.agencies
  for each row execute function public.set_updated_at();

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  is_agency_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (profile_id)
);
create index agents_agency_idx on public.agents (agency_id);

create table public.agency_reviews (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (agency_id, author_id)
);

-- ---------------------------------------------------------------------------
-- Developers (promoteurs) & projects
-- ---------------------------------------------------------------------------
create table public.developers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  slug text not null unique,
  company_name text not null,
  logo_url text,
  description text,
  phone text,
  website text,
  is_verified boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger developers_updated_at before update on public.developers
  for each row execute function public.set_updated_at();

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developers (id) on delete cascade,
  slug text not null unique,
  name text not null,
  name_ar text,
  description text,
  description_ar text,
  city text not null,
  district text,
  location extensions.geography(point, 4326),
  cover_url text,
  gallery text[] not null default '{}',
  status public.project_status not null default 'planned',
  delivery_date date,
  progress_pct smallint not null default 0 check (progress_pct between 0 and 100),
  price_from bigint,
  is_published boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create index projects_location_gix on public.projects using gist (location);

create table public.project_units (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  label text not null,
  unit_type public.property_type not null default 'apartment',
  floor smallint,
  bedrooms smallint,
  bathrooms smallint,
  area_m2 numeric(8, 2),
  price bigint,
  status public.unit_status not null default 'available',
  plan_url text,
  created_at timestamptz not null default now()
);
create index project_units_project_idx on public.project_units (project_id);

-- ---------------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------------
create sequence public.property_reference_seq start 100;

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('DR-' || nextval('public.property_reference_seq')),
  slug text not null unique,
  title text not null,
  title_ar text,
  description text,
  description_ar text,
  listing_type public.listing_type not null,
  property_type public.property_type not null,
  status public.property_status not null default 'draft',

  price bigint not null check (price >= 0),
  price_period public.price_period not null default 'total',
  price_negotiable boolean not null default false,
  notary_fees_estimate bigint,

  owner_id uuid not null references public.profiles (id) on delete restrict,
  agency_id uuid references public.agencies (id) on delete set null,
  agent_id uuid references public.agents (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,

  city text not null,
  district text,
  address text,

  bedrooms smallint check (bedrooms >= 0),
  bathrooms smallint check (bathrooms >= 0),
  area_m2 numeric(10, 2) check (area_m2 >= 0),
  land_area_m2 numeric(10, 2) check (land_area_m2 >= 0),
  parking_spaces smallint not null default 0,
  has_pool boolean not null default false,
  has_garden boolean not null default false,
  has_generator boolean not null default false,
  water_tank_liters integer,
  furnished boolean not null default false,
  year_built smallint,
  available_from date,

  -- Investment indicators (always presented as indicative estimates)
  estimated_yield numeric(4, 2),
  occupancy_rate numeric(5, 2),

  -- Trust & rich media flags maintained by triggers / admin
  is_verified boolean not null default false,
  documents_verified boolean not null default false,
  has_360 boolean not null default false,
  has_3d boolean not null default false,
  featured_until timestamptz,

  views_count integer not null default 0,
  favorites_count integer not null default 0,

  is_demo boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  search_tsv tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(district, '') || ' ' || coalesce(city, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(title_ar, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) stored
);
create trigger properties_updated_at before update on public.properties
  for each row execute function public.set_updated_at();

create index properties_status_idx on public.properties (status, published_at desc);
create index properties_search_idx on public.properties (listing_type, property_type, city, district) where status = 'published';
create index properties_price_idx on public.properties (price) where status = 'published';
create index properties_owner_idx on public.properties (owner_id);
create index properties_agency_idx on public.properties (agency_id);
create index properties_tsv_idx on public.properties using gin (search_tsv);
create index properties_title_trgm_idx on public.properties using gin (title extensions.gin_trgm_ops);

create table public.property_locations (
  property_id uuid primary key references public.properties (id) on delete cascade,
  geog extensions.geography(point, 4326) not null,
  -- When true the public map shows a ~150m-offset position (privacy of private owners)
  is_approximate boolean not null default false,
  updated_at timestamptz not null default now()
);
create index property_locations_gix on public.property_locations using gist (geog);

create table public.property_features (
  property_id uuid not null references public.properties (id) on delete cascade,
  feature_key text not null,
  value text,
  primary key (property_id, feature_key)
);

create table public.property_media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  kind public.media_kind not null default 'image',
  -- Either a storage object path (bucket/path) or an absolute URL for external/demo media
  storage_bucket text,
  storage_path text,
  url text,
  width integer,
  height integer,
  blurhash text,
  caption text,
  position smallint not null default 0,
  is_cover boolean not null default false,
  ai_tags jsonb,
  created_at timestamptz not null default now(),
  check (url is not null or (storage_bucket is not null and storage_path is not null))
);
create index property_media_property_idx on public.property_media (property_id, kind, position);
create unique index property_media_one_cover on public.property_media (property_id) where is_cover;

create table public.property_price_history (
  id bigint generated always as identity primary key,
  property_id uuid not null references public.properties (id) on delete cascade,
  price bigint not null,
  price_period public.price_period not null,
  changed_at timestamptz not null default now()
);
create index property_price_history_idx on public.property_price_history (property_id, changed_at desc);

-- Points of interest near a property ("École Française — 3 min en voiture")
create table public.property_nearby (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  category text not null, -- school, embassy, shop, mosque, hospital, beach...
  name text not null,
  travel_minutes smallint,
  travel_mode text not null default 'car' check (travel_mode in ('car', 'walk'))
);
create index property_nearby_idx on public.property_nearby (property_id);

-- ---------------------------------------------------------------------------
-- 3D / 360° tours
-- ---------------------------------------------------------------------------
create table public.property_3d_tours (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  title text not null default 'Visite virtuelle',
  status public.tour_status not null default 'draft',
  source public.tour_source not null default 'manual_360',
  -- Optional glTF/GLB model for the free 3D mode (photogrammetry, LiDAR, generated)
  model_url text,
  start_scene_id uuid,
  settings jsonb not null default '{}',
  is_verified boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger property_3d_tours_updated_at before update on public.property_3d_tours
  for each row execute function public.set_updated_at();
create index property_3d_tours_property_idx on public.property_3d_tours (property_id);

create table public.property_floor_plans (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.property_3d_tours (id) on delete cascade,
  level smallint not null default 0,
  name text not null,
  name_ar text,
  image_url text,
  scale_label text,
  width_m numeric(6, 2),
  depth_m numeric(6, 2),
  created_at timestamptz not null default now()
);
create index property_floor_plans_tour_idx on public.property_floor_plans (tour_id, level);

create table public.property_rooms (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.property_3d_tours (id) on delete cascade,
  floor_plan_id uuid references public.property_floor_plans (id) on delete set null,
  name text not null,
  name_ar text,
  room_type text, -- living, kitchen, bedroom, bathroom, dining, garage, patio, pool, terrace...
  area_m2 numeric(7, 2),
  length_m numeric(5, 2),
  width_m numeric(5, 2),
  ceiling_height_m numeric(4, 2),
  material text,
  -- normalized rectangle on the floor plan [x, y, w, h] in 0..1
  plan_rect numeric[] check (plan_rect is null or array_length(plan_rect, 1) = 4),
  position smallint not null default 0
);
create index property_rooms_tour_idx on public.property_rooms (tour_id);

create table public.property_360_scenes (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.property_3d_tours (id) on delete cascade,
  room_id uuid references public.property_rooms (id) on delete set null,
  name text not null,
  panorama_url text not null, -- equirectangular image (2:1)
  preview_url text,
  initial_yaw numeric(6, 2) not null default 0,
  initial_pitch numeric(6, 2) not null default 0,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create index property_360_scenes_tour_idx on public.property_360_scenes (tour_id, position);

alter table public.property_3d_tours
  add constraint property_3d_tours_start_scene_fk
  foreign key (start_scene_id) references public.property_360_scenes (id) on delete set null;

create table public.property_hotspots (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.property_360_scenes (id) on delete cascade,
  kind public.hotspot_kind not null default 'navigation',
  target_scene_id uuid references public.property_360_scenes (id) on delete cascade,
  yaw numeric(6, 2) not null,   -- degrees, 0 = panorama center, positive = right
  pitch numeric(6, 2) not null, -- degrees, positive = up
  label text,
  label_ar text,
  icon text,
  payload jsonb,
  check (kind <> 'navigation' or target_scene_id is not null)
);
create index property_hotspots_scene_idx on public.property_hotspots (scene_id);
