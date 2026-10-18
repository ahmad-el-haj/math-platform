import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  FileText,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getClass } from '@/services/classes'
import { deleteLesson, listLessons, reorderLessons, setLessonPublished } from '@/services/lessons'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button, buttonStyles } from '@/components/ui/button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { ConfirmDialog } from '@/components/ui/dialog'
import { toAppError } from '@/lib/errors'

export default function TeacherClassDetailPage() {
  const { classId = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [reordering, setReordering] = useState(false)

  const classQuery = useQuery({
    queryKey: ['class', classId],
    queryFn: () => getClass(classId),
    enabled: Boolean(classId),
  })

  const lessonsQuery = useQuery({
    queryKey: ['lessons', classId, 'teacher'],
    queryFn: () => listLessons(classId),
    enabled: Boolean(classId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['lessons', classId] })

  const moveLesson = async (index: number, direction: -1 | 1) => {
    const lessons = lessonsQuery.data
    if (!lessons) return

    const target = index + direction
    if (target < 0 || target >= lessons.length) return

    const reordered = [...lessons]
    const [moved] = reordered.splice(index, 1)
    if (!moved) return
    reordered.splice(target, 0, moved)

    setReordering(true)
    try {
      await reorderLessons(reordered.map((lesson) => lesson.id))
      await invalidate()
    } catch (error) {
      toast.error('تعذّر حفظ الترتيب', toAppError(error, 'validation').message)
    } finally {
      setReordering(false)
    }
  }

  const togglePublished = async (lessonId: string, isPublished: boolean) => {
    try {
      await setLessonPublished(lessonId, isPublished)
      await invalidate()
      toast.success(isPublished ? 'نُشر الدرس' : 'أُخفي الدرس')
    } catch (error) {
      toast.error('تعذّر تغيير حالة النشر', toAppError(error, 'validation').message)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteLesson(pendingDelete.id)
      await invalidate()
      toast.success('تم حذف الدرس')
      setPendingDelete(null)
    } catch (error) {
      toast.error('تعذّر حذف الدرس', toAppError(error, 'validation').message)
    } finally {
      setDeleting(false)
    }
  }

  if (classQuery.isLoading) {
    return (
      <>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-8 h-72" />
      </>
    )
  }

  if (classQuery.isError || !classQuery.data) {
    return (
      <ErrorState
        title="تعذّر فتح الصف"
        description={classQuery.error?.message ?? 'هذا الصف غير متاح.'}
      />
    )
  }

  const classItem = classQuery.data
  const lessons = lessonsQuery.data ?? []

  return (
    <>
      <PageHeader
        title={classItem.title}
        description={classItem.description || 'إدارة دروس هذا الصف.'}
        breadcrumb={{ label: 'الصفوف', to: '/app/teacher/classes' }}
        action={
          <>
            <Link
              to={`/app/teacher/classes/${classId}/edit`}
              className={buttonStyles('secondary', 'sm')}
            >
              <Pencil className="size-4" aria-hidden="true" />
              تعديل الصف
            </Link>
            <Link
              to={`/app/teacher/classes/${classId}/lessons/new`}
              className={buttonStyles('primary', 'sm')}
            >
              <Plus className="size-4" aria-hidden="true" />
              درس جديد
            </Link>
          </>
        }
      />

      <section>
        <h2 className="text-lg font-bold text-ink">الدروس</h2>

        <div className="mt-4">
          {lessonsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-24" />
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
              title="لا توجد دروس في هذا الصف"
              description="أضف أول درس، ثم اربط به المواد التعليمية (PDF أو DOCX)."
              action={
                <Link
                  to={`/app/teacher/classes/${classId}/lessons/new`}
                  className={buttonStyles('primary', 'sm')}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  إضافة درس جديد
                </Link>
              }
            />
          ) : (
            <ul className="space-y-3">
              {lessons.map((lesson, index) => (
                <li key={lesson.id}>
                  <Card className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-ink sm:text-base">
                            {lesson.title}
                          </h3>
                          <Badge tone={lesson.is_published ? 'success' : 'neutral'}>
                            {lesson.is_published ? 'منشور' : 'مسودة'}
                          </Badge>
                          {lesson.documentCount > 0 ? (
                            <span className="flex items-center gap-1.5 text-xs text-ink-3">
                              <FileText className="size-3.5" aria-hidden="true" />
                              {lesson.documentCount}
                            </span>
                          ) : null}
                        </div>
                        {lesson.description ? (
                          <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-relaxed text-ink-2">
                            {lesson.description}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void moveLesson(index, -1)}
                            disabled={index === 0 || reordering}
                            className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-35"
                            aria-label="تحريك الدرس إلى الأعلى"
                          >
                            <ArrowUp className="size-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void moveLesson(index, 1)}
                            disabled={
                              index === lessons.length - 1 || reordering
                            }
                            className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-35"
                            aria-label="تحريك الدرس إلى الأسفل"
                          >
                            <ArrowDown className="size-4" aria-hidden="true" />
                          </button>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void togglePublished(lesson.id, !lesson.is_published)
                          }
                        >
                          {lesson.is_published ? 'إخفاء' : 'نشر'}
                        </Button>

                        <Link
                          to={`/app/teacher/classes/${classId}/lessons/${lesson.id}/edit`}
                          className={buttonStyles('secondary', 'sm')}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                          تعديل
                        </Link>

                        <Link
                          to={`/app/teacher/classes/${classId}/lessons/${lesson.id}/documents`}
                          className={buttonStyles('secondary', 'sm')}
                        >
                          <FileText className="size-4" aria-hidden="true" />
                          المواد
                        </Link>

                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setPendingDelete({ id: lesson.id, title: lesson.title })}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                          حذف
                        </Button>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`حذف الدرس «${pendingDelete?.title ?? ''}»؟`}
        description="سيُحذف الدرس مع المواد التعليمية المرتبطة به."
        confirmLabel="حذف"
        destructive
        loading={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />

      {void navigate}
    </>
  )
}
