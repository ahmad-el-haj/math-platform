import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileText, FileType, Pencil, RefreshCw, Trash2, Upload } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { getClass } from '@/services/classes'
import { getLesson } from '@/services/lessons'
import { createSignedUrl, deleteDocument, listDocuments, DOCX_MIME } from '@/services/documents'
import { appConfig } from '@/config/env'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import {
  EditDocumentMetadataDialog,
  ReplaceDocumentFileDialog,
  UploadDocumentDialog,
} from '@/components/documents/document-dialogs'
import { formatBytes, formatDateTime } from '@/lib/format'
import { toAppError } from '@/lib/errors'
import type { LessonDocument } from '@/lib/database.types'

/**
 * The document list of a lesson — teacher view.
 *
 * The three dialogs (upload, edit the metadata, replace the file) live in
 * `src/components/documents/document-dialogs.tsx`.
 */
export default function TeacherDocumentsPage() {
  const { classId = '', lessonId = '' } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [uploadOpen, setUploadOpen] = useState(false)
  const [editing, setEditing] = useState<LessonDocument | null>(null)
  const [replacing, setReplacing] = useState<LessonDocument | null>(null)
  const [pendingDelete, setPendingDelete] = useState<LessonDocument | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  const documents = documentsQuery.data ?? []
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['documents', lessonId] })

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteDocument(pendingDelete)
      await invalidate()
      toast.success('تم حذف المادة', 'أُزيل الملف من مخزن الملفات أيضًا.')
      setPendingDelete(null)
    } catch (error) {
      toast.error('تعذّر حذف المادة', toAppError(error, 'validation').message)
    } finally {
      setDeleting(false)
    }
  }

  const handleDownload = async (document: LessonDocument) => {
    try {
      const url = await createSignedUrl(document.file_path, {
        download: document.original_file_name,
      })
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = document.original_file_name
      anchor.rel = 'noopener'
      window.document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    } catch (error) {
      toast.error('تعذّر تجهيز رابط التنزيل', toAppError(error, 'storage').message)
    }
  }

  if (lessonQuery.isLoading) {
    return (
      <>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-8 h-72" />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={lessonQuery.data?.title ?? 'المواد التعليمية'}
        description="ارفع أوراق العمل والامتحانات بصيغة PDF أو DOCX، وامنح الطالب معاينة مباشرة وتحميلًا آمنًا."
        breadcrumb={
          classQuery.data
            ? { label: classQuery.data.title, to: `/app/teacher/classes/${classId}` }
            : { label: 'الصفوف', to: '/app/teacher/classes' }
        }
        action={
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="size-4" aria-hidden="true" />
            رفع مادة
          </Button>
        }
      />

      {documentsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
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
          description="ارفع أول ملف — سيظهر للطلاب فور رفعه إذا كان الدرس منشورًا."
          action={
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="size-4" aria-hidden="true" />
              رفع مادة
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {documents.map((document) => {
            const isDocx = document.mime_type === DOCX_MIME
            return (
              <li key={document.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3.5">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-gold">
                        {isDocx ? (
                          <FileType className="size-5" aria-hidden="true" />
                        ) : (
                          <FileText className="size-5" aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-bold text-ink sm:text-base">
                            {document.title}
                          </h3>
                          <Badge tone={isDocx ? 'info' : 'gold'}>
                            {isDocx ? 'DOCX' : 'PDF'}
                          </Badge>
                        </div>
                        {document.description ? (
                          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-2">
                            {document.description}
                          </p>
                        ) : null}
                        <p className="mt-1.5 text-xs text-ink-3" dir="ltr">
                          {document.original_file_name}
                        </p>
                        <p className="mt-1 text-xs text-ink-3">
                          {formatBytes(document.file_size)} · الإصدار {document.version} ·{' '}
                          {formatDateTime(document.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDownload(document)}
                      >
                        <Download className="size-4" aria-hidden="true" />
                        تنزيل
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(document)}>
                        <Pencil className="size-4" aria-hidden="true" />
                        تعديل
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setReplacing(document)}>
                        <RefreshCw className="size-4" aria-hidden="true" />
                        استبدال
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setPendingDelete(document)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        حذف
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <UploadDocumentDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        classId={classId}
        lessonId={lessonId}
        createdBy={user?.id ?? ''}
        onDone={invalidate}
      />

      <EditDocumentMetadataDialog
        document={editing}
        onClose={() => setEditing(null)}
        onDone={invalidate}
      />

      <ReplaceDocumentFileDialog
        document={replacing}
        classId={classId}
        onClose={() => setReplacing(null)}
        onDone={invalidate}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`حذف «${pendingDelete?.title ?? ''}»؟`}
        description="سيُحذف الملف من مخزن الملفات ولن يظهر للطلاب بعد الآن."
        confirmLabel="حذف"
        destructive
        loading={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />

      <p className="mt-8 text-xs leading-relaxed text-ink-3">
        صيغ مدعومة: PDF و DOCX · الحد الأقصى {appConfig.maxUploadMegabytes} م.ب لكل ملف.
      </p>
    </>
  )
}
