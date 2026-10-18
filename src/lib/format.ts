/**
 * Formatting helpers.
 *
 * The platform is Arabic first, but mathematics is easier to read with
 * western digits, and the same convention is used for file names and
 * formulas. Every locale therefore uses the `latn` numbering system while
 * keeping Arabic month and day names.
 */

const LOCALE = 'ar-u-nu-latn'
const RELATIVE_LOCALE = 'ar'

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  calendar: 'gregory',
})

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  calendar: 'gregory',
})

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

const weekdayFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  calendar: 'gregory',
})

const numberFormatter = new Intl.NumberFormat(LOCALE)

const relativeFormatter = new Intl.RelativeTimeFormat(RELATIVE_LOCALE, { numeric: 'auto' })

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? dateFormatter.format(date) : '—'
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? dateTimeFormatter.format(date) : '—'
}

export function formatTime(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? timeFormatter.format(date) : '—'
}

export function formatWeekday(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? weekdayFormatter.format(date) : '—'
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return numberFormatter.format(value)
}

/** Human readable relative time, e.g. "قبل 5 دقائق" / "الآن". */
export function formatRelativeTime(value: string | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return '—'

  const deltaSeconds = (date.getTime() - Date.now()) / 1000
  const absolute = Math.abs(deltaSeconds)

  if (absolute < 45) return 'الآن'
  if (absolute < 90) return relativeFormatter.format(Math.round(deltaSeconds), 'minute')
  if (absolute < 3600) return relativeFormatter.format(Math.round(deltaSeconds / 60), 'minute')
  if (absolute < 86400) return relativeFormatter.format(Math.round(deltaSeconds / 3600), 'hour')
  if (absolute < 2592000) return relativeFormatter.format(Math.round(deltaSeconds / 86400), 'day')
  if (absolute < 31536000) return relativeFormatter.format(Math.round(deltaSeconds / 2592000), 'month')
  return relativeFormatter.format(Math.round(deltaSeconds / 31536000), 'year')
}

/** File size in a compact, Arabic-friendly notation. */
export function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${formatNumber(bytes)} بايت`

  const units = ['ك.ب', 'م.ب', 'غ.ب']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const rounded = value >= 100 ? Math.round(value).toString() : value.toFixed(1)
  return `${rounded} ${units[unitIndex]}`
}

/** Two letter initials for the avatar placeholder. */
export function initials(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return '؟'
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0]!.slice(0, 2)
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`
}

/** Strip characters that are unsafe in a storage object name. */
export function toSafeFileName(name: string): string {
  const cleaned = name
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
  return cleaned.slice(0, 120) || 'document'
}

/** Display name with a sensible fallback. */
export function displayName(
  fullName: string | null | undefined,
  email: string | null | undefined,
): string {
  const name = (fullName ?? '').trim()
  if (name) return name
  const mail = (email ?? '').trim()
  if (mail) return mail.split('@')[0] ?? mail
  return 'مستخدم'
}
