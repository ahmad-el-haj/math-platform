/**
 * The upload transport.
 *
 * `uploadFileWithProgress` talks to the Supabase Storage REST endpoint
 * directly through XMLHttpRequest, because the official client does not
 * expose an upload progress callback. These tests verify the shape of that
 * request: the *user's* access token is used, no privileged credential is
 * involved, and the file part carries the detected content type.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: 'user-access-token' } },
        error: null,
      }),
    },
  },
}))

import { uploadFileWithProgress } from '@/lib/storage-upload'
import { AppError } from '@/lib/errors'

type Recorded = {
  method: string
  url: string
  headers: Record<string, string>
  body: FormData
  status: number
  responseText: string
  sent: boolean
  upload: { onprogress: ((event: unknown) => void) | null }
  onload: (() => void) | null
  onerror: (() => void) | null
  onabort: (() => void) | null
}

let recorded: Recorded[] = []
let signalRequest: (() => void) | null = null
let requestCreated: Promise<void> = Promise.resolve()

class FakeXhr {
  request: Recorded
  /** The real XMLHttpRequest exposes the progress events on the instance. */
  upload: { onprogress: ((event: unknown) => void) | null }

  // The production code assigns the handlers and reads the response on the
  // instance, so every property is forwarded to the recorded request.
  get status(): number {
    return this.request.status
  }

  set status(value: number) {
    this.request.status = value
  }

  get responseText(): string {
    return this.request.responseText
  }

  set responseText(value: string) {
    this.request.responseText = value
  }

  get onload(): (() => void) | null {
    return this.request.onload
  }

  set onload(value: (() => void) | null) {
    this.request.onload = value
  }

  get onerror(): (() => void) | null {
    return this.request.onerror
  }

  set onerror(value: (() => void) | null) {
    this.request.onerror = value
  }

  get onabort(): (() => void) | null {
    return this.request.onabort
  }

  set onabort(value: (() => void) | null) {
    this.request.onabort = value
  }

  constructor() {
    this.request = {
      method: '',
      url: '',
      headers: {},
      body: new FormData(),
      status: 200,
      responseText: '',
      sent: false,
      upload: { onprogress: null },
      onload: null,
      onerror: null,
      onabort: null,
    }
    this.upload = this.request.upload
    recorded.push(this.request)
    signalRequest?.()
  }

  open(method: string, url: string): void {
    this.request.method = method
    this.request.url = url
  }

  setRequestHeader(name: string, value: string): void {
    this.request.headers[name] = value
  }

  send(body: FormData): void {
    this.request.body = body
    this.request.sent = true
  }

  abort(): void {
    this.request.onabort?.()
  }
}

/** The uploader creates the request after an `await`, so the test waits for it. */
async function waitForRequest(): Promise<Recorded> {
  await requestCreated
  return recorded[0]!
}

function sampleFile(): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'lesson.pdf', {
    type: 'application/pdf',
  })
}

beforeEach(() => {
  recorded = []
  requestCreated = new Promise<void>((resolve) => {
    signalRequest = resolve
  })
  vi.stubGlobal('XMLHttpRequest', FakeXhr)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uploadFileWithProgress', () => {
  it('posts the file to the storage endpoint with the user access token', async () => {
    const progress: number[] = []

    const promise = uploadFileWithProgress({
      bucket: 'lesson-documents',
      path: 'classes/c1/lessons/l1/documents/d1/v1/lesson.pdf',
      file: sampleFile(),
      contentType: 'application/pdf',
      onProgress: (percent) => progress.push(percent),
    })

    const request = await waitForRequest()
    expect(request.method).toBe('POST')
    expect(request.url).toBe(
      'https://fake-project.supabase.co/storage/v1/object/lesson-documents/classes/c1/lessons/l1/documents/d1/v1/lesson.pdf',
    )
    expect(request.headers.authorization).toBe('Bearer user-access-token')
    expect(request.headers.apikey).toBe('fake-anon-key-for-tests')
    expect(request.headers['x-upsert']).toBe('false')
    expect(request.sent).toBe(true)

    // Simulate the progress event and the successful response.
    request.upload.onprogress?.({ lengthComputable: true, loaded: 512, total: 1024 })
    request.status = 200
    request.onload?.()

    await expect(promise).resolves.toBeUndefined()
    expect(progress).toContain(50)
    expect(progress).toContain(100)
  })

  it('sends the detected content type with the file part', async () => {
    const promise = uploadFileWithProgress({
      bucket: 'lesson-documents',
      path: 'classes/c1/lessons/l1/documents/d1/v1/lesson.pdf',
      file: sampleFile(),
      contentType: 'application/pdf',
    })

    const request = await waitForRequest()
    const file = request.body.get('') as File
    expect(file.type).toBe('application/pdf')
    expect(request.body.get('cacheControl')).toBe('3600')

    request.onload?.()
    await promise
  })

  it('reports a rejected upload as a storage error', async () => {
    const promise = uploadFileWithProgress({
      bucket: 'lesson-documents',
      path: 'classes/c1/lessons/l1/documents/d1/v1/lesson.pdf',
      file: sampleFile(),
      contentType: 'application/pdf',
    })

    const request = await waitForRequest()
    request.status = 413
    request.responseText = JSON.stringify({ message: 'File too large' })
    request.onload?.()

    await expect(promise).rejects.toBeInstanceOf(AppError)
    await expect(promise).rejects.toMatchObject({ kind: 'storage' })
  })

  it('reports a network failure as a retryable network error', async () => {
    const promise = uploadFileWithProgress({
      bucket: 'lesson-documents',
      path: 'classes/c1/lessons/l1/documents/d1/v1/lesson.pdf',
      file: sampleFile(),
      contentType: 'application/pdf',
    })

    const request = await waitForRequest()
    request.onerror?.()

    await expect(promise).rejects.toMatchObject({ kind: 'network', retryable: true })
  })
})
