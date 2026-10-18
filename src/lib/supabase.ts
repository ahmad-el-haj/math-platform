import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/config/env'
import { ConfigurationError } from '@/lib/errors'
import type { Database } from '@/lib/database.types'

/**
 * The single Supabase client used by the whole application.
 *
 * Only the *public* (anon / publishable) key is used. Every privileged
 * operation (creating the first teacher account) is performed by the owner's
 * local script `scripts/provision-teacher.mjs` with the service-role key,
 * which never reaches this bundle.
 *
 * When the environment is not configured the client is replaced by a proxy
 * that throws a descriptive error on first use, so a misconfigured deployment
 * fails loudly instead of silently talking to an invalid host.
 */
function createSupabaseClient(): SupabaseClient<Database> {
  if (!env.isConfigured) {
    return new Proxy({} as SupabaseClient<Database>, {
      get(_target, property) {
        if (property === 'then') return undefined
        throw new ConfigurationError(
          'لم تُضبط متغيّرات البيئة المطلوبة لتشغيل المنصة (VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY).',
        )
      },
    })
  }

  return createClient<Database>(env.supabaseUrl!, env.supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: { 'x-application-name': 'riwaq-math-platform' },
    },
  })
}

export const supabase: SupabaseClient<Database> = createSupabaseClient()

export type { SupabaseClient }
