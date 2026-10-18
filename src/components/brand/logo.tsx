import { cn } from '@/lib/cn'

export type LogoProps = {
  className?: string
  size?: number
  showWordmark?: boolean
}

/**
 * The brand mark: a parabola inside a squared frame.
 * It reads as a function graph — the visual language of the whole platform.
 */
export function LogoMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="11"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <path
        d="M9 28.5C14 28.5 15 12 20 12C25 12 26 28.5 31 28.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="20" cy="12" r="2.6" fill="currentColor" />
      <path d="M9 32.5H31" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ className, size = 36, showWordmark = true }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} className="text-gold" />
      {showWordmark ? (
        <span className="flex flex-col leading-none">
          <span className="font-serif text-xl font-bold tracking-tight text-ink">رِواق</span>
          <span
            className="mt-1 text-[9px] font-semibold tracking-[0.3em] text-ink-3"
            lang="en"
            dir="ltr"
          >
            RIWAQ
          </span>
        </span>
      ) : null}
    </span>
  )
}
