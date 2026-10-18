-- =============================================================================
--  Migration: triggers and guards
--
--  Triggers are the last line of defence that runs *inside* the database and
--  therefore cannot be bypassed by a modified client, a crafted request body
--  or a direct REST call.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. set_updated_at()
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists classes_set_updated_at on public.classes;
create trigger classes_set_updated_at
  before update on public.classes
  for each row execute function public.set_updated_at();

drop trigger if exists lessons_set_updated_at on public.lessons;
create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

drop trigger if exists lesson_documents_set_updated_at on public.lesson_documents;
create trigger lesson_documents_set_updated_at
  before update on public.lesson_documents
  for each row execute function public.set_updated_at();

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. handle_new_user()
--    Creates the profile row for every new auth user.
--
--    SECURITY DEFINER so it can insert into `public.profiles` even though no
--    client INSERT policy exists (profiles may only be created by the system).
--
--    The role is *always* `student` here. The role is deliberately NOT derived
--    from `raw_user_meta_data`: a client can set arbitrary metadata during
--    sign-up, so trusting it would be a privilege escalation. Promotion to
--    teacher happens only through public.set_user_role(), which requires
--    service_role credentials that never reach the browser.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    left(
      coalesce(
        nullif(new.raw_user_meta_data ->> 'full_name', ''),
        nullif(new.raw_user_meta_data ->> 'name', ''),
        split_part(coalesce(new.email, ''), '@', 1)
      ),
      120
    ),
    left(coalesce(new.email, ''), 320),
    'student'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. guard_profile_role_change()
--    Blocks privilege escalation performed through a profile UPDATE.
--
--    The function is deliberately NOT security definer: it must observe the
--    *real* executing role so that an `authenticated` session cannot slip
--    through. A role change is only accepted from
--      * a request carrying the service_role JWT (the owner's bootstrap tool), or
--      * the database owner (SQL editor / migrations / the SECURITY DEFINER
--        helper below).
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    if coalesce(auth.role(), '') <> 'service_role'
       and current_user not in ('postgres', 'supabase_admin') then
      raise exception 'Direct role changes are not permitted. Use public.set_user_role().'
        using errcode = '42501';
    end if;
  end if;

  if new.id <> old.id then
    raise exception 'The profile id is immutable.' using errcode = '42501';
  end if;

  if new.created_at <> old.created_at then
    raise exception 'The profile creation timestamp is immutable.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role_change();

-- ---------------------------------------------------------------------------
-- 4. validate_conversation_participants()
--    Guarantees that the "student" side of a conversation really holds the
--    student role and the "teacher" side really holds the teacher role.
--    Without this a compromised client could open a thread with another
--    student and read it, or with a non-teacher account.
-- ---------------------------------------------------------------------------
create or replace function public.validate_conversation_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.student_id and p.role = 'student'
  ) then
    raise exception 'student_id must reference an account with the student role.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = new.teacher_id and p.role = 'teacher'
  ) then
    raise exception 'teacher_id must reference an account with the teacher role.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists conversations_validate_participants on public.conversations;
create trigger conversations_validate_participants
  before insert or update on public.conversations
  for each row execute function public.validate_conversation_participants();

-- ---------------------------------------------------------------------------
-- 4b. guard_conversation_participants()
--     The two participants of a thread are immutable. Without this guard a
--     student could repoint their own conversation at another student's id
--     (or at a second teacher) and thereby read or write foreign messages.
-- ---------------------------------------------------------------------------
create or replace function public.guard_conversation_participants()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.student_id <> old.student_id or new.teacher_id <> old.teacher_id then
    if coalesce(auth.role(), '') <> 'service_role'
       and current_user not in ('postgres', 'supabase_admin') then
      raise exception 'The participants of a conversation cannot be changed.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists conversations_guard_participants on public.conversations;
create trigger conversations_guard_participants
  before update on public.conversations
  for each row execute function public.guard_conversation_participants();

-- ---------------------------------------------------------------------------
-- 5. guard_message_sender()
--    A message can only ever be sent as the authenticated user. This makes
--    impersonating the teacher impossible even if the RLS policy were wrong.
-- ---------------------------------------------------------------------------
create or replace function public.guard_message_sender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor      uuid := (select auth.uid());
  actor_role text := coalesce(auth.role(), '');
