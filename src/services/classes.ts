import { appConfig } from '@/config/env'
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { ClassRow } from '@/lib/database.types'
import type { ClassInput } from '@/lib/validation'

export type ClassWithLessonCount = ClassRow & { lessonCount: number }

/**
 * List the classes the current user may see.
 * RLS already hides unpublished classes from students, so no extra filtering
 * is required here — the database is the single source of truth.
 */
export async function listClasses(options?: {
  includeArchived?: boolean
  withLessonCounts?: boolean
}): Promise<ClassWithLessonCount[]> {
  let query = supabase
    .from('classes')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (!options?.includeArchived) {
    query = query.eq('is_archived', false)
  }

  const { data, error } = await query
  if (error) {
    throw toAppError(error, 'unknown')
  }

  const classes = (data ?? []) as ClassRow[]
  if (!options?.withLessonCounts) {
    return classes.map((row) => ({ ...row, lessonCount: 0 }))
  }

  const counts = await Promise.all(
    classes.map((row) => countLessons(row.id)),
  )
  return classes.map((row, index) => ({ ...row, lessonCount: counts[index] ?? 0 }))
}

async function countLessons(classId: string): Promise<number> {
  const { count, error } = await supabase
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', classId)
    .eq('is_archived', false)

  if (error) {
    throw toAppError(error, 'unknown')
  }
  return count ?? 0
}

export async function getClass(classId: string): Promise<ClassRow | null> {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('id', classId)
    .maybeSingle()

  if (error) {
    throw toAppError(error, 'not_found')
  }
  return (data as ClassRow | null) ?? null
}

export async function createClass(input: ClassInput, createdBy: string): Promise<ClassRow> {
  const { data, error } = await supabase
    .from('classes')
    .insert({
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
  return data as ClassRow
}

export async function updateClass(classId: string, input: ClassInput): Promise<ClassRow> {
  const { data, error } = await supabase
    .from('classes')
    .update({
      title: input.title,
      description: input.description,
      display_order: input.displayOrder,
      is_published: input.isPublished,
    })
    .eq('id', classId)
    .select('*')
    .single()

  if (error) {
    throw toAppError(error, 'validation')
  }
  return data as ClassRow
}

export async function setClassPublished(classId: string, isPublished: boolean): Promise<void> {
  const { error } = await supabase
    .from('classes')
    .update({ is_published: isPublished })
    .eq('id', classId)

  if (error) {
    throw toAppError(error, 'validation')
  }
}

export async function setClassArchived(classId: string, isArchived: boolean): Promise<void> {
  const { error } = await supabase
    .from('classes')
    .update({ is_archived: isArchived })
    .eq('id', classId)

  if (error) {
    throw toAppError(error, 'validation')
  }
}

/**
 * Delete a class.
 *
 * The lessons and their documents are removed by the `on delete cascade`
 * constraint. The storage objects are removed by the caller *before* the row
 * is deleted, so no orphaned file is left behind in the bucket.
 */
export async function deleteClass(classId: string): Promise<void> {
  const { error } = await supabase.from('classes').delete().eq('id', classId)
  if (error) {
    throw toAppError(error, 'validation')
  }
}

/**
 * Delete a class *and* the files that belong to it.
 *
 * The storage objects are removed first (the database cascade only removes
 * the metadata rows, it cannot touch the files in the bucket). If a single
 * object cannot be removed the deletion still continues — the leftover is
 * reported so it can be cleaned up later.
 */
export async function deleteClassWithFiles(classId: string): Promise<{
  removedFiles: number
  failedFiles: number
}> {
  const { data: lessons, error: lessonsError } = await supabase
    .from('lessons')
    .select('id')
    .eq('class_id', classId)

  if (lessonsError) {
    throw toAppError(lessonsError, 'unknown')
  }

  const lessonIds = (lessons ?? []).map((lesson) => lesson.id as string)
  let paths: string[] = []

  if (lessonIds.length > 0) {
    const { data: documents, error: documentsError } = await supabase
      .from('lesson_documents')
      .select('file_path')
      .in('lesson_id', lessonIds)

    if (documentsError) {
      throw toAppError(documentsError, 'unknown')
    }
    paths = (documents ?? []).map((document) => document.file_path as string)
  }

  let removedFiles = 0
  let failedFiles = 0

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(appConfig.storageBucket)
      .remove(paths)

    if (storageError) {
      console.error('[classes] could not remove every storage object', storageError)
      failedFiles = paths.length
    } else {
      removedFiles = paths.length
    }
  }

  await deleteClass(classId)

  return { removedFiles, failedFiles }
}
