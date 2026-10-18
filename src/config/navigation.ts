import { BookOpen, Home, MessageCircle, User, Users, type LucideIcon } from 'lucide-react'
import type { UserRole } from '@/lib/database.types'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  /** Show the number of unread messages next to the entry. */
  showsUnreadBadge?: boolean
  /** Only match the exact path (used for the dashboard entry). */
  end?: boolean
}

const STUDENT_NAV: NavItem[] = [
  { to: '/app/student', label: 'لوحة التحكم', icon: Home, end: true },
  { to: '/app/student/classes', label: 'الصفوف', icon: BookOpen },
  { to: '/app/student/messages', label: 'الرسائل', icon: MessageCircle, showsUnreadBadge: true },
  { to: '/app/student/profile', label: 'ملفي', icon: User },
]

const TEACHER_NAV: NavItem[] = [
  { to: '/app/teacher', label: 'لوحة التحكم', icon: Home, end: true },
  { to: '/app/teacher/classes', label: 'الصفوف والدروس', icon: BookOpen },
  { to: '/app/teacher/students', label: 'الطلاب', icon: Users },
  { to: '/app/teacher/conversations', label: 'الرسائل', icon: MessageCircle, showsUnreadBadge: true },
  { to: '/app/teacher/profile', label: 'ملفي', icon: User },
]

export function navigationFor(role: UserRole | null): NavItem[] {
  if (role === 'teacher') return TEACHER_NAV
  if (role === 'student') return STUDENT_NAV
  return []
}

export const LANDING_NAV = [
  { to: '#features', label: 'المزايا' },
  { to: '#how-it-works', label: 'كيف تعمل' },
  { to: '#teacher', label: 'للمعلّم' },
]
