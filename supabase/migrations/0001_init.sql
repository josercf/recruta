-- RecrutaBot — initial schema: jobs table, RLS, Realtime, private storage bucket.
-- Apply via the Supabase SQL editor, or `supabase db push` with the CLI.

-- gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- jobs: one row per async unit of work (parse a CV, or generate a DOCX).
-- Persisted in Postgres so the backend BackgroundService survives restarts.
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null check (type in ('parse', 'generate')),
  status      text not null default 'queued'
                check (status in ('queued', 'processing', 'parsed', 'done', 'error')),
  input       jsonb,
  result      jsonb,
  docx_url    text,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists jobs_user_id_idx        on public.jobs (user_id);
create index if not exists jobs_status_created_idx on public.jobs (status, created_at);

-- keep updated_at fresh on every update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: each user sees only their own jobs.
-- The backend uses the SERVICE ROLE key, which bypasses RLS, so the
-- BackgroundService can claim and update any job. These policies protect the
-- anon/user path (frontend Realtime subscription + the GET /api/jobs fallback,
-- which the backend scopes to user_id anyway).
-- ---------------------------------------------------------------------------
alter table public.jobs enable row level security;

drop policy if exists jobs_select_own on public.jobs;
create policy jobs_select_own on public.jobs
  for select using (auth.uid() = user_id);

drop policy if exists jobs_insert_own on public.jobs;
create policy jobs_insert_own on public.jobs
  for insert with check (auth.uid() = user_id);

drop policy if exists jobs_update_own on public.jobs;
create policy jobs_update_own on public.jobs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists jobs_delete_own on public.jobs;
create policy jobs_delete_own on public.jobs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Realtime: the frontend subscribes to status changes on its own jobs.
-- (Realtime honors RLS, so a user only receives changes to their own rows.)
-- ---------------------------------------------------------------------------
alter table public.jobs replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'jobs'
  ) then
    alter publication supabase_realtime add table public.jobs;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Storage: one PRIVATE bucket for uploads (transient) and generated DOCX.
-- No public/user policies are added on purpose: the frontend never touches
-- Storage directly — the backend (service role) reads/writes objects, and the
-- DOCX download uses a time-limited SIGNED URL, which does not require RLS.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', false)
on conflict (id) do nothing;