begin
  if actor_role = 'service_role' then
    return new;  -- trusted administrative path (owner tooling / backfill)
  end if;

  if actor is null then
    raise exception 'Authentication is required to send a message.'
      using errcode = '42501';
  end if;

  if new.sender_id <> actor then
    raise exception 'A message can only be sent on behalf of the authenticated user.'
      using errcode = '42501';
  end if;

  if not (select public.is_conversation_participant(new.conversation_id)) then
    raise exception 'You are not a participant of this conversation.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_guard_sender on public.messages;
create trigger messages_guard_sender
  before insert on public.messages
  for each row execute function public.guard_message_sender();

-- ---------------------------------------------------------------------------
-- 6. guard_message_update()
--    Message bodies are immutable. Only `read_at` may change, and only the
--    recipient of a message may mark it as read.
-- ---------------------------------------------------------------------------
create or replace function public.guard_message_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.body <> old.body
     or new.conversation_id <> old.conversation_id
     or new.sender_id <> old.sender_id
     or new.created_at <> old.created_at then
    raise exception 'A message cannot be edited after it was sent.'
      using errcode = '42501';
  end if;

  if new.read_at is distinct from old.read_at and new.read_at is not null then
    if new.sender_id = (select auth.uid()) then
      raise exception 'Only the recipient of a message can mark it as read.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists messages_guard_update on public.messages;
create trigger messages_guard_update
  before update on public.messages
  for each row execute function public.guard_message_update();

-- ---------------------------------------------------------------------------
-- 7. touch_conversation_on_message()
--    Keeps `conversations.last_message_at` current so the conversation list can
--    be ordered without scanning the whole message table.
-- ---------------------------------------------------------------------------
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
     set last_message_at = new.created_at,
         updated_at = now()
   where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

-- ---------------------------------------------------------------------------
-- 8. validate_lesson_document_path()
--    Keeps the storage path and the database row consistent. It guarantees
--    that a document row can never point at another lesson's or another
--    document's object, which would otherwise allow a teacher (or a buggy
--    client) to hand a student a signed URL for foreign content.
-- ---------------------------------------------------------------------------
create or replace function public.validate_lesson_document_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parts    text[];
  lesson_class uuid;
begin
  parts := string_to_array(new.file_path, '/');

  if array_length(parts, 1) <> 8 then
    raise exception 'Unexpected storage path format: %', new.file_path
      using errcode = '23514';
  end if;

  if parts[1] <> 'classes' or parts[3] <> 'lessons' or parts[5] <> 'documents' then
    raise exception 'Unexpected storage path format: %', new.file_path
      using errcode = '23514';
  end if;

  if parts[7] !~ '^v[0-9]+$' then
    raise exception 'Unexpected storage version segment: %', parts[7]
      using errcode = '23514';
  end if;

  if parts[8] ~ '[/\\]' or parts[8] in ('.', '..') or parts[8] like '.%' then
    raise exception 'Unsafe file name: %', parts[8] using errcode = '23514';
  end if;

  select l.class_id into lesson_class
  from public.lessons l
  where l.id = new.lesson_id;

  if lesson_class is null then
    raise exception 'The lesson referenced by this document does not exist.'
      using errcode = '23503';
  end if;

  if parts[2] <> lesson_class::text then
    raise exception 'The storage path class does not match the lesson class.'
      using errcode = '23514';
  end if;

  if parts[4] <> new.lesson_id::text then
    raise exception 'The storage path lesson does not match the document lesson.'
      using errcode = '23514';
  end if;

  if parts[6] <> new.id::text then
    raise exception 'The storage path document does not match the document row.'
      using errcode = '23514';
  end if;

  if new.version <> substring(parts[7] from 2)::integer then
    raise exception 'The storage path version does not match the document version.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists lesson_documents_validate_path on public.lesson_documents;
create trigger lesson_documents_validate_path
  before insert or update on public.lesson_documents
  for each row execute function public.validate_lesson_document_path();

-- ---------------------------------------------------------------------------
-- 9. guard_lesson_document_soft_delete()
--    A soft deleted document keeps its row (so the storage object can be
--    cleaned up later) but must not be resurrected by a plain UPDATE.
--    Only an explicit, privileged restore may clear `deleted_at`.
-- ---------------------------------------------------------------------------
create or replace function public.guard_lesson_document_soft_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.deleted_at is not null and new.deleted_at is null then
    if coalesce(auth.role(), '') <> 'service_role'
       and current_user not in ('postgres', 'supabase_admin') then
      raise exception 'A deleted document cannot be restored by a client request.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists lesson_documents_guard_soft_delete on public.lesson_documents;
create trigger lesson_documents_guard_soft_delete
  before update on public.lesson_documents
  for each row execute function public.guard_lesson_document_soft_delete();
