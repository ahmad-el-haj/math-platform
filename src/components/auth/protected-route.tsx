import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import type { UserRole } from '@/lib/database.types'
import { Spinner } from '@/components/ui/feedback'

export type ProtectedRouteProps = {
  children: ReactNode
  /** When provided, the route additionally requires this role. */
  role?: UserRole
}

/**
 * Gate for every private page.
 *
 * The frontend check is a *usability* measure only — it keeps students out of
 * the teacher interface. The real authorisation boundary is the Row Level
 * Security of the database, which is verified independently by the test suite
 * in `tests/db/rls.test.ts`.
 */
export function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { status, role: currentRole } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-7" />
        <span className="sr-only">جارٍ التحقق من الجلسة</span>
      </div>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (role && currentRole && currentRole !== role) {
    return <Navigate to={currentRole === 'teacher' ? '/app/teacher' : '/app/student'} replace />
  }

  return <>{children}</>
}
