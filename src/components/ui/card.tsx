import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type CardElement = 'div' | 'article' | 'section' | 'li'

export type CardProps = {
  className?: string | undefined
  interactive?: boolean | undefined
  as?: CardElement | undefined
  children?: ReactNode
} & Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'>

export function Card({ className, interactive = false, as = 'div', ...props }: CardProps) {
  const Tag = as
  return (
    <Tag
      className={cn(
        'surface-card',
        interactive && 'surface-card-interactive',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 p-5 pb-0 sm:p-6 sm:pb-0', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-base font-bold leading-snug text-ink sm:text-lg', className)}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm leading-relaxed text-ink-2', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 sm:p-6', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-3 border-t border-line px-5 py-4 sm:px-6', className)}
      {...props}
    />
  )
}

/** A section heading used across the dashboards. */
export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-ink sm:text-xl">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  )
}
