/**
 * Classes and lessons — service level integration tests.
 *
 * The suite runs against the in-memory Supabase emulator
 * (`tests/app/support/fake-backend.ts`), which enforces the same Row Level
 * Security rules and the same database triggers as the SQL migrations. The
 * *real* PostgreSQL verification of the same rules lives in
 * `tests/db/rls.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { createFakeSupabase } = await import('../support/fake-backend')
  const client = createFakeSupabase()
  ;(globalThis as Record<string, unknown>).__riwaq_fake_supabase__ = client
  return { supabase: client }
})

import {
  createClass,
  deleteClass,
  deleteClassWithFiles,
  getClass,
  listClasses,
  setClassArchived,
  setClassPublished,
  updateClass,
} from '@/services/classes'
import {
  createLesson,
  deleteLesson,
  listLessons,
  reorderLessons,
  setLessonArchived,
  setLessonPublished,
  updateLesson,
} from '@/services/lessons'
import { getFakeDb, rawRows, resetFakeDb, seedUser, signInAs } from '../support/harness'

const TEACHER = { id: 'teacher-1', email: 'teacher@example.com', role: 'teacher' as const }
const STUDENT = { id: 'student-1', email: 'student@example.com', role: 'student' as const }
const OTHER_STUDENT = { id: 'student-2', email: 'other@example.com', role: 'student' as const }

function classInput(overrides: Partial<Parameters<typeof createClass>[0]> = {}) {
  return {
    title: 'الصف الثالث',
    description: 'صف الرياضيات للصف الثالث',
    displayOrder: 1,
    isPublished: false,
    ...overrides,
  }
}

beforeEach(() => {
  resetFakeDb()
  seedUser(TEACHER)
  seedUser(STUDENT)
  seedUser(OTHER_STUDENT)
})

describe('classes — teacher workflow', () => {
  it('creates a class and stores it with the teacher as the author', async () => {
    signInAs(TEACHER.id)

    const created = await createClass(classInput({ isPublished: true }), TEACHER.id)

    expect(created.id).toBeTruthy()
    expect(created.title).toBe('الصف الثالث')
    expect(created.is_published).toBe(true)
    expect(created.created_by).toBe(TEACHER.id)
    expect(rawRows('classes')).toHaveLength(1)
  })

  it('lists the classes of the teacher including unpublished ones', async () => {
    signInAs(TEACHER.id)
    await createClass(classInput({ title: 'الصف الأول' }), TEACHER.id)
    await createClass(classInput({ title: 'الصف الثاني', isPublished: true }), TEACHER.id)

    const classes = await listClasses()

    expect(classes.map((row) => row.title)).toEqual(['الصف الأول', 'الصف الثاني'])
  })

  it('rejects a duplicate active class title with a conflict', async () => {
    signInAs(TEACHER.id)
    await createClass(classInput({ title: 'الصف الثالث' }), TEACHER.id)

    await expect(createClass(classInput({ title: 'الصف الثالث' }), TEACHER.id)).rejects.toThrow()
  })

  it('allows the same title again after the class was archived', async () => {
    signInAs(TEACHER.id)
    const first = await createClass(classInput({ title: 'الصف الثالث' }), TEACHER.id)
    await setClassArchived(first.id, true)

    const second = await createClass(classInput({ title: 'الصف الثالث' }), TEACHER.id)

    expect(second.id).not.toBe(first.id)
  })

  it('edits the name, the description and the display order', async () => {
    signInAs(TEACHER.id)
    const created = await createClass(classInput(), TEACHER.id)

    const updated = await updateClass(created.id, {
      title: 'الصف الرابع',
      description: 'وصف جديد',
      displayOrder: 7,
      isPublished: true,
    })

    expect(updated.title).toBe('الصف الرابع')
    expect(updated.description).toBe('وصف جديد')
    expect(updated.display_order).toBe(7)
    expect(updated.is_published).toBe(true)
  })

  it('publishes and unpublishes a class', async () => {
    signInAs(TEACHER.id)
    const created = await createClass(classInput(), TEACHER.id)

    await setClassPublished(created.id, true)
    expect((await getClass(created.id))?.is_published).toBe(true)

    await setClassPublished(created.id, false)
    expect((await getClass(created.id))?.is_published).toBe(false)
  })

  it('deletes a class together with its lessons', async () => {
    signInAs(TEACHER.id)
    const created = await createClass(classInput(), TEACHER.id)
    await createLesson(
      { classId: created.id, title: 'الدرس الأول', description: '', displayOrder: 1, isPublished: true },
      TEACHER.id,
    )

    await deleteClass(created.id)

    expect(rawRows('classes')).toHaveLength(0)
    expect(rawRows('lessons')).toHaveLength(0)
  })
})

describe('classes — publish visibility for students', () => {
  it('hides an unpublished class from a student', async () => {
    signInAs(TEACHER.id)
    await createClass(classInput({ isPublished: false }), TEACHER.id)

    signInAs(STUDENT.id)
    const classes = await listClasses()

    expect(classes).toHaveLength(0)
  })

  it('shows a published class to a student', async () => {
    signInAs(TEACHER.id)
    await createClass(classInput({ isPublished: true }), TEACHER.id)

    signInAs(STUDENT.id)
    const classes = await listClasses()

    expect(classes).toHaveLength(1)
    expect(classes[0]?.title).toBe('الصف الثالث')
  })

  it('hides an archived class from a student but keeps it for the teacher', async () => {
    signInAs(TEACHER.id)
    const created = await createClass(classInput({ isPublished: true }), TEACHER.id)
    await setClassArchived(created.id, true)

    signInAs(STUDENT.id)
    expect(await listClasses()).toHaveLength(0)

    signInAs(TEACHER.id)
    expect(await listClasses({ includeArchived: true })).toHaveLength(1)
  })
})

describe('classes — a student may not manage the catalogue', () => {
  it('cannot create a class', async () => {
    signInAs(STUDENT.id)

    await expect(createClass(classInput(), STUDENT.id)).rejects.toThrow()
    expect(rawRows('classes')).toHaveLength(0)
  })

  it('cannot edit a class', async () => {
    signInAs(TEACHER.id)
    const created = await createClass(classInput(), TEACHER.id)

    signInAs(STUDENT.id)
    await expect(
      updateClass(created.id, {
        title: 'اختطاف',
        description: '',
        displayOrder: 1,
        isPublished: true,
      }),
    ).rejects.toThrow()

    expect(rawRows('classes')[0]?.title).toBe('الصف الثالث')
  })

  it('cannot publish or unpublish a class', async () => {
    signInAs(TEACHER.id)
    const created = await createClass(classInput(), TEACHER.id)

    signInAs(STUDENT.id)
    await expect(setClassPublished(created.id, true)).rejects.toThrow()

    expect(rawRows('classes')[0]?.is_published).toBe(false)
  })

  it('cannot archive a class', async () => {
    signInAs(TEACHER.id)
    const created = await createClass(classInput({ isPublished: true }), TEACHER.id)

    signInAs(STUDENT.id)
    await expect(setClassArchived(created.id, true)).rejects.toThrow()

    expect(rawRows('classes')[0]?.is_archived).toBe(false)
  })

  it('cannot delete a class', async () => {
    signInAs(TEACHER.id)
    const created = await createClass(classInput(), TEACHER.id)

    signInAs(STUDENT.id)
    await expect(deleteClass(created.id)).rejects.toThrow()

    expect(rawRows('classes')).toHaveLength(1)
  })
})

describe('lessons', () => {
  it('creates a lesson inside a class', async () => {
    signInAs(TEACHER.id)
    const classRow = await createClass(classInput({ isPublished: true }), TEACHER.id)

    const lesson = await createLesson(
      {
        classId: classRow.id,
        title: 'الدرس الأول: الأعداد الطبيعية',
        description: 'مدخل إلى الأعداد الطبيعية',
        displayOrder: 1,
        isPublished: true,
      },
      TEACHER.id,
    )

    expect(lesson.class_id).toBe(classRow.id)
    expect(lesson.is_published).toBe(true)
    expect(rawRows('lessons')).toHaveLength(1)
  })

  it('creates several lessons inside the same class without creating another class', async () => {
    signInAs(TEACHER.id)
    const classRow = await createClass(classInput({ isPublished: true }), TEACHER.id)

    await createLesson(
      { classId: classRow.id, title: 'الدرس الأول', description: '', displayOrder: 1, isPublished: true },
      TEACHER.id,
    )
    await createLesson(
      { classId: classRow.id, title: 'الدرس الثاني', description: '', displayOrder: 2, isPublished: true },
      TEACHER.id,
    )
    await createLesson(
      { classId: classRow.id, title: 'مسودة الدرس الثالث', description: '', displayOrder: 3, isPublished: false },
      TEACHER.id,
    )

    // Still exactly one class; all three lessons belong to it.
    expect(rawRows('classes')).toHaveLength(1)
    expect(rawRows('lessons')).toHaveLength(3)
    expect(rawRows('lessons').every((lesson) => lesson.class_id === classRow.id)).toBe(true)

    const teacherLessons = await listLessons(classRow.id)
    expect(teacherLessons.map((lesson) => lesson.title)).toEqual([
      'الدرس الأول',
      'الدرس الثاني',
      'مسودة الدرس الثالث',
    ])

    // The student sees the class exactly once, with its published lessons inside.
    signInAs(STUDENT.id)
    const studentClasses = await listClasses()
    expect(studentClasses.filter((row) => row.id === classRow.id)).toHaveLength(1)
    expect((await listLessons(classRow.id)).map((lesson) => lesson.title)).toEqual([
      'الدرس الأول',
      'الدرس الثاني',
    ])
  })

  it('is visible to a student only when the class and the lesson are published', async () => {
    signInAs(TEACHER.id)
    const classRow = await createClass(classInput({ isPublished: false }), TEACHER.id)
    await createLesson(
      { classId: classRow.id, title: 'درس', description: '', displayOrder: 1, isPublished: true },
      TEACHER.id,
    )

    signInAs(STUDENT.id)
    expect(await listLessons(classRow.id)).toHaveLength(0)

    signInAs(TEACHER.id)
    await setClassPublished(classRow.id, true)

    signInAs(STUDENT.id)
    expect(await listLessons(classRow.id)).toHaveLength(1)
  })

  it('hides an unpublished lesson from a student', async () => {
    signInAs(TEACHER.id)
    const classRow = await createClass(classInput({ isPublished: true }), TEACHER.id)
    await createLesson(
      { classId: classRow.id, title: 'مسودة', description: '', displayOrder: 1, isPublished: false },
      TEACHER.id,
    )

    signInAs(STUDENT.id)
    expect(await listLessons(classRow.id)).toHaveLength(0)
  })

  it('reorders the lessons', async () => {
    signInAs(TEACHER.id)
    const classRow = await createClass(classInput(), TEACHER.id)
    const first = await createLesson(
      { classId: classRow.id, title: 'أ', description: '', displayOrder: 1, isPublished: false },
      TEACHER.id,
    )
    const second = await createLesson(
      { classId: classRow.id, title: 'ب', description: '', displayOrder: 2, isPublished: false },
      TEACHER.id,
    )

    await reorderLessons([second.id, first.id])

    const lessons = await listLessons(classRow.id)
    expect(lessons.map((lesson) => lesson.title)).toEqual(['ب', 'أ'])
    expect(lessons[0]?.display_order).toBe(1)
  })

  it('archives and deletes a lesson', async () => {
    signInAs(TEACHER.id)
    const classRow = await createClass(classInput(), TEACHER.id)
    const lesson = await createLesson(
      { classId: classRow.id, title: 'درس', description: '', displayOrder: 1, isPublished: false },
      TEACHER.id,
    )

    await setLessonArchived(lesson.id, true)
    expect(await listLessons(classRow.id)).toHaveLength(0)

    await deleteLesson(lesson.id)
    expect(rawRows('lessons')).toHaveLength(0)
  })

  it('refuses every lesson write coming from a student', async () => {
    signInAs(TEACHER.id)
    const classRow = await createClass(classInput({ isPublished: true }), TEACHER.id)
    const lesson = await createLesson(
      { classId: classRow.id, title: 'درس', description: '', displayOrder: 1, isPublished: true },
      TEACHER.id,
    )

    signInAs(STUDENT.id)
    await expect(
      createLesson(
        { classId: classRow.id, title: 'درس جديد', description: '', displayOrder: 2, isPublished: true },
        STUDENT.id,
      ),
    ).rejects.toThrow()
    await expect(
      updateLesson(lesson.id, {
        title: 'معدّل',
        description: '',
        displayOrder: 1,
        isPublished: false,
      }),
    ).rejects.toThrow()
    await expect(setLessonPublished(lesson.id, false)).rejects.toThrow()
    await expect(deleteLesson(lesson.id)).rejects.toThrow()

    expect(rawRows('lessons')).toHaveLength(1)
    expect(rawRows('lessons')[0]?.title).toBe('درس')
    expect(rawRows('lessons')[0]?.is_published).toBe(true)
  })
})

describe('deleting a class with its files', () => {
  it('removes the storage objects before the database rows', async () => {
    signInAs(TEACHER.id)
    const classRow = await createClass(classInput(), TEACHER.id)
    const lesson = await createLesson(
      { classId: classRow.id, title: 'درس', description: '', displayOrder: 1, isPublished: false },
      TEACHER.id,
    )
    getFakeDb().objects.set('lesson-documents/classes/x/lessons/y/documents/z/v1/file.pdf', {
      bucket: 'lesson-documents',
      path: 'classes/x/lessons/y/documents/z/v1/file.pdf',
      contentType: 'application/pdf',
      size: 10,
    })
    getFakeDb().tables.lesson_documents.push({
      id: 'doc-1',
      lesson_id: lesson.id,
      title: 'ملف',
      description: '',
      file_path: 'classes/x/lessons/y/documents/z/v1/file.pdf',
      original_file_name: 'file.pdf',
      mime_type: 'application/pdf',
      file_size: 10,
      storage_bucket: 'lesson-documents',
      version: 1,
      created_by: TEACHER.id,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    const result = await deleteClassWithFiles(classRow.id)

    expect(result.failedFiles).toBe(0)
    expect(result.removedFiles).toBe(1)
    expect(getFakeDb().objects.size).toBe(0)
    expect(rawRows('classes')).toHaveLength(0)
    expect(rawRows('lesson_documents')).toHaveLength(0)
  })
})
