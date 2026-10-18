# رِواق — منصة الرياضيات التعليمية

<div dir="rtl">

منصة تعليمية لرياضيات موجَّهة لمعلّم واحد وطلابه: صفوف ودروس ومواد (PDF/DOCX) ورسائل
خاصة بين الطرفين. الواجهة عربية بالكامل (RTL) بهوية بصرية سينمائية: كحلي منتصف الليل،
عاجي دافئ، وذهب شامبانيا هادئ.

</div>

---

## 1. What this is

A production-oriented, Arabic-first (RTL) web application for a single teacher and their
students. It is **not** a mockup: the frontend talks to a real Supabase project
(Auth + PostgreSQL + Row Level Security + Storage + Realtime), and the database refuses
everything a student is not allowed to do.

| Area | Summary |
| --- | --- |
| Stack | React 19 + TypeScript (strict) + Vite 8 + Tailwind CSS 4 + Supabase JS 2 + React Query 5 |
| Auth | Email/password sign-up, sign-in, sign-out, password reset, session persistence, profile |
| Roles | `student` and `teacher`. **The teacher role is only granted server-side.** |
| Content | Dynamic classes → lessons → documents (PDF/DOCX) with publish / archive / reorder |
| Documents | Private storage bucket, content-based type detection, upload progress, in-app PDF preview, browser-side DOCX rendering, versioned replacement |
| Messaging | Private student ↔ teacher threads in PostgreSQL, paginated, Realtime, unread counters |
| Database | 7 versioned SQL migrations, RLS on every table, storage policies, database triggers |
| Tests | 120 automated tests (80 application level, 35 against a real PostgreSQL server, 5 UI render) |
| Deployment | Static build → Cloudflare Pages, with a documented SPA fallback |

---

## 2. Quick start

### 2.1 Requirements

* **Node.js 22 LTS** (Node 20 works for the build, but `pdfjs-dist` declares `node >= 22`
  and the jsdom test environment needs Node 22 for `zstd` support in `undici`).
* A free Supabase project (for a real deployment) — see [DEPLOYMENT.md](./DEPLOYMENT.md).
* Optional, only for the database test suite: a local PostgreSQL 14+ server.

### 2.2 Install

```bash
npm install          # or: npx npm@11 install   (npm 10 can fail on vitest 5's optional peers)
```

### 2.3 Configure

```bash
cp .env.example .env.local
```

Fill in the two **public** values from the Supabase dashboard
(*Project Settings → API*):

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> The service-role key **must never** appear in a `VITE_` variable, in the repository or
> in the browser. `src/config/env.ts` refuses to boot the application when it detects a
> privileged key in a public variable.

### 2.4 Run

```bash
npm run dev        # http://localhost:5173
```

### 2.5 Create the first teacher

Registration always creates a **student**. The teacher account is provisioned by the
project owner with the service-role key, from the command line:

```bash
export SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role key from the dashboard>"
node scripts/provision-teacher.mjs --email teacher@example.com
```

Add `--create` to let the script create the auth user too (it prints a generated
password once). See [DEPLOYMENT.md §6](./DEPLOYMENT.md) for the full procedure and the
reason why this cannot be a button.

---

## 3. Repository layout

