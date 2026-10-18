import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Send } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { findTeacherProfile, getOrCreateConversation, listConversations } from '@/services/conversations'
import { PageHeader } from '@/components/layout/page-header'
import { MessageThread } from '@/components/messaging/message-thread'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { displayName } from '@/lib/format'
import { toAppError } from '@/lib/errors'

export default function StudentMessagesPage() {
  const { user, isTeacher } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const conversationsQuery = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: () => listConversations(user!.id),
    enabled: Boolean(user?.id),
  })

  const teacherQuery = useQuery({
    queryKey: ['teacher-profile'],
    queryFn: findTeacherProfile,
    enabled: Boolean(user?.id) && !isTeacher,
  })

  // The active conversation is derived: an explicit selection wins, otherwise
  // the most recent conversation is shown. No effect is needed for that.
  const conversations = conversationsQuery.data ?? []
  const conversationId = selectedConversationId ?? conversations[0]?.id ?? null

  const startConversation = async () => {
    if (!teacherQuery.data) {
      toast.error('لا يوجد معلّم متاح', 'أخبر مُدير المنصة.')
      return
    }
    setStarting(true)
    try {
      const conversation = await getOrCreateConversation({
        currentUserId: user!.id,
        peerId: teacherQuery.data.id,
        isCurrentUserTeacher: false,
      })
      setSelectedConversationId(conversation.id)
      await queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch (error) {
      toast.error('تعذّر فتح المحادثة', toAppError(error, 'unknown').message)
    } finally {
      setStarting(false)
    }
  }

  const active = conversations.find((item) => item.id === conversationId)
  const peerName = displayName(active?.peer?.full_name, active?.peer?.email)

  return (
    <>
      <PageHeader
        title="الرسائل"
        description="محادثة خاصة بينك وبين المعلم. لا يطّلع على رسائلك طالب آخر."
      />

      {conversationsQuery.isLoading ? (
        <Skeleton className="h-96" />
      ) : conversationsQuery.isError ? (
        <ErrorState
          description={conversationsQuery.error.message}
          onRetry={() => void conversationsQuery.refetch()}
        />
      ) : conversations.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gold-soft text-gold">
            <MessageCircle className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-bold text-ink">ابدأ محادثة مع المعلم</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-2">
              اسأل عن أي درس أو تمرين، وستصلك الإجابة هنا مباشرة.
            </p>
          </div>
          <Button onClick={() => void startConversation()} loading={starting}>
            {!starting ? <Send className="size-4" aria-hidden="true" /> : null}
            فتح المحادثة
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-line px-5 py-4">
            <p className="text-sm font-semibold text-ink">{peerName}</p>
            <p className="mt-0.5 text-xs text-ink-3">محادثة خاصة</p>
          </div>

          <div className="h-[min(62vh,620px)]">
            {conversationId ? (
              <MessageThread
                conversationId={conversationId}
                peerName={peerName}
                className="h-full px-4 sm:px-5"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <p className="text-sm text-ink-2">اختر محادثة لعرض رسائلك.</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </>
  )
}
