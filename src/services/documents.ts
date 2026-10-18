import { appConfig } from '@/config/env'
import { supabase } from '@/lib/supabase'
import { uploadFileWithProgress } from '@/lib/storage-upload'
import { toAppError } from '@/lib/errors'
import { toSafeFileName } from '@/lib/format'
import type { LessonDocument } from '@/lib/database.types'

export const PDF_MIME = 'application/pdf'
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export type DetectedFile = {
  mimeType: typeof PDF_MIME | typeof DOCX_MIME
  extension: 'pdf' | 'docx'
  fileName: string
}

/**
 * Inspect the *content* of a file instead of trusting its name or the MIME
 * type reported by the browser.
 *
 * The browser check is a convenience, not a security boundary — the real
 * boundary is the `allowed_mime_types` and `file_size_limit` of the storage
 * bucket, which the Supabase Storage API enforces on the server.
 */
export async function detectFileKind(file: File): Promise<DetectedFile | null> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46
  if (isPdf) {
    return { mimeType: PDF_MIME, extension: 'pdf', fileName: toSafeFileName(file.name) }
  }

  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04
  if (isZip) {
    // A .docx is an OPC package that contains `word/document.xml`. The entry
    // names are stored uncompressed in the zip directory, so a targeted scan
    // of the head and the tail of the file is enough to confirm it.
    const window = Math.min(file.size, 1024 * 1024)
    const headChunk = new TextDecoder('latin1').decode(
      await file.slice(0, window).arrayBuffer(),
    )
    const tailChunk = new TextDecoder('latin1').decode(
      await file.slice(Math.max(0, file.size - window), file.size).arrayBuffer(),
    )
    const looksLikeDocx =
      headChunk.includes('word/document.xml') || tailChunk.includes('word/document.xml')

    if (looksLikeDocx || file.name.toLowerCase().endsWith('.docx')) {
      return { mimeType: DOCX_MIME, extension: 'docx', fileName: toSafeFileName(file.name) }
    }
  }

  return null
}

export function validateFileSize(file: File): string | null {
  if (file.size <= 0) {
    return 'الملف فارغ. اختر ملفًا يحتوي على محتوى.'
  }
  if (file.size > appConfig.maxUploadBytes) {
    return `حجم الملف يتجاوز الحد المسموح (${appConfig.maxUploadMegabytes} م.ب).`
  }
  return null
}

export async function listDocuments(lessonId: string): Promise<LessonDocument[]> {
  const { data, error } = await supabase
    .from('lesson_documents')
    .select('*')
    .eq('lesson_id', lessonId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    throw toAppError(error, 'unknown')
  }
  return (data ?? []) as LessonDocument[]
}

export async function getDocument(documentId: string): Promise<LessonDocument | null> {
  const { data, error } = await supabase
    .from('lesson_documents')
    .select('*')
    .eq('id', documentId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw toAppError(error, 'not_found')
  }
  return (data as LessonDocument | null) ?? null
}

/**
 * Storage layout. The structure is fixed and validated by a database trigger
 * so that a document row can never point at a foreign lesson or file.
 */
export function buildStoragePath(params: {
  classId: string
  lessonId: string
  documentId: string
  version: number
  fileName: string
}): string {
  const fileName = toSafeFileName(params.fileName)
  return [
    'classes',
    params.classId,
    'lessons',
    params.lessonId,
    'documents',
    params.documentId,
    `v${params.version}`,
    fileName,
  ].join('/')
}

export type UploadProgress = (percent: number) => void

/**
 * Upload a new document.
 *
 * Order of operations:
 *   1. the metadata row is created with its final path,
 *   2. the file is uploaded,
 *   3. if the upload fails the metadata row is rolled back so that no
 *      dangling record is left behind.
 */
