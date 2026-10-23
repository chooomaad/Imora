-- Imora — engagement: favorites, searches, comparisons, views, leads, contact, messaging, visits, notifications.

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, property_id)
);
create index favorites_property_idx on public.favorites (property_id);

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  filters jsonb not null,
  notify boolean not null default true,
  last_notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index saved_searches_user_idx on public.saved_searches (user_id);

create table public.comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text,
  property_ids uuid[] not null check (array_length(property_ids, 1) between 1 and 4),
  created_at timestamptz not null default now()
);
create index comparisons_user_idx on public.comparisons (user_id);

create table public.property_views (
  id bigint generated always as identity primary key,
  property_id uuid not null references public.properties (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  session_id text,
  source text, -- home, explorer, map, recommendation, share...
  created_at timestamptz not null default now()
);
create index property_views_property_idx on public.property_views (property_id, created_at desc);
create index property_views_user_idx on public.property_views (user_id, created_at desc);

create table public.property_contact_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  agency_id uuid references public.agencies (id) on delete set null,
  event_type public.contact_event_type not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index contact_events_property_idx on public.property_contact_events (property_id, created_at desc);
create index contact_events_owner_idx on public.property_contact_events (owner_id, created_at desc);
create index contact_events_user_idx on public.property_contact_events (user_id, event_type, created_at desc);

create table public.property_leads (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  agency_id uuid references public.agencies (id) on delete set null,
  source public.lead_source not null,
  status public.lead_status not null default 'new',
  notes text,
  interactions_count integer not null default 1,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (property_id, buyer_id)
);
create index property_leads_owner_idx on public.property_leads (owner_id, status, last_activity_at desc);
create index property_leads_agency_idx on public.property_leads (agency_id, status, last_activity_at desc);

-- ---------------------------------------------------------------------------
-- Messaging (Supabase Realtime)
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  counterpart_id uuid not null references public.profiles (id) on delete cascade, -- owner or agent
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz not null default now(),
  unique (property_id, client_id, counterpart_id),
  check (client_id <> counterpart_id)
);
create index conversations_client_idx on public.conversations (client_id, last_message_at desc);
create index conversations_counterpart_idx on public.conversations (counterpart_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text check (char_length(body) <= 4000),
  attachment_path text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (body is not null or attachment_path is not null)
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Physical visits
-- ---------------------------------------------------------------------------
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  agency_id uuid references public.agencies (id) on delete set null,
  date date not null,
  time time not null,
  status public.visit_status not null default 'requested',
  notes text check (char_length(notes) <= 1000),
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger visits_updated_at before update on public.visits
  for each row execute function public.set_updated_at();
-- One active booking per slot and per property
create unique index visits_slot_unique on public.visits (property_id, date, time)
  where status in ('requested', 'confirmed');
create index visits_owner_idx on public.visits (owner_id, date);
create index visits_user_idx on public.visits (user_id, date);

-- ---------------------------------------------------------------------------
-- In-app notifications (also fanned out to Expo push / email by edge functions)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null, -- visit_requested, visit_confirmed, new_message, new_lead, saved_search_match, transaction_*
  title text not null,
  body text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now()
);
