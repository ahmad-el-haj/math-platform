import { useEffect, useRef, useState } from 'react'
import { FileWarning } from 'lucide-react'
import { renderAsync } from 'docx-preview'
import { fetchDocumentBlob } from '@/services/documents'
import { Spinner } from '@/components/ui/feedback'
import { cn } from '@/lib/cn'

export type DocxViewerProps = {
  filePath: string
  className?: string
}

/**
 * In-app DOCX preview.
 *
 * The conversion happens entirely in the browser with `docx-preview`; the file
 * is never sent to an external conversion service. The file is downloaded
 * through a short lived signed URL and rendered into a sandboxed container.
 */
export function DocxViewer({ filePath, className }: DocxViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Reset the viewer when the file changes (derived during render, not in an effect).
  const [activePath, setActivePath] = useState(filePath)
  if (activePath !== filePath) {
    setActivePath(filePath)
    setLoading(true)
    setError(null)
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const blob = await fetchDocumentBlob(filePath)
        if (cancelled || !containerRef.current) return

        containerRef.current.innerHTML = ''
        await renderAsync(blob, containerRef.current, undefined, {
          className: 'docx',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          experimental: true,
        })

        if (!cancelled) setLoading(false)
      } catch (caught) {
        console.error('[docx] preview failed', caught)
        if (!cancelled) {
          setError('تعذّر عرض هذا الملف. يمكنك تحميله بدلًا من ذلك.')
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [filePath])

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

  return (
    <div className={cn('relative', className)}>
      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-line bg-surface-2/40 py-20">
          <Spinner />
          <span className="text-sm text-ink-2">جارٍ تجهيز المعاينة…</span>
        </div>
      ) : null}

      <div
        ref={containerRef}
        className="docx-preview-container overflow-auto rounded-2xl border border-line bg-white/95 p-2 sm:p-6 [&_.docx-wrapper]:!bg-transparent [&_.docx-wrapper>section.docx]:!bg-white [&_.docx-wrapper>section.docx]:!shadow-[var(--shadow-soft)]"
        style={{ display: loading ? 'none' : 'block' }}
      />
    </div>
  )
}
