# Security model — رِواق

This document explains **what is protected, by which mechanism, and with which
intention**. It also states plainly what is *not* proven, and where the design has
ambiguity.

The short version:

> The database is the security boundary. The frontend is a convenience layer.
> Every protected table has Row Level Security enabled, every table has explicit
> least-privilege policies, and the one privileged operation (granting the teacher
> role) requires a credential that never reaches a browser.

---

## 1. Roles and the trust boundary

| Actor | What they can do | Enforced by |
| --- | --- | --- |
| `anon` (not signed in) | Nothing at all — no table grants | `GRANT`s + RLS |
| `authenticated` / `student` | Read published content, read their own profile, talk to the teacher | RLS |
| `authenticated` / `teacher` | Manage classes, lessons, documents; read the student list and every conversation | RLS |
| `service_role` | Everything, including `set_user_role()` | the key itself (owner side only) |

The role is stored in `public.profiles.role` and is **never** read from client
supplied data. `signUp` only sends `full_name` and `grade_level` to Supabase Auth.

---

## 2. How a student becomes a teacher (and why it cannot happen from the browser)

```
signUp(email, password, data:{full_name, grade_level})
        │
        ▼
auth.users  ──trigger handle_new_user (SECURITY DEFINER)──▶  profiles.role = 'student'   ← hard coded
        │
        ▼
profiles.role can only be changed by:
        │
        ├─ guard_profile_role_change  → refuses EVERY role update from a client
        │
        └─ public.set_user_role(target_email, new_role)
               • SECURITY DEFINER, owned by the database owner
               • raises unless auth.role() = 'service_role'
               • EXECUTE revoked from public / anon / authenticated
               • only reachable with the service-role key
                    → scripts/provision-teacher.mjs, on the owner's machine
```

Consequences:

* Editing the profile in the browser does nothing — the request never carries a role.
* Calling the REST API directly does nothing — the trigger rejects the `UPDATE`.
* Calling `set_user_role` through PostgREST does nothing — the privilege is revoked
  and the function checks the JWT role again.
* The only way is the owner's service-role key, which is never in the repository,
  never in a `VITE_` variable, and never in the browser bundle.
  `src/config/env.ts` additionally throws at boot time if a privileged-looking key
  is found in a public variable.

**Verified by:** `tests/db/rls.test.ts` (real PostgreSQL) and
`tests/app/services/profiles.test.ts` (application level).

---

## 3. Row Level Security — policy by policy

RLS is enabled on all six tables. It is deliberately **not** `FORCE`d, because the
`SECURITY DEFINER` helper functions are owned by the table owner and would otherwise
be filtered by their own policies.

### 3.1 `profiles`

| Policy | Rule | Intent |
| --- | --- | --- |
| `profiles_select` | `id = auth.uid() or role = 'teacher' or is_teacher()` | A user sees their own row; everyone signed in sees the *teacher* profile (needed for the messaging UI); a teacher sees everybody. **A student never sees another student.** |
| `profiles_update_own` | `using (id = auth.uid()) with check (id = auth.uid())` | Only your own row can be changed. |
| — | no INSERT policy | Profiles are created by the `handle_new_user` trigger, never by a client. |
| — | no DELETE policy | Accounts are removed through the Auth admin API. |

The trigger `guard_profile_role_change` additionally refuses any change of `role`.

### 3.2 `classes`

| Policy | Rule | Intent |
| --- | --- | --- |
| `classes_select` | `is_teacher() or (is_published and not is_archived)` | A student sees published, non-archived classes only. |
| `classes_insert/update/delete_teacher` | `is_teacher()` | The catalogue is managed by the teacher alone. |

### 3.3 `lessons`

| Policy | Rule | Intent |
| --- | --- | --- |
| `lessons_select` | `is_teacher() or (is_published and not is_archived and can_view_lesson(id))` | A student sees a lesson only when the lesson *and* its class are published. `can_view_lesson()` performs the join through the helper function. |
| `lessons_insert/update/delete_teacher` | `is_teacher()` | Same intent as the classes. |

### 3.4 `lesson_documents`

| Policy | Rule | Intent |
| --- | --- | --- |
| `lesson_documents_select` | `is_teacher() or can_view_document(id)` | A document is visible only through its lesson's publication chain. |
| `lesson_documents_insert/update/delete_teacher` | `is_teacher()` | A student can neither attach, nor edit, nor remove a document. |

### 3.5 `conversations`

| Policy | Rule | Intent |
| --- | --- | --- |
| `conversations_select_participant` | `student_id = auth.uid() or teacher_id = auth.uid()` | A thread is visible only to its two participants. |
| `conversations_insert_participant` | `(student_id = auth.uid() and is_teacher_profile(teacher_id)) or (teacher_id = auth.uid() and not is_teacher_profile(student_id))` | A student may open a thread with a *teacher*; a teacher may open a thread with a *student*. A student cannot open a thread with another student. |
| `conversations_update_participant` | participants only | The thread can be updated (for example the `last_message_at` stamp), but the trigger `guard_conversation_participants` refuses a change of the participants themselves. |
| `conversations_delete_teacher` | `is_teacher()` | Only the teacher can remove a thread. |

