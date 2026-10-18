import { useQuery } from '@tanstack/react-query'
import { MessageCircle } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useRealtimeConversations } from '@/hooks/use-realtime'
import { listConversations } from '@/services/conversations'
import { PageHeader } from '@/components/layout/page-header'
import { ConversationList } from '@/components/messaging/conversation-list'
import { ErrorState, Skeleton } from '@/components/ui/feedback'

export default function TeacherConversationsPage() {
  const { user } = useAuth()

  const conversationsQuery = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: () => listConversations(user!.id),
    enabled: Boolean(user?.id),
  })

  useRealtimeConversations(() => {
    void conversationsQuery.refetch()
  })

  return (
    <>
      <PageHeader
        title="المحادثات"
        description="كل محادثة خاصة بينك وبين طالب واحد. لا يمكنك رؤية محادثات غيرك لأنك المعلم الوحيد، ولا يطّلع الطالب على محادثات غيره."
      />

      {conversationsQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      ) : conversationsQuery.isError ? (
        <ErrorState
          description={conversationsQuery.error.message}
          onRetry={() => void conversationsQuery.refetch()}
        />
      ) : (
        <ConversationList
          conversations={conversationsQuery.data ?? []}
          currentUserId={user!.id}
          linkFor={(conversation) => `/app/teacher/conversations/${conversation.id}`}
          emptyTitle="لا توجد محادثات"
          emptyDescription="ستظهر هنا محادثات الطلاب معك فور وصول أول رسالة."
        />
      )}

      <p className="mt-8 flex items-center gap-2 text-xs text-ink-3">
        <MessageCircle className="size-3.5" aria-hidden="true" />
        تُحدَّث القائمة تلقائيًا عند وصول رسالة جديدة.
      </p>
    </>
  )
}
