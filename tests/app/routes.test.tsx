/**
 * Route protection.
 *
 * The frontend guard is a usability measure; the real authorisation
 * boundary is the Row Level Security of the database. These tests verify
 * that the *routing* keeps students out of the teacher area and that an
 * anonymous visitor never reaches a private page.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactElement } from 'react'

vi.mock('@/lib/supabase', async () => {
  const { createFakeSupabase } = await import('./support/fake-backend')
  const client = createFakeSupabase()
  ;(globalThis as Record<string, unknown>).__riwaq_fake_supabase__ = client
  return { supabase: client }
})

import { AuthProvider } from '@/hooks/use-auth'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { resetFakeDb, seedUser, signInAs } from './support/harness'

const TEACHER = { id: 'teacher-1', email: 'teacher@example.com', role: 'teacher' as const }
const STUDENT = { id: 'student-1', email: 'student@example.com', role: 'student' as const }

function renderApp(): ReactElement {
  return (
    <AuthProvider>
      <MemoryRouter initialEntries={['/app/teacher']}>
        <Routes>
          <Route
            path="/app/teacher"
            element={
              <ProtectedRoute role="teacher">
                <span>لوحة المعلم</span>
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/student"
            element={
              <ProtectedRoute role="student">
                <span>لوحة الطالب</span>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<span>صفحة تسجيل الدخول</span>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

beforeEach(() => {
  resetFakeDb()
  seedUser(TEACHER)
  seedUser(STUDENT)
})

describe('protected routes', () => {
  it('sends an anonymous visitor to the login page', async () => {
    render(renderApp())

    expect(await screen.findByText('صفحة تسجيل الدخول')).toBeInTheDocument()
    expect(screen.queryByText('لوحة المعلم')).not.toBeInTheDocument()
  })

  it('lets a teacher into the teacher area', async () => {
    signInAs(TEACHER.id)
    render(renderApp())

    expect(await screen.findByText('لوحة المعلم')).toBeInTheDocument()
  })

  it('sends a student out of the teacher area into their own', async () => {
    signInAs(STUDENT.id)
    render(renderApp())

    expect(await screen.findByText('لوحة الطالب')).toBeInTheDocument()
    expect(screen.queryByText('لوحة المعلم')).not.toBeInTheDocument()
  })
})
