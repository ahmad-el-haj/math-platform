#!/usr/bin/env node
/**
 * Owner tooling: promote an account to the teacher role.
 *
 * WHY THIS IS A SCRIPT AND NOT A BUTTON
 * -------------------------------------
 * The teacher role is *never* assigned by the browser. Client supplied role
 * metadata is forgeable (anyone can call `signUp` with
 * `options.data.role = 'teacher'`), so the application never reads a role
 * from the client. Instead:
 *
 *   1. `public.handle_new_user()` creates every new profile with the hard
 *      coded role `student`.
 *   2. The role can only be changed by `public.set_user_role()`, which is
 *      `SECURITY DEFINER` and refuses to run unless the request carries the
 *      `service_role` JWT. `anon` and `authenticated` have no EXECUTE grant.
 *
 * This script is the owner-side way to call that function. It reads the
 * service-role key from the *process environment* (never from a `VITE_`
 * variable, never from the repository) and talks to the Supabase admin API
 * directly from Node — the key never enters a browser bundle.
 *
 * USAGE
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   node scripts/provision-teacher.mjs --email teacher@example.com
 *
 * OPTIONS
 *   --email <address>   Account to promote (required).
 *   --role <role>       teacher (default) or student.
 *   --create            Create the auth user first if it does not exist.
 *   --password <pass>   Password for --create. If omitted a strong random
 *                       password is generated and printed once.
 *
 * To promote an *existing* account: register normally through the app, then
 * run this script with that e-mail address.
 */

import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'

const args = process.argv.slice(2)

function flag(name) {
  const index = args.indexOf(`--${name}`)
  if (index === -1) return undefined
  const next = args[index + 1]
  if (!next || next.startsWith('--')) return undefined
  return next
}

const has = (name) => args.includes(`--${name}`)

const targetEmail = (flag('email') ?? '').trim().toLowerCase()
const targetRole = (flag('role') ?? 'teacher').trim().toLowerCase()
const shouldCreate = has('create')
const providedPassword = flag('password')

const env = process.env

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

if (!targetEmail) {
  fail('Missing --email <address>. Example: node scripts/provision-teacher.mjs --email teacher@example.com')
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
  fail(`"${targetEmail}" does not look like a valid e-mail address.`)
}

if (targetRole !== 'teacher' && targetRole !== 'student') {
  fail(`--role must be "teacher" or "student" (received "${targetRole}").`)
}

const supabaseUrl = (env.SUPABASE_URL ?? '').trim()
const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()

if (!supabaseUrl) {
  fail('SUPABASE_URL is not set. Export it before running this script:\n  export SUPABASE_URL=https://xxxx.supabase.co')
}

if (!serviceRoleKey) {
  fail(
    'SUPABASE_SERVICE_ROLE_KEY is not set. It lives in the Supabase dashboard under\n' +
      '  Project Settings → API Keys → service_role. Never store it in a VITE_ variable\n' +
      '  and never commit it to the repository.',
  )
}

if (serviceRoleKey.startsWith('sb_publishable_') || serviceRoleKey.startsWith('sb_anon_')) {
  fail('The key looks like a *public* key. This script needs the service-role key.')
}

let parsedUrl
try {
  parsedUrl = new URL(supabaseUrl)
} catch {
  fail(`SUPABASE_URL is not a valid URL: "${supabaseUrl}"`)
}
if (parsedUrl.protocol !== 'https:' && parsedUrl.hostname !== 'localhost') {
  fail('SUPABASE_URL must be an https:// URL (or http://localhost for a local stack).')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function generatePassword() {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%*'
  const bytes = randomBytes(20)
  let out = ''
  for (const byte of bytes) out += alphabet[byte % alphabet.length]
  return out
}

async function findUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(`Could not list users: ${error.message}`)
  return (data?.users ?? []).find((user) => (user.email ?? '').toLowerCase() === email) ?? null
}

async function ensureUser(email) {
  const existing = await findUserByEmail(email)
  if (existing) {
    console.log(`• Account already exists for ${email}.`)
    return existing
  }

  if (!shouldCreate) {
    fail(
      `No account exists for ${email}.\n` +
        '  Either register the teacher through the app first, or re-run with --create\n' +
        '  (the script can then create the account for you).',
    )
  }

  const password = providedPassword ?? generatePassword()
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw new Error(`Could not create the account: ${error.message}`)

  console.log(`✓ Created the auth account for ${email}.`)
  if (!providedPassword) {
    console.log('\n  ┌────────────────────────────────────────────────────────────┐')
    console.log('  │  Generated password (shown once) — store it now.           │')
    console.log(`  │  ${password.padEnd(56)}│`)
    console.log('  └────────────────────────────────────────────────────────────┘\n')
  }
  return data.user
}

async function main() {
  console.log(`\n▶ Provisioning "${targetRole}" for ${targetEmail}`)

  const user = await ensureUser(targetEmail)
  if (!user) fail('The account could not be resolved.')

  const { data, error } = await supabase.rpc('set_user_role', {
    target_email: targetEmail,
    new_role: targetRole,
  })

  if (error) {
    fail(`set_user_role() failed: ${error.message}`)
  }

  const profile = Array.isArray(data) ? data[0] : data
  console.log('✓ Role updated:')
  console.log(`    id    : ${profile?.id ?? user.id}`)
  console.log(`    email : ${profile?.email ?? targetEmail}`)
  console.log(`    role  : ${profile?.role ?? targetRole}`)
  console.log('\n  The teacher can now sign in at /login and reach /app/teacher.\n')
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error))
})
