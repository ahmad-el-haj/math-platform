import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { Conversation, Message, Profile } from '@/lib/database.types'

export type ConversationSummary = {
  id: string
  studentId: string
  teacherId: string
  lastMessageAt: string
  peer: Profile | null
  unreadCount: number
}

/** Upper bound for the number of conversations loaded in one request. */
const CONVERSATION_LIMIT = 200
/** Upper bound for the unread markers collected in one request. */
const UNREAD_SCAN_LIMIT = 1000

/**
 * List the conversations of the current user.
 *
 * The list is ordered by the last activity and each entry carries the profile
 * of the *other* participant plus the number of unread messages.
 */
export async function listConversations(currentUserId: string): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(
      '*, student:profiles!conversations_student_id_fkey(*), teacher:profiles!conversations_teacher_id_fkey(*)',
    )
    .order('last_message_at', { ascending: false })
    .limit(CONVERSATION_LIMIT)

  if (error) {
    throw toAppError(error, 'unknown')
  }

  const rows = (data ?? []) as (Conversation & {
    student: Profile | null
    teacher: Profile | null
  })[]

  const unread = await fetchUnreadCounts(
    rows.map((row) => row.id),
    currentUserId,
  )

  return rows.map((row) => {
    const peer = row.student?.id === currentUserId ? (row.teacher ?? null) : (row.student ?? null)
    return {
      id: row.id,
      studentId: row.student_id,
      teacherId: row.teacher_id,
      lastMessageAt: row.last_message_at,
      peer,
      unreadCount: unread.get(row.id) ?? 0,
    }
  })
}

async function fetchUnreadCounts(
  conversationIds: string[],
  currentUserId: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (conversationIds.length === 0) return counts

  const { data, error } = await supabase
    .from('messages')
    .select('conversation_id')
    .in('conversation_id', conversationIds)
    .is('read_at', null)
    .neq('sender_id', currentUserId)
    .limit(UNREAD_SCAN_LIMIT)

  if (error) {
    throw toAppError(error, 'unknown')
  }

  for (const row of data ?? []) {
    const id = row.conversation_id as string
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

/** Total number of unread messages across every conversation. */
export async function countUnreadMessages(currentUserId: string): Promise<number> {
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
    .neq('sender_id', currentUserId)
    .limit(UNREAD_SCAN_LIMIT)

  if (error) {
    throw toAppError(error, 'unknown')
  }
  return count ?? 0
}

/**
 * Return the conversation with the given participant, creating it when it
 * does not exist yet. The unique constraint on (student_id, teacher_id) makes
 * concurrent attempts safe.
 */
export async function getOrCreateConversation(params: {
  currentUserId: string
  peerId: string
  isCurrentUserTeacher: boolean
}): Promise<Conversation> {
  const studentId = params.isCurrentUserTeacher ? params.peerId : params.currentUserId
  const teacherId = params.isCurrentUserTeacher ? params.currentUserId : params.peerId

  const { data: existing, error: lookupError } = await supabase
    .from('conversations')
    .select('*')
    .eq('student_id', studentId)
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (lookupError) {
    throw toAppError(lookupError, 'unknown')
  }
  if (existing) {
    return existing as Conversation
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({ student_id: studentId, teacher_id: teacherId })
    .select('*')
    .single()

  if (error) {
    // Another request may have created the conversation in the meantime.
    const { data: retry } = await supabase
      .from('conversations')
      .select('*')
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)
      .maybeSingle()
    if (retry) return retry as Conversation
    throw toAppError(error, 'conflict')
  }

  return data as Conversation
}

/** The teacher account a student should talk to. */
export async function findTeacherProfile(): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'teacher')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw toAppError(error, 'unknown')
  }
  return (data as Profile | null) ?? null
}

/** Delete a conversation (teacher only — enforced by RLS). */
export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase.from('conversations').delete().eq('id', conversationId)
  if (error) {
    throw toAppError(error, 'validation')
  }
}

export type { Message }
