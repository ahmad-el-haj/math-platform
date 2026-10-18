import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, FileText, Lock } from 'lucide-react'
import { getClass } from '@/services/classes'
import { listLessons } from '@/services/lessons'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'

export default function StudentClassDetailPage() {
  const { classId = '' } = useParams()

  const classQuery = useQuery({
    queryKey: ['class', classId],
    queryFn: () => getClass(classId),
    enabled: Boolean(classId),
  })

  const lessonsQuery = useQuery({
    queryKey: ['lessons', classId, 'student'],
    queryFn: () => listLessons(classId),
    enabled: Boolean(classId),
  })

  if (classQuery.isLoading) {
    return (
      <>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-4 h-4 w-96" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      </>
    )
  }

  if (classQuery.isError || !classQuery.data) {
    return (
      <ErrorState
        title="تعذّر فتح الصف"
        description={classQuery.error?.message ?? 'هذا الصف غير متاح أو لم يعد منشورًا.'}
      />
    )
  }

  const classItem = classQuery.data
  const lessons = lessonsQuery.data ?? []

  return (
    <>
      <PageHeader
        title={classItem.title}
        description={classItem.description || 'صف دراسي منشور.'}
        breadcrumb={{ label: 'الصفوف', to: '/app/student/classes' }}
      />

      <section>
        {lessonsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-20" />
            ))}
          </div>
        ) : lessonsQuery.isError ? (
          <ErrorState
            description={lessonsQuery.error.message}
            onRetry={() => void lessonsQuery.refetch()}
          />
        ) : lessons.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="size-5" aria-hidden="true" />}
            title="لا توجد دروس منشورة في هذا الصف"
            description="سيظهر هنا كل درس ينشره المعلم."
          />
        ) : (
          <ul className="space-y-3">
            {lessons.map((lesson) => (
              <li key={lesson.id}>
                <Card interactive>
                  <Link
                    to={`/app/student/classes/${classId}/lessons/${lesson.id}`}
                    className="flex items-center gap-4 p-4 sm:p-5"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-gold">
                      <BookOpen className="size-5" aria-hidden="true" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-ink sm:text-base">
                        {lesson.title}
                      </h3>
                      {lesson.description ? (
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-2">
                          {lesson.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="hidden shrink-0 items-center gap-3 sm:flex">
                      {lesson.documentCount > 0 ? (
                        <span className="flex items-center gap-1.5 text-xs text-ink-3">
                          <FileText className="size-3.5" aria-hidden="true" />
                          {lesson.documentCount}
                        </span>
                      ) : null}
                      <Badge tone="success">منشور</Badge>
                    </div>
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {lessons.length > 0 ? (
        <p className="mt-6 flex items-center gap-2 text-xs text-ink-3">
          <Lock className="size-3.5" aria-hidden="true" />
          تظهر هنا الدروس المنشورة فقط.
        </p>
      ) : null}
    </>
  )
}
