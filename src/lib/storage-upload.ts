import { env } from '@/config/env'
import { supabase } from '@/lib/supabase'
import { AppError } from '@/lib/errors'

/**
 * File upload with real progress reporting.
 *
 * The Supabase storage client does not expose an upload progress callback, so
 * this module talks to the documented Storage REST endpoint directly through
 * `XMLHttpRequest`, which reports `upload.onprogress` events.
 *
 * The request carries the *user's* access token — exactly like the official
 * client does — so the very same Row Level Security policies on
 * `storage.objects` decide whether the upload is allowed. No privileged
 * credential is involved.
 *
 * Request shape (identical to `storage-js`):
 *   POST {supabaseUrl}/storage/v1/object/{bucket}/{path}
 *   body: multipart/form-data with `cacheControl` and the file part
 */
export type UploadWithProgressOptions = {
  bucket: string
  path: string
  file: File
  /** The content type detected from the file content, not from the browser. */
  contentType: string
  cacheControl?: string
  onProgress?: ((percent: number) => void) | undefined
  signal?: AbortSignal | undefined
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

export async function uploadFileWithProgress(options: UploadWithProgressOptions): Promise<void> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new AppError('configuration', 'لم تُضبط بيانات الاتصال بخدمة الملفات.')
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !sessionData.session) {
    throw new AppError('auth', 'انتهت الجلسة. سجّل الدخول مجددًا ثم أعد المحاولة.')
  }

  const accessToken = sessionData.session.access_token
  const url = `${env.supabaseUrl}/storage/v1/object/${encodeURIComponent(options.bucket)}/${encodePath(options.path)}`

  const form = new FormData()
  form.append('cacheControl', options.cacheControl ?? '3600')
  // The file part carries the detected content type so the bucket level
  // `allowed_mime_types` check sees the real type of the document.
  const blob = new Blob([options.file], { type: options.contentType })
  form.append('', blob, options.file.name)

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', url, true)
    request.setRequestHeader('authorization', `Bearer ${accessToken}`)
    request.setRequestHeader('apikey', env.supabaseAnonKey!)
    request.setRequestHeader('x-upsert', 'false')
    request.setRequestHeader('x-client-info', 'riwaq-math-platform')

    if (options.onProgress) {
      request.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          options.onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)))
        }
      }
    }

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        options.onProgress?.(100)
        resolve()
        return
      }

      let message = 'تعذّر رفع الملف.'
      try {
        const parsed = JSON.parse(request.responseText) as {
          message?: string
          error?: string
          statusCode?: number
        }
        message = parsed.message || parsed.error || message
      } catch {
        /* keep the generic message */
      }

      const kind = request.status === 413 ? 'storage' : request.status === 401 ? 'auth' : 'storage'
      reject(new AppError(kind, message))
    }

    request.onerror = () =>
      reject(
        new AppError('network', 'تعذّر الاتصال بخادم الملفات. تحقّق من اتصالك بالإنترنت.', {
          retryable: true,
        }),
      )

    request.onabort = () =>
      reject(new AppError('storage', 'تم إلغاء عملية الرفع.'))

    if (options.signal) {
      if (options.signal.aborted) {
        request.abort()
        return
      }
      options.signal.addEventListener('abort', () => request.abort(), { once: true })
    }

    request.send(form)
  })
}
