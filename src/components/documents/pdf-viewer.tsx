import { useEffect, useMemo, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, FileWarning, ZoomIn, ZoomOut } from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { fetchDocumentBlob } from '@/services/documents'
import { Spinner } from '@/components/ui/feedback'
import { cn } from '@/lib/cn'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export type PdfViewerProps = {
  filePath: string
  className?: string
}

/**
 * In-app PDF preview.
 *
 * The file is fetched through a short lived signed URL and handed to pdf.js as
 * an in-memory buffer, so no file ever leaves the platform.
 */
export function PdfViewer({ filePath, className }: PdfViewerProps) {
  const [data, setData] = useState<Uint8Array | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1)
  const [containerWidth, setContainerWidth] = useState(720)

  // Reset the viewer when the file changes. Deriving the reset during render
  // (instead of inside the effect) avoids a cascading second render pass.
  const [activePath, setActivePath] = useState(filePath)
  if (activePath !== filePath) {
    setActivePath(filePath)
    setData(null)
    setError(null)
    setPageNumber(1)
    setNumPages(0)
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const blob = await fetchDocumentBlob(filePath)
        const buffer = new Uint8Array(await blob.arrayBuffer())
        if (!cancelled) setData(buffer)
      } catch {
        if (!cancelled) {
          setError('تعذّر تحميل الملف. تأكّد من اتصالك ثم أعد المحاولة.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [filePath])

  // Keep the rendered page inside the available width.
  useEffect(() => {
    const element = document.getElementById('pdf-viewport')
    if (!element) return

    const update = () => setContainerWidth(element.clientWidth || 720)
    update()

    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const pageWidth = useMemo(
    () => Math.max(280, Math.min(containerWidth - 8, 860) * scale),
    [containerWidth, scale],
  )

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-2xl border border-danger/25 bg-danger/8 px-6 py-14 text-center"
      >
        <FileWarning className="size-9 text-danger" aria-hidden="true" />
        <p className="text-sm text-ink-2">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-line bg-surface-2/40 py-20">
        <Spinner />
        <span className="text-sm text-ink-2">جارٍ تجهيز المعاينة…</span>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/50 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
            disabled={pageNumber <= 1}
            className="rounded-lg p-2 text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-40"
            aria-label="الصفحة السابقة"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
          <span className="tabular min-w-20 text-center text-sm text-ink-2">
            {pageNumber} / {numPages || '—'}
          </span>
          <button
            type="button"
            onClick={() => setPageNumber((page) => Math.min(numPages || 1, page + 1))}
            disabled={pageNumber >= numPages}
            className="rounded-lg p-2 text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-40"
            aria-label="الصفحة التالية"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setScale((value) => Math.max(0.6, Number((value - 0.15).toFixed(2))))}
            className="rounded-lg p-2 text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
            aria-label="تصغير"
          >
            <ZoomOut className="size-4" aria-hidden="true" />
          </button>
          <span className="tabular min-w-14 text-center text-sm text-ink-2">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale((value) => Math.min(2, Number((value + 0.15).toFixed(2))))}
            className="rounded-lg p-2 text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
            aria-label="تكبير"
          >
            <ZoomIn className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        id="pdf-viewport"
        className="overflow-auto rounded-2xl border border-line bg-surface-2/30 p-2 sm:p-4"
      >
        <Document
          file={{ data }}
          onLoadSuccess={({ numPages: total }) => setNumPages(total)}
          onLoadError={() => setError('تعذّر قراءة ملف PDF. قد يكون الملف تالفًا.')}
          loading={
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          }
          error={
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <FileWarning className="size-8 text-danger" aria-hidden="true" />
              <p className="text-sm text-ink-2">تعذّر عرض هذا الملف.</p>
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            width={pageWidth}
            renderAnnotationLayer
            renderTextLayer
            className="overflow-hidden rounded-lg shadow-[var(--shadow-lift)]"
            loading={
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            }
          />
        </Document>
      </div>
    </div>
  )
}
