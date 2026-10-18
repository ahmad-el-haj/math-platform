import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'

export type TeacherStats = {
  publishedClasses: number
  totalClasses: number
  lessons: number
  publishedLessons: number
  documents: number
  students: number
  conversations: number
  unreadMessages: number
}

export type StudentStats = {
  publishedClasses: number
  lessons: number
  documents: number
  unreadMessages: number
}

async function count(
  build: () => PromiseLike<{ count: number | null; error: PostgrestError | null }>,
): Promise<number> {
  const { count: total, error } = await build()
  if (error) {
    throw toAppError(error, 'unknown')
  }
  return total ?? 0
}

/**
 * Statistics for the teacher dashboard.
 *
 * Every number is a `count: 'exact', head: true` query: the database answers
 * with the count only, no rows are transferred, and the existing indexes are
 * used.
 *
 * The count options must be passed to the FIRST `.select()` call (the one on
 * the query builder returned by `.from()`), exactly as in `countLessons` /
 * `countDocuments`. Calling `.select(columns, options)` again on an already
 * filtered builder silently discards the options in the real PostgREST
 * client, so the response carries no count and every statistic reads as 0.
 */
export async function fetchTeacherStats(currentUserId: string): Promise<TeacherStats> {
  const [
    publishedClasses,
    totalClasses,
    lessons,
    publishedLessons,
    documents,
    students,
    conversations,
    unreadMessages,
  ] = await Promise.all([
    count(() =>
      supabase
        .from('classes')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true)
        .eq('is_archived', false),
    ),
    count(() => supabase.from('classes').select('id', { count: 'exact', head: true }).eq('is_archived', false)),
    count(() => supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('is_archived', false)),
    count(() =>
      supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('is_published', true).eq('is_archived', false),
    ),
    count(() => supabase.from('lesson_documents').select('id', { count: 'exact', head: true }).is('deleted_at', null)),
    count(() => supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student')),
    count(() => supabase.from('conversations').select('id', { count: 'exact', head: true })),
    count(() =>
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
        .neq('sender_id', currentUserId),
    ),
  ])

  return {
    publishedClasses,
    totalClasses,
    lessons,
    publishedLessons,
    documents,
    students,
    conversations,
    unreadMessages,
  }
}

/** Statistics for the student dashboard. */
export async function fetchStudentStats(currentUserId: string): Promise<StudentStats> {
  const [publishedClasses, lessons, documents, unreadMessages] = await Promise.all([
    count(() =>
      supabase
        .from('classes')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true)
        .eq('is_archived', false),
    ),
    count(() =>
      supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true)
        .eq('is_archived', false),
    ),
    count(() => supabase.from('lesson_documents').select('id', { count: 'exact', head: true }).is('deleted_at', null)),
    count(() =>
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
        .neq('sender_id', currentUserId),
    ),
  ])

  return { publishedClasses, lessons, documents, unreadMessages }
}