```
.
├── src/
│   ├── App.tsx                    # router: public routes, protected shell, role guards
│   ├── main.tsx                   # StrictMode + QueryClientProvider
│   ├── config/
│   │   ├── env.ts                 # environment validation, privileged-key guard, app config
│   │   └── navigation.ts          # role based navigation
│   ├── lib/
│   │   ├── supabase.ts            # the single Supabase client (public key only)
│   │   ├── database.types.ts      # hand maintained types of the six tables
│   │   ├── errors.ts              # AppError + toAppError (no internal details leak out)
│   │   ├── validation.ts          # zod schemas shared by the forms
│   │   ├── storage-upload.ts      # XHR uploader with real progress
│   │   ├── format.ts              # Arabic dates, numbers, byte sizes, initials
│   │   ├── query-client.ts        # React Query defaults
│   │   └── cn.ts
│   ├── hooks/                     # use-auth, use-theme, use-toast, use-unread-count,
│   │                              # use-realtime, use-debounced-value
│   ├── services/                  # the only place that talks to Supabase
│   │   ├── profiles.ts  classes.ts  lessons.ts  documents.ts
│   │   └── conversations.ts  messages.ts  stats.ts
│   ├── components/
│   │   ├── ui/                    # button, field, card, badge, feedback, dialog, avatar, pagination
│   │   ├── layout/                # app shell, navigation, user menu, auth layout, page header
│   │   ├── auth/                  # protected route
│   │   ├── brand/  marketing/     # logo, hero, sections, footer, mathematical motifs
│   │   ├── documents/             # PDF viewer, DOCX viewer, unified document viewer,
│   │   │                          # the teacher's upload / edit / replace dialogs
│   │   └── messaging/             # conversation list, thread, composer
│   └── pages/
│       ├── public/                # landing, login, register, forgot/reset password
│       ├── student/               # dashboard, classes, class detail, lesson, documents, messages
│       ├── teacher/               # dashboard, classes, class/lesson forms, documents,
│       │                          # students, conversations, conversation
│       ├── shared/profile.tsx     # one profile page, used by both roles
│       ├── not-found.tsx  configuration-notice.tsx
├── supabase/migrations/           # 7 versioned migrations (schema, helpers, triggers,
│                                  # RLS, storage, teacher provisioning, realtime + grants)
├── scripts/
│   ├── local-db/setup.sh          # creates the local verification database
│   ├── local-db/teardown.sh
│   ├── local-db/supabase_emulation.sql
│   ├── provision-teacher.mjs      # owner side role management (service role key)
│   └── fetch-fonts.mjs            # regenerates the self-hosted web fonts
├── tests/
│   ├── db/rls.test.ts             # 35 tests against a REAL PostgreSQL server
│   ├── app/                       # 80 application level tests + 5 render tests
│   │   ├── support/fake-backend.ts  # in-memory Supabase emulator with the same RLS rules
│   │   ├── support/harness.ts
│   │   ├── services/  pages/  unit/
│   └── setup.ts
├── docs/ACCEPTANCE.md            # the requirement-by-requirement acceptance report
├── public/                        # fonts, favicon, _redirects (SPA fallback)
├── .env.example
├── eslint.config.js
├── vite.config.ts
└── tsconfig*.json
```

---

## 4. Architecture notes

### 4.1 The data flow

```
page  →  service (src/services/*)  →  supabase-js  →  PostgREST + Storage + Realtime
                                            ↑
                                   RLS decides what is allowed
```

The pages never build a query themselves; every read and write goes through a typed
service function. That keeps the "what is allowed" question in exactly two places:
the service layer (UX, error mapping) and the database (authorisation).

### 4.2 Why the role can never be forged

1. `signUp` only ever sends `full_name` and `grade_level` to Supabase Auth.
2. The database trigger `handle_new_user` creates every profile with the **hard coded**
   role `student`.
3. The trigger `guard_profile_role_change` refuses any `UPDATE` of `profiles.role`.
4. The role can only be changed through `public.set_user_role()`, which is
   `SECURITY DEFINER` and raises unless the request carries the `service_role` JWT.
   `anon` and `authenticated` have no `EXECUTE` privilege on it.
5. The only caller of that function is `scripts/provision-teacher.mjs`, which runs on
   the owner's machine with the service-role key.

The frontend additionally hides the teacher interface from students — but that is a
*usability* measure only. Even a modified browser cannot create a class, publish a
lesson, read another student's messages or change a role: the database rejects it.

### 4.3 Documents

* The storage bucket `lesson-documents` is **private**. Students never receive a public
  URL; they receive a short-lived signed URL (120 s) that the storage policies authorise
  per object.
* The type of a file is detected from its **content** (`%PDF` magic bytes, ZIP + 
  `word/document.xml` for DOCX), not from its name or the browser's MIME type. The
  server-side boundary is the bucket's `allowed_mime_types` and `file_size_limit`
  (25 MiB).
* Every object lives under
  `classes/{class}/lessons/{lesson}/documents/{document}/v{n}/{file}`; a database
  trigger verifies that the path really belongs to the row, so a document can never
  point at a foreign lesson.
* Replacing a file writes `v{n+1}` first and only then switches the row, so a failed
  replacement always leaves the previous, working file in place. The previous object is
  removed afterwards.
* The DOCX preview renders **in the browser** with `docx-preview`. No file ever leaves
  the platform for an external conversion service.

### 4.4 Messaging

* One conversation per (student, teacher) pair, enforced by a unique constraint.
* Messages are plain text, 1–4000 characters, enforced by a `CHECK` constraint and by
  the `guard_message_sender` trigger (`sender_id = auth.uid()`), so a student can
  neither impersonate the teacher nor write into a foreign conversation.
