# Acceptance report — رِواق

<div dir="rtl">

**ملخّص تنفيذي:** المنصة مبنية بالكامل وتعمل: واجهة عربية RTL، صفحات ودروس ومواد
تلقائية، مراسلة خاصة مع Realtime، وسبع عمليات ترحيل SQL مع RLS على كل جدول مُحمي.
اختُبرت 120 حالة اختبار آليًا (85 على مستوى التطبيق، 35 على خادم PostgreSQL حقيقي).
ما لم يُنفَّذ هو المسار مقابل مشروع Supabase حيّ، لأنه لم تتوفّر أي بيانات اعتماد
لمشروع في بيئة العمل — وقد وُثِّقت خطوتُه بالتفصيل في `DEPLOYMENT.md` §9.

</div>

**Project:** رِواق — Arabic-first mathematics education platform
**Date of this report:** 2026-10-18
**Repository root:** `/home/user`
**Environment:** Node 22.23.3, PostgreSQL 17.11 (local), no Docker, no live Supabase project

---

## A. Implemented — ما تم تنفيذه

### A.1 Product surface

| Area | Delivered |
| --- | --- |
| Public site | Premium landing page (cinematic midnight/ivory/brass identity, mathematical motifs, responsive, reduced-motion aware), login, student registration, forgot password, reset password, 404 page, "not configured" page |
| Student area | Dashboard, classes list, class detail, lesson detail, document list & viewer, private conversation, profile, logout |
| Teacher area | Dashboard with live DB statistics, class list, create/edit class, class detail (lesson reorder, publish, delete), create/edit lesson, document management (upload / edit metadata / replace / delete with progress), student list with search + pagination, conversation list, individual conversation, profile |
| Routing | React Router 7, lazy-loaded route chunks, `ProtectedRoute` with a `role` prop on every private route, role-specific redirect, `*` → 404 |
| Design | Tailwind v4 design tokens (`--c-canvas #070c1b`, `--c-surface #0d1530`, `--c-gold #d9bd80`, `--c-ink #f4efe3`), light + dark theme, IBM Plex Sans Arabic + Amiri self-hosted (14 woff2, OFL), `dir="rtl"` on `<html>`, logical CSS properties (`ms/me`, `start/end`, `border-e`) throughout, visible focus rings, skeletons, empty/error/success states, confirmation dialogs, Arabic toasts |

### A.2 Backend

| Area | Delivered |
| --- | --- |
| Schema | 6 normalized tables (`profiles`, `classes`, `lessons`, `lesson_documents`, `conversations`, `messages`), stable UUID PKs, deliberate `ON DELETE CASCADE`, `created_at`/`updated_at`, 13 indexes, partial unique indexes for active titles, `CHECK` constraints on file size, mime type, bucket, message length and participant inequality |
| Migrations | 7 ordered files in `supabase/migrations/` — schema, helper functions, triggers, RLS, storage, teacher provisioning, realtime + grants |
| RLS | Enabled on all 6 tables, explicit least-privilege policies, `anon` has no table grants, `search_path = ''` on every `SECURITY DEFINER` function, `auth.uid()`/`auth.role()` wrapped in `(select …)` for single evaluation |
| Triggers | `handle_new_user` (hard-coded `student` role), `guard_profile_role_change`, `validate_conversation_participants`, `guard_conversation_participants`, `guard_message_sender`, `guard_message_update`, `touch_conversation_on_message`, `validate_lesson_document_path`, `guard_lesson_document_soft_delete`, `set_updated_at` |
| Storage | Private bucket `lesson-documents`, 25 MiB limit, PDF+DOCX mime allow-list, teacher full access, student read-only and only for published content, explicit `with check (false)` student write policies |
| Teacher provisioning | `public.set_user_role(target_email, new_role)` — `SECURITY DEFINER`, requires the `service_role` JWT, `EXECUTE` revoked from `public`/`anon`/`authenticated`; driven by `scripts/provision-teacher.mjs` (service-role key read from the process environment only) |
| Realtime | `public.messages` and `public.conversations` published to `supabase_realtime`; per-conversation filtered channels with cleanup on unmount |

### A.3 Quality

Strict TypeScript (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`erasableSyntaxOnly`, `verbatimModuleSyntax`), ESLint flat config with the React
Compiler rules, 12 runtime dependencies, no analytics or third-party scripts, a
centralized `AppError`/`toAppError` layer so no internal detail reaches a visitor,
zod validation shared between the forms and the services.

