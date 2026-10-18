import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { Profile } from '@/lib/database.types'

/** Fetch the profile of a single user (RLS decides what is visible). */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw toAppError(error, 'not_found')
  }
  return (data as Profile | null) ?? null
}

/**
 * List the accounts that the current user is allowed to see.
 * A teacher sees every student; a student only sees the teachers.
 */
export async function listVisibleProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name', { ascending: true })

  if (error) {
    throw toAppError(error, 'unknown')
  }
  return (data ?? []) as Profile[]
}

/** Update the caller's own profile. The role column is rejected by the database. */
export async function updateOwnProfile(
  userId: string,
  values: { full_name: string; grade_level: string },
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: values.full_name, grade_level: values.grade_level })
    .eq('id', userId)
    .select('*')
    .single()

  if (error) {
    throw toAppError(error, 'validation')
  }
  return data as Profile
}

/** Count the registered students (teacher only — enforced by RLS). */
export async function countStudents(): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'student')

  if (error) {
    throw toAppError(error, 'unknown')
  }
  return count ?? 0
}

/** Paginated list of students for the teacher area. */
export async function listStudents(
  options: { page: number; pageSize: number; search?: string | undefined },
): Promise<{ profiles: Profile[]; total: number }> {
  const from = options.page * options.pageSize
  const to = from + options.pageSize - 1

  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .eq('role', 'student')
    .order('created_at', { ascending: false })
    .range(from, to)

  const search = options.search?.trim()
  if (search) {
    const pattern = `%${search}%`
    query = query.or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
  }

  const { data, count, error } = await query
  if (error) {
    throw toAppError(error, 'unknown')
  }
  return { profiles: (data ?? []) as Profile[], total: count ?? 0 }
}