### 3.6 `messages`

| Policy | Rule | Intent |
| --- | --- | --- |
| `messages_select_participant` | `is_conversation_participant(conversation_id)` | No message of a foreign thread is ever returned. |
| `messages_insert_participant` | `sender_id = auth.uid() and is_conversation_participant(conversation_id)` | A message is always sent *as* the signed-in user, inside a thread they take part in. **Impersonation is impossible.** |
| `messages_update_participant` | participant only | Only `read_at` may change — the trigger `guard_message_update` refuses a rewritten body, a changed sender or a move to another thread. |
| `messages_delete_author_or_teacher` | `sender_id = auth.uid() or (is_teacher() and is_conversation_participant(...))` | The author may delete their own message; the teacher may moderate a message inside their own threads. |

### 3.7 `anon`

The `anon` role has **no table privileges at all**. Even if a policy were missing,
an anonymous visitor could not read a single row.

---

## 4. Storage

The bucket `lesson-documents` is:

| Property | Value | Intent |
| --- | --- | --- |
| `public` | `false` | No public URL ever exists. |
| `file_size_limit` | 26 214 400 (25 MiB) | Matches `appConfig.maxUploadBytes` in the frontend. |
| `allowed_mime_types` | `application/pdf`, `…wordprocessingml.document` | The server rejects everything else, whatever the browser claims. |

### 4.1 Storage policies

| Policy | Rule | Intent |
| --- | --- | --- |
| `objects_select_teacher` | `bucket_id = 'lesson-documents' and is_teacher()` | The teacher can read every object. |
| `objects_select_student` | the object path points at a document of a published lesson in a published class | A student may download **only** the files they are entitled to see. The path encodes the document id, so the policy can resolve it. |
| `objects_insert_teacher` / `objects_update_teacher` / `objects_delete_teacher` | `is_teacher()` | Only the teacher writes. |
| `objects_insert_student` / `objects_update_student` / `objects_delete_student` | `with check (false)` | Explicitly denied rather than merely absent — a student can never write into the bucket, even by guessing a path. |

### 4.2 The storage path is validated by the database

The trigger `validate_lesson_document_path` checks that the path of a document row

```
classes/{class_id}/lessons/{lesson_id}/documents/{document_id}/v{n}/{file_name}
```

has eight segments, that the document id and the lesson id in the path really belong
to the row, and that the class id in the path is the class of that lesson. A student
therefore cannot repoint a document at somebody else's lesson to gain access — the
write is rejected by PostgreSQL, not by the client.

### 4.3 Download mechanism

* The frontend asks for a **signed URL** (`createSignedUrl`) with a 120 second
  lifetime. The storage API applies the SELECT policy of the object, so an
  unauthorised student receives a permission error instead of a URL.
* The signed URL is created on demand and never stored.
* The original file is downloaded from the signed URL; the in-app preview works on an
  in-memory buffer, so nothing is written to a third party.

---

## 5. Realtime

`public.messages` and `public.conversations` are added to the `supabase_realtime`
publication.

* Supabase evaluates the **table's RLS policies for every subscriber** of a
  `postgres_changes` channel. A client is therefore only notified about the rows it
  is allowed to read.
* The subscriptions are narrow: one channel per conversation, filtered with
  `conversation_id=eq.<id>`, plus one channel for the conversation list.
* Every channel is removed in the effect cleanup, so a closed tab does not keep a
  connection alive.
* The channel names contain the conversation id — that is not a secret, because the
  events are still filtered by the RLS policies.

---

## 6. Frontend hardening

| Concern | Measure |
| --- | --- |
| Error messages | `toAppError()` maps every failure to a fixed Arabic message. Raw PostgREST messages, SQL fragments, table names and stack traces never reach the visitor; the original error is kept for the console only. |
| Privileged key in the bundle | `src/config/env.ts` throws at start-up if a public variable looks like a service-role key. |
| XSS | React escapes by default; the application never renders `dangerouslySetInnerHTML`. The DOCX preview is the single place where the library injects markup — it is rendered into a container that is emptied before every render, and the content comes from a document the teacher uploaded. |
| CSRF | The browser only ever talks to the Supabase REST/Auth API with the user's own bearer token; there is no cookie based session and no server that could be tricked into acting on the user's behalf. |
| Open redirect | The router only redirects to fixed internal paths. |
| `target="_blank"` | Not used; the download uses a same-tab navigation. |
| Dependencies | 12 runtime dependencies, no framework beyond React, no analytics, no third-party script. The only external requests are to the Supabase project the owner configured. |
| Secrets in the repository | `.env` and `.env.*` are git-ignored, `.env.example` contains placeholders only. |
| Password handling | Handled entirely by Supabase Auth; the application never sees a hash. Minimum length is enforced by the zod schema. |

---

