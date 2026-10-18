/**
 * Environment configuration.
 *
 * The platform is a static single page app: only *public* Supabase
 * credentials can ever reach the browser. Anything prefixed with `VITE_` is
 * inlined into the JavaScript bundle by Vite, therefore:
 *
 *   * the anon / publishable key is safe to expose (it is protected by RLS),
 *   * the service-role key must NEVER be given a `VITE_` prefix, and
 *   * this module actively refuses to run if a privileged key is detected in
 *     a public variable, so a mistake is caught at boot time instead of
 *     leaking into a deployed bundle.
 */

export type MissingConfig = {
  variable: string
  hint: string
}

const PUBLIC_URL_KEYS = ['VITE_SUPABASE_URL'] as const
const PUBLIC_KEY_KEYS = ['VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY'] as const

function readEnv(name: string): string {
  const value = (import.meta.env as Record<string, string | undefined>)[name]
  return typeof value === 'string' ? value.trim() : ''
}

/** Refuse to boot if a privileged key was accidentally exposed to the browser. */
function assertNoPrivilegedKey(): void {
  for (const name of [...PUBLIC_URL_KEYS, ...PUBLIC_KEY_KEYS]) {
    const value = readEnv(name)
    if (!value) continue
    const looksPrivileged =
      value.startsWith('sb_secret_') ||
      value.includes('service_role') ||
      value.startsWith('eyJ') === false && value.length > 300

    if (looksPrivileged) {
      throw new Error(
        `${name} looks like a privileged Supabase key. ` +
          'The service-role key must never be exposed to the browser — ' +
          'remove it from the frontend environment and rotate it in the Supabase dashboard.',
      )
    }
  }
}

function isValidSupabaseUrl(value: string): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.hostname === 'localhost'
  } catch {
    return false
  }
}

const rawUrl = readEnv('VITE_SUPABASE_URL')
const rawKey = readEnv('VITE_SUPABASE_ANON_KEY') || readEnv('VITE_SUPABASE_PUBLISHABLE_KEY')

export const missingConfig: MissingConfig[] = []

if (!isValidSupabaseUrl(rawUrl)) {
  missingConfig.push({
    variable: 'VITE_SUPABASE_URL',
    hint: 'عنوان مشروع Supabase، مثل https://xxxxxxxxxxxx.supabase.co',
  })
}

if (!rawKey) {
  missingConfig.push({
    variable: 'VITE_SUPABASE_ANON_KEY',
    hint: 'المفتاح العام (anon) أو المفتاح المنشور (publishable) من إعدادات المشروع.',
  })
}

if (import.meta.env.PROD) {
  assertNoPrivilegedKey()
}

export const env = {
  supabaseUrl: rawUrl || null,
  supabaseAnonKey: rawKey || null,
  isConfigured: missingConfig.length === 0,
} as const

export const appConfig = {
  name: 'رِواق',
  tagline: 'منصة الرياضيات التعليمية',
  description:
    'صفوف ودروس ومواد تعليمية ورسائل خاصة بين المعلم والطلاب — بتجربة عربية مصمَّمة بعناية.',
  /** 25 MiB — matches the `file_size_limit` of the storage bucket. */
  maxUploadBytes: 25 * 1024 * 1024,
  maxUploadMegabytes: 25,
  allowedMimeTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ] as const,
  /** Lifetime of the signed URLs handed out for preview / download. */
  signedUrlTtlSeconds: 120,
  /** Number of messages fetched per page when scrolling back in a thread. */
  messagePageSize: 30,
  /** Number of students listed per page in the teacher area. */
  studentsPageSize: 25,
  storageBucket: 'lesson-documents',
} as const