* History is paginated with a `created_at` cursor (30 messages per page); older pages
  are fetched on demand.
* Realtime is a narrow `postgres_changes` subscription per conversation, filtered by
  `conversation_id`, and removed when the component unmounts. Supabase evaluates the
  table's RLS policies for every subscriber, so a client only receives the events of the
  conversations it takes part in.

### 4.5 Performance choices

* Route level code splitting — the PDF engine (≈640 kB raw) is only downloaded when a
  document is opened.
* Indexed, paginated queries; the student list and the message history never load a
  full table.
* Unread counters are aggregated with `count: 'exact', head: true` and refreshed at
  most once a minute.
* Signed URLs are short-lived and created on demand, not stored.
* Upload progress is reported by a real `XMLHttpRequest` progress event.

---

## 5. Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run build` | `tsc -b` + production build into `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run typecheck` | `tsc -b --force` — strict type check of app, node and test projects |
| `npm run lint` | ESLint (flat config) over the whole project |
| `npm run lint:fix` | ESLint with auto fix |
| `npm test` | All test suites (application + database) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run test:db` | Only the PostgreSQL Row Level Security suite |
| `npm run db:local:setup` | Creates the local verification database and applies all migrations |
| `npm run db:local:teardown` | Drops that database |
| `npm run teacher:provision` | Promotes an account to the teacher role (owner side) |

---

## 6. Testing

### 6.1 The two suites

**`tests/db/rls.test.ts` — 35 tests against a real PostgreSQL server.**
The migrations are applied to a real database and the suite impersonates the Supabase
API roles (`anon`, `authenticated`, `service_role`) to prove that the *database* —
not the frontend — enforces the rules: a student cannot create a class, publish a
lesson, read another student's messages, impersonate a sender, change a role or
download a document of an unpublished lesson.

```bash
bash scripts/local-db/setup.sh     # once
npm run test:db
```

The suite skips itself (with a warning) when no database is reachable, so `npm test`
stays green on a machine without PostgreSQL.

**`tests/app/**` — 85 application level tests.**
They run in jsdom against `tests/app/support/fake-backend.ts`, an in-memory Supabase
emulator that re-implements the same policies, the same triggers and the same storage
rules. It is a faithful re-implementation, **not** a PostgreSQL engine — claims about
database behaviour in the acceptance report always refer to the real PostgreSQL suite.

Covered: class and lesson CRUD, publish visibility, student modification attempts,
document upload / validation / replacement / deletion, signed-URL access, messaging
(send, reply, persistence, isolation, impersonation, unread counters, pagination),
role escalation attempts, the route guards and the rendering of the public pages.

### 6.2 Verified results

```
typecheck  tsc -b --force          → exit 0
lint       eslint .                → 0 problems
tests      vitest run              → 8 files, 120 tests, 120 passed
build      vite build              → success, dist/ ≈ 1.0 MB raw (≈ 300 kB gzip on first load)
```

---

## 7. Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the complete Cloudflare Pages guide:
build command, output directory, environment variables, the SPA fallback, the GitHub
connection, the Supabase configuration, the migrations, the secure first-teacher setup
and the test steps to run on the deployed site.

**[SECURITY.md](./SECURITY.md)** documents the security model, the intent of every
policy, the threat model and the known limitations.

**[docs/ACCEPTANCE.md](./docs/ACCEPTANCE.md)** is the requirement-by-requirement
acceptance report with the exact status of every item.

---

## 8. Known limitations

Honest about what is **not** done or not measured:

* No live Supabase project was available in the authoring environment, so the end-to-end
  path against a real Supabase instance (real Auth e-mails, real Storage, real
  Realtime websockets) was **not** executed. The database side is verified against a
  real PostgreSQL server with the same migrations; the browser side is verified against
  an emulator that mirrors the same rules.
* The number of students, files and messages the platform can carry is **not measured**.
  The free tier of Supabase (1 GB database, 1 GB storage, 5 GB egress/month, project
  inactivity pause after one week) is the real limit — see
  [DEPLOYMENT.md §10](./DEPLOYMENT.md).
* Only PDF and DOCX are accepted. Other formats are rejected by the client *and* by the
  bucket policy.
* Messages are text only; there is no attachment support.
* The teacher area assumes exactly one teacher account. The schema supports more, but
  the "student ↔ teacher" conversation lookup picks the oldest teacher profile.