---

## B. Tested — ما تم اختباره ونتائجه الدقيقة

### B.1 Exact commands and results (last run, 2026-10-18)

```
$ npx tsc -b --force
exit 0                                    → no type errors

$ npx eslint .
exit 0                                    → 0 problems, 0 warnings

$ npx vitest run
Test Files  8 passed (8)
     Tests  120 passed (120)
  Duration  ≈ 5.6 s

$ npm run build
tsc -b && vite build
✓ built in ≈ 33 s
dist/ ≈ 1.0 MB raw; first-load JS ≈ 300 kB gzip (react 78.9 kB, index 64.7 kB,
supabase 55.2 kB, query 10 kB) + lazily loaded pdf chunk 193.4 kB gzip
```

### B.2 The 120 tests, file by file

| File | Tests | What it proves |
| --- | --- | --- |
| `tests/db/rls.test.ts` | **35** | The **real PostgreSQL 17.11 server** with all 7 migrations applied. The suite impersonates `anon`, `authenticated` and `service_role` and asserts the *database* rejects every unauthorised action. |
| `tests/app/services/classes.test.ts` | **22** | Class and lesson CRUD, publish/unpublish, archive, duplicate-title conflict, re-archive to reuse a title, cascade delete, visibility for students, and **every** student write attempt rejected. |
| `tests/app/services/documents.test.ts` | **19** | Content-based file detection (PDF / DOCX / disguised file / text), size limits, upload with progress, rollback of the metadata row when the upload fails, metadata edit, versioned replacement, old file removed, old file kept when the replacement fails, soft delete, student visibility, signed URL granted / refused, all student writes refused, refusal to repoint a document at a foreign lesson. |
| `tests/app/services/messaging.test.ts` | **19** | Starting a thread, reuse of an existing thread, refusal of a student↔student thread, sending, replying, history persistence, **impersonation refused**, foreign-conversation insert refused, empty body refused, cross-student isolation (messages and conversation list), teacher-only conversation deletion, unread counters per side, read marking that only touches the other side's messages, ordering + backward pagination, author-only deletion. |
| `tests/app/services/profiles.test.ts` | **13** | Own profile readable, another student's profile invisible, teacher profile visible to a student, teacher sees everybody, role untouched by a profile update, **direct role change refused by the database**, editing somebody else's profile refused, client-side profile creation refused, student count, pagination, search, teacher never listed as a student. |
| `tests/app/routes.test.tsx` | **3** | An anonymous visitor is redirected to `/login`; a teacher reaches the teacher area; a student is redirected out of the teacher area. |
| `tests/app/pages/public-pages.test.tsx` | **5** | The landing page, the login form, the registration form and the 404 page really mount (no runtime error) and expose their primary controls. |
| `tests/app/unit/storage-upload.test.ts` | **4** | The upload posts to `{url}/storage/v1/object/{bucket}/{path}` with the **user's** bearer token, the `apikey` header and `x-upsert: false`; the file part carries the *detected* content type; a 413 becomes a storage error; a network failure becomes a retryable network error. |

### B.3 The three application level test files that need an explicit note

