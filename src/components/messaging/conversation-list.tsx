import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/feedback'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ConversationSummary } from '@/services/conversations'

export type ConversationListProps = {
  conversations: ConversationSummary[]
  currentUserId: string
  /** Builds the link to a conversation for the given peer. */
  linkFor: (conversation: ConversationSummary) => string
  emptyTitle: string
  emptyDescription: string
}

export function ConversationList({
  conversations,
  currentUserId,
  linkFor,
  emptyTitle,
  emptyDescription,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={<MessageCircle className="size-5" aria-hidden="true" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  return (
    <ul className="space-y-2">
      {conversations.map((conversation) => {
        const name = conversation.peer?.full_name || conversation.peer?.email || 'مشارك'
        const isMine = conversation.peer?.id === currentUserId

        return (
          <li key={conversation.id}>
            <Link
              to={linkFor(conversation)}
              className={cn(
                'flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 p-3.5',
                'transition-colors hover:border-line-strong hover:bg-surface-2',
              )}
            >
              <Avatar name={name} src={conversation.peer?.avatar_url || null} size="md" />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {isMine ? 'أنت' : name}
                </p>
                <p className="mt-0.5 text-xs text-ink-3">
                  {formatRelativeTime(conversation.lastMessageAt)}
                </p>
              </div>

              {conversation.unreadCount > 0 ? (
                <span className="flex min-w-6 items-center justify-center rounded-full bg-gold px-2 py-1 text-[11px] font-bold text-on-gold">
                  {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                </span>
              ) : null}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
