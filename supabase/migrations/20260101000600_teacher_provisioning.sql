-- =============================================================================
--  Migration: secure teacher provisioning
--
--  THE FIRST TEACHER ACCOUNT MUST NEVER BE CREATED FROM THE BROWSER.
--
--  Why a normal sign-up cannot be used
--  ----------------------------------
--  `supabase.auth.signUp({ options: { data: { role: 'teacher' } } })` stores
--  whatever the client sends in `auth.users.raw_user_meta_data`. Any policy
--  that reads the role from client supplied metadata is therefore forgeable.
--  This platform never does: `public.handle_new_user()` always creates the
--  profile with the `student` role, and the role can only be changed through
--  the function below.
--
--  public.set_user_role(target_email, new_role)
--  ---------------------------------------------
--  * SECURITY DEFINER, owned by the database owner.
--  * Refuses to run unless the HTTP request carries the `service_role` JWT.
--    The service role key is only ever used by the owner's local provisioning
--    script (scripts/provision-teacher.mjs) and never reaches the browser.
--  * `anon` and `authenticated` have no EXECUTE privilege on the function, so
--    even discovering it through the REST API is not possible.
--  * A first teacher can therefore only be established by someone who already
--    owns the Supabase project.
-- =============================================================================

create or replace function public.set_user_role(target_email text, new_role public.user_role)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  result    public.profiles;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'set_user_role() requires service_role credentials.'
      using errcode = '42501';
  end if;

  select u.id into target_id
  from auth.users u
  where lower(u.email) = lower(btrim(target_email));

  if target_id is null then
    raise exception 'No account exists for the requested email address.'
      using errcode = 'P0002';
  end if;

  update public.profiles
     set role = new_role
   where id = target_id
  returning * into result;

  if result.id is null then
    insert into public.profiles (id, email, role)
    values (target_id, left(btrim(target_email), 320), new_role)
    returning * into result;
  end if;

  return result;
end;
$$;

revoke execute on function public.set_user_role(text, public.user_role) from public;
revoke execute on function public.set_user_role(text, public.user_role) from anon;
revoke execute on function public.set_user_role(text, public.user_role) from authenticated;
grant execute on function public.set_user_role(text, public.user_role) to service_role;

comment on function public.set_user_role(text, public.user_role) is
  'Privileged role management. Callable only with service_role credentials (owner tooling).';
