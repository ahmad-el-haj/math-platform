/**
 * Dashboard statistics — service level tests.
 *
 * Verifies that `fetchTeacherStats` / `fetchStudentStats` apply the counting
 * rules the dashboards promise: archived rows are excluded, published counts
 * only include published rows, soft-deleted documents are excluded, and the
 * student count contains accounts with the `student` role only (the teacher
 * is never counted).
 *
 * These tests run against the in-memory Supabase emulator. The emulator
 * cannot reproduce the real PostgREST client's header behaviour, so the
 * count options are additionally pinned by construction: `stats.ts` passes
 * `{ count: 'exact', head: true }` to the first `.select()` of every query —
 * the same pattern `countLessons` / `countDocuments` already used.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { createFakeSupabase } = await import('../support/fake-backend')
  const client = createFakeSupabase()
  ;(globalThis as Record<string, unknown>).__riwaq_fake_supabase__ = client
  return { supabase: client }
})

import { createClass, setClassArchived } from '@/services/classes'
import { createLesson, setLessonArchived } from '@/services/lessons'
import { getOrCreateConversation } from '@/services/conversations'
import { sendMessage } from '@/services/messages'
import { fetchStudentStats, fetchTeacherStats } from '@/services/stats'
import { getFakeDb, resetFakeDb, seedUser, signInAs } from '../support/harness'

const TEACHER = { id: 'teacher-1', email: 'teacher@example.com', role: 'teacher' as const }
const STUDENT = { id: 'student-1', email: 'student@example.com', role: 'student' as const }
const OTHER_STUDENT = { id: 'student-2', email: 'other@example.com', role: 'student' as const }

function classInput(title: string, isPublished: boolean) {
  return { title, description: '', displayOrder: 1, isPublished }
}

function lessonInput(classId: string, title: string, isPublished: boolean) {
  return { classId, title, description: '', displayOrder: 1, isPublished }
}

function seedDocument(id: string, lessonId: string, deletedAt: string | null): void {
  getFakeDb().tables.lesson_documents.push({
    id,
    lesson_id: lessonId,
    title: id,
    description: '',
    file_path: `classes/c/lessons/l/documents/d/v1/${id}.pdf`,
    original_file_name: `${id}.pdf`,
    mime_type: 'application/pdf',
    file_size: 1024,
    storage_bucket: 'lesson-documents',
    version: 1,
    created_by: TEACHER.id,
    deleted_at: deletedAt,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  })
}

beforeEach(() => {
  resetFakeDb()
  seedUser(TEACHER)
  seedUser(STUDENT)
  seedUser(OTHER_STUDENT)
})

/** Build a small, fully known data set and return the ids that matter. */
async function seedContent() {
  signInAs(TEACHER.id)

  const publishedClass = await createClass(classInput('الصف السابع', true), TEACHER.id)
  const draftClass = await createClass(classInput('الصف الثامن', false), TEACHER.id)
  const archivedClass = await createClass(classInput('صف مؤرشف', true), TEACHER.id)
  await setClassArchived(archivedClass.id, true)

  const publishedLesson = await createLesson(
    lessonInput(publishedClass.id, 'الدرس المنشور', true),
    TEACHER.id,
  )
  await createLesson(lessonInput(publishedClass.id, 'مسودة درس', false), TEACHER.id)
  await createLesson(lessonInput(draftClass.id, 'درس في صف غير منشور', true), TEACHER.id)
  const archivedLesson = await createLesson(
    lessonInput(publishedClass.id, 'درس مؤرشف', true),
    TEACHER.id,
  )
  await setLessonArchived(archivedLesson.id, true)

  seedDocument('doc-1', publishedLesson.id, null)
  seedDocument('doc-2', publishedLesson.id, null)
  seedDocument('doc-3', publishedLesson.id, '2026-01-02T00:00:00.000Z')

  const conversation = await getOrCreateConversation({
    currentUserId: TEACHER.id,
    peerId: STUDENT.id,
    isCurrentUserTeacher: true,
  })
  signInAs(STUDENT.id)
  await sendMessage({ conversationId: conversation.id, senderId: STUDENT.id, body: 'سؤال أول' })
  await sendMessage({ conversationId: conversation.id, senderId: STUDENT.id, body: 'سؤال ثانٍ' })
  signInAs(TEACHER.id)
  await sendMessage({ conversationId: conversation.id, senderId: TEACHER.id, body: 'إجابة المعلم' })

  return { publishedClass, publishedLesson }
}

describe('teacher statistics', () => {
  it('counts classes, lessons, documents and students from the real rows', async () => {
    await seedContent()

    const stats = await fetchTeacherStats(TEACHER.id)

    // 3 classes exist; the archived one is excluded everywhere.
    expect(stats.totalClasses).toBe(2)
    expect(stats.publishedClasses).toBe(1)
    // 4 lessons exist; the archived one is excluded.
    expect(stats.lessons).toBe(3)
    expect(stats.publishedLessons).toBe(2)
    // 3 document rows exist; the soft-deleted one is excluded.
    expect(stats.documents).toBe(2)
    // Two student accounts; the teacher is never counted as a student.
    expect(stats.students).toBe(2)
    expect(stats.conversations).toBe(1)
    // The two student messages are unread for the teacher; his own is not.
    expect(stats.unreadMessages).toBe(2)
  })

  it('returns real zeros for an empty account instead of stale numbers', async () => {
    signInAs(TEACHER.id)

    const stats = await fetchTeacherStats(TEACHER.id)

    expect(stats.totalClasses).toBe(0)
    expect(stats.lessons).toBe(0)
    expect(stats.documents).toBe(0)
    // The two seeded students still exist.
    expect(stats.students).toBe(2)
  })
})

describe('student statistics', () => {
  it('only counts content the student may actually see', async () => {
    const { publishedClass } = await seedContent()

    signInAs(STUDENT.id)
    const stats = await fetchStudentStats(STUDENT.id)

    void publishedClass
    expect(stats.publishedClasses).toBe(1)
    // Only the published lesson inside the published class is visible.
    expect(stats.lessons).toBe(1)
    expect(stats.documents).toBe(2)
    // The teacher's reply is unread for the student.
    expect(stats.unreadMessages).toBe(1)
  })
})
