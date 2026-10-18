import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/cn'

export type PageHeaderProps = {
  title: string
  description?: string | undefined
  /** Breadcrumb entry shown above the title. */
  breadcrumb?: { label: string; to: string } | undefined
  action?: ReactNode | undefined
  className?: string
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  action,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-6 sm:mb-8', className)}>
      {breadcrumb ? (
        <Link
          to={breadcrumb.to}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-3 transition-colors hover:text-gold"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {breadcrumb.label}
        </Link>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
    </header>
  )
}
