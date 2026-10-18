/**
 * Error normalisation.
 *
 * Every error that reaches the user interface goes through `toAppError` so
 * that:
 *   * raw Supabase/PostgREST messages never leak internal details such as
 *     SQL fragments, table names or stack traces,
 *   * the same failure always produces the same Arabic message,
 *   * the original error is preserved for the console so it can be diagnosed
 *     without exposing anything to the visitor.
 */

export type AppErrorKind =
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'network'
  | 'rate_limit'
  | 'storage'
  | 'configuration'
  | 'unknown'

export class AppError extends Error {
  readonly kind: AppErrorKind
  readonly original?: unknown
  /** True when retrying the same operation may succeed. */
  readonly retryable: boolean

  constructor(kind: AppErrorKind, message: string, options?: { original?: unknown; retryable?: boolean }) {
    super(message)
    this.name = 'AppError'
    this.kind = kind
    this.original = options?.original
    this.retryable = options?.retryable ?? false
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super('configuration', message)
    this.name = 'ConfigurationError'
  }
}

const MESSAGES: Record<AppErrorKind, string> = {
  auth: 'تعذّر تسجيل الدخول. تحقّق من البريد الإلكتروني وكلمة المرور وحاول مجددًا.',
  forbidden: 'ليست لديك صلاحية تنفيذ هذه العملية.',
  not_found: 'العنصر المطلوب غير موجود أو لم يعد متاحًا.',
  validation: 'البيانات المُدخلة غير صحيحة. راجع الحقول المميّزة.',
  conflict: 'يوجد عنصر بالاسم نفسه بالفعل.',
  network: 'تعذّر الاتصال بالخدمة. تحقّق من اتصالك بالإنترنت وحاول مجددًا.',
  rate_limit: 'تم تجاوز عدد الطلبات المسموح بها. انتظر قليلًا ثم أعد المحاولة.',
  storage: 'تعذّر تنفيذ عملية الملف. حاول مجددًا وتأكّد من حجم الملف.',
  configuration: 'المنصة لم تُهيّأ بعد. راجع متغيّرات البيئة المطلوبة.',
  unknown: 'حدث خطأ غير متوقع. حاول مجددًا.',
}

/** PostgREST error codes that we can translate into something meaningful. */
const PG_STATUS_MAP: Record<string, AppErrorKind> = {
  '23505': 'conflict',
  '23503': 'validation',
  '23514': 'validation',
  '42501': 'forbidden',
  '42P01': 'not_found',
  'PGRST116': 'not_found',
  'PGRST301': 'forbidden',
}

const SUPABASE_MESSAGE_MAP: Record<string, string> = {
  'Invalid login credentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  'User already registered': 'هذا البريد الإلكتروني مسجّل مسبقًا. سجّل الدخول بدلاً من ذلك.',
  'Email not confirmed': 'لم يتم تأكيد البريد الإلكتروني بعد.',
  'Password should be at least 6 characters.': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.',
  'New password should be different from the old password.': 'كلمة المرور الجديدة يجب أن تختلف عن السابقة.',
  'Token has expired or is invalid': 'انتهت صلاحية الرابط. يُرجى طلب رابط جديد.',
  'Email rate limit exceeded': 'تم تجاوز عدد الرسائل المسموح بها. حاول لاحقًا.',
  'A user with this email address has already been registered': 'هذا البريد الإلكتروني مسجّل مسبقًا.',
}

interface SupabaseLikeError {
  message?: string
  code?: string
  status?: number
  details?: string
  hint?: string
}

function isSupabaseLikeError(value: unknown): value is SupabaseLikeError {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('message' in value || 'code' in value || 'status' in value)
  )
}

/**
 * Convert an unknown thrown value into a user facing `AppError`.
 * The original value is always kept for the console.
 */
export function toAppError(error: unknown, fallbackKind: AppErrorKind = 'unknown'): AppError {
  if (error instanceof AppError) return error

  if (isSupabaseLikeError(error)) {
    const rawMessage = error.message ?? ''
    const friendly = SUPABASE_MESSAGE_MAP[rawMessage]
    if (friendly) {
      return new AppError(fallbackKind === 'unknown' ? 'auth' : fallbackKind, friendly, { original: error })
    }

    const kind = error.code ? PG_STATUS_MAP[error.code] : undefined
    if (kind) {
      return new AppError(kind, MESSAGES[kind], { original: error })
    }

    if (error.status === 401) {
      return new AppError('auth', MESSAGES.auth, { original: error })
    }
    if (error.status === 403) {
      return new AppError('forbidden', MESSAGES.forbidden, { original: error })
    }
    if (error.status === 404) {
      return new AppError('not_found', MESSAGES.not_found, { original: error })
    }
    if (error.status === 409) {
      return new AppError('conflict', MESSAGES.conflict, { original: error })
    }
    if (error.status === 429) {
      return new AppError('rate_limit', MESSAGES.rate_limit, { original: error, retryable: true })
    }
    if (error.status && error.status >= 500) {
      return new AppError('network', MESSAGES.network, { original: error, retryable: true })
    }
  }

  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return new AppError('network', MESSAGES.network, { original: error, retryable: true })
  }

  return new AppError(fallbackKind, MESSAGES[fallbackKind], { original: error })
}

/** Log an error for diagnostics without leaking anything to the visitor. */
export function logError(context: string, error: unknown): void {
  const appError = toAppError(error)
  console.error(`[${context}]`, appError.original ?? appError.message)
}
