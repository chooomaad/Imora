-- Imora — AI tables. The model never touches these directly: edge functions
-- (service role) write them after validating model output.

create table public.ai_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  query text not null check (char_length(query) <= 1000),
  extracted_filters jsonb not null,
  interpretation text,
  result_count integer,
  model text,
  created_at timestamptz not null default now()
);
create index ai_searches_user_idx on public.ai_searches (user_id, created_at desc);

-- Multimodal embedding space (voyage-multimodal-3, 1024 dims): property text,
-- property photos and user query photos live in the same space so text->image
-- and image->image similarity both work.
create table public.ai_embeddings (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('property_text', 'property_image')),
  property_id uuid not null references public.properties (id) on delete cascade,
  media_id uuid references public.property_media (id) on delete cascade,
  model text not null,
  content_hash text not null,
  embedding extensions.vector(1024) not null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (entity_type, property_id, media_id)
);
create index ai_embeddings_hnsw on public.ai_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);
create index ai_embeddings_property_idx on public.ai_embeddings (property_id);

create table public.ai_recommendations (
  user_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  score numeric not null,
  reasons text[] not null default '{}',
  generated_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  messages jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Vision / description suggestions awaiting owner review. Nothing here is
-- applied to a listing until the owner accepts or edits it.
create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  media_id uuid references public.property_media (id) on delete cascade,
  kind text not null check (kind in ('description', 'room_detection', 'features', 'title')),
  suggestion jsonb not null,
  final_value jsonb,
  status public.suggestion_status not null default 'pending',
  model text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index ai_suggestions_property_idx on public.ai_suggestions (property_id, status);

-- Simple per-user rate limiting for paid AI calls
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete cascade,
  ip_hash text,
  feature text not null,
  created_at timestamptz not null default now()
);
create index ai_usage_user_idx on public.ai_usage (user_id, feature, created_at desc);
create index ai_usage_ip_idx on public.ai_usage (ip_hash, feature, created_at desc);
