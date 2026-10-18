import { useState } from 'react'
import { Download, FileText, Info } from 'lucide-react'
import type { LessonDocument } from '@/lib/database.types'
import { DOCX_MIME, PDF_MIME } from '@/services/documents'
import { createSignedUrl } from '@/services/documents'
import { useToast } from '@/hooks/use-toast'
import { PdfViewer } from '@/components/documents/pdf-viewer'
import { DocxViewer } from '@/components/documents/docx-viewer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatBytes, formatDateTime } from '@/lib/format'
import { toAppError } from '@/lib/errors'

export type DocumentViewerProps = {
  document: LessonDocument
}

/** Preview a lesson document inside the platform, with a download action. */
export function DocumentViewer({ document }: DocumentViewerProps) {
  const toast = useToast()
  const [downloading, setDownloading] = useState(false)

  const isPdf = document.mime_type === PDF_MIME
  const isDocx = document.mime_type === DOCX_MIME

  const handleDownload = async () => {
    setDownloading(true)
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
      toast.success('جارٍ تنزيل الملف', document.original_file_name)
    } catch (error) {
      toast.error('تعذّر تجهيز رابط التنزيل', toAppError(error, 'storage').message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="surface-card flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-gold">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-ink">{document.title}</h2>
            <p className="mt-1 truncate text-xs text-ink-3" dir="ltr">
              {document.original_file_name}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={isPdf ? 'gold' : 'info'}>
                {isPdf ? 'PDF' : isDocx ? 'DOCX' : 'ملف'}
              </Badge>
              <span className="text-xs text-ink-3">{formatBytes(document.file_size)}</span>
              <span className="text-xs text-ink-3">·</span>
              <span className="text-xs text-ink-3">{formatDateTime(document.created_at)}</span>
            </div>
          </div>
        </div>

        <Button variant="secondary" onClick={handleDownload} loading={downloading}>
          {!downloading ? <Download className="size-4" aria-hidden="true" /> : null}
          تنزيل الملف
        </Button>
      </div>

      {document.description ? (
        <p className="flex items-start gap-2 rounded-xl border border-line bg-surface-2/40 px-4 py-3 text-sm leading-relaxed text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
          {document.description}
        </p>
      ) : null}

      {isPdf ? (
        <PdfViewer filePath={document.file_path} />
      ) : isDocx ? (
        <DocxViewer filePath={document.file_path} />
      ) : (
        <div className="rounded-2xl border border-line bg-surface-2/40 px-6 py-12 text-center">
          <p className="text-sm text-ink-2">
            لا يمكن معاينة هذا النوع من الملفات داخل المنصة. يمكنك تنزيله من الزر
            أعلاه.
          </p>
        </div>
      )}
    </div>
  )
}
