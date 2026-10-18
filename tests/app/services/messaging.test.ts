/**
 * Private messaging — service level integration tests.
 *
 * Covered here: sending, replying, persistence, per-student isolation,
 * impersonation attempts, unread bookkeeping, ordering and pagination.
 * The database side of the same rules is verified against a real PostgreSQL
 * server in `tests/db/rls.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { createFakeSupabase } = await import('../support/fake-backend')
  const client = createFakeSupabase()
  ;(globalThis as Record<string, unknown>).__riwaq_fake_supabase__ = client
  return { supabase: client }
})

import {
  countUnreadMessages,
  deleteConversation,
  findTeacherProfile,
  getOrCreateConversation,
  listConversations,
} from '@/services/conversations'
import { deleteMessage, listMessages, markConversationRead, sendMessage } from '@/services/messages'
import { rawRows, resetFakeDb, seedUser, signInAs } from '../support/harness'

const TEACHER = { id: 'teacher-1', email: 'teacher@example.com', role: 'teacher' as const }
const STUDENT = { id: 'student-1', email: 'student@example.com', role: 'student' as const }
const OTHER_STUDENT = { id: 'student-2', email: 'other@example.com', role: 'student' as const }

beforeEach(() => {
  resetFakeDb()
  seedUser(TEACHER)
  seedUser(STUDENT)
  seedUser(OTHER_STUDENT)
})

describe('starting a conversation', () => {
  it('lets a student open a thread with the teacher', async () => {
    signInAs(STUDENT.id)

    const conversation = await getOrCreateConversation({
      currentUserId: STUDENT.id,
      peerId: TEACHER.id,
      isCurrentUserTeacher: false,
    })

    expect(conversation.student_id).toBe(STUDENT.id)
    expect(conversation.teacher_id).toBe(TEACHER.id)
    expect(rawRows('conversations')).toHaveLength(1)
  })

  it('reuses the existing thread instead of creating a second one', async () => {
    signInAs(STUDENT.id)
    const first = await getOrCreateConversation({
      currentUserId: STUDENT.id,
      peerId: TEACHER.id,
      isCurrentUserTeacher: false,
    })
    const second = await getOrCreateConversation({
      currentUserId: STUDENT.id,
      peerId: TEACHER.id,
      isCurrentUserTeacher: false,
    })

    expect(second.id).toBe(first.id)
    expect(rawRows('conversations')).toHaveLength(1)
  })

  it('refuses a conversation between two students', async () => {
    signInAs(STUDENT.id)

    await expect(
      getOrCreateConversation({
        currentUserId: STUDENT.id,
        peerId: OTHER_STUDENT.id,
        isCurrentUserTeacher: false,
      }),
    ).rejects.toThrow()

    expect(rawRows('conversations')).toHaveLength(0)
  })

  it('finds the teacher profile for the student interface', async () => {
    signInAs(STUDENT.id)
    const teacher = await findTeacherProfile()
    expect(teacher?.id).toBe(TEACHER.id)
  })
})

describe('sending and replying', () => {
  it('stores a message and bumps the conversation', async () => {
    signInAs(STUDENT.id)
    const conversation = await getOrCreateConversation({
      currentUserId: STUDENT.id,
      peerId: TEACHER.id,
      isCurrentUserTeacher: false,
    })

    const message = await sendMessage({
      conversationId: conversation.id,
      senderId: STUDENT.id,
      body: '  السلام عليكم  ',
    })

    expect(message.sender_id).toBe(STUDENT.id)
    expect(message.body).toBe('السلام عليكم')
    expect(rawRows('messages')).toHaveLength(1)
    expect(rawRows('conversations')[0]?.last_message_at).toBeTruthy()
  })

  it('lets the teacher reply and keeps the whole history', async () => {
    signInAs(STUDENT.id)
    const conversation = await getOrCreateConversation({
      currentUserId: STUDENT.id,
      peerId: TEACHER.id,
      isCurrentUserTeacher: false,
    })
    await sendMessage({ conversationId: conversation.id, senderId: STUDENT.id, body: 'سؤال' })

    signInAs(TEACHER.id)
    await sendMessage({ conversationId: conversation.id, senderId: TEACHER.id, body: 'مرحبًا' })

    const page = await listMessages({ conversationId: conversation.id })
    expect(page.messages.map((message) => message.body)).toEqual(['سؤال', 'مرحبًا'])
  })

  it('refuses a message that pretends to come from somebody else', async () => {
    signInAs(STUDENT.id)
    const conversation = await getOrCreateConversation({
      currentUserId: STUDENT.id,
      peerId: TEACHER.id,
      isCurrentUserTeacher: false,
    })

    await expect(
      sendMessage({
        conversationId: conversation.id,
        senderId: TEACHER.id, // impersonation attempt
        body: 'رسالة مزوّرة',
      }),
    ).rejects.toThrow()

    expect(rawRows('messages')).toHaveLength(0)
  })

  it('refuses a message inside a foreign conversation', async () => {
    signInAs(STUDENT.id)
    const conversation = await getOrCreateConversation({
      currentUserId: STUDENT.id,
      peerId: TEACHER.id,
      isCurrentUserTeacher: false,
    })

    signInAs(OTHER_STUDENT.id)
    await expect(
      sendMessage({ conversationId: conversation.id, senderId: OTHER_STUDENT.id, body: 'تطفّل' }),
    ).rejects.toThrow()

    expect(rawRows('messages')).toHaveLength(0)
  })

  it('rejects an empty body', async () => {
    signInAs(STUDENT.id)
    const conversation = await getOrCreateConversation({
      currentUserId: STUDENT.id,
      peerId: TEACHER.id,
      isCurrentUserTeacher: false,
    })

    await expect(
      sendMessage({ conversationId: conversation.id, senderId: STUDENT.id, body: '   ' }),
    ).rejects.toThrow()
  })
})

describe('isolation between students', () => {
  it('never shows the messages of another student', async () => {
    signInAs(STUDENT.id)
    const conversation = await getOrCreateConversation({
      currentUserId: STUDENT.id,
      peerId: TEACHER.id,
      isCurrentUserTeacher: false,
    })
    await sendMessage({ conversationId: conversation.id, senderId: STUDENT.id, body: 'سرّي' })

    signInAs(OTHER_STUDENT.id)
    const page = await listMessages({ conversationId: conversation.id })

    expect(page.messages).toHaveLength(0)
  })

  it('never lists a foreign conversation', async () => {
    signInAs(STUDENT.id)
    await getOrCreateConversation({
      currentUserId: STUDENT.id,
      peerId: TEACHER.id,
      isCurrentUserTeacher: false,
    })

    signInAs(OTHER_STUDENT.id)
    expect(await listConversations(OTHER_STUDENT.id)).toHaveLength(0)
  })

  it('does not let a student delete a conversation', async () => {
    signInAs(STUDENT.id)
    const conversation = await getOrCreateConversation({
      currentUserId: STUDENT.id,
      peerId: TEACHER.id,
      isCurrentUserTeacher: false,
    })

    await expect(deleteConversation(conversation.id)).rejects.toThrow()
    expect(rawRows('conversations')).toHaveLength(1)
  })
})

describe('conversation list', () => {
  it('shows the peer profile and the unread counter to the teacher', async () => {
    signInAs(STUDENT.id)
    const conversation = await getOrCreateConversation({
      currentUserId: STUDENT.id,
      peerId: TEACHER.id,
      isCurrentUserTeacher: false,
    })
    await sendMessage({ conversationId: conversation.id, senderId: STUDENT.id, body: 'مرحبًا' })

    signInAs(TEACHER.id)
    const conversations = await listConversations(TEACHER.id)

    expect(conversations).toHaveLength(1)
    expect(conversations[0]?.unreadCount).toBe(1)
    expect(conversations[0]?.peer?.id).toBe(STUDENT.id)
  })

  it('shows the teacher profile to the student', async () => {
    signInAs(STUDENT.id)
    await getOrCreateConversation({
      currentUserId: STUDENT.id,
      peerId: TEACHER.id,
      isCurrentUserTeacher: false,
    })

    const conversations = await listConversations(STUDENT.id)
    expect(conversations[0]?.peer?.id).toBe(TEACHER.id)
  })
})

describe('unread bookkeeping', () => {
  it('counts the messages the current user did not send', async () => {
    signInAs(STUDENT.id)
    const conversation = await getOrCreateConversation({
      currentUserId: STUDENT.id,
      peerId: TEACHER.id,
      isCurrentUserTeacher: false,
    })
    await sendMessage({ conversationId: conversation.id, senderId: STUDENT.id, body: 'سؤال' })

    signInAs(TEACHER.id)
    await sendMessage({ conversationId: conversation.id, senderId: TEACHER.id, body: 'جواب' })
    await sendMessage({ conversationId: conversation.id, senderId: TEACHER.id, body: 'جواب ٢' })

    // The student has not read the two answers, the teacher has not read the
    // question — each side only counts what the *other* side wrote.
    expect(await countUnreadMessages(STUDENT.id)).toBe(2)
    expect(await countUnreadMessages(TEACHER.id)).toBe(1)
  })

  it('marks only the messages of the other participant as read', async () => {
    signInAs(STUDENT.id)
    const conversation = await getOrCreateConversation({
      currentUserId: STUDENT.id,
      peerId: TEACHER.id,
      isCurrentUserTeacher: false,
    })
    await sendMessage({ conversationId: conversation.id, senderId: STUDENT.id, body: 'سؤال' })

    signInAs(TEACHER.id)
    await sendMessage({ conversationId: conversation.id, senderId: TEACHER.id, body: 'جواب' })

    signInAs(STUDENT.id)
    const marked = await markConversationRead({
      conversationId: conversation.id,
      currentUserId: STUDENT.id,
    })

    expect(marked).toBe(1)
    const messages = rawRows<{ body: string; read_at: string | null }>('messages')
    const own = messages.find((message) => message.body === 'سؤال')
    const incoming = messages.find((message) => message.body === 'جواب')
    expect(own?.read_at).toBeNull()
    expect(incoming?.read_at).toBeTruthy()
  })
})

describe('pagination and ordering', () => {
  it('returns the messages oldest first and pages backwards', async () => {
    signInAs(STUDENT.id)
    const conversation = await getOrCreateConversation({
      currentUserId: STUDENT.id,
      peerId: TEACHER.id,
      isCurrentUserTeacher: false,
    })

    for (let index = 1; index <= 5; index += 1) {
      await sendMessage({
        conversationId: conversation.id,
        senderId: STUDENT.id,
        body: `رسالة ${index}`,
      })
    }

    const firstPage = await listMessages({ conversationId: conversation.id, limit: 3 })
    expect(firstPage.messages.map((message) => message.body)).toEqual([
      'رسالة 3',
      'رسالة 4',
      'رسالة 5',
    ])
    expect(firstPage.hasMore).toBe(true)
    expect(firstPage.oldestCreatedAt).toBeTruthy()

    const secondPage = await listMessages({
      conversationId: conversation.id,
      limit: 3,
      before: firstPage.oldestCreatedAt,
    })
    expect(secondPage.messages.map((message) => message.body)).toEqual(['رسالة 1', 'رسالة 2'])
    expect(secondPage.hasMore).toBe(false)
  })
})

describe('deleting a message', () => {
  it('lets the author remove their own message', async () => {
    signInAs(STUDENT.id)
    const conversation = await getOrCreateConversation({
      currentUserId: STUDENT.id,
      peerId: TEACHER.id,
      isCurrentUserTeacher: false,
    })
    const message = await sendMessage({
      conversationId: conversation.id,
      senderId: STUDENT.id,
      body: 'احذفني',
    })

    await deleteMessage(message.id)

    expect(rawRows('messages')).toHaveLength(0)
  })

  it('refuses the deletion of a message written by somebody else', async () => {
    signInAs(STUDENT.id)
    const conversation = await getOrCreateConversation({
      currentUserId: STUDENT.id,
      peerId: TEACHER.id,
      isCurrentUserTeacher: false,
    })
    const message = await sendMessage({
      conversationId: conversation.id,
      senderId: STUDENT.id,
      body: 'نص',
    })

    signInAs(OTHER_STUDENT.id)
    await expect(deleteMessage(message.id)).rejects.toThrow()

    expect(rawRows('messages')).toHaveLength(1)
  })
})
