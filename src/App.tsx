import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { env } from '@/config/env'
import { AuthProvider } from '@/hooks/use-auth'
import { ThemeProvider } from '@/hooks/use-theme'
import { ToastProvider } from '@/hooks/use-toast'
import { AppShell } from '@/components/layout/app-shell'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { Spinner } from '@/components/ui/feedback'
import ConfigurationNoticePage from '@/pages/configuration-notice'
import LandingPage from '@/pages/public/landing'
import LoginPage from '@/pages/public/login'
import RegisterPage from '@/pages/public/register'
import ForgotPasswordPage from '@/pages/public/forgot-password'
import ResetPasswordPage from '@/pages/public/reset-password'
import NotFoundPage from '@/pages/not-found'
import ProfilePage from '@/pages/shared/profile'

/* Route level code splitting: the teacher tools are only downloaded when a
   teacher actually opens them. */
const StudentDashboard = lazy(() => import('@/pages/student/dashboard'))
const StudentClasses = lazy(() => import('@/pages/student/classes'))
const StudentClassDetail = lazy(() => import('@/pages/student/class-detail'))
const StudentLessonDetail = lazy(() => import('@/pages/student/lesson-detail'))
const StudentDocument = lazy(() => import('@/pages/student/document-viewer'))
const StudentMessages = lazy(() => import('@/pages/student/messages'))

const TeacherDashboard = lazy(() => import('@/pages/teacher/dashboard'))
const TeacherClasses = lazy(() => import('@/pages/teacher/classes'))
const TeacherClassForm = lazy(() => import('@/pages/teacher/class-form'))
const TeacherClassDetail = lazy(() => import('@/pages/teacher/class-detail'))
const TeacherLessonForm = lazy(() => import('@/pages/teacher/lesson-form'))
const TeacherDocuments = lazy(() => import('@/pages/teacher/documents'))
const TeacherStudents = lazy(() => import('@/pages/teacher/students'))
const TeacherConversations = lazy(() => import('@/pages/teacher/conversations'))
const TeacherConversation = lazy(() => import('@/pages/teacher/conversation'))

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="size-7" />
      <span className="sr-only">جارٍ تحميل الصفحة</span>
    </div>
  )
}

export default function App() {
  if (!env.isConfigured) {
    return (
      <ThemeProvider>
        <ToastProvider>
          <ConfigurationNoticePage />
        </ToastProvider>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Public */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Application shell — every child route is protected */}
                <Route
                  path="/app"
                  element={
                    <ProtectedRoute>
                      <AppShell />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/app/student" replace />} />

                  {/* Student area */}
                  <Route
                    path="student"
                    element={
                      <ProtectedRoute role="student">
                        <StudentDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="student/classes"
                    element={
                      <ProtectedRoute role="student">
                        <StudentClasses />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="student/classes/:classId"
                    element={
                      <ProtectedRoute role="student">
                        <StudentClassDetail />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="student/classes/:classId/lessons/:lessonId"
                    element={
                      <ProtectedRoute role="student">
                        <StudentLessonDetail />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="student/documents/:documentId"
                    element={
                      <ProtectedRoute role="student">
                        <StudentDocument />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="student/messages"
                    element={
                      <ProtectedRoute role="student">
                        <StudentMessages />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="student/profile"
                    element={
                      <ProtectedRoute role="student">
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Teacher area */}
                  <Route
                    path="teacher"
                    element={
                      <ProtectedRoute role="teacher">
                        <TeacherDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="teacher/classes"
                    element={
                      <ProtectedRoute role="teacher">
                        <TeacherClasses />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="teacher/classes/new"
                    element={
                      <ProtectedRoute role="teacher">
                        <TeacherClassForm />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="teacher/classes/:classId"
                    element={
                      <ProtectedRoute role="teacher">
                        <TeacherClassDetail />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="teacher/classes/:classId/edit"
                    element={
                      <ProtectedRoute role="teacher">
                        <TeacherClassForm />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="teacher/classes/:classId/lessons/new"
                    element={
                      <ProtectedRoute role="teacher">
                        <TeacherLessonForm />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="teacher/classes/:classId/lessons/:lessonId/edit"
                    element={
                      <ProtectedRoute role="teacher">
                        <TeacherLessonForm />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="teacher/classes/:classId/lessons/:lessonId/documents"
                    element={
                      <ProtectedRoute role="teacher">
                        <TeacherDocuments />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="teacher/students"
                    element={
                      <ProtectedRoute role="teacher">
                        <TeacherStudents />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="teacher/conversations"
                    element={
                      <ProtectedRoute role="teacher">
                        <TeacherConversations />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="teacher/conversations/:conversationId"
                    element={
                      <ProtectedRoute role="teacher">
                        <TeacherConversation />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="teacher/profile"
                    element={
                      <ProtectedRoute role="teacher">
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}
