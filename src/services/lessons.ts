import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { Lesson } from '@/lib/database.types'
import type { LessonInput } from '@/lib/validation'

export type LessonWithDocumentCount = Lesson & { documentCount: number }

/** List the lessons of a class together with the number of attached files. */
export async function listLessons(classId: string): Promise<LessonWithDocumentCount[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('class_id', classId)
    .eq('is_archived', false)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw toAppError(error, 'unknown')
  }

  const lessons = (data ?? []) as Lesson[]
  const counts = await Promise.all(lessons.map((lesson) => countDocuments(lesson.id)))
  return lessons.map((lesson, index) => ({ ...lesson, documentCount: counts[index] ?? 0 }))
}

async function countDocuments(lessonId: string): Promise<number> {
  const { count, error } = await supabase
    .from('lesson_documents')
    .select('id', { count: 'exact', head: true })
    .eq('lesson_id', lessonId)
    .is('deleted_at', null)

  if (error) {
    throw toAppError(error, 'unknown')
  }
  return count ?? 0
}

export async function getLesson(lessonId: string): Promise<Lesson | null> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .maybeSingle()

  if (error) {
    throw toAppError(error, 'not_found')
  }
  return (data as Lesson | null) ?? null
}

export type LessonFormInput = LessonInput & { classId: string }

export async function createLesson(input: LessonFormInput, createdBy: string): Promise<Lesson> {
  const { data, error } = await supabase
    .from('lessons')
    .insert({
      class_id: input.classId,
      title: input.title,
      description: input.description,
      display_order: input.displayOrder,
      is_published: input.isPublished,
      created_by: createdBy,
    })
    .select('*')
    .single()

  if (error) {
    throw toAppError(error, 'conflict')
  }
  return data as Lesson
}

export async function updateLesson(lessonId: string, input: LessonInput): Promise<Lesson> {
  const { data, error } = await supabase
    .from('lessons')
    .update({
      title: input.title,
      description: input.description,
      display_order: input.displayOrder,
      is_published: input.isPublished,
    })
    .eq('id', lessonId)
    .select('*')
    .single()

  if (error) {
    throw toAppError(error, 'validation')
  }
  return data as Lesson
}

export async function setLessonPublished(lessonId: string, isPublished: boolean): Promise<void> {
  const { error } = await supabase
    .from('lessons')
    .update({ is_published: isPublished })
    .eq('id', lessonId)

  if (error) {
    throw toAppError(error, 'validation')
  }
}

export async function setLessonArchived(lessonId: string, isArchived: boolean): Promise<void> {
  const { error } = await supabase
    .from('lessons')
    .update({ is_archived: isArchived })
    .eq('id', lessonId)

  if (error) {
    throw toAppError(error, 'validation')
  }
}

/**
 * Persist a new lesson order.
 * The whole list is written in one transaction by the caller; the order is
 * stored in `display_order` so that sorting stays stable and cheap.
 */
export async function reorderLessons(
  orderedIds: string[],
): Promise<void> {
  const updates = orderedIds.map((id, index) =>
    supabase.from('lessons').update({ display_order: index + 1 }).eq('id', id),
  )

  const results = await Promise.all(updates)
  const failed = results.find((result) => result.error)
  if (failed?.error) {
    throw toAppError(failed.error, 'validation')
  }
}

export async function deleteLesson(lessonId: string): Promise<void> {
  const { error } = await supabase.from('lessons').delete().eq('id', lessonId)
  if (error) {
    throw toAppError(error, 'validation')
  }
}
