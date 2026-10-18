import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, FileType, Presentation } from 'lucide-react'
import { getClass } from '@/services/classes'
import { getLesson } from '@/services/lessons'
import { listDocuments } from '@/services/documents'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { formatBytes, formatDate } from '@/lib/format'
import { DOCX_MIME } from '@/services/documents'

export default function StudentLessonDetailPage() {
  const { classId = '', lessonId = '' } = useParams()

  const classQuery = useQuery({
    queryKey: ['class', classId],
    queryFn: () => getClass(classId),
    enabled: Boolean(classId),
  })

  const lessonQuery = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => getLesson(lessonId),
    enabled: Boolean(lessonId),
  })

  const documentsQuery = useQuery({
    queryKey: ['documents', lessonId],
    queryFn: () => listDocuments(lessonId),
    enabled: Boolean(lessonId),
  })

  if (lessonQuery.isLoading) {
    return (
      <>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-4 h-4 w-96" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      </>
    )
  }

  if (lessonQuery.isError || !lessonQuery.data) {
    return (
      <ErrorState
        title="تعذّر فتح الدرس"
        description={lessonQuery.error?.message ?? 'هذا الدرس غير متاح.'}
      />
    )
  }

  const lesson = lessonQuery.data
  const documents = documentsQuery.data ?? []

  return (
    <>
      <PageHeader
        title={lesson.title}
        description={lesson.description || 'محتوى الدرس.'}
        breadcrumb={
          classQuery.data
            ? { label: classQuery.data.title, to: `/app/student/classes/${classId}` }
            : { label: 'الصفوف', to: '/app/student/classes' }
        }
      />

      <section>
        <h2 className="text-lg font-bold text-ink">المواد التعليمية</h2>

        <div className="mt-4">
          {documentsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }, (_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
          ) : documentsQuery.isError ? (
            <ErrorState
              description={documentsQuery.error.message}
              onRetry={() => void documentsQuery.refetch()}
            />
          ) : documents.length === 0 ? (
            <EmptyState
              icon={<FileText className="size-5" aria-hidden="true" />}
              title="لا توجد مواد في هذا الدرس"
              description="سيظهر هنا أي ملف يرفعه المعلم لهذا الدرس."
            />
          ) : (
            <ul className="space-y-3">
              {documents.map((document) => {
                const isDocx = document.mime_type === DOCX_MIME
                return (
                  <li key={document.id}>
                    <Card interactive>
                      <Link
                        to={`/app/student/documents/${document.id}`}
                        className="flex items-center gap-4 p-4 sm:p-5"
                      >
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-gold">
                          {isDocx ? (
                            <FileType className="size-5" aria-hidden="true" />
                          ) : (
                            <Presentation className="size-5" aria-hidden="true" />
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-bold text-ink sm:text-base">
                            {document.title}
                          </h3>
                          {document.description ? (
                            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-2">
                              {document.description}
                            </p>
                          ) : null}
                          <p className="mt-1.5 text-xs text-ink-3">
                            {formatBytes(document.file_size)} · {formatDate(document.created_at)}
                          </p>
                        </div>

                        <Badge tone={isDocx ? 'info' : 'gold'}>{isDocx ? 'DOCX' : 'PDF'}</Badge>
                      </Link>
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}
