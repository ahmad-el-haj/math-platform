/**
 * Documents — upload, validation, preview access, replacement and deletion.
 *
 * The upload transport is replaced by a stub that calls the *storage API of
 * the emulator*, so the bucket policies (teacher only, allowed mime types,
 * file size limit) are still exercised. The transport itself is covered
 * separately in `tests/app/unit/storage-upload.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', async () => {
  const { createFakeSupabase } = await import('../support/fake-backend')
  const client = createFakeSupabase()
  ;(globalThis as Record<string, unknown>).__riwaq_fake_supabase__ = client
  return { supabase: client }
})

vi.mock('@/lib/storage-upload', async () => {
  const { supabase } = await import('@/lib/supabase')
  return {
    uploadFileWithProgress: async (options: {
      bucket: string
      path: string
      file: Blob
      contentType: string
      onProgress?: (percent: number) => void
    }) => {
      if ((globalThis as Record<string, unknown>).__riwaq_fail_upload__) {
        throw new Error('simulated network failure')
      }
      options.onProgress?.(40)
      const { error } = await supabase.storage
        .from(options.bucket)
        .upload(options.path, options.file, { contentType: options.contentType })
      if (error) throw new Error(error.message)
      options.onProgress?.(100)
    },
  }
})

import {
  buildStoragePath,
  createSignedUrl,
  deleteDocument,
  detectFileKind,
  listDocuments,
  replaceDocument,
  updateDocumentMetadata,
  uploadDocument,
  validateFileSize,
} from '@/services/documents'
import { createClass } from '@/services/classes'
import { createLesson } from '@/services/lessons'
import { getFakeDb, rawRows, resetFakeDb, seedUser, signInAs } from '../support/harness'

const TEACHER = { id: 'teacher-1', email: 'teacher@example.com', role: 'teacher' as const }
const STUDENT = { id: 'student-1', email: 'student@example.com', role: 'student' as const }

function pdfFile(name = 'lesson.pdf'): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x37, 0x0a])], name, {
    type: 'application/pdf',
  })
}

function docxFile(name = 'lesson.docx'): File {
  const bytes = new TextEncoder().encode(
    `PK\u0003\u0004${'x'.repeat(40)}word/document.xml${'y'.repeat(40)}`,
  )
  return new File([bytes], name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

function textFile(name = 'notes.txt'): File {
  return new File([new TextEncoder().encode('hello')], name, { type: 'text/plain' })
}

let classId = ''
let lessonId = ''

beforeEach(async () => {
  resetFakeDb()
  ;(globalThis as Record<string, unknown>).__riwaq_fail_upload__ = false
  seedUser(TEACHER)
  seedUser(STUDENT)

  signInAs(TEACHER.id)
  const classRow = await createClass(
    { title: 'الصف الثالث', description: '', displayOrder: 1, isPublished: true },
    TEACHER.id,
  )
  classId = classRow.id
  const lesson = await createLesson(
    { classId, title: 'درس', description: '', displayOrder: 1, isPublished: true },
    TEACHER.id,
  )
  lessonId = lesson.id
})

describe('file detection', () => {
  it('recognises a PDF by its content', async () => {
    const detected = await detectFileKind(pdfFile())
    expect(detected?.mimeType).toBe('application/pdf')
    expect(detected?.extension).toBe('pdf')
  })

  it('recognises a DOCX by its content', async () => {
    const detected = await detectFileKind(docxFile())
    expect(detected?.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    expect(detected?.extension).toBe('docx')
  })

  it('refuses an unsupported file', async () => {
    expect(await detectFileKind(textFile())).toBeNull()
  })

  it('refuses a file that only pretends to be a PDF through its name', async () => {
    const disguised = new File([new TextEncoder().encode('not a pdf')], 'fake.pdf', {
      type: 'application/pdf',
    })
    expect(await detectFileKind(disguised)).toBeNull()
  })

  it('rejects an empty file and a file above the size limit', () => {
    expect(validateFileSize(new File([], 'empty.pdf'))).toBeTruthy()
    const huge = { size: 30 * 1024 * 1024 } as File
    expect(validateFileSize(huge)).toBeTruthy()
    expect(validateFileSize(pdfFile())).toBeNull()
  })
})

describe('the storage path', () => {
  it('is built from the class, the lesson, the document and the version', () => {
    const path = buildStoragePath({
      classId: 'c1',
      lessonId: 'l1',
      documentId: 'd1',
      version: 3,
      fileName: 'my file.pdf',
    })
    expect(path).toBe('classes/c1/lessons/l1/documents/d1/v3/my file.pdf')
  })
})

describe('uploading a document', () => {
  it('stores the metadata row and the file', async () => {
    signInAs(TEACHER.id)
    const progress: number[] = []

    const document = await uploadDocument({
      classId,
      lessonId,
      file: pdfFile(),
      title: 'التمارين',
      description: 'ورقة تمارين',
      createdBy: TEACHER.id,
      onProgress: (percent) => progress.push(percent),
    })

    expect(document.title).toBe('التمارين')
    expect(document.mime_type).toBe('application/pdf')
    expect(document.lesson_id).toBe(lessonId)
    expect(document.version).toBe(1)
    expect(progress).toContain(100)
    expect(getFakeDb().objects.size).toBe(1)
    expect(rawRows('lesson_documents')).toHaveLength(1)
  })

  it('refuses an unsupported file and leaves nothing behind', async () => {
    signInAs(TEACHER.id)

    await expect(
      uploadDocument({
        classId,
        lessonId,
        file: textFile(),
        title: 'ملف غير مدعوم',
        description: '',
        createdBy: TEACHER.id,
      }),
    ).rejects.toThrow()

    expect(rawRows('lesson_documents')).toHaveLength(0)
    expect(getFakeDb().objects.size).toBe(0)
  })

  it('rolls the metadata row back when the upload fails', async () => {
    signInAs(TEACHER.id)
    ;(globalThis as Record<string, unknown>).__riwaq_fail_upload__ = true

    await expect(
      uploadDocument({
        classId,
        lessonId,
        file: pdfFile(),
        title: 'تعذّر الرفع',
        description: '',
        createdBy: TEACHER.id,
      }),
    ).rejects.toThrow()

    expect(rawRows('lesson_documents')).toHaveLength(0)
    expect(getFakeDb().objects.size).toBe(0)
  })
})

describe('editing, replacing and deleting a document', () => {
  it('edits the title and the description without touching the file', async () => {
    signInAs(TEACHER.id)
    const document = await uploadDocument({
      classId,
      lessonId,
      file: pdfFile(),
      title: 'التمارين',
      description: '',
      createdBy: TEACHER.id,
    })

    const updated = await updateDocumentMetadata(document.id, {
      title: 'التمارين المحدّثة',
      description: 'وصف',
    })

    expect(updated.title).toBe('التمارين المحدّثة')
    expect(updated.file_path).toBe(document.file_path)
  })

  it('replaces the file with a new version and removes the old object', async () => {
    signInAs(TEACHER.id)
    const document = await uploadDocument({
      classId,
      lessonId,
      file: pdfFile('old.pdf'),
      title: 'الملف',
      description: '',
      createdBy: TEACHER.id,
    })

    const replaced = await replaceDocument({
      document,
      classId,
      file: pdfFile('new.pdf'),
    })

    expect(replaced.version).toBe(2)
    expect(replaced.file_path).toContain('/v2/')
    expect(replaced.id).toBe(document.id)
    expect(replaced.lesson_id).toBe(lessonId)
    expect(getFakeDb().objects.size).toBe(1)
    expect([...getFakeDb().objects.keys()][0]).toContain('/v2/')
  })

  it('keeps the old file when the replacement fails', async () => {
    signInAs(TEACHER.id)
    const document = await uploadDocument({
      classId,
      lessonId,
      file: pdfFile('old.pdf'),
      title: 'الملف',
      description: '',
      createdBy: TEACHER.id,
    })
    ;(globalThis as Record<string, unknown>).__riwaq_fail_upload__ = true

    await expect(replaceDocument({ document, classId, file: pdfFile('new.pdf') })).rejects.toThrow()

    const stored = rawRows<{ version: number; file_path: string }>('lesson_documents')[0]
    expect(stored?.version).toBe(1)
    expect(stored?.file_path).toBe(document.file_path)
  })

  it('removes the file and hides the document', async () => {
    signInAs(TEACHER.id)
    const document = await uploadDocument({
      classId,
      lessonId,
      file: pdfFile(),
      title: 'الملف',
      description: '',
      createdBy: TEACHER.id,
    })

    await deleteDocument(document)

    expect(getFakeDb().objects.size).toBe(0)
    expect(rawRows<{ deleted_at: string | null }>('lesson_documents')[0]?.deleted_at).toBeTruthy()
    expect(await listDocuments(lessonId)).toHaveLength(0)
  })
})

describe('student access to the documents', () => {
  it('lets a student list the documents of a published lesson', async () => {
    signInAs(TEACHER.id)
    await uploadDocument({
      classId,
      lessonId,
      file: pdfFile(),
      title: 'التمارين',
      description: '',
      createdBy: TEACHER.id,
    })

    signInAs(STUDENT.id)
    expect(await listDocuments(lessonId)).toHaveLength(1)
  })

  it('hides the documents of an unpublished lesson from a student', async () => {
    signInAs(TEACHER.id)
    const draft = await createLesson(
      { classId, title: 'مسودة', description: '', displayOrder: 2, isPublished: false },
      TEACHER.id,
    )
    await uploadDocument({
      classId,
      lessonId: draft.id,
      file: pdfFile(),
      title: 'سرّي',
      description: '',
      createdBy: TEACHER.id,
    })

    signInAs(STUDENT.id)
    expect(await listDocuments(draft.id)).toHaveLength(0)
  })

  it('gives a student a signed URL for a published document', async () => {
    signInAs(TEACHER.id)
    const document = await uploadDocument({
      classId,
      lessonId,
      file: pdfFile(),
      title: 'التمارين',
      description: '',
      createdBy: TEACHER.id,
    })

    signInAs(STUDENT.id)
    const url = await createSignedUrl(document.file_path)
    expect(url).toContain('/storage/v1/object/sign/')
  })

  it('refuses a signed URL for a document of an unpublished lesson', async () => {
    signInAs(TEACHER.id)
    const draft = await createLesson(
      { classId, title: 'مسودة', description: '', displayOrder: 2, isPublished: false },
      TEACHER.id,
    )
    const document = await uploadDocument({
      classId,
      lessonId: draft.id,
      file: pdfFile(),
      title: 'سرّي',
      description: '',
      createdBy: TEACHER.id,
    })

    signInAs(STUDENT.id)
    await expect(createSignedUrl(document.file_path)).rejects.toThrow()
  })

  it('refuses every write coming from a student', async () => {
    signInAs(TEACHER.id)
    const document = await uploadDocument({
      classId,
      lessonId,
      file: pdfFile(),
      title: 'التمارين',
      description: '',
      createdBy: TEACHER.id,
    })

    signInAs(STUDENT.id)
    await expect(
      uploadDocument({
        classId,
        lessonId,
        file: pdfFile(),
        title: 'رفع غير مصرّح',
        description: '',
        createdBy: STUDENT.id,
      }),
    ).rejects.toThrow()
    await expect(replaceDocument({ document, classId, file: pdfFile() })).rejects.toThrow()
    await expect(deleteDocument(document)).rejects.toThrow()

    expect(rawRows('lesson_documents')).toHaveLength(1)
    expect(getFakeDb().objects.size).toBe(1)
  })

  it('refuses to repoint a document at a foreign lesson', async () => {
    signInAs(TEACHER.id)
    const otherLesson = await createLesson(
      { classId, title: 'درس آخر', description: '', displayOrder: 2, isPublished: true },
      TEACHER.id,
    )
    const document = await uploadDocument({
      classId,
      lessonId,
      file: pdfFile(),
      title: 'التمارين',
      description: '',
      createdBy: TEACHER.id,
    })

    await expect(
      updateDocumentMetadata(document.id, { title: 'مُغيَّر', description: '' }),
    ).resolves.toBeTruthy()

    // A direct update of the path is rejected by the database trigger.
    const { supabase } = await import('@/lib/supabase')
    const { error } = await supabase
      .from('lesson_documents')
      .update({
        file_path: buildStoragePath({
          classId,
          lessonId: otherLesson.id,
          documentId: document.id,
          version: 2,
          fileName: 'x.pdf',
        }),
      })
      .eq('id', document.id)
      .select('*')
      .single()

    expect(error).toBeTruthy()
    expect(rawRows<{ lesson_id: string }>('lesson_documents')[0]?.lesson_id).toBe(lessonId)
  })
})
