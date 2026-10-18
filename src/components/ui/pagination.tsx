import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { buttonStyles } from '@/components/ui/button'

export type PaginationProps = {
  page: number
  pageCount: number
  total: number
  onPageChange: (page: number) => void
  className?: string
}

/**
 * Pagination control.
 *
 * The arrows follow the RTL reading order: "previous" points to the right
 * side of the control.
 */
export function Pagination({ page, pageCount, total, onPageChange, className }: PaginationProps) {
  if (pageCount <= 1) {
    return (
      <p className={cn('text-xs text-ink-3', className)}>
        {total > 0 ? `الإجمالي: ${total}` : null}
      </p>
    )
  }

  return (
    <nav
      className={cn('flex items-center justify-between gap-3', className)}
      aria-label="تصفّح الصفحات"
    >
      <p className="text-xs text-ink-3">
        صفحة {page + 1} من {pageCount} — الإجمالي: {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          className={buttonStyles('secondary', 'sm')}
          aria-label="الصفحة السابقة"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount - 1}
          className={buttonStyles('secondary', 'sm')}
          aria-label="الصفحة التالية"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}
