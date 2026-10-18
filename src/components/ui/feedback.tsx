import type { ReactNode } from 'react'
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { buttonStyles } from '@/components/ui/button'

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn('size-5 animate-spin text-ink-3', className)}
      role="status"
      aria-label="جارٍ التحميل"
    />
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />
}

export function ProgressBar({
  value,
  className,
  label,
}: {
  value: number
  className?: string
  label?: string
}) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'التقدّم'}
    >
      <div
        className="h-full rounded-full bg-gold transition-[width] duration-300 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed',
        'border-line-strong/70 bg-surface-2/30 px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="flex size-12 items-center justify-center rounded-2xl bg-gold-soft text-gold">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1.5">
        <p className="text-base font-bold text-ink">{title}</p>
        {description ? (
          <p className="mx-auto max-w-md text-sm leading-relaxed text-ink-2">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title = 'تعذّر تحميل البيانات',
  description,
  onRetry,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-danger/25',
        'bg-danger/8 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-danger/12 text-danger">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-bold text-ink">{title}</p>
        {description ? (
          <p className="mx-auto max-w-md text-sm leading-relaxed text-ink-2">{description}</p>
        ) : null}
      </div>
      {onRetry ? (
        <button type="button" onClick={onRetry} className={buttonStyles('secondary', 'sm')}>
          <RotateCcw className="size-4" aria-hidden="true" />
          إعادة المحاولة
        </button>
      ) : null}
    </div>
  )
}
