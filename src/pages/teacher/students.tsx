import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Users } from 'lucide-react'
import { listStudents } from '@/services/profiles'
import { appConfig } from '@/config/env'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatDate } from '@/lib/format'

export default function TeacherStudentsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const debouncedSearch = useDebouncedValue(search, 300)

  const studentsQuery = useQuery({
    queryKey: ['students', page, debouncedSearch],
    queryFn: () =>
      listStudents({
        page,
        pageSize: appConfig.studentsPageSize,
        search: debouncedSearch || undefined,
      }),
  })

  const students = studentsQuery.data?.profiles ?? []
  const total = studentsQuery.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / appConfig.studentsPageSize))

  return (
    <>
      <PageHeader
        title="الطلاب"
        description="الطلاب المسجّلون في المنصة. تظهر هنا أرقامهم دون أي بيانات إضافية."
      />

      <div className="mb-6">
        <label htmlFor="student-search" className="relative block max-w-md">
          <span className="sr-only">ابحث في الطلاب</span>
          <Search
            className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
            aria-hidden="true"
          />
          <input
            id="student-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(0)
            }}
            placeholder="ابحث بالاسم أو البريد…"
            className="h-11 w-full rounded-xl border border-line bg-surface-2/70 ps-10 pe-4 text-sm text-ink placeholder:text-ink-3 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25"
          />
        </label>
      </div>

      {studentsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      ) : studentsQuery.isError ? (
        <ErrorState
          description={studentsQuery.error.message}
          onRetry={() => void studentsQuery.refetch()}
        />
      ) : students.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" aria-hidden="true" />}
          title={search ? 'لا نتائج مطابقة' : 'لا يوجد طلاب بعد'}
          description={
            search
              ? 'جرّب اسمًا أو بريدًا إلكترونيًا آخر.'
              : 'سيظهر هنا كل طالب يسجّل في المنصة.'
          }
        />
      ) : (
        <>
          <ul className="space-y-2">
            {students.map((student) => (
              <li key={student.id}>
                <Card className="flex items-center gap-3.5 p-3.5">
                  <Avatar name={student.full_name || student.email} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {student.full_name || student.email.split('@')[0]}
                    </p>
                    <p className="truncate text-xs text-ink-3" dir="ltr">
                      {student.email}
                    </p>
                  </div>
                  {student.grade_level ? (
                    <Badge tone="info">{student.grade_level}</Badge>
                  ) : null}
                  <span className="hidden shrink-0 text-xs text-ink-3 sm:inline">
                    {formatDate(student.created_at)}
                  </span>
                </Card>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            onPageChange={setPage}
            className="mt-6"
          />
        </>
      )}
    </>
  )
}
