import { useQuery } from '@tanstack/react-query'
import { countUnreadMessages } from '@/services/conversations'
import { useAuth } from '@/hooks/use-auth'

/**
 * The number of unread messages for the current user.
 *
 * The value is refreshed when the window regains focus and every 60 seconds,
 * and it is invalidated whenever a message is sent or read (see the
 * conversation pages). A `head: true` count query transfers no rows.
 */
export function useUnreadCount(): number {
  const { user } = useAuth()

  const { data } = useQuery({
    queryKey: ['unread-count', user?.id],
    queryFn: () => countUnreadMessages(user!.id),
    enabled: Boolean(user?.id),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  })

  return data ?? 0
}
