-- =============================================================================
--  Migration: Row Level Security policies
--
--  Every protected table has RLS enabled and at least one explicit policy.
--  `anon` (unauthenticated) has no table privileges at all, so an anonymous
--  visitor cannot read a single row of application data.
--
--  Role model
--  ---------
--  * teacher  : full control over classes, lessons and documents; reads every
--               conversation; may moderate messages.
--  * student  : reads published & non-archived classes/lessons/documents;
--               reads only the conversations they take part in.
--
--  All `auth.uid()` / `auth.role()` calls are wrapped in `(select ...)` so
--  PostgreSQL evaluates them once per statement (InitPlan) instead of once
--  per row.
--
--  NOTE: RLS is enabled but deliberately NOT forced. `force row level security`
--  would also apply RLS to the table owner and therefore break the
--  `security definer` helper functions that the policies rely on.
-- =============================================================================

alter table public.profiles        enable row level security;
alter table public.classes         enable row level security;
alter table public.lessons         enable row level security;
alter table public.lesson_documents enable row level security;
alter table public.conversations   enable row level security;
alter table public.messages        enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

-- A user may read their own profile, a teacher may read every profile, and
-- anyone signed in may read teacher profiles (needed to display the teacher in
-- the messaging UI). Students can never read another student's profile.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or role = 'teacher'
    or (select public.is_teacher())
  );

-- A user may only update their own row. Changing `role` is additionally
-- refused by the `profiles_guard_role` trigger, so a student cannot promote
-- themselves even though the UPDATE itself is allowed.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No INSERT policy: profiles are created by the `handle_new_user` trigger
-- (security definer) and by the privileged provisioning function only.
-- No DELETE policy: accounts are removed through the auth admin API.

-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------

drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes
  for select to authenticated
  using (
    (select public.is_teacher())
    or (is_published and not is_archived)
  );

drop policy if exists classes_insert_teacher on public.classes;
create policy classes_insert_teacher on public.classes
  for insert to authenticated
  with check ((select public.is_teacher()));

drop policy if exists classes_update_teacher on public.classes;
create policy classes_update_teacher on public.classes
  for update to authenticated
  using ((select public.is_teacher()))
  with check ((select public.is_teacher()));

drop policy if exists classes_delete_teacher on public.classes;
create policy classes_delete_teacher on public.classes
  for delete to authenticated
  using ((select public.is_teacher()));

-- ---------------------------------------------------------------------------
-- lessons
-- ---------------------------------------------------------------------------

drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons
  for select to authenticated
  using (
    (select public.is_teacher())
    or (
      is_published
      and not is_archived
      and (select public.can_view_lesson(id))
    )
  );

drop policy if exists lessons_insert_teacher on public.lessons;
create policy lessons_insert_teacher on public.lessons
  for insert to authenticated
  with check ((select public.is_teacher()));

drop policy if exists lessons_update_teacher on public.lessons;
create policy lessons_update_teacher on public.lessons
  for update to authenticated
  using ((select public.is_teacher()))
  with check ((select public.is_teacher()));

drop policy if exists lessons_delete_teacher on public.lessons;
create policy lessons_delete_teacher on public.lessons
  for delete to authenticated
  using ((select public.is_teacher()));

-- ---------------------------------------------------------------------------
-- lesson_documents
-- ---------------------------------------------------------------------------

drop policy if exists lesson_documents_select on public.lesson_documents;
create policy lesson_documents_select on public.lesson_documents
  for select to authenticated
  using (
    (select public.is_teacher())
    or ((select public.can_view_document(id)))
  );

drop policy if exists lesson_documents_insert_teacher on public.lesson_documents;
create policy lesson_documents_insert_teacher on public.lesson_documents
  for insert to authenticated
  with check ((select public.is_teacher()));

drop policy if exists lesson_documents_update_teacher on public.lesson_documents;
create policy lesson_documents_update_teacher on public.lesson_documents
  for update to authenticated
  using ((select public.is_teacher()))
  with check ((select public.is_teacher()));

drop policy if exists lesson_documents_delete_teacher on public.lesson_documents;
create policy lesson_documents_delete_teacher on public.lesson_documents
  for delete to authenticated
  using ((select public.is_teacher()));

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------

drop policy if exists conversations_select_participant on public.conversations;
create policy conversations_select_participant on public.conversations
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or teacher_id = (select auth.uid())
  );

-- A student opens a thread with a teacher; a teacher may open a thread with a
-- student. The `validate_conversation_participants` trigger independently
-- verifies the roles of both sides.
drop policy if exists conversations_insert_participant on public.conversations;
create policy conversations_insert_participant on public.conversations
  for insert to authenticated
  with check (
    (
      student_id = (select auth.uid())
      and (select public.is_teacher_profile(teacher_id))
    )
    or (
      teacher_id = (select auth.uid())
      and (select public.is_teacher_profile(student_id) = false)
    )
  );

-- Participants may update their thread. Changing the participants themselves
-- is refused by the `conversations_guard_participants` trigger.
drop policy if exists conversations_update_participant on public.conversations;
create policy conversations_update_participant on public.conversations
  for update to authenticated
  using (
    student_id = (select auth.uid())
    or teacher_id = (select auth.uid())
  )
  with check (
    student_id = (select auth.uid())
    or teacher_id = (select auth.uid())
  );

-- Only a teacher may remove a thread.
drop policy if exists conversations_delete_teacher on public.conversations;
create policy conversations_delete_teacher on public.conversations
  for delete to authenticated
  using ((select public.is_teacher()));

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------

drop policy if exists messages_select_participant on public.messages;
create policy messages_select_participant on public.messages
  for select to authenticated
  using ((select public.is_conversation_participant(conversation_id)));

-- A message is always sent as the authenticated user inside a conversation
-- they take part in. The `guard_message_sender` trigger enforces the same rule
-- again inside the database.
drop policy if exists messages_insert_participant on public.messages;
create policy messages_insert_participant on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (select public.is_conversation_participant(conversation_id))
  );

-- Only `read_at` may be updated (enforced by the `guard_message_update`
-- trigger); a participant may never rewrite somebody else's message.
drop policy if exists messages_update_participant on public.messages;
create policy messages_update_participant on public.messages
  for update to authenticated
  using ((select public.is_conversation_participant(conversation_id)))
  with check ((select public.is_conversation_participant(conversation_id)));

-- The author may delete their own message; a teacher may moderate any message
-- inside their own conversations.
drop policy if exists messages_delete_author_or_teacher on public.messages;
create policy messages_delete_author_or_teacher on public.messages
  for delete to authenticated
  using (
    sender_id = (select auth.uid())
    or (
      (select public.is_teacher())
      and (select public.is_conversation_participant(conversation_id))
    )
  );
