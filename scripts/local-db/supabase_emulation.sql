-- =============================================================================
--  Supabase schema emulation for local verification
--
--  Supabase projects expose two managed schemas that the application depends
--  on: `auth` (users + the `auth.uid()` / `auth.role()` helpers) and `storage`
--  (buckets + objects + `storage.foldername()`).
--
--  This script recreates the parts of those schemas that the platform relies
--  on, so that the *production* migration files can be executed unchanged
--  against a plain PostgreSQL instance. That makes it possible to verify the
--  Row Level Security policies for real instead of only reasoning about them.
--
--  It is a test harness, NOT production code. It is never applied to a real
--  Supabase project.
-- =============================================================================

create schema if not exists auth;
create schema if not exists storage;

-- API roles, mirroring the ones Supabase provisions.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- auth schema
-- ---------------------------------------------------------------------------
create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  )
$$;

-- ---------------------------------------------------------------------------
-- storage schema
-- ---------------------------------------------------------------------------
create table if not exists storage.buckets (
  id                  text primary key,
  name                text not null,
  public              boolean not null default false,
  file_size_limit     bigint,
  allowed_mime_types  text[]
);

create table if not exists storage.objects (
  id          uuid primary key default gen_random_uuid(),
  bucket_id   text not null references storage.buckets (id),
  name        text not null,
  owner       uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

-- Mirrors the Supabase implementation: the path segments without the file name.
create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1 : array_length(_parts, 1) - 1];
end
$$;

-- Supabase enables RLS on storage.objects; the policies are meaningless
-- without it, so the harness does the same.
alter table storage.objects enable row level security;

grant select on storage.buckets to authenticated, anon;
grant select, insert, update, delete on storage.objects to authenticated;

-- The administrative role reaches the managed schemas as well, mirroring the
-- Supabase admin API which runs with the service role key.
grant all on auth.users to service_role;
grant all on storage.buckets, storage.objects to service_role;
