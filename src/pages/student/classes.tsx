import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, GraduationCap, Search } from 'lucide-react'
import { listClasses } from '@/services/classes'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { useDebouncedValue } from '@/hooks/use-debounced-value'

export default function StudentClassesPage() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 250)

  const classesQuery = useQuery({
    queryKey: ['classes', 'student'],
    queryFn: () => listClasses(),
  })

  const filtered = useMemo(() => {
    const items = classesQuery.data ?? []
    const term = debouncedSearch.trim().toLowerCase()
    if (!term) return items
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(term) || item.description.toLowerCase().includes(term),
    )
  }, [classesQuery.data, debouncedSearch])

  return (
    <>
      <PageHeader
        title="الصفوف"
        description="جميع الصفوف التي نشرها المعلم. افتح أي صف لعرض دروسه ومواده التعليمية."
      />

      <div className="mb-6">
        <label
          htmlFor="class-search"
          className="relative block max-w-md"
        >
          <span className="sr-only">ابحث في الصفوف</span>
          <Search
            className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
            aria-hidden="true"
          />
          <input
            id="class-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث باسم الصف…"
            className="h-11 w-full rounded-xl border border-line bg-surface-2/70 ps-10 pe-4 text-sm text-ink placeholder:text-ink-3 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25"
          />
        </label>
      </div>

      {classesQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-44" />
          ))}
        </div>
      ) : classesQuery.isError ? (
        <ErrorState
          description={classesQuery.error.message}
          onRetry={() => void classesQuery.refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-5" aria-hidden="true" />}
          title={search ? 'لا نتائج مطابقة' : 'لا توجد صفوف منشورة بعد'}
          description={
            search
              ? 'جرّب كلمة بحث أخرى.'
              : 'لم ينشر المعلم أي صف حتى الآن. ستظهر الصفوف هنا فور نشرها.'
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((classItem) => (
            <li key={classItem.id}>
              <Card interactive className="h-full">
                <Link to={`/app/student/classes/${classItem.id}`} className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-gold-soft text-gold">
                      <BookOpen className="size-5" aria-hidden="true" />
                    </span>
                    <Badge tone="success">منشور</Badge>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-ink">{classItem.title}</h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-2">
                    {classItem.description || 'لا يوجد وصف لهذا الصف.'}
                  </p>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
