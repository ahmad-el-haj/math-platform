-- =============================================================================
--  Migration: core schema
--  Platform : Premium Arabic-first mathematics learning platform
--  Database : Supabase PostgreSQL
--
--  Design notes
--  ------------
--  * Every table that contains protected data has Row Level Security enabled
--    (see the rls_policies migration). Table privileges alone are never the
--    security boundary.
--  * `auth.uid()` / `auth.role()` are the Supabase helpers that resolve the
--    JWT of the current request. They are always wrapped in a scalar subquery
--    in policies so PostgreSQL can cache them as an InitPlan instead of
--    re-evaluating them per row.
--  * All timestamps are `timestamptz` and stored in UTC; the UI renders them
--    in the browser's local zone with an Arabic locale.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enumerated types
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('student', 'teacher');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. profiles
--    One row per authenticated user. `id` mirrors `auth.users.id`.
--    The role column is the single source of truth for authorisation and is
--    guarded by a trigger (see triggers migration) so that a student can never
--    promote themselves by updating their own profile.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text        not null default '' check (char_length(full_name) <= 120),
  email         text        not null default '' check (char_length(email) <= 320),
  role          public.user_role not null default 'student',
  grade_level   text        not null default '' check (char_length(grade_level) <= 60),
  avatar_url    text        not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'Public-facing profile of every authenticated user. Role is authoritative only when written by a privileged operation.';
comment on column public.profiles.role is
  'Authorisation role. Changes are only permitted through public.set_user_role() (service_role only) or the database owner.';

create index if not exists profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- 3. classes
--    A teaching class (for example "Grade 9"). Fully dynamic: the teacher
--    creates them at runtime, no code change or redeploy required.
-- ---------------------------------------------------------------------------
create table if not exists public.classes (
  id            uuid primary key default gen_random_uuid(),
  title         text        not null check (char_length(btrim(title)) between 2 and 120),
  description   text        not null default '' check (char_length(description) <= 2000),
  display_order integer     not null default 0,
  is_published  boolean     not null default false,
  is_archived   boolean     not null default false,
  created_by    uuid        references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Duplicate class names are rejected case-insensitively among active classes.
create unique index if not exists classes_title_unique_active
  on public.classes (lower(btrim(title)))
  where not is_archived;

create index if not exists classes_order_idx
  on public.classes (display_order, created_at);

create index if not exists classes_published_idx
  on public.classes (is_published, display_order)
  where not is_archived;

-- ---------------------------------------------------------------------------
-- 4. lessons
-- ---------------------------------------------------------------------------
create table if not exists public.lessons (
  id            uuid primary key default gen_random_uuid(),
  class_id      uuid        not null references public.classes (id) on delete cascade,
  title         text        not null check (char_length(btrim(title)) between 2 and 160),
  description   text        not null default '' check (char_length(description) <= 4000),
  display_order integer     not null default 0,
  is_published  boolean     not null default false,
  is_archived   boolean     not null default false,
  created_by    uuid        references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists lessons_class_title_unique_active
  on public.lessons (class_id, lower(btrim(title)))
  where not is_archived;

create index if not exists lessons_class_order_idx
  on public.lessons (class_id, display_order)
  where not is_archived;

create index if not exists lessons_published_idx
  on public.lessons (class_id, is_published)
  where not is_archived;

-- ---------------------------------------------------------------------------
-- 5. lesson_documents
--    Metadata only. The binary lives in a private Supabase Storage bucket
--    named `lesson-documents` and is reached through short-lived signed URLs.
--
--    `file_path` layout (fixed so that the storage RLS policies can parse it):
--       classes/{class_id}/lessons/{lesson_id}/documents/{document_id}/v{version}/{file_name}
--
--    Replacing a document bumps `version` and points `file_path` at a brand new
--    object, so a failed upload can never corrupt the currently served file.
--    The previous object is removed by the application after the update.
--
--    Deletion is a two phase operation: the row is soft deleted (`deleted_at`)
--    and the storage object is removed afterwards. `public.purge_soft_deleted_documents()`
--    finishes the job for objects that could not be removed immediately.
-- ---------------------------------------------------------------------------
create table if not exists public.lesson_documents (
  id                 uuid primary key default gen_random_uuid(),
  lesson_id          uuid        not null references public.lessons (id) on delete cascade,
  title              text        not null check (char_length(btrim(title)) between 2 and 160),
  description        text        not null default '' check (char_length(description) <= 2000),
  file_path          text        not null,
  original_file_name text        not null check (char_length(original_file_name) between 1 and 255),
  mime_type          text        not null check (
                     mime_type in (
                       'application/pdf',
                       'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                     )
                   ),
  file_size          bigint      not null check (file_size > 0 and file_size <= 26214400),
  storage_bucket     text        not null default 'lesson-documents'
                     check (storage_bucket = 'lesson-documents'),
  version            integer     not null default 1 check (version > 0),
  created_by         uuid        references public.profiles (id) on delete set null,
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists lesson_documents_lesson_idx
  on public.lesson_documents (lesson_id, created_at)
  where deleted_at is null;

create index if not exists lesson_documents_active_idx
  on public.lesson_documents (lesson_id)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 6. conversations & messages
--    One private thread per (student, teacher) pair. The unique constraint
--    makes double submission harmless and the trigger below guarantees that
--    `student_id` really is a student and `teacher_id` really is a teacher.
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid        not null references public.profiles (id) on delete cascade,
  teacher_id     uuid        not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint conversations_distinct_participants check (student_id <> teacher_id),
  constraint conversations_unique_pair unique (student_id, teacher_id)
);

create index if not exists conversations_student_idx
  on public.conversations (student_id, last_message_at desc);

create index if not exists conversations_teacher_idx
  on public.conversations (teacher_id, last_message_at desc);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid        not null references public.conversations (id) on delete cascade,
  sender_id       uuid        not null references public.profiles (id) on delete cascade,
  body            text        not null check (char_length(btrim(body)) between 1 and 4000),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- Pagination friendly: newest first within a conversation.
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

-- Unread lookups only ever touch unread rows.
create index if not exists messages_unread_idx
  on public.messages (conversation_id, created_at desc)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- 7. Grants
--    `anon` receives no table privileges at all: every protected table requires
--    an authenticated session. `authenticated` receives the CRUD privileges and
--    is then constrained by RLS.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.classes,
  public.lessons,
  public.lesson_documents,
  public.conversations,
  public.messages
  to authenticated;

-- `service_role` is the administrative role used by the owner's provisioning
-- tooling. It bypasses RLS (BYPASSRLS) and therefore needs the table
-- privileges as well. It is never used from the browser.
grant usage on schema public to service_role;
grant all on
  public.profiles,
  public.classes,
  public.lessons,
  public.lesson_documents,
  public.conversations,
  public.messages
  to service_role;
