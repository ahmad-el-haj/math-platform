/**
 * Profiles and roles — the attempt to become a teacher.
 *
 * The role is decided by the database, never by the client. These tests
 * prove that the *frontend* never asks for a role change and that a
 * *direct* attempt to change it is rejected by the database layer.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { createFakeSupabase } = await import('../support/fake-backend')
  const client = createFakeSupabase()
  ;(globalThis as Record<string, unknown>).__riwaq_fake_supabase__ = client
  return { supabase: client }
})

import {
  countStudents,
  fetchProfile,
  listStudents,
  listVisibleProfiles,
  updateOwnProfile,
} from '@/services/profiles'
import { rawRows, resetFakeDb, seedUser, signInAs } from '../support/harness'

const TEACHER = { id: 'teacher-1', email: 'teacher@example.com', role: 'teacher' as const }
const STUDENT = { id: 'student-1', email: 'student@example.com', role: 'student' as const }
const OTHER_STUDENT = { id: 'student-2', email: 'other@example.com', role: 'student' as const }

function profileRow(id: string): { id: string; role: string } | undefined {
  return rawRows<{ id: string; role: string }>('profiles').find((row) => row.id === id)
}

beforeEach(() => {
  resetFakeDb()
  seedUser(TEACHER)
  seedUser(STUDENT)
  seedUser(OTHER_STUDENT)
})

describe('reading profiles', () => {
  it('lets a student read their own profile', async () => {
    signInAs(STUDENT.id)
    const profile = await fetchProfile(STUDENT.id)
    expect(profile?.id).toBe(STUDENT.id)
    expect(profile?.role).toBe('student')
  })

  it('never lets a student read another student profile', async () => {
    signInAs(STUDENT.id)
    expect(await fetchProfile(OTHER_STUDENT.id)).toBeNull()
  })

  it('lets a student read the teacher profile', async () => {
    signInAs(STUDENT.id)
    const profile = await fetchProfile(TEACHER.id)
    expect(profile?.role).toBe('teacher')
  })

  it('lets a teacher read every profile', async () => {
    signInAs(TEACHER.id)
    expect(await fetchProfile(OTHER_STUDENT.id)).not.toBeNull()
  })

  it('only lists the own profile and the teachers for a student', async () => {
    signInAs(STUDENT.id)
    const profiles = await listVisibleProfiles()
    const ids = profiles.map((profile) => profile.id).sort()
    expect(ids).toEqual([STUDENT.id, TEACHER.id].sort())
  })
})

describe('role escalation attempts', () => {
  it('keeps the role untouched when a student updates their profile', async () => {
    signInAs(STUDENT.id)

    const updated = await updateOwnProfile(STUDENT.id, {
      full_name: 'اسم جديد',
      grade_level: 'الثالث',
    })

    expect(updated.full_name).toBe('اسم جديد')
    expect(updated.grade_level).toBe('الثالث')
    expect(updated.role).toBe('student')
    expect(profileRow(STUDENT.id)?.role).toBe('student')
  })

  it('refuses a direct role change in the database', async () => {
    signInAs(STUDENT.id)
    const { supabase } = await import('@/lib/supabase')

    const { error } = await supabase
      .from('profiles')
      .update({ role: 'teacher' })
      .eq('id', STUDENT.id)
      .select('*')
      .single()

    expect(error).toBeTruthy()
    expect(profileRow(STUDENT.id)?.role).toBe('student')
  })

  it('refuses a student to edit the profile of somebody else', async () => {
    signInAs(STUDENT.id)
    const { supabase } = await import('@/lib/supabase')

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: 'اختطاف' })
      .eq('id', OTHER_STUDENT.id)
      .select('*')
      .single()

    expect(error).toBeTruthy()
    const other = rawRows<{ id: string; full_name: string }>('profiles').find(
      (row) => row.id === OTHER_STUDENT.id,
    )
    expect(other?.full_name).toBe('other@example.com')
  })

  it('refuses the creation of a profile by a client', async () => {
    signInAs(STUDENT.id)
    const { supabase } = await import('@/lib/supabase')

    const { error } = await supabase
      .from('profiles')
      .insert({ id: 'forged', email: 'forged@example.com', role: 'teacher' })
      .select('*')
      .single()

    expect(error).toBeTruthy()
    expect(rawRows('profiles').some((row) => row.id === 'forged')).toBe(false)
  })
})

describe('the student list of the teacher area', () => {
  it('counts the registered students', async () => {
    signInAs(TEACHER.id)
    expect(await countStudents()).toBe(2)
  })

  it('paginates the list', async () => {
    signInAs(TEACHER.id)
    const page = await listStudents({ page: 0, pageSize: 1 })
    expect(page.profiles).toHaveLength(1)
    expect(page.total).toBe(2)
  })

  it('searches by name', async () => {
    signInAs(TEACHER.id)
    const page = await listStudents({ page: 0, pageSize: 10, search: 'other' })
    expect(page.profiles).toHaveLength(1)
    expect(page.profiles[0]?.id).toBe(OTHER_STUDENT.id)
  })

  it('never lists the teacher as a student', async () => {
    signInAs(TEACHER.id)
    const page = await listStudents({ page: 0, pageSize: 10 })
    expect(page.profiles.some((profile) => profile.id === TEACHER.id)).toBe(false)
  })
})
