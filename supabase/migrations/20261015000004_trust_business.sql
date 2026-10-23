-- Imora — trust (verifications, documents, reports, audit) and business (transactions, commissions, subscriptions, payments).

create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  subject_type public.verification_subject not null,
  subject_id uuid not null,
  requested_by uuid references public.profiles (id) on delete set null,
  status public.verification_status not null default 'pending',
  notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index verifications_subject_idx on public.verifications (subject_type, subject_id);
create index verifications_status_idx on public.verifications (status, created_at);

-- Sensitive files live in the private "documents" bucket.
create table public.property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  doc_type public.document_type not null,
  storage_path text not null,
  status public.verification_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index property_documents_property_idx on public.property_documents (property_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid references public.properties (id) on delete cascade,
  agency_id uuid references public.agencies (id) on delete cascade,
  reason text not null check (reason in ('fraud', 'wrong_price', 'already_sold', 'fake_photos', 'wrong_location', 'duplicate', 'offensive', 'other')),
  details text check (char_length(details) <= 2000),
  status public.report_status not null default 'open',
  resolution text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (property_id is not null or agency_id is not null)
);
create index reports_status_idx on public.reports (status, created_at);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Commissions — rules are configured from the admin, never hard-coded.
-- ---------------------------------------------------------------------------
create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  transaction_type public.transaction_type not null,
  property_type public.property_type, -- null = applies to every type
  method public.commission_method not null,
  rate numeric(6, 4) check (rate is null or (rate >= 0 and rate <= 1)),          -- percentage method, e.g. 0.01 = 1 %
  fixed_amount bigint check (fixed_amount is null or fixed_amount >= 0),           -- fixed method
  rent_fraction numeric(5, 3) check (rent_fraction is null or rent_fraction > 0),  -- rent_fraction method, e.g. 0.5 = half of first rent
  min_amount bigint,
  max_amount bigint,
  priority smallint not null default 0,
  is_active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (method = 'percentage' and rate is not null) or
    (method = 'fixed' and fixed_amount is not null) or
    (method = 'rent_fraction' and rent_fraction is not null)
  )
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete restrict,
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  seller_id uuid not null references public.profiles (id) on delete restrict,
  agency_id uuid references public.agencies (id) on delete set null,
  lead_id uuid references public.property_leads (id) on delete set null,
  transaction_type public.transaction_type not null,
  amount bigint not null check (amount > 0),        -- sale price, or monthly rent for a rental
  monthly_rent bigint,
  commission_rule_id uuid references public.commission_rules (id) on delete set null,
  commission_rate numeric(6, 4),
  commission_amount bigint,
  status public.transaction_status not null default 'pending',
  confirmed_by_buyer boolean not null default false,
  confirmed_by_seller boolean not null default false,
  buyer_confirmed_at timestamptz,
  seller_confirmed_at timestamptz,
  declared_by uuid not null references public.profiles (id) on delete restrict,
  dispute_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);
create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
create index transactions_status_idx on public.transactions (status, created_at desc);
create index transactions_buyer_idx on public.transactions (buyer_id);
create index transactions_seller_idx on public.transactions (seller_id);
-- Only one open declaration per property/buyer
create unique index transactions_open_unique on public.transactions (property_id, buyer_id)
  where status in ('pending', 'confirmed');

create table public.commission_payments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references public.transactions (id) on delete cascade,
  payer_id uuid not null references public.profiles (id) on delete restrict,
  amount bigint not null,
  status public.commission_payment_status not null default 'unpaid',
  due_date date,
  paid_at timestamptz,
  method public.payment_provider,
  reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger commission_payments_updated_at before update on public.commission_payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Subscriptions & payments
-- ---------------------------------------------------------------------------
create table public.subscription_plans (
  code text primary key, -- client_free, owner_free, owner_premium, agency_basic, agency_pro, developer_business
  audience public.app_role not null,
  name text not null,
  name_ar text,
  price_monthly bigint not null default 0,
  features jsonb not null default '{}', -- { "featured_listings": 3, "advanced_stats": true, "tour_generation": true, ... }
  is_active boolean not null default true,
  sort_order smallint not null default 0
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  agency_id uuid references public.agencies (id) on delete cascade,
  developer_id uuid references public.developers (id) on delete cascade,
  plan_code text not null references public.subscription_plans (code),
  status public.subscription_status not null default 'active',
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(profile_id, agency_id, developer_id) = 1)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payer_id uuid not null references public.profiles (id) on delete restrict,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  commission_payment_id uuid references public.commission_payments (id) on delete set null,
  amount bigint not null check (amount > 0),
  currency text not null default 'MRU',
  provider public.payment_provider not null,
  status public.payment_status not null default 'pending',
  provider_reference text,
  created_at timestamptz not null default now()
);
create index payments_payer_idx on public.payments (payer_id, created_at desc);
