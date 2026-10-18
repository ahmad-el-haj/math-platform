import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Archive, GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  deleteClassWithFiles,
  listClasses,
  setClassArchived,
  setClassPublished,
} from '@/services/classes'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button, buttonStyles } from '@/components/ui/button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { ConfirmDialog } from '@/components/ui/dialog'
import { toAppError } from '@/lib/errors'

export default function TeacherClassesPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const classesQuery = useQuery({
    queryKey: ['classes', 'teacher'],
    queryFn: () => listClasses({ includeArchived: true, withLessonCounts: true }),
  })

  const classes = classesQuery.data ?? []
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['classes'] })

  const togglePublished = async (id: string, isPublished: boolean) => {
    try {
      await setClassPublished(id, isPublished)
      await invalidate()
      toast.success(isPublished ? 'نُشر الصف للطلاب' : 'أُخفي الصف عن الطلاب')
    } catch (error) {
      toast.error('تعذّر تغيير حالة النشر', toAppError(error, 'validation').message)
    }
  }

  const toggleArchived = async (id: string, isArchived: boolean) => {
    try {
      await setClassArchived(id, isArchived)
      await invalidate()
      toast.success(isArchived ? 'أُرشف الصف' : 'أُعيد الصف من الأرشيف')
    } catch (error) {
      toast.error('تعذّر تغيير حالة الأرشفة', toAppError(error, 'validation').message)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const result = await deleteClassWithFiles(pendingDelete.id)
      await invalidate()
      toast.success(
        'تم حذف الصف',
        result.failedFiles > 0
          ? `حُذفت الدروس، وتعذّر حذف ${result.failedFiles} ملف من مخزن الملفات.`
          : 'حُذفت دروسه ومواده التعليمية معه.',
      )
      setPendingDelete(null)
    } catch (error) {
      toast.error('تعذّر حذف الصف', toAppError(error, 'validation').message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="الصفوف والدروس"
        description="أنشئ صفوفك، نظّم دروسها، وتحكّم في ما يراه الطلاب."
        action={
          <Link to="/app/teacher/classes/new" className={buttonStyles('primary', 'sm')}>
            <Plus className="size-4" aria-hidden="true" />
            صف جديد
          </Link>
        }
      />

      {classesQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : classesQuery.isError ? (
        <ErrorState
          description={classesQuery.error.message}
          onRetry={() => void classesQuery.refetch()}
        />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-5" aria-hidden="true" />}
          title="لا توجد صفوف بعد"
          description="ابدأ بإنشاء صفك الأول — يمكنك تسميته لأي grade تريد دون تعديل الكود."
          action={
            <Link to="/app/teacher/classes/new" className={buttonStyles('primary', 'sm')}>
              <Plus className="size-4" aria-hidden="true" />
              إنشاء صف
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {classes.map((classItem) => (
            <li key={classItem.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/app/teacher/classes/${classItem.id}`}
                        className="text-base font-bold text-ink transition-colors hover:text-gold"
                      >
                        {classItem.title}
                      </Link>
                      <Badge tone={classItem.is_published ? 'success' : 'neutral'}>
                        {classItem.is_published ? 'منشور' : 'مسودة'}
                      </Badge>
                      {classItem.is_archived ? <Badge tone="warning">مؤرشف</Badge> : null}
                    </div>
                    {classItem.description ? (
                      <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-relaxed text-ink-2">
                        {classItem.description}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-ink-3">
                      {classItem.lessonCount} درسًا · الترتيب {classItem.display_order}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void togglePublished(classItem.id, !classItem.is_published)}
                    >
                      {classItem.is_published ? 'إخفاء' : 'نشر'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void toggleArchived(classItem.id, !classItem.is_archived)}
                    >
                      <Archive className="size-4" aria-hidden="true" />
                      {classItem.is_archived ? 'إلغاء الأرشفة' : 'أرشفة'}
                    </Button>
                    <Link
                      to={`/app/teacher/classes/${classItem.id}/edit`}
                      className={buttonStyles('secondary', 'sm')}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      تعديل
                    </Link>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setPendingDelete({ id: classItem.id, title: classItem.title })}
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`حذف الصف «${pendingDelete?.title ?? ''}»؟`}
        description="سيُحذف الصف مع كل دروسه والمواد التعليمية المرتبطة به. لا يمكن التراجع."
        confirmLabel="حذف نهائي"
        destructive
        loading={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}
