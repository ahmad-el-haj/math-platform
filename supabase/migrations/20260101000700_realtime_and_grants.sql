-- =============================================================================
--  Migration: realtime publication and function grants
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Realtime
--    Adding a table to the `supabase_realtime` publication makes INSERT /
--    UPDATE / DELETE events available to subscribed clients.
--
--    Supabase Realtime authorises every Postgres Changes event against the
--    RLS SELECT policies of the published table, so a student subscribing to
--    `public.messages` only ever receives rows of their own conversations.
--    The client additionally filters by `conversation_id`.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages'
    ) then
      execute 'alter publication supabase_realtime add table public.messages';
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'conversations'
    ) then
      execute 'alter publication supabase_realtime add table public.conversations';
    end if;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Function grants
--    The authorisation helpers are invoked from inside RLS policies, which
--    run as the requesting role. `anon` therefore needs no access to them at
--    all, and `public` (the implicit default) is revoked so that only the two
--    API roles can call them.
-- ---------------------------------------------------------------------------
revoke execute on function public.is_teacher() from public, anon;
revoke execute on function public.is_conversation_participant(uuid) from public, anon;
revoke execute on function public.can_view_lesson(uuid) from public, anon;
revoke execute on function public.can_view_document(uuid) from public, anon;
revoke execute on function public.is_teacher_profile(uuid) from public, anon;
revoke execute on function public.primary_teacher_id() from public, anon;
revoke execute on function public.storage_document_id(text) from public, anon;
revoke execute on function public.storage_lesson_id(text) from public, anon;
revoke execute on function public.storage_class_id(text) from public, anon;

grant execute on function public.is_teacher() to authenticated, service_role;
grant execute on function public.is_conversation_participant(uuid) to authenticated, service_role;
grant execute on function public.can_view_lesson(uuid) to authenticated, service_role;
grant execute on function public.can_view_document(uuid) to authenticated, service_role;
grant execute on function public.is_teacher_profile(uuid) to authenticated, service_role;
grant execute on function public.primary_teacher_id() to authenticated, service_role;
grant execute on function public.storage_document_id(text) to authenticated, service_role;
grant execute on function public.storage_lesson_id(text) to authenticated, service_role;
grant execute on function public.storage_class_id(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Default privileges for future migrations
--    New tables created later inherit the same privilege baseline: the API
--    roles can read and write, `anon` cannot, and RLS is the real boundary.
-- ---------------------------------------------------------------------------
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  revoke select, insert, update, delete on tables from anon;
alter default privileges in schema public
  grant all on tables to service_role;
