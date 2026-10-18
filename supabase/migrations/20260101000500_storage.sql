-- =============================================================================
--  Migration: private storage bucket and object policies
--
--  The bucket `lesson-documents` is PRIVATE. Nothing is served publicly; the
--  application asks Supabase Storage for a short-lived signed URL (60 s) and
--  the Storage API authorises that request against the policies below, which
--  mirror the RLS rules of the metadata tables.
--
--  Bucket level hardening (server side, not browser side):
--    * file_size_limit    -> 25 MiB, enforced by Storage on upload
--    * allowed_mime_types -> only PDF and DOCX are accepted, enforced by
--                            Storage on upload
--    * public = false     -> the bucket id cannot be used to read objects
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-documents',
  'lesson-documents',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
   set public = excluded.public,
       file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Object policies
-- ---------------------------------------------------------------------------

-- Teacher: full access to the objects of the bucket.
drop policy if exists "teachers manage lesson document objects" on storage.objects;
create policy "teachers manage lesson document objects"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'lesson-documents'
    and (select public.is_teacher())
  )
  with check (
    bucket_id = 'lesson-documents'
    and (select public.is_teacher())
  );

-- Student: may only download objects that belong to a document which is
-- attached to a published lesson inside a published class. The document id is
-- read out of the object path, so a student cannot request an arbitrary path.
drop policy if exists "students read published lesson document objects" on storage.objects;
create policy "students read published lesson document objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'lesson-documents'
    and exists (
      select 1
      from public.lesson_documents d
      join public.lessons l on l.id = d.lesson_id
      join public.classes c on c.id = l.class_id
      where d.id = public.storage_document_id(name)
        and d.deleted_at is null
        and l.is_published
        and not l.is_archived
        and c.is_published
        and not c.is_archived
    )
  );

-- Explicitly deny every write path for students. `for all` above already
-- restricts to teachers, but an explicit statement documents the intent and
-- protects against a later, looser teacher policy being copied by mistake.
drop policy if exists "students cannot write lesson document objects" on storage.objects;
create policy "students cannot write lesson document objects"
  on storage.objects
  for insert to authenticated
  with check (false);

drop policy if exists "students cannot update lesson document objects" on storage.objects;
create policy "students cannot update lesson document objects"
  on storage.objects
  for update to authenticated
  using (false)
  with check (false);

drop policy if exists "students cannot delete lesson document objects" on storage.objects;
create policy "students cannot delete lesson document objects"
  on storage.objects
  for delete to authenticated
  using (false);
