/**
 * Test harness helpers.
 *
 * The fake Supabase client is created by the `vi.mock('@/lib/supabase', …)`
 * factory of every test file. The factory stores the client on `globalThis`
 * so the test body can reach the very same instance that the services use.
 */
import type { FakeDatabase, FakeSupabase, FakeUser } from './fake-backend'

const GLOBAL_KEY = '__riwaq_fake_supabase__'

type GlobalWithFake = typeof globalThis & { [GLOBAL_KEY]?: FakeSupabase }

export function getFakeSupabase(): FakeSupabase {
  const client = (globalThis as GlobalWithFake)[GLOBAL_KEY]
  if (!client) {
    throw new Error(
      'The fake Supabase client is not installed. Add a `vi.mock("@/lib/supabase", …)` factory to the test file.',
    )
  }
  return client
}

export function getFakeDb(): FakeDatabase {
  return getFakeSupabase().__db
}

/** Empty the database between test cases. */
export function resetFakeDb(): void {
  getFakeDb().reset()
}

export type SeededUser = {
  id: string
  email: string
  role: 'student' | 'teacher'
}

/**
 * Create an account and a profile with the given role.
 *
 * The role is written directly into the profile row, which is exactly what
 * the privileged `public.set_user_role()` function does on a real project.
 */
export function seedUser(input: {
  id: string
  email: string
  role: 'student' | 'teacher'
  fullName?: string
  password?: string
}): SeededUser {
  const db = getFakeDb()
  const user: FakeUser = {
    id: input.id,
    email: input.email,
    password: input.password ?? 'password-123',
    confirmed: true,
    metadata: { full_name: input.fullName ?? input.email },
  }
  db.addUser(user)
  const profile = db.tables.profiles.find((row) => row.id === input.id)
  if (profile) {
    profile.role = input.role
    profile.full_name = input.fullName ?? input.email
  }
  return { id: input.id, email: input.email, role: input.role }
}

export function signInAs(userId: string): void {
  getFakeDb().signIn(userId)
}

export function signOut(): void {
  getFakeDb().signOut()
}

/** The rows of a table, bypassing RLS (for assertions on stored state). */
export function rawRows<T = Record<string, unknown>>(
  table: 'profiles' | 'classes' | 'lessons' | 'lesson_documents' | 'conversations' | 'messages',
): T[] {
  return getFakeDb().tables[table] as T[]
}
