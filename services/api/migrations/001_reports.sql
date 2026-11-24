-- TrustCore Phase 2A: per-user report storage (Postgres / Supabase).
-- Apply once in the Supabase SQL editor, or: psql "$DATABASE_URL" -f migrations/001_reports.sql
--
-- The API connects with DATABASE_URL and filters every statement by user_id.
-- Row Level Security below is defence in depth: it stops the table being read
-- or changed through Supabase's public REST API (PostgREST) with the anon key.

create table if not exists public.reports (
    id          text primary key,
    user_id     text not null,              -- Supabase auth.users.id (JWT "sub")
    product     text not null,              -- launchgate | agentscope | evidence | evalkit
    title       text not null,
    created_at  timestamptz not null default now(),
    payload     jsonb not null              -- full Report document (secrets already redacted)
);

create index if not exists ix_reports_user_created
    on public.reports (user_id, created_at desc);

alter table public.reports enable row level security;

-- Anonymous clients get nothing.
revoke all on public.reports from anon;

-- Signed-in users may read and delete only their own rows. There are deliberately
-- no insert/update policies: only the API writes reports.
drop policy if exists reports_select_own on public.reports;
create policy reports_select_own on public.reports
    for select to authenticated
    using ((select auth.uid())::text = user_id);

drop policy if exists reports_delete_own on public.reports;
create policy reports_delete_own on public.reports
    for delete to authenticated
    using ((select auth.uid())::text = user_id);
