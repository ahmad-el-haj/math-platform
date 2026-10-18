import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { listConversations } from '@/services/conversations'
import { PageHeader } from '@/components/layout/page-header'
import { MessageThread } from '@/components/messaging/message-thread'
import { Card } from '@/components/ui/card'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { displayName } from '@/lib/format'

export default function TeacherConversationPage() {
  const { conversationId = '' } = useParams()
  const { user } = useAuth()

  const conversationsQuery = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: () => listConversations(user!.id),
    enabled: Boolean(user?.id),
  })

  const conversation = conversationsQuery.data?.find((item) => item.id === conversationId)
  const peerName = displayName(conversation?.peer?.full_name, conversation?.peer?.email)

  if (conversationsQuery.isLoading) {
    return (
      <>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-[60vh]" />
      </>
    )
  }

  if (conversationsQuery.isError) {
    return (
      <ErrorState
        description={conversationsQuery.error.message}
        onRetry={() => void conversationsQuery.refetch()}
      />
    )
  }

  if (!conversation) {
    return (
      <ErrorState
        title="المحادثة غير متاحة"
        description="قد تكون المحادثة حُذفت، أو لا تملك صلاحية الاطلاع عليها."
      />
    )
  }

  return (
    <>
      <PageHeader
        title={peerName}
        description="محادثة خاصة مع هذا الطالب."
        breadcrumb={{ label: 'المحادثات', to: '/app/teacher/conversations' }}
      />

      <Card className="overflow-hidden p-0">
        <div className="h-[min(66vh,680px)]">
          <MessageThread
            conversationId={conversationId}
            peerName={peerName}
            className="h-full px-4 sm:px-5"
          />
        </div>
      </Card>
    </>
  )
}
