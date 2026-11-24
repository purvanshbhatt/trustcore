-- TrustCore Phase 2B: Stripe entitlements and webhook idempotency (Postgres / Supabase).
-- Apply after 001_reports.sql: psql "$DATABASE_URL" -f migrations/002_entitlements.sql
--
-- Only the API (DATABASE_URL connection) reads and writes these tables. Row Level
-- Security is enabled with no policies, so they are closed to Supabase's public
-- REST API for both the anon and authenticated roles.

create table if not exists public.entitlements (
    user_id                 text primary key,           -- Supabase auth.users.id, or "anon:<ip hash>" for signed-out visitors
    tier                    text not null default 'free',   -- free | per_scan | pro_monthly | enterprise
    credits_remaining       integer not null default 0 check (credits_remaining >= 0),
    free_scans_used         integer not null default 0 check (free_scans_used >= 0),
    stripe_customer_id      text,
    stripe_subscription_id  text,
    updated_at              timestamptz default now()
);

create index if not exists ix_entitlements_subscription
    on public.entitlements (stripe_subscription_id);

-- Processed Stripe event ids. A webhook is applied in the same transaction that
-- inserts its id here, so a re-delivered event can never grant twice.
create table if not exists public.stripe_events (
    event_id      text primary key,
    event_type    text not null,
    processed_at  timestamptz not null default now()
);

alter table public.entitlements enable row level security;
alter table public.stripe_events enable row level security;
revoke all on public.entitlements from anon, authenticated;
revoke all on public.stripe_events from anon, authenticated;
