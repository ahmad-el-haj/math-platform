import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * Subscribe to the message table of a single conversation.
 *
 * Supabase Realtime authorises every `postgres_changes` event against the
 * Row Level Security policies of the published table, so a client only ever
 * receives the events of the conversations it takes part in. The channel is
 * removed when the component unmounts.
 */
export function useRealtimeMessages(
  conversationId: string | null,
  onChange: () => void,
): { connected: boolean } {
  const handler = useRef(onChange)
  // Keep the latest callback in a ref without writing to it during render.
  useEffect(() => {
    handler.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!conversationId) return

    const channel: RealtimeChannel = supabase
      .channel(`conversation:${conversationId}`, { config: { presence: { key: conversationId } } })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => handler.current(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId])

  return { connected: true }
}

/**
 * Subscribe to conversation level changes (a new message bumps
 * `last_message_at`, which reorders the conversation list).
 */
export function useRealtimeConversations(onChange: () => void): void {
  const handler = useRef(onChange)
  // Keep the latest callback in a ref without writing to it during render.
  useEffect(() => {
    handler.current = onChange
  }, [onChange])

  useEffect(() => {
    const channel: RealtimeChannel = supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => handler.current(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])
}