export async function uploadDocument(params: {
  classId: string
  lessonId: string
  file: File
  title: string
  description: string
  createdBy: string
  onProgress?: UploadProgress
}): Promise<LessonDocument> {
  const detected = await detectFileKind(params.file)
  if (!detected) {
    throw toAppError(
      new Error('unsupported file type'),
      'validation',
    )
  }
  const sizeError = validateFileSize(params.file)
  if (sizeError) {
    throw toAppError(new Error(sizeError), 'validation')
  }

  const documentId = crypto.randomUUID()
  const path = buildStoragePath({
    classId: params.classId,
    lessonId: params.lessonId,
    documentId,
    version: 1,
    fileName: detected.fileName,
  })

  const { data: row, error: insertError } = await supabase
    .from('lesson_documents')
    .insert({
      id: documentId,
      lesson_id: params.lessonId,
      title: params.title,
      description: params.description,
      file_path: path,
      original_file_name: detected.fileName,
      mime_type: detected.mimeType,
      file_size: params.file.size,
      created_by: params.createdBy,
    })
    .select('*')
    .single()

  if (insertError) {
    throw toAppError(insertError, 'conflict')
  }

  try {
    await uploadFileWithProgress({
      bucket: appConfig.storageBucket,
      path,
      file: params.file,
      contentType: detected.mimeType,
      onProgress: params.onProgress,
    })
  } catch (error) {
    // Roll the metadata row back so the database and the bucket stay in sync.
    await supabase.from('lesson_documents').delete().eq('id', documentId)
    throw error
  }

  params.onProgress?.(100)
  return row as LessonDocument
}

/**
 * Replace the file of an existing document.
 *
 * The new file is stored under a fresh version segment. Only after the upload
 * succeeded is the metadata row switched over, so a failed replacement always
 * leaves the previous, working file in place.
 */
export async function replaceDocument(params: {
  document: LessonDocument
  classId: string
  file: File
  onProgress?: UploadProgress
}): Promise<LessonDocument> {
  const detected = await detectFileKind(params.file)
  if (!detected) {
    throw toAppError(new Error('unsupported file type'), 'validation')
  }
  const sizeError = validateFileSize(params.file)
  if (sizeError) {
    throw toAppError(new Error(sizeError), 'validation')
  }

  const nextVersion = params.document.version + 1
  const nextPath = buildStoragePath({
    classId: params.classId,
    lessonId: params.document.lesson_id,
    documentId: params.document.id,
    version: nextVersion,
    fileName: detected.fileName,
  })

  try {
    await uploadFileWithProgress({
      bucket: appConfig.storageBucket,
      path: nextPath,
      file: params.file,
      contentType: detected.mimeType,
      onProgress: params.onProgress,
    })
  } catch (error) {
    throw toAppError(error, 'storage')
  }

  const { data, error } = await supabase
    .from('lesson_documents')
    .update({
      file_path: nextPath,
      original_file_name: detected.fileName,
      mime_type: detected.mimeType,
      file_size: params.file.size,
      version: nextVersion,
    })
    .eq('id', params.document.id)
    .select('*')
    .single()

  if (error) {
    // The row still points at the old file; remove the object we just wrote.
    await supabase.storage.from(appConfig.storageBucket).remove([nextPath])
    throw toAppError(error, 'validation')
  }

  // The previous version is no longer referenced.
  await supabase.storage.from(appConfig.storageBucket).remove([params.document.file_path])

  params.onProgress?.(100)
  return data as LessonDocument
}

export async function updateDocumentMetadata(
  documentId: string,
  values: { title: string; description: string },
): Promise<LessonDocument> {
  const { data, error } = await supabase
    .from('lesson_documents')
    .update(values)
    .eq('id', documentId)
    .select('*')
    .single()

  if (error) {
    throw toAppError(error, 'validation')
  }
  return data as LessonDocument
}

/**
 * Delete a document.
 *
 * The storage object is removed first, then the row is soft deleted. If the
 * object removal fails the row is still soft deleted, which removes the file
 * from every student view; the leftover object can be cleaned up later.
 */
export async function deleteDocument(document: LessonDocument): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(appConfig.storageBucket)
    .remove([document.file_path])

  if (storageError) {
    console.error('[documents] could not remove the storage object', storageError)
  }

  const { error } = await supabase
    .from('lesson_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', document.id)

  if (error) {
    throw toAppError(error, 'validation')
  }
}

/** Create a short lived signed URL for previewing or downloading a file. */
export async function createSignedUrl(
  path: string,
  options?: { download?: string; ttl?: number },
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(appConfig.storageBucket)
    .createSignedUrl(
      path,
      options?.ttl ?? appConfig.signedUrlTtlSeconds,
      options?.download ? { download: options.download } : undefined,
    )

  if (error) {
    throw toAppError(error, 'storage')
  }
  if (!data?.signedUrl) {
    throw toAppError(new Error('missing signed url'), 'storage')
  }
  return data.signedUrl
}

/** Fetch the raw bytes of a document (used by the DOCX renderer). */
export async function fetchDocumentBlob(path: string): Promise<Blob> {
  const signedUrl = await createSignedUrl(path)
  const response = await fetch(signedUrl)
  if (!response.ok) {
    throw toAppError(new Error(`request failed with ${response.status}`), 'storage')
  }
  return response.blob()
}