## 7. What the automated tests actually prove

| Claim | Verified by | Against |
| --- | --- | --- |
| A student cannot create, edit, publish, archive or delete a class | `tests/db/rls.test.ts`, `tests/app/services/classes.test.ts` | real PostgreSQL + emulator |
| A student cannot create, edit, publish, archive or delete a lesson | same | real PostgreSQL + emulator |
| A student cannot attach, edit, replace or delete a document | `tests/db/rls.test.ts`, `tests/app/services/documents.test.ts` | real PostgreSQL + emulator |
| A student cannot obtain a signed URL for an unpublished document | `tests/app/services/documents.test.ts` | emulator |
| A document path cannot be repointed at a foreign lesson | `tests/db/rls.test.ts`, `tests/app/services/documents.test.ts` | real PostgreSQL + emulator |
| A student cannot read another student's messages | `tests/db/rls.test.ts`, `tests/app/services/messaging.test.ts` | real PostgreSQL + emulator |
| A message cannot be sent with somebody else's `sender_id` | `tests/db/rls.test.ts`, `tests/app/services/messaging.test.ts` | real PostgreSQL + emulator |
| A student cannot open a thread with another student | `tests/db/rls.test.ts`, `tests/app/services/messaging.test.ts` | real PostgreSQL + emulator |
| A profile role cannot be changed by a client | `tests/db/rls.test.ts`, `tests/app/services/profiles.test.ts` | real PostgreSQL + emulator |
| A profile cannot be created by a client | `tests/app/services/profiles.test.ts` | emulator |
| `set_user_role()` is not callable by `anon`/`authenticated` | `tests/db/rls.test.ts` | real PostgreSQL |
| The upload uses the *user's* token, never a privileged one | `tests/app/unit/storage-upload.test.ts` | unit test of the request shape |
| An anonymous visitor is redirected away from every private page | `tests/app/routes.test.tsx` | jsdom render |

---

## 8. Known risks, ambiguities and limits

Stated plainly, because "secure" is a claim that needs its evidence attached.

1. **The application level emulator is not PostgreSQL.**
   `tests/app/support/fake-backend.ts` re-implements the policies in TypeScript. It
   is a faithful re-implementation and it caught a real bug during development
   (the row identity semantics of PostgREST), but it is **not** a second source of
   truth about PostgreSQL behaviour. The authoritative check is
   `tests/db/rls.test.ts`.

2. **The end-to-end path against a live Supabase project was not executed.**
   No Supabase credentials were available in the authoring environment. The
   migrations were verified against a real PostgreSQL 17 server with the Supabase
   emulation of `auth`/`storage`; the browser side was verified against the
   emulator. The behaviour of the *real* Supabase Auth, Storage and Realtime
   services is therefore documented but not measured here. The manual test
   procedure in `DEPLOYMENT.md §9` exists exactly for that gap.

3. **The Realtime authorisation was verified by documentation, not by execution.**
   The claim "Supabase applies the table's RLS policies to every `postgres_changes`
   subscriber" comes from the Supabase documentation, not from a test run in this
   environment. The narrow, filtered subscriptions are a second layer of safety, but
   the claim itself should be re-verified on a live project (test step 11 in the
   deployment guide).

4. **The bucket policies are exercised by the emulator, not by Supabase Storage.**
   The SQL of `20260101000500_storage.sql` is written against the documented
   `storage.objects` schema, but it has not been applied to a real Supabase
   project. Applying it is step 3 of the deployment guide, and the verification
   queries in §3.1 of the deployment guide check the result.

5. **Realtime `DELETE` events are not RLS-filterable.**
   Supabase documents that `DELETE` changes cannot be filtered per subscriber. The
   application therefore never relies on a delete event: every mutation invalidates
   the React Query cache, and the thread re-reads the affected page.

6. **The teacher area assumes one teacher.** The schema allows several, but the
   "message the teacher" button of the student interface resolves to the *oldest*
   teacher profile. With several teachers, a student would always reach the first
   one. This is a product decision, not a security hole.

7. **No rate limiting is implemented in the application.** The Supabase platform
   applies its own limits (Auth requests, API requests); the storage bucket limit
   protects the file size. A determined attacker could still hammer the public
   endpoints. Cloudflare can add a WAF rule for that — out of scope here.

8. **No audit log.** A teacher action is not recorded anywhere except the
   `updated_at`/`created_by` columns. A real deployment with several staff members
   would want an audit table.

9. **Signed URLs leak to the browser.** That is inherent to a browser based download.
   The 120 second lifetime limits the exposure; a stricter deployment could proxy
   the download through a function.

10. **The `service_role` key is a single point of failure.** Whoever holds it can
    do everything. It must live only in the owner's shell / CI secret store, and
    must be rotated if it is ever exposed.

---

## 9. Reporting a vulnerability

This is a private, single-teacher deployment. If you find a problem in this
codebase, report it to the owner of the repository directly, with a reproduction
description. Please do not publish a working exploit for a deployment that is in use.
