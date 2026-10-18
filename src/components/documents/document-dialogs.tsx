import { useRef, useState } from 'react'
import { RefreshCw, Upload } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  detectFileKind,
  replaceDocument,
  updateDocumentMetadata,
  uploadDocument,
  validateFileSize,
} from '@/services/documents'
import { appConfig } from '@/config/env'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/field'
import { Dialog } from '@/components/ui/dialog'
import { ProgressBar } from '@/components/ui/feedback'
import { toAppError } from '@/lib/errors'
import type { LessonDocument } from '@/lib/database.types'

/**
 * The three document dialogs of the teacher area.
 *
 * They live in their own module so the page itself stays a readable list of
 * documents instead of a 600 line file. Every dialog owns its own form state
 * and reports the outcome through `onDone`.
 */

const FILE_ACCEPT =
  '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
    >
      {message}
    </div>
  )
}

function ProgressNote({ progress }: { progress: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs text-ink-2">
        <span>جارٍ الرفع…</span>
        <span className="tabular">{progress}%</span>
      </div>
      <ProgressBar value={progress} label="تقدّم الرفع" />
    </div>
  )
}

/** Upload a new document into a lesson. */
export function UploadDocumentDialog({
  open,
  onClose,
  classId,
  lessonId,
  createdBy,
  onDone,
}: {
  open: boolean
  onClose: () => void
  classId: string
  lessonId: string
  createdBy: string
  onDone: () => void
}) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setTitle('')
    setDescription('')
    setFile(null)
    setProgress(0)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const pickFile = async (selected: File | null) => {
    if (!selected) return
    const sizeError = validateFileSize(selected)
    if (sizeError) {
      setError(sizeError)
      return
    }
    const detected = await detectFileKind(selected)
    if (!detected) {
      setError('نوع الملف غير مدعوم. المسموح: PDF أو DOCX فقط.')
      return
    }
    setError(null)
    setFile(selected)
    if (!title) setTitle(selected.name.replace(/\.[^.]+$/, ''))
  }

  const submit = async () => {
    if (!file) {
      setError('اختر ملفًا أولًا.')
      return
    }
    if (title.trim().length < 2) {
      setError('اكتب عنوانًا للمادة (حرفان على الأقل).')
      return
    }

    setUploading(true)
    setError(null)
    try {
      await uploadDocument({
        classId,
        lessonId,
        file,
        title: title.trim(),
        description: description.trim(),
        createdBy,
        onProgress: setProgress,
      })
      toast.success('تم رفع المادة', 'يمكنك معاينتها الآن.')
      onDone()
      reset()
      onClose()
    } catch (caught) {
      setError(toAppError(caught, 'storage').message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={uploading ? () => undefined : onClose}
      title="رفع مادة تعليمية"
      description="اختر ملف PDF أو DOCX، ثم أضف عنوانًا ووصفًا اختياريًا."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={uploading}>
            إلغاء
          </Button>
          <Button onClick={() => void submit()} loading={uploading}>
            {uploading ? 'جارٍ الرفع…' : 'رفع'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorNote message={error} />

        <div>
          <span className="text-sm font-medium text-ink-2">الملف</span>
          <label
            htmlFor="document-file"
            className="mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface-2/40 px-4 py-8 text-center transition-colors hover:border-gold/50"
          >
            <Upload className="size-6 text-gold" aria-hidden="true" />
            <span className="text-sm font-medium text-ink">
              {file ? file.name : 'اختر ملفًا من جهازك'}
            </span>
            <span className="text-xs text-ink-3">
              PDF أو DOCX · حتى {appConfig.maxUploadMegabytes} م.ب
            </span>
            <input
              ref={inputRef}
              id="document-file"
              type="file"
              accept={FILE_ACCEPT}
              className="sr-only"
              disabled={uploading}
              onChange={(event) => void pickFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <Input
          label="عنوان المادة"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="مثال: أوراق عمل — المعادلات"
          disabled={uploading}
        />

        <Textarea
          label="الوصف (اختياري)"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="ماذا يتضمّن هذا الملف؟"
          disabled={uploading}
        />

        {uploading ? <ProgressNote progress={progress} /> : null}
      </div>
    </Dialog>
  )
}

/** Edit the title and the description of a document. */
export function EditDocumentMetadataDialog({
  document,
  onClose,
  onDone,
}: {
  document: LessonDocument | null
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  // Load the values of the selected document during render (React's
  // "adjust the state when a prop changes" pattern) instead of in an effect.
  if (document && loadedFor !== document.id) {
    setLoadedFor(document.id)
    setTitle(document.title)
    setDescription(document.description)
    setError(null)
  }

  const save = async () => {
    if (!document) return
    if (title.trim().length < 2) {
      setError('العنوان قصير جدًا.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateDocumentMetadata(document.id, {
        title: title.trim(),
        description: description.trim(),
      })
      toast.success('تم تحديث البيانات')
      onDone()
      onClose()
    } catch (caught) {
      setError(toAppError(caught, 'validation').message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={document !== null}
      onClose={onClose}
      title="تعديل بيانات المادة"
      description="العنوان والوصف فقط. لاستبدال الملف استخدم إجراء «استبدال»."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            إلغاء
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            حفظ
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorNote message={error} />

        <Input
          label="عنوان المادة"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Textarea
          label="الوصف"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
    </Dialog>
  )
}

/** Replace the file of a document with a new version. */
export function ReplaceDocumentFileDialog({
  document,
  classId,
  onClose,
  onDone,
}: {
  document: LessonDocument | null
  classId: string
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const pickFile = async (selected: File | null) => {
    if (!selected) return
    const sizeError = validateFileSize(selected)
    if (sizeError) {
      setError(sizeError)
      return
    }
    const detected = await detectFileKind(selected)
    if (!detected) {
      setError('نوع الملف غير مدعوم. المسموح: PDF أو DOCX فقط.')
      return
    }
    setError(null)
    setFile(selected)
  }

  const submit = async () => {
    if (!document || !file) {
      setError('اختر ملفًا أولًا.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      await replaceDocument({ document, classId, file, onProgress: setProgress })
      toast.success('تم استبدال الملف', 'أُضيف الملف الجديد كنسخة مستقلة.')
      setFile(null)
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ''
      onDone()
      onClose()
    } catch (caught) {
      setError(toAppError(caught, 'storage').message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog
      open={document !== null}
      onClose={uploading ? () => undefined : onClose}
      title="استبدال الملف"
      description="الملف الجديد يُحفظ كنسخة جديدة، ويبقى الملف القديم متاحًا حتى ينجح الرفع."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={uploading}>
            إلغاء
          </Button>
          <Button onClick={() => void submit()} loading={uploading}>
            {uploading ? 'جارٍ الاستبدال…' : 'استبدال'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorNote message={error} />

        <label
          htmlFor="replace-file"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface-2/40 px-4 py-8 text-center transition-colors hover:border-gold/50"
        >
          <RefreshCw className="size-6 text-gold" aria-hidden="true" />
          <span className="text-sm font-medium text-ink">
            {file ? file.name : 'اختر الملف الجديد'}
          </span>
          <span className="text-xs text-ink-3">PDF أو DOCX</span>
          <input
            ref={inputRef}
            id="replace-file"
            type="file"
            accept={FILE_ACCEPT}
            className="sr-only"
            disabled={uploading}
            onChange={(event) => void pickFile(event.target.files?.[0] ?? null)}
          />
        </label>

        {uploading ? <ProgressNote progress={progress} /> : null}
      </div>
    </Dialog>
  )
}
