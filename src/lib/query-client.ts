import { QueryClient } from '@tanstack/react-query'
import { AppError, toAppError } from '@/lib/errors'

/**
 * Shared TanStack Query client.
 *
 * The defaults are tuned for a classroom sized deployment: data is considered
 * fresh for a short while, failed requests are retried twice with a backoff,
 * and errors are normalised into `AppError` so that every consumer can rely on
 * a stable `error.message`.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const appError = toAppError(error)
        if (!appError.retryable) return false
        return failureCount < 2
      },
    },
    mutations: {
      retry: false,
    },
  },
})

/** Throw a normalised error when a Supabase response carries one. */
export function assertNoError(
  result: { error: unknown },
  context: string,
): void {
  if (result.error) {
    const appError = toAppError(result.error)
    console.error(`[${context}]`, appError.original ?? appError.message)
    throw appError
  }
}

export { AppError }