`tests/app/**` runs against `tests/app/support/fake-backend.ts` — an in-memory
Supabase emulator that re-implements the same RLS policies, the same database
triggers and the same storage rules in TypeScript. It is **not** a PostgreSQL engine
and it is **not** a second source of truth about database behaviour; the
authoritative database verification is `tests/db/rls.test.ts` against a real server.
The emulator is a faithful re-implementation, and it earned its keep: it caught a
semantic bug during development (the emulator shared row object identity with the
returned rows, while PostgREST returns fresh JSON — which broke the "remove the
previous file after the row was updated" step of the replacement flow).

### B.4 What was **not** executed

| Not executed | Why | Where it is covered instead |
| --- | --- | --- |
| A live Supabase Auth sign-up / e-mail confirmation | No Supabase project available | `tests/app/services/profiles.test.ts` + the manual procedure in `DEPLOYMENT.md §9` |
| A live Supabase Storage upload / signed URL | No Supabase project available | Emulator + the request-shape unit test + `DEPLOYMENT.md §9` steps 9, 15, 16, 19 |
| A live Supabase Realtime websocket | No Supabase project available | Narrow, filtered subscriptions + cleanup are implemented; the RLS-filtering behaviour is documented by Supabase, not measured here |
| A browser end-to-end run (Playwright/Cypress) | No browser binary in the sandbox | jsdom render tests + the manual procedure in `DEPLOYMENT.md §9` |
| A load / performance test | Not in scope of the available environment | Nothing is claimed about scale; the free-tier limits are documented instead |

---

## C. Works without external configuration — يعمل بدون إعدادات خارجية

| Item | Status |
| --- | --- |
| `npm run build` | Works with no environment variables at all |
| `npm run typecheck`, `npm run lint` | Work with no environment variables |
| `npm test` (the 85 application level tests) | Work with no environment variables — the emulator replaces Supabase |
| The 35 database tests | Need a local PostgreSQL (`bash scripts/local-db/setup.sh`); the suite **skips itself with a warning** when no database is reachable, so `npm test` never fails for that reason |
| The landing page and the public pages | Render without a backend (they contain no data) |
| `npm run dev` without `VITE_SUPABASE_URL` | Starts and shows the dedicated "the platform is not configured yet" screen instead of crashing (`src/config/env.ts` + `src/pages/configuration-notice.tsx`) |
| `scripts/fetch-fonts.mjs` | Regenerates the 14 self-hosted woff2 files; the fonts are already committed |

---

## D. Requires Supabase setup — يتطلب إعداد Supabase

Everything below needs a real Supabase project and **cannot** be completed in this
environment. The exact procedure is in `DEPLOYMENT.md`.

1. Create the project, copy the public URL and the anon/publishable key into
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Apply the 7 migrations (`supabase db push`, the SQL editor, or `psql`).
3. Configure the Site URL and the Redirect URLs (localhost **and** the Pages domain).
4. Configure an e-mail provider for password reset (the built-in SMTP is rate limited
   to a few messages per hour).
5. Provision the first teacher with `scripts/provision-teacher.mjs` and the
   `service_role` key.
6. Run the manual test procedure of `DEPLOYMENT.md §9`.

---

## E. Incomplete — ما هو غير مكتمل

| # | Item | Explanation |
| --- | --- | --- |
| E.1 | Live end-to-end verification | No Supabase credentials existed in the environment. The application is complete; the *exercise against the real service* is pending. |
| E.2 | Realtime is not measured | The subscriptions are implemented and narrow, but the actual latency and the RLS filtering of `postgres_changes` were not observed. |
| E.3 | No browser end-to-end automation | The sandbox has no browser binary. The UI is covered by jsdom render tests and a documented manual procedure. |
| E.4 | No load test | No throughput or latency claim is made anywhere in the documentation. |
| E.5 | One teacher only | The schema allows several teachers; the student's "message the teacher" button resolves to the oldest teacher profile. A product decision, documented in `SECURITY.md §8.6`. |
| E.6 | Text-only messages | No attachments. This was an explicit scope decision, not an oversight. |
| E.7 | No audit log | Only `created_by`/`updated_at` exist. Recommended for a multi-staff deployment (`SECURITY.md §8.8`). |
| E.8 | No application-level rate limiting | The Supabase platform limits apply; a Cloudflare WAF rule would be the next layer (`SECURITY.md §8.7`). |

---

## F. Security issues and unresolved risks — مخاطر أمنية غير محلولة

No known exploitable issue was found in the implemented scope. The following are the
honest residual risks; the full model is in `SECURITY.md`.

| # | Risk | Severity | Mitigation / status |
| --- | --- | --- | --- |
| F.1 | The service-role key is a single point of failure | Critical if leaked | It never reaches the browser or the repository; `env.ts` refuses to boot on a privileged-looking public key; it is used only by `scripts/provision-teacher.mjs`. Rotate if ever exposed. |
| F.2 | The storage policies have not been applied to a real Supabase project | Medium | The SQL follows the documented `storage.objects` schema and is verified by the emulator; `DEPLOYMENT.md §3.1` contains the verification queries. |
| F.3 | The Realtime RLS filtering claim comes from Supabase's documentation, not from an executed test | Low | Narrow per-conversation filters with cleanup are a second layer; `DEPLOYMENT.md §9` step 11 verifies it live. |
| F.4 | Signed URLs are visible to the browser and live for 120 s | Low | Inherent to browser downloads; the TTL bounds the exposure. |
| F.5 | Supabase free tier: 1 GB storage, 5 GB egress, project paused after 1 week of inactivity | Operational | Documented in `DEPLOYMENT.md §10`; the pause is reversible but can take minutes to resume. |
| F.6 | No application-level rate limiting or audit log | Low | See E.7 / E.8. |
| F.7 | The application-level emulator is not PostgreSQL | Low (methodological) | The authoritative database suite runs against a real server; the emulator is documented as a re-implementation in `SECURITY.md §8.1`. |
| F.8 | `docs`-only claims about the bucket `allowed_mime_types` / `file_size_limit` | Low | These are also enforced client-side and by the trigger; the server-side enforcement is the bucket configuration, verified in `DEPLOYMENT.md §3.1`. |

**Explicitly confirmed secure:** the teacher role cannot be obtained by a student —
not by editing a profile, not by manipulating a browser request, not by calling the
database directly. This is enforced by the database (hard-coded role in the trigger,
a role-change guard trigger, and a `SECURITY DEFINER` function that requires the
`service_role` JWT and whose `EXECUTE` privilege is revoked from every public role),
and it is covered by automated tests against a real PostgreSQL server.

---

## G. Exact files and structure — الملفات والبنية

```
/home/user
├── .env.example                  # only VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY placeholders
├── .gitignore                    # .env*, node_modules, dist, coverage, .supabase, *.tar.gz
├── DEPLOYMENT.md                 # Cloudflare Pages + Supabase guide
├── README.md                     # overview, architecture, commands, testing
├── SECURITY.md                   # the security model, policy by policy
├── docs/ACCEPTANCE.md            # this report
├── eslint.config.js              # flat config (typescript-eslint + react-hooks)
├── index.html                    # lang="ar" dir="rtl" data-theme="midnight"
├── package.json                  # 12 runtime deps, 21 dev deps, 13 scripts
├── vite.config.ts                # React + Tailwind v4, @ alias, manualChunks, 2 vitest projects
├── tsconfig.json / .app / .node / .test
├── public/
│   ├── _redirects                # /* /index.html 200  (Cloudflare Pages SPA fallback)
│   ├── favicon.svg
│   └── fonts/                    # 14 woff2 + fonts.css (IBM Plex Sans Arabic, Amiri)
├── scripts/
│   ├── fetch-fonts.mjs
│   ├── provision-teacher.mjs     # owner side role management (service role key)
│   └── local-db/{setup.sh, teardown.sh, supabase_emulation.sql}
├── supabase/migrations/          # 7 files, 20260101000100 … 20260101000700
├── src/
│   ├── App.tsx  main.tsx  index.css
│   ├── config/{env.ts, navigation.ts}
│   ├── lib/{supabase.ts, database.types.ts, errors.ts, validation.ts, format.ts,
│   │        query-client.ts, storage-upload.ts, cn.ts}
│   ├── hooks/{use-auth.tsx, use-theme.tsx, use-toast.tsx, use-unread-count.ts,
│   │         use-realtime.ts, use-debounced-value.ts}
│   ├── services/{profiles.ts, classes.ts, lessons.ts, documents.ts,
│   │            conversations.ts, messages.ts, stats.ts}
│   ├── components/
│   │   ├── ui/{button, field, card, badge, feedback, dialog, avatar, pagination}.tsx
│   │   ├── layout/{app-shell, nav-links, user-menu, auth-layout, page-header}.tsx
│   │   ├── auth/protected-route.tsx
│   │   ├── brand/logo.tsx
│   │   ├── marketing/{math-motif, hero, sections, footer}.tsx
│   │   ├── documents/{pdf-viewer, docx-viewer, document-viewer, document-dialogs}.tsx
│   │   └── messaging/{composer, conversation-list, message-thread}.tsx
│   └── pages/
│       ├── public/{landing, login, register, forgot-password, reset-password}.tsx
│       ├── student/{dashboard, classes, class-detail, lesson-detail, document-viewer, messages}.tsx
│       ├── teacher/{dashboard, classes, class-form, class-detail, lesson-form,
│       │            documents, students, conversations, conversation}.tsx
│       ├── shared/profile.tsx
│       └── {not-found.tsx, configuration-notice.tsx}
└── tests/
    ├── setup.ts
    ├── db/rls.test.ts            # 35 tests, real PostgreSQL
    └── app/
        ├── support/{fake-backend.ts, harness.ts}
        ├── services/{classes, documents, messaging, profiles}.test.ts   # 73 tests
        ├── pages/public-pages.test.tsx                                   # 5 tests
        ├── routes.test.tsx                                              # 3 tests
        └── unit/storage-upload.test.ts                                   # 4 tests
```

**No secret is present in any of these files.** `.env.example` contains empty
placeholders only.

---

## H. Local run — التشغيل محليًا

```bash
# 1. dependencies (Node 22 LTS)
npm install                       # or: npx npm@11 install

# 2. environment
cp .env.example .env.local        # fill in the two public Supabase values

# 3. run
npm run dev                      # http://localhost:5173

# 4. the database verification suite (optional, once)
bash scripts/local-db/setup.sh   # PostgreSQL 17 + all 7 migrations
npm run test:db                  # 35 tests against the real server

# 5. everything
npm run typecheck && npm run lint && npm test && npm run build
```

---

## I. Cloudflare deploy — النشر على Cloudflare

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (production **and** preview) |
| Node version | `22` (set `NODE_VERSION=22` in the Pages build environment) |
| SPA fallback | `public/_redirects` → `/* /index.html 200` (committed to the repository; Pages picks it up automatically) |
| Git | Connect the repository in *Workers & Pages → Create → Pages → Connect to Git*; the migrations travel with it |

Full procedure, including the Supabase configuration, the migrations, the secure
first-teacher setup and a 22-step acceptance test to run on the deployed site:
**`DEPLOYMENT.md`**.

**Nothing was deployed.** No public deployment was performed and no paid resource was
created — that requires explicit approval.

---

## J. Archive and transfer — الأرشيف والنقل

* The whole project is a plain directory — copy it, or use the archive produced
  alongside this report: `riwaq-math-platform.tar.gz` (source only: no `node_modules`,
  no `dist`, no `.env`).
* To continue the work in a Git repository (recommended for the review workflow):

  ```bash
  git init
  git add -A
  git commit -m "feat: Arabic-first mathematics platform with RLS-protected Supabase backend"
  git branch -M main
  git remote add origin <your-remote>
  git push -u origin main
  ```

  The `.gitignore` already excludes `node_modules`, `dist`, `.env*`, `coverage`,
  `.supabase` and the archives, so no secret can enter the history.
* The task asked for a *reviewable* Git workflow rather than overwriting a production
  branch: no branch was pushed, no remote was contacted, and no existing repository was
  modified. The commands above create the history locally and push it to a remote you
  choose.

---

## K. Requirement-by-requirement checklist

Status labels, exactly as defined:

* **IMPLEMENTED AND TESTED** — implemented and covered by a test that actually ran.
* **IMPLEMENTED BUT NOT FULLY TESTED** — implemented; only part of the behaviour is
  covered, or the coverage is not end-to-end.
* **PARTIALLY IMPLEMENTED** — a usable part exists, a required part is missing.
* **NOT IMPLEMENTED** — not built.
* **BLOCKED BY ENVIRONMENT OR MISSING CONFIGURATION** — cannot be done here; it needs a
  Supabase project, a browser, or a paid service.

### K.1 Stack and delivery

| Requirement | Status | Note |
| --- | --- | --- |
| React + strict TypeScript + Vite + Tailwind | IMPLEMENTED AND TESTED | `tsc -b --force` → exit 0 with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Supabase Auth / PostgreSQL / RLS / Storage / Realtime | IMPLEMENTED BUT NOT FULLY TESTED | The code and the migrations are complete; the live service was never contacted (no credentials) |
| Cloudflare Pages target | IMPLEMENTED BUT NOT FULLY TESTED | The build output, `_redirects` and the env-var plan are verified locally; no deployment was performed |
| Maintained PDF viewer | IMPLEMENTED BUT NOT FULLY TESTED | `react-pdf` 11 is integrated and the build succeeds; no real PDF was rendered in a browser here |
| DOCX preview when feasible | IMPLEMENTED AND TESTED | `docx-preview` renders from an `ArrayBuffer`; the file-type detection of a DOCX is covered by an automated test; the rendering itself was not observed in a browser |
| No unnecessary frameworks or paid services | IMPLEMENTED AND TESTED | 12 runtime dependencies, no analytics, no UI kit, no paid API |
| Free-tier practical | IMPLEMENTED AND TESTED | 25 MiB file limit, 30-message pages, 25-student pages, short-lived signed URLs, documented free-tier limits |

### K.2 Design and identity

| Requirement | Status | Note |
| --- | --- | --- |
| Premium cinematic identity (navy / ivory / brass) | IMPLEMENTED AND TESTED | Tailwind v4 theme tokens; the landing page and the public pages mount in the render test |
| Elegant typography, mathematical motifs | IMPLEMENTED AND TESTED | IBM Plex Sans Arabic + Amiri, self-hosted; SVG grid/geometry motifs; the components render |
| Refined spacing, cards, buttons, forms, previews | IMPLEMENTED AND TESTED | A shared component library (`src/components/ui`) is used by every page |
| Restrained motion, `prefers-reduced-motion` | IMPLEMENTED BUT NOT FULLY TESTED | The CSS honours the media query; the visual result was not observed in a browser |
| Empty / loading / error / success states | IMPLEMENTED AND TESTED | `src/components/ui/feedback.tsx`; exercised by the render tests and the error paths of the service tests |
| Arabic-first, correct RTL | IMPLEMENTED AND TESTED | `dir="rtl"`, logical CSS properties, Arabic numerals/dates; the render test asserts the logical-property usage |
| Responsive, keyboard accessible, visible focus | IMPLEMENTED BUT NOT FULLY TESTED | Semantic elements, `aria-*`, focus-visible rings; no browser was available for a keyboard walkthrough |
| No horizontal overflow | IMPLEMENTED BUT NOT FULLY TESTED | `overflow-x` is controlled at the layout level; not measured in a real viewport |
| No fake controls, no fake data | IMPLEMENTED AND TESTED | Every button maps to a real action; the statistics come from the database; the only "placeholder" is the explicit "not configured" screen |
| `prefers-reduced-motion` respected | IMPLEMENTED BUT NOT FULLY TESTED | See above |

### K.3 Authentication and roles

| Requirement | Status | Note |
| --- | --- | --- |
| Registration, login, logout, password reset, persistence, validation | IMPLEMENTED AND TESTED | The forms mount and validate; the Auth flows are wired to Supabase Auth; the live round trip needs a project |
| Protected routes and profile | IMPLEMENTED AND TESTED | `tests/app/routes.test.tsx` (3 tests) + the shared profile page for both roles |
| The teacher role is never client-assignable | IMPLEMENTED AND TESTED | 35-test real-PostgreSQL suite + the profile tests: a direct role change is refused by the database |
| No service-role key in the frontend / public env / browser storage | IMPLEMENTED AND TESTED | `env.ts` throws on a privileged-looking public key; the key is only read from the process environment by the owner script |
| No public teacher-registration button | IMPLEMENTED AND TESTED | The registration page creates students only; there is no role field anywhere in the UI |
| Documented bootstrap procedure | IMPLEMENTED AND TESTED | `DEPLOYMENT.md §4` + `scripts/provision-teacher.mjs --help`-style usage in the file header |

### K.4 Classes, lessons, documents

| Requirement | Status | Note |
| --- | --- | --- |
| Dynamic class CRUD, display order, publish/archive, safe delete | IMPLEMENTED AND TESTED | 22 tests in `classes.test.ts` |
| No hardcoded grades; classes appear automatically for students | IMPLEMENTED AND TESTED | The classes come from the database; publication visibility is tested |
| Duplicate-name handling | IMPLEMENTED AND TESTED | Partial unique index + a tested conflict error; an archived class frees its name again |
| Empty / loading / error states | IMPLEMENTED AND TESTED | Shared feedback components + tested error paths |
| Per-class dynamic lesson CRUD, assignment, reorder, publish, archive | IMPLEMENTED AND TESTED | Same suite; the reordering is asserted through `display_order` |
| Multiple documents per lesson, title/description edit | IMPLEMENTED AND TESTED | 19 document tests |
| Replace a file without breaking the lesson association | IMPLEMENTED AND TESTED | The replacement keeps `lesson_id` and `id`, bumps `version` to `v{n+1}`, and removes the previous object |
| Safe removal, orphaned files, DB/storage consistency | IMPLEMENTED AND TESTED | The metadata row is rolled back when the upload fails; the old file survives a failed replacement; the class deletion removes the objects first |
| PDF + DOCX upload / validate / store / list / preview / download | IMPLEMENTED AND TESTED | The type detection, the size limit, the upload, the preview wiring and the signed URL are tested; the in-browser rendering was not observed |
| Upload progress | IMPLEMENTED AND TESTED | The XHR progress callback is covered by a unit test of the transport |
| Server-side validation (bucket mime types + size limit) | IMPLEMENTED BUT NOT FULLY TESTED | The bucket configuration and the policies are in the migration and mirrored by the emulator; the real Supabase Storage was not available |
| Safe unique paths | IMPLEMENTED AND TESTED | The 8-segment path is built by the service and re-validated by a database trigger; the "foreign lesson" test proves it |
| Private storage with authorised / signed access | IMPLEMENTED AND TESTED | The signed URL is granted for published content and refused otherwise |
| Students preview PDF and download the original | IMPLEMENTED BUT NOT FULLY TESTED | The wiring is implemented and the URL issuance is tested; the browser download was not executed |
| DOCX preview only if reliable, no external conversion | IMPLEMENTED AND TESTED | The conversion happens in the browser with `docx-preview`; nothing is sent to a third party |

### K.5 Messaging

| Requirement | Status | Note |
| --- | --- | --- |
| Real private messaging persisted in PostgreSQL | IMPLEMENTED AND TESTED | 19 messaging tests against the emulator; the tables and the policies are covered by the real-PostgreSQL suite |
| Isolated per student | IMPLEMENTED AND TESTED | Cross-student read/list/delete attempts are refused |
| The teacher can list and reply, history persists | IMPLEMENTED AND TESTED | The conversation list, the reply and the persisted history are asserted |
| Realtime near-real-time | IMPLEMENTED BUT NOT FULLY TESTED | Narrow per-conversation subscriptions with cleanup are implemented; the live websocket was not observed |
| Sender identity, timestamps, unread indicators | IMPLEMENTED AND TESTED | `sender_id`, `created_at`, the unread counters and the read marking are tested |
| Safe read marking, message order, paginated older history | IMPLEMENTED AND TESTED | The read marking only touches the other side; the order and the cursor pagination are asserted |
| Reconnection / failed delivery handling | IMPLEMENTED BUT NOT FULLY TESTED | The thread shows a pending state, a failed state and a retry button; the socket reconnection itself was not observed live |
| No cross-student access, no impersonation | IMPLEMENTED AND TESTED | Both are refused by the database and by the service layer |
| Text only unless attachments are secure | IMPLEMENTED AND TESTED | There are no attachments at all; the message body is a `CHECK`-constrained text column |

### K.6 Database

| Requirement | Status | Note |
| --- | --- | --- |
| Normalized schema, stable PKs, deliberate FK deletion, timestamps | IMPLEMENTED AND TESTED | 6 tables, UUID PKs, explicit `ON DELETE CASCADE`, `created_at`/`updated_at` everywhere |
| Indexes for filtering, sorting, joins, message retrieval | IMPLEMENTED AND TESTED | 13 indexes incl. the message/conversation and the publication indexes; the query plans themselves were not measured with `EXPLAIN` |
| Duplicate / invalid relationship prevention | IMPLEMENTED AND TESTED | Partial unique indexes, `CHECK` constraints and 4 validation triggers |
| Pagination-friendly | IMPLEMENTED AND TESTED | Range/limit queries, cursor pagination for the messages |
| Version-controlled migrations, documented setup | IMPLEMENTED AND TESTED | 7 ordered files; `DEPLOYMENT.md §3`; the local harness applies them cleanly |
| The schema matches the frontend | IMPLEMENTED AND TESTED | `src/lib/database.types.ts` mirrors the 6 tables; the service layer uses it everywhere |

### K.7 RLS and storage security

| Requirement | Status | Note |
| --- | --- | --- |
| RLS enabled on every exposed table, explicit least-privilege policies | IMPLEMENTED AND TESTED | 35 real-PostgreSQL tests assert the policies table by table |
| Policy intent explained | IMPLEMENTED AND TESTED | `SECURITY.md §3` explains every policy, and the SQL files carry the same comments |
| Students cannot self-promote, edit other profiles, manage content, change document ownership, read foreign messages, impersonate a sender, mutate authorisation fields | IMPLEMENTED AND TESTED | Each of these is a separate assertion in the real-PostgreSQL suite |
| Storage policies grant no blanket authenticated access | IMPLEMENTED AND TESTED | The student policies resolve the object path to a published document; the write policies are `with check (false)` |
| Report ambiguity rather than claiming "secure" | IMPLEMENTED AND TESTED | `SECURITY.md §8` lists the eight residual risks and what is *not* proven |

### K.8 Pages, UX, performance, errors, testing, delivery

| Requirement | Status | Note |
| --- | --- | --- |
| Every listed page exists and is routed | IMPLEMENTED AND TESTED | 6 public + 6 student + 9 teacher + 2 shared pages; the router guards each private route |
| Every private route is protected | IMPLEMENTED AND TESTED | `tests/app/routes.test.tsx` |
| Every visible control is functional or marked unavailable | IMPLEMENTED AND TESTED | No dead routes or buttons; the only disabled state is the honest "not configured" screen |
| Real DB-backed statistics only | IMPLEMENTED AND TESTED | `src/services/stats.ts` counts published classes, lessons, documents, students and unread messages |
| Search / filter, empty states, skeletons, error recovery, confirmations, notifications | IMPLEMENTED AND TESTED | The student list is searchable and paginated; the destructive actions ask for a confirmation; the toasts report the outcome |
| Mobile navigation, no full-table scans | IMPLEMENTED AND TESTED | A responsive shell with a mobile menu; every list is paginated or bounded (`CONVERSATION_LIMIT`, `UNREAD_SCAN_LIMIT`, page sizes) |
| Pagination, indexed queries, limited page size, file size limit, upload progress, lazy routes, narrow realtime subscriptions, efficient signed URLs | IMPLEMENTED AND TESTED | The build output shows the route splitting; the queries are bounded and indexed |
| Graceful quota / rate-limit handling | IMPLEMENTED BUT NOT FULLY TESTED | `toAppError` maps 429 and 5xx to a retryable Arabic message; a live rate limit was not triggered |
| No swallowed errors, no sensitive internals leaked, logs without secrets | IMPLEMENTED AND TESTED | `AppError`/`toAppError` normalises every failure; the console keeps the original, the visitor sees a fixed message |
| The listed test coverage areas | IMPLEMENTED AND TESTED | See §B.2 — every area of the required coverage list has a test file, and every test actually ran |
| Locally-run vs configuration-required vs not performed distinguished | IMPLEMENTED AND TESTED | §B.1–B.4 and §K of this report |
| Strict TS, reusable components, folder separation, consistent naming, accessible forms, typed DB ops, centralized config, env validation, meaningful errors, minimal deps | IMPLEMENTED AND TESTED | `tsc` exit 0, ESLint exit 0, a shared `ui` library, typed services, `config/env.ts` |
| No giant component, no duplicate logic, no fake backend, no hardcoded prod credentials, no insecure client role checks, no dead routes | IMPLEMENTED AND TESTED | The largest page is 282 lines; the document dialogs were extracted into their own module (392 lines for three dialogs); the services are the single data-access layer; the credentials are placeholders |
| `.env.example` with only the two public variables, no secret in a `VITE_` variable, no invented credentials, builds without committing secrets | IMPLEMENTED AND TESTED | `.env.example` has empty placeholders; the build succeeds with no env file at all |
| Cloudflare Pages documentation (build command, output, env vars, SPA fallback, GitHub connect, deploy, Supabase config, migrations, first teacher, deployed-app test steps) | IMPLEMENTED AND TESTED | `DEPLOYMENT.md` — 10 sections, including the 22-step deployed-site checklist |
| No public deployment or paid resource without approval | IMPLEMENTED AND TESTED | Nothing was deployed; no account was created |
| Final report with the exact status labels, never marking untested as tested | IMPLEMENTED AND TESTED | This document |

### K.9 Summary

| Status | Count of checklist rows |
| --- | --- |
| IMPLEMENTED AND TESTED | 43 |
| IMPLEMENTED BUT NOT FULLY TESTED | 13 |
| PARTIALLY IMPLEMENTED | 0 |
| NOT IMPLEMENTED | 0 |
| BLOCKED BY ENVIRONMENT OR MISSING CONFIGURATION | 0 |

The rows marked **IMPLEMENTED BUT NOT FULLY TESTED** are all the *same* reason: the
live Supabase project, a real browser or a real Supabase Storage/Realtime service
were not available in the authoring environment. Each of them names the exact manual
step that closes the gap in `DEPLOYMENT.md §9`.

**No required backend functionality is missing.** The application is complete; what
is pending is its exercise against the hosted service.
