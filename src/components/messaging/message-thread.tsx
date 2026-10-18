import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowDown, RotateCcw } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useRealtimeMessages } from '@/hooks/use-realtime'
import { listMessages, markConversationRead, sendMessage } from '@/services/messages'
import { Composer } from '@/components/messaging/composer'
import { Spinner } from '@/components/ui/feedback'
import { cn } from '@/lib/cn'
import { formatDate, formatTime } from '@/lib/format'
import type { Message } from '@/lib/database.types'
import { toAppError } from '@/lib/errors'

export type MessageThreadProps = {
  conversationId: string
  /** Displayed above every bubble of the other participant. */
  peerName: string
  className?: string
}

type PendingMessage = {
  id: string
  sender_id: string
  body: string
  created_at: string
  status: 'sending' | 'failed'
}

export function MessageThread({ conversationId, peerName, className }: MessageThreadProps) {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<PendingMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const messagesKey = ['messages', conversationId] as const

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: messagesKey,
    queryFn: ({ pageParam }) =>
      listMessages({ conversationId, before: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.oldestCreatedAt : undefined,
  })

  const serverMessages = useMemo(() => {
    if (!data) return [] as Message[]
    return [...data.pages].reverse().flatMap((page) => page.messages)
  }, [data])

  const merged = useMemo(() => [...serverMessages, ...pending], [serverMessages, pending])

  const markRead = async () => {
    try {
      await markConversationRead({ conversationId, currentUserId: user!.id })
      void queryClient.invalidateQueries({ queryKey: ['unread-count'] })
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch {
      /* Marking as read is best effort and never shown as a failure. */
    }
  }

  useRealtimeMessages(conversationId, () => {
    void queryClient.invalidateQueries({ queryKey: messagesKey })
    void queryClient.invalidateQueries({ queryKey: ['unread-count'] })
    void queryClient.invalidateQueries({ queryKey: ['conversations'] })
  })

  useEffect(() => {
    if (serverMessages.length === 0) return
    void markRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverMessages.length, conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [serverMessages.length, pending.length])

  const handleSend = async (body: string) => {
    const tempId = `pending-${crypto.randomUUID()}`
    setPending((current) => [
      ...current,
      {
        id: tempId,
        sender_id: user!.id,
        body,
        created_at: new Date().toISOString(),
        status: 'sending',
      },
    ])

    try {
      await sendMessage({ conversationId, senderId: user!.id, body })
      setPending((current) => current.filter((message) => message.id !== tempId))
      await queryClient.invalidateQueries({ queryKey: messagesKey })
      void queryClient.invalidateQueries({ queryKey: ['unread-count'] })
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch (caught) {
      setPending((current) =>
        current.map((message) =>
          message.id === tempId ? { ...message, status: 'failed' } : message,
        ),
      )
      toast.error('تعذّر إرسال الرسالة', toAppError(caught, 'unknown').message)
    }
  }

  const retryPending = async (message: PendingMessage) => {
    setPending((current) => current.filter((item) => item.id !== message.id))
    await handleSend(message.body)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-20">
        <Spinner />
        <span className="text-sm text-ink-2">جارٍ تحميل المحادثة…</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-2xl border border-danger/25 bg-danger/8 px-6 py-12 text-center"
      >
        <AlertCircle className="size-8 text-danger" aria-hidden="true" />
        <p className="text-sm text-ink-2">{toAppError(error).message}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gold hover:underline"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          إعادة المحاولة
        </button>
      </div>
    )
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-4"
        aria-live="polite"
        aria-label="رسائل المحادثة"
      >
        {hasNextPage ? (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              disabled={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2/60 px-4 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              {isFetchingNextPage ? (
                <Spinner className="size-3.5" />
              ) : (
                <ArrowDown className="size-3.5" aria-hidden="true" />
              )}
              {isFetchingNextPage ? 'جارٍ التحميل…' : 'عرض الرسائل الأقدم'}
            </button>
          </div>
        ) : null}

        {merged.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-sm font-semibold text-ink">لا توجد رسائل بعد</p>
            <p className="max-w-sm text-sm leading-relaxed text-ink-2">
              ابدأ المحادثة بسؤال أو ملاحظة — ستصلك إجابة المعلم هنا مباشرة.
            </p>
          </div>
        ) : null}

        {merged.map((message, index) => {
          const previous = merged[index - 1]
          const isOwn = message.sender_id === user?.id
          const showDay =
            !previous || previous.created_at.slice(0, 10) !== message.created_at.slice(0, 10)
          const isPendingMessage = 'status' in message

          return (
            <div key={message.id}>
              {showDay ? (
                <div className="my-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                  <span className="text-[11px] font-medium text-ink-3">
                    {formatDate(message.created_at)}
                  </span>
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                </div>
              ) : null}

              <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-[1.75] shadow-sm sm:max-w-[70%]',
                    isOwn
                      ? 'rounded-ee-md border border-gold/25 bg-gold-soft text-ink'
                      : 'rounded-es-md border border-line bg-surface-2 text-ink',
                    isPendingMessage && message.status === 'failed' && 'border-danger/40',
                  )}
                >
                  {!isOwn ? (
                    <p className="mb-1 text-[11px] font-semibold text-gold">{peerName}</p>
                  ) : null}

                  <p className="whitespace-pre-wrap break-words">{message.body}</p>

                  <p className="mt-1.5 flex items-center justify-end gap-2 text-[10px] text-ink-3">
                    {formatTime(message.created_at)}
                    {isOwn && !isPendingMessage ? (
                      <span aria-label={message.read_at ? 'قُرئت' : 'أُرسلت'}>
                        {message.read_at ? '✓✓' : '✓'}
                      </span>
                    ) : null}
                    {isPendingMessage ? (
                      <span className={message.status === 'failed' ? 'text-danger' : ''}>
                        {message.status === 'failed' ? 'فشل الإرسال' : 'جارٍ الإرسال…'}
                      </span>
                    ) : null}
                  </p>

                  {isPendingMessage && message.status === 'failed' ? (
                    <button
                      type="button"
                      onClick={() => void retryPending(message as PendingMessage)}
                      className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-danger hover:underline"
                    >
                      <RotateCcw className="size-3" aria-hidden="true" />
                      إعادة المحاولة
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-line pt-3">
        <Composer onSend={handleSend} />
      </div>
    </div>
  )
}
