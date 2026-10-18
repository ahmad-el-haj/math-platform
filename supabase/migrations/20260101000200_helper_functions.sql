-- =============================================================================
--  Migration: authorisation helper functions
--
--  These helpers are `security definer` so they can read `public.profiles`
--  without being subject to that table's own RLS policies (the function owner
--  is the table owner and therefore bypasses RLS). Every one of them:
--
--    * sets `search_path = ''` so that no malicious object in the search path
--      can hijack the function body,
--    * fully qualifies every referenced object,
--    * re-implements the access rule itself instead of delegating to RLS, so
--      the check is meaningful even when called from another policy.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- is_teacher()
--   True when the current request belongs to a user whose profile role is
--   `teacher`. This is the single gate used by all teacher-only policies.
-- ---------------------------------------------------------------------------
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'teacher'
  );
$$;

comment on function public.is_teacher() is
  'Returns true when the authenticated user holds the teacher role.';

-- ---------------------------------------------------------------------------
-- is_conversation_participant(conversation_id)
--   True when the authenticated user is one of the two participants.
-- ---------------------------------------------------------------------------
create or replace function public.is_conversation_participant(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = target_conversation
      and (
        c.student_id = (select auth.uid())
        or c.teacher_id = (select auth.uid())
      )
  );
$$;

comment on function public.is_conversation_participant(uuid) is
  'Returns true when the authenticated user participates in the given conversation.';

-- ---------------------------------------------------------------------------
-- can_view_lesson(lesson_id)
--   Mirrors the student facing visibility rule: the lesson, its class and the
--   class must all be published and not archived.
-- ---------------------------------------------------------------------------
create or replace function public.can_view_lesson(target_lesson uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lessons l
    join public.classes c on c.id = l.class_id
    where l.id = target_lesson
      and l.is_published
      and not l.is_archived
      and c.is_published
      and not c.is_archived
  );
$$;

-- ---------------------------------------------------------------------------
-- can_view_document(document_id)
--   Mirrors the student facing visibility rule for a document row.
-- ---------------------------------------------------------------------------
create or replace function public.can_view_document(target_document uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lesson_documents d
    join public.lessons l on l.id = d.lesson_id
    join public.classes c on c.id = l.class_id
    where d.id = target_document
      and d.deleted_at is null
      and l.is_published
      and not l.is_archived
      and c.is_published
      and not c.is_archived
  );
$$;

-- ---------------------------------------------------------------------------
-- is_teacher_profile(profile_id)
-- ---------------------------------------------------------------------------
create or replace function public.is_teacher_profile(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = target_profile and p.role = 'teacher'
  );
$$;

-- ---------------------------------------------------------------------------
-- primary_teacher_id()
--   Returns the id of the teacher account students should talk to. The schema
--   already supports several teachers (conversations.teacher_id is a plain
--   column); this helper only exists so the "start a conversation" flow has a
--   deterministic default while a single teacher is running the platform.
-- ---------------------------------------------------------------------------
create or replace function public.primary_teacher_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.role = 'teacher'
  order by p.created_at
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Storage path helpers.
--   Object names look like:
--     classes/{class_id}/lessons/{lesson_id}/documents/{document_id}/v{version}/{file}
--   `storage.foldername()` drops the file name, so the resulting array is
--   1-indexed as: 1='classes' 2=class_id 3='lessons' 4=lesson_id
--   5='documents' 6=document_id 7='v{version}'.
--   The helpers parse defensively and return NULL instead of raising.
-- ---------------------------------------------------------------------------
create or replace function public.storage_document_id(object_name text)
returns uuid
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  parts text[];
begin
  parts := storage.foldername(object_name);
  if parts is null or array_length(parts, 1) < 6 then
    return null;
  end if;
  return parts[6]::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function public.storage_lesson_id(object_name text)
returns uuid
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  parts text[];
begin
  parts := storage.foldername(object_name);
  if parts is null or array_length(parts, 1) < 6 then
    return null;
  end if;
  return parts[4]::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function public.storage_class_id(object_name text)
returns uuid
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  parts text[];
begin
  parts := storage.foldername(object_name);
  if parts is null or array_length(parts, 1) < 6 then
    return null;
  end if;
  return parts[2]::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;
