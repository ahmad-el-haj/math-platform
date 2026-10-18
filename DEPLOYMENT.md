# Deployment guide — رِواق

This guide takes the platform from "works on my machine" to "running on Cloudflare
Pages with a real Supabase backend". It is written for a single owner and one teacher
account, on the Supabase free tier.

---

## 1. What gets deployed where

| Piece | Where | Why |
| --- | --- | --- |
| The web application | Cloudflare Pages (static assets) | It is a single page app: HTML + JS + CSS + fonts. No server runtime needed. |
| Authentication, database, files, realtime | Supabase (free tier) | Managed Postgres with Row Level Security, private Storage and Realtime. |
| The migrations | Applied to the Supabase database | The schema, the policies and the triggers are versioned in `supabase/migrations/`. |

> **A successful frontend deployment does not mean the backend is correct.**
> The frontend boots even when the Supabase project is empty or misconfigured
> (it then shows the "not configured" screen). Always run the steps in
> [§9](#9-testing-the-deployed-site) after the first deployment.

---

## 2. 1 — Create the Supabase project

1. <https://supabase.com/dashboard> → **New project**.
2. Pick a region close to your users (the teacher's students), a strong database
   password, and a name such as `riwaq-math`.
3. Wait for the project to finish provisioning.

### 2.1 Authentication settings

* **Site URL / Redirect URLs** (Authentication → URL Configuration):
  * `http://localhost:5173` — for local development.
  * `https://<your-project>.pages.dev` — the Cloudflare Pages URL.
  * `https://<your-domain>` — if you attach a custom domain.
* **Email provider**: the default SMTP provider of Supabase is rate limited
  (2–4 e-mails per hour on the free tier) and only sends to project members.
  For a real class, connect a transactional provider (Resend, Postmark, Brevo…)
  or enable the Supabase SMTP relay. This is a **configuration step that requires
  an account you own** — it was not performed here.
* **Confirm email**: keep it *on*. The application handles the "check your inbox"
  state explicitly (`register.tsx`).

### 2.2 Get the public keys

*Dashboard → Project Settings → API.*

| Value | Where it goes | Secret? |
| --- | --- | --- |
| Project URL | `VITE_SUPABASE_URL` | No — it is public by design |
| `anon` / `publishable` key | `VITE_SUPABASE_ANON_KEY` | No — it is protected by RLS |
| `service_role` key | **only** the shell environment of `scripts/provision-teacher.mjs` | **Yes — never in the browser, never in git** |

---

## 3. 2 — Apply the migrations

The schema, the Row Level Security policies, the triggers, the storage bucket and
the teacher provisioning function all live in `supabase/migrations/` as seven ordered
files:

| File | Content |
| --- | --- |
| `20260101000100_core_schema.sql` | the six tables, the enums, the constraints, the indexes |
| `20260101000200_helper_functions.sql` | `is_teacher()`, `can_view_lesson()`, `can_view_document()`, … |
| `20260101000300_triggers.sql` | `handle_new_user`, the role guard, the message/conversation guards, the storage path validator |
| `20260101000400_rls_policies.sql` | RLS enabled on every table + the explicit policies |
| `20260101000500_storage.sql` | the private `lesson-documents` bucket and its policies |
| `20260101000600_teacher_provisioning.sql` | `public.set_user_role()` — the only way to become a teacher |
| `20260101000700_realtime_and_grants.sql` | Realtime publication, helper grants, default privileges |

### Option A — Supabase CLI (recommended)

```bash
npm install -g supabase
supabase login
supabase link --project-ref <project-ref>
supabase db push          # applies every migration that is not yet applied
```

### Option B — Dashboard SQL editor

Open *Dashboard → SQL Editor → New query* and run the seven files **in order**
(they are plain SQL and contain no `\i` directives).

### Option C — psql

```bash
export PGHOST=db.<project-ref>.supabase.co
export PGUSER=postgres
export PGPASSWORD='<the database password you chose>'
export PGDATABASE=postgres
for f in supabase/migrations/*.sql; do
  echo "→ $f"
  psql -v ON_ERROR_STOP=1 -f "$f"
done
```

> `supabase db push` also records the migrations in `supabase_migrations.schema_migrations`,
> so repeat pushes are safe and a re-run of a file is detected.

### 3.1 Verify the migration worked

Run these three queries in the SQL editor:

```sql
-- 1. RLS is enabled on every protected table
select relname, relrowsecurity
from pg_class
where relname in ('profiles','classes','lessons','lesson_documents','conversations','messages');
-- every row must show relrowsecurity = true

-- 2. The private bucket exists with the right limits
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where name = 'lesson-documents';

-- 3. The privileged function is not callable by the public
select has_function_privilege('anon', 'public.set_user_role(text, public.user_role)', 'EXECUTE');  -- false
select has_function_privilege('authenticated', 'public.set_user_role(text, public.user_role)', 'EXECUTE'); -- false
```

---

## 4. 3 — Create the first teacher

**The teacher role is never assignable from the browser.** Registration always creates
a student. The teacher is provisioned by the owner with the service-role key.

```bash
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<the service_role key from Project Settings → API>"

# Promote an account that already registered through the app:
node scripts/provision-teacher.mjs --email teacher@example.com

# …or let the script create the account and print a generated password:
node scripts/provision-teacher.mjs --email teacher@example.com --create
```

The script refuses to run without both variables, refuses a public key, and never
writes the key to disk. It calls `public.set_user_role()`, which itself refuses to run
unless the request carries the `service_role` JWT.

**Immediately afterwards:**

* Do not keep `SUPABASE_SERVICE_ROLE_KEY` in your shell history — `unset` it, or use a
  password manager / CI secret.
* If the key was ever exposed, rotate it in *Project Settings → API Keys* immediately.

### 4.1 Adding further teachers later

The same command works. Note that the student interface picks the **oldest** teacher
profile for its "write to the teacher" button, so a second teacher is only reachable
from the teacher area.

---

## 5. 4 — Deploy to Cloudflare Pages

### 5.1 Connect the repository

1. Push the project to a Git provider (GitHub / GitLab). The repository must contain
   the `supabase/migrations/` folder — the migrations are part of the deliverable.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repository and the production branch (`main`).

### 5.2 Build settings

| Setting | Value |
| --- | --- |
| Framework preset | `None` (or `Vite`) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (the repository root) |
| Node.js version | `22` — set it in *Settings → Builds → Environment variables* as `NODE_VERSION=22` |

> `NODE_VERSION=22` matters: `pdfjs-dist` declares `node >= 22`, and the Vite 8 /
> Rolldown toolchain is happiest on a current LTS.

### 5.3 Environment variables

Only these two — both public:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the `anon` / `publishable` key |

Set them for **both** *Production* and *Preview* environments. Never add the
service-role key — it would end up in the public JavaScript bundle.

### 5.4 SPA routing fallback

`public/_redirects` is committed to the repository and contains:

```
/*    /index.html   200
```

Cloudflare Pages picks this file up automatically at build time, so a hard refresh on
`/app/student/classes` serves `index.html` instead of a 404. If you deploy with a
different pipeline, add this redirect in the Pages dashboard (*Settings → Functions &
Routes → Redirects*) as well.

### 5.5 Deploy

Push to the production branch, or press **Retry deployment** in the Pages dashboard.
The build log must end with a successful `vite build`. The output of `npm run build`
is the `dist/` folder — nothing else is uploaded.

### 5.6 Custom domain (optional)

*Pages → Custom domains → Set up a custom domain.* Add the domain to
*Authentication → URL Configuration → Redirect URLs* in Supabase at the same time.

---

## 6. 5 — Environment variables locally

```bash
cp .env.example .env.local
# fill in the two public values
npm run dev
```

`.env.local` is git-ignored. `src/config/env.ts` validates the values at start-up and
renders a dedicated "not configured" screen instead of crashing, so a forgotten
variable never produces a blank page.

---

## 7. 6 — Local database verification (optional)

To verify the migrations and the Row Level Security policies without a Supabase
project, a local PostgreSQL server is enough:

```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo pg_ctlcluster 17 main start
bash scripts/local-db/setup.sh     # creates the database and applies every migration
npm run test:db                    # 35 tests against the real server
```

`scripts/local-db/supabase_emulation.sql` provides the `anon`, `authenticated` and
`service_role` roles and the `auth`/`storage` schemas that the migrations expect.

---

## 8. 7 — Continuous integration

A minimal GitHub Actions workflow (optional, not included in the repository because
it was not executed here):

```yaml
name: ci
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

---

## 9. 8 — Testing the deployed site

Work through this list after the **first** deployment, and after every change to the
migrations.

### 9.1 The public side

| # | Action | Expected |
| --- | --- | --- |
| 1 | Open the deployed URL | The landing page renders in Arabic, RTL, with the dark theme |
| 2 | Click *تسجيل حساب* | The registration form opens |
| 3 | Register a new account | "Check your inbox" (or a direct sign-in if e-mail confirmation is off) |
| 4 | Open `/app/student/classes` while signed out | You are redirected to `/login` |
| 5 | Open a non-existent path | The 404 page with a link home |

### 9.2 The student

| # | Action | Expected |
| --- | --- | --- |
| 6 | Sign in as a student | The student dashboard with real numbers from the database |
| 7 | The class list | Only *published* classes appear; an unpublished class is invisible |
| 8 | Open a lesson | Its documents can be opened and previewed |
| 9 | Open a document | The PDF renders in the app; the DOCX renders in the browser; *download* opens the original file |
| 10 | Open *الرسائل* | A conversation with the teacher can be started; a message is sent and appears after a refresh |
| 11 | Open the same page in a second browser window as the teacher | The message appears without a refresh (Realtime) |
| 12 | Try `/app/teacher` directly | You are redirected to your own area |

### 9.3 The teacher

| # | Action | Expected |
| --- | --- | --- |
| 13 | Sign in as the teacher | The teacher dashboard with the real statistics |
| 14 | Create a class, publish it | The class appears for the student without a reload of the app |
| 15 | Create a lesson, attach a PDF | The upload shows a progress bar; the document is previewable |
| 16 | Replace the file | The new version is used; the old one is gone from the bucket |
| 17 | Open *الطلاب* | The list shows the registered students and is searchable |
| 18 | Open *الرسائل* | The student conversation is listed with the unread counter |

### 9.4 The security spot checks

| # | Action | Expected |
| --- | --- | --- |
| 19 | As a student, run `supabase.from('classes').insert({…})` in the browser console | The database returns a permission error — the row is not created |
| 20 | As a student, run `supabase.from('profiles').update({role:'teacher'}).eq('id', myId)` | The role change is refused by the trigger |
| 21 | As a student, try to read another student's conversation id | The rows are not returned |
| 22 | Check the bucket in the Supabase dashboard | `lesson-documents` is **private**; the objects are not listed publicly |

> Item 19–22 are the real acceptance criteria of the security model. The same
> assertions are automated in `tests/db/rls.test.ts` against a real PostgreSQL server.

---

## 10. 9 — Free tier limits, honestly

These are the documented Supabase free-tier limits. They are **not** measurements of
this application; they are the constraints the deployment runs into.

| Resource | Free tier | What it means here |
| --- | --- | --- |
| Database size | 1 GB | The metadata (classes, lessons, messages) is tiny; a few hundred thousand messages would still fit |
| Storage | 1 GB | With a 25 MiB per-file limit, roughly 40 large PDFs — use the file limit wisely |
| Egress | 5 GB / month | Every preview and every download consumes it; signed URLs keep the traffic cacheable |
| Realtime | 200 concurrent connections, 2 GB/month | Comfortable for one class; the subscriptions are per conversation and are closed on unmount |
| Auth e-mails | ~2–4/hour on the built-in SMTP | Password resets will be rate limited without a real provider |
| Project inactivity | Paused after 1 week of inactivity | The project is paused, not deleted; it resumes on the next request. **Unpausing can take minutes.** |
| Build minutes | 500 minutes/month on Cloudflare Pages | A build takes well under a minute |

### 10.1 Things that are *not* guaranteed

* No load test was performed. The number of simultaneous students, the message
  throughput and the realtime latency are **unknown**.
* The 120 second signed-URL lifetime is a compromise: long enough for a slow
  download, short enough to limit the damage of a leaked link.
* Deleting a class removes the storage objects first and the rows afterwards. If the
  storage removal fails, the leftover objects are reported to the teacher and can be
  removed by hand in the dashboard — the database rows are removed regardless.

---

## 11. 10 — Rollback and maintenance

* **Frontend**: Cloudflare Pages keeps the previous deployment. *Deployments →
  Promote to production* restores it in one click.
* **Database**: the migrations are additive and forward-only. Take a snapshot before
  applying them (*Database → Backups*) and keep the order of the files. There is no
  automated down-migration, because rolling back a policy silently is more dangerous
  than applying the next migration.
* **Rotating the keys**: rotate the `anon` key in the dashboard and update the
  Pages environment variable. Rotate the `service_role` key if it was ever exposed,
  and re-run `scripts/provision-teacher.mjs` afterwards.
