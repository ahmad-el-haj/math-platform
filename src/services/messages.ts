import { appConfig } from '@/config/env'
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { Message } from '@/lib/database.types'

export type MessagePage = {
  messages: Message[]
  /** Cursor for the next (older) page. */
  oldestCreatedAt: string | null
  hasMore: boolean
}

/**
 * Load a page of messages, newest first.
 *
 * `before` is the creation timestamp of the oldest message that is already on
 * screen; the query then returns the messages that come before it. The result
 * is reversed so the caller always receives them in chronological order.
 */
export async function listMessages(params: {
  conversationId: string
  before?: string | null
  limit?: number
}): Promise<MessagePage> {
  const limit = params.limit ?? appConfig.messagePageSize

  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', params.conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (params.before) {
    query = query.lt('created_at', params.before)
  }

  const { data, error } = await query
  if (error) {
    throw toAppError(error, 'unknown')
  }

  const rows = (data ?? []) as Message[]
  const messages = [...rows].reverse()

  return {
    messages,
    oldestCreatedAt: messages[0]?.created_at ?? null,
    hasMore: rows.length === limit,
  }
}

/** Send a message as the authenticated user. */
export async function sendMessage(params: {
  conversationId: string
  senderId: string
  body: string
}): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: params.conversationId,
      sender_id: params.senderId,
      body: params.body.trim(),
    })
    .select('*')
    .single()

  if (error) {
    throw toAppError(error, 'unknown')
  }
  return data as Message
}

/** Mark the given messages as read. Only the recipient is allowed to do so. */
export async function markMessagesRead(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return

  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .in('id', messageIds)
    .is('read_at', null)

  if (error) {
    throw toAppError(error, 'validation')
  }
}

/** Mark every unread message of a conversation as read. */
export async function markConversationRead(params: {
  conversationId: string
  currentUserId: string
}): Promise<number> {
  const { data, error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', params.conversationId)
    .neq('sender_id', params.currentUserId)
    .is('read_at', null)
    .select('id')

  if (error) {
    throw toAppError(error, 'validation')
  }
  return data?.length ?? 0
}

/** Remove a message (its author, or a teacher in their own conversation). */
export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase.from('messages').delete().eq('id', messageId)
  if (error) {
    throw toAppError(error, 'validation')
  }
}
