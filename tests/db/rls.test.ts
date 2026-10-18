/**
 * Row Level Security verification suite.
 *
 * These tests run against a REAL PostgreSQL instance that has the production
 * migrations applied (see `scripts/local-db/setup.sh`). They impersonate the
 * Supabase API roles (`anon`, `authenticated`, `service_role`) and assert that
 * the database itself — not the frontend — enforces the authorisation rules.
 *
 * Run with:
 *   DATABASE_URL=postgresql://riwaq_test:riwaq_test@127.0.0.1:5432/riwaq_test npm run test:db
 *
 * The suite is skipped (not failed) when no database is configured, so the
 * regular `npm test` run stays green on a machine without PostgreSQL.
 *
 * Note on PostgreSQL semantics used throughout this file:
 *   * INSERT / SELECT violations raise an error.
 *   * UPDATE and DELETE that are filtered out by a `USING` clause silently
 *     affect zero rows — PostgreSQL does not raise. The tests therefore
 *     assert on the resulting data, which is the stronger statement anyway.
 */
import { Pool, type PoolClient } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * The connection string of the local verification database.
 *
 * `scripts/local-db/setup.sh` creates exactly this database, so the suite can
 * run without any further configuration. An explicit `DATABASE_URL` always
 * wins — that is how the same suite is pointed at a remote staging database.
 */
const LOCAL_DATABASE_URL = 'postgresql://riwaq_test:riwaq_test@127.0.0.1:5432/riwaq_test'

const DATABASE_URL = process.env.DATABASE_URL ?? LOCAL_DATABASE_URL

const describeIfDb = DATABASE_URL ? describe : describe.skip

if (!DATABASE_URL) {
  console.warn(
    '[db] DATABASE_URL is not set — the Row Level Security suite is skipped. ' +
      'Run `bash scripts/local-db/setup.sh` to create the verification database.',
  )
}

type Role = 'anon' | 'authenticated' | 'service_role'

const ROLES: Role[] = ['anon', 'authenticated', 'service_role']

describeIfDb('Row Level Security (real PostgreSQL)', () => {
  const pool = new Pool({ connectionString: DATABASE_URL })

  const teacherId = '11111111-1111-4111-8111-111111111111'
  const studentAId = '22222222-2222-4222-8222-222222222222'
  const studentBId = '33333333-3333-4333-8333-333333333333'
  const outsiderId = '44444444-4444-4444-8444-444444444444'

  let publishedClassId = ''
  let draftClassId = ''
  let publishedLessonId = ''
  let draftLessonId = ''
  let publishedDocumentId = ''
  let draftDocumentId = ''
  let conversationId = ''
  let studentBConversationId = ''

  /** Run a callback inside a transaction impersonating a Supabase API role. */
  async function as<T>(
    role: Role,
    userId: string | null,
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    if (!ROLES.includes(role)) throw new Error(`Unsupported role: ${role}`)

    const client = await pool.connect()
    try {
      await client.query('begin')
      await client.query(`set local role ${role}`)
      const claims = JSON.stringify({
        sub: userId ?? undefined,
        role,
        aud: 'authenticated',
        iss: 'supabase',
      })
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [claims])

      const result = await fn(client)
      await client.query('commit')
      return result
    } catch (error) {
      await client.query('rollback').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }

  /** Read state with administrative (RLS bypassing) visibility. */
  async function admin<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    return as('service_role', null, fn)
  }

  beforeAll(async () => {
    // Fresh state for every run.
    await admin(async (client) => {
      await client.query('delete from public.messages;')
      await client.query('delete from public.conversations;')
      await client.query('delete from public.lesson_documents;')
      await client.query('delete from public.lessons;')
      await client.query('delete from public.classes;')
      await client.query('delete from auth.users;')
      await client.query('delete from storage.objects;')
    })

    // Create the accounts exactly like Supabase Auth would.
    await admin((client) =>
      client.query(
        `insert into auth.users (id, email, raw_user_meta_data) values
           ($1, 'teacher@example.com', '{"full_name":"أ. المعلم"}'),
           ($2, 'student-a@example.com', '{"full_name":"طالب أ"}'),
           ($3, 'student-b@example.com', '{"full_name":"طالب ب"}'),
           ($4, 'outsider@example.com', '{"full_name":"دخيل"}')`,
        [teacherId, studentAId, studentBId, outsiderId],
      ),
    )

    // Promote the teacher through the *only* supported path: service_role.
    await admin((client) => client.query(`select public.set_user_role('teacher@example.com', 'teacher')`))

    // Give student B a conversation of their own.
    const { rows } = await admin((client) =>
      client.query(
        `insert into public.conversations (student_id, teacher_id)
         values ($1, $2) returning id`,
        [studentBId, teacherId],
      ),
    )
    studentBConversationId = rows[0].id as string
  })

  afterAll(async () => {
    await pool.end()
  })

  /* ---------------------------------------------------------------------- */
  /* Profiles and roles                                                      */
  /* ---------------------------------------------------------------------- */

  it('creates every new account with the student role', async () => {
    const { rows } = await admin((client) =>
      client.query(`select id, role from public.profiles order by id`),
    )
    const byId = new Map(rows.map((row) => [row.id as string, row.role as string]))
    expect(byId.get(studentAId)).toBe('student')
    expect(byId.get(studentBId)).toBe('student')
    expect(byId.get(outsiderId)).toBe('student')
    expect(byId.get(teacherId)).toBe('teacher')
  })

  it('ignores a role sent by the client during sign-up', async () => {
    await admin((client) =>
      client.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         values ('55555555-5555-4555-8555-555555555555', 'sneaky@example.com', '{"role":"teacher","full_name":"مزيّف"}')`,
      ),
    )
    const { rows } = await admin((client) =>
      client.query(`select role from public.profiles where id = '55555555-5555-4555-8555-555555555555'`),
    )
    expect(rows[0].role).toBe('student')
  })

  it('refuses a role escalation through a profile update', async () => {
    await expect(
      as('authenticated', studentAId, (client) =>
        client.query(`update public.profiles set role = 'teacher' where id = $1`, [studentAId]),
      ),
    ).rejects.toThrow(/Direct role changes are not permitted/i)

    const { rows } = await admin((client) =>
      client.query(`select role from public.profiles where id = $1`, [studentAId]),
    )
    expect(rows[0].role).toBe('student')
  })

  it('refuses to let an authenticated user call the privileged role function', async () => {
    await expect(
      as('authenticated', teacherId, (client) =>
        client.query(`select public.set_user_role('student-a@example.com', 'teacher')`),
      ),
    ).rejects.toThrow(/permission denied/i)
  })

  it('lets a student read their own profile and a teacher profile, but not another student', async () => {
    const { rows } = await as('authenticated', studentAId, (client) =>
      client.query(`select id from public.profiles`),
    )
    const ids = rows.map((row) => row.id as string)
    expect(ids).toContain(studentAId)
    expect(ids).toContain(teacherId)
    expect(ids).not.toContain(studentBId)
  })

  it('lets a teacher read every profile', async () => {
    const { rows } = await as('authenticated', teacherId, (client) =>
      client.query(`select id from public.profiles`),
    )
    expect(rows.length).toBeGreaterThanOrEqual(4)
  })

  it('refuses to let a student insert a profile', async () => {
    await expect(
      as('authenticated', studentAId, (client) =>
        client.query(
          `insert into public.profiles (id, full_name, email, role) values ($1, 'x', 'x@x.com', 'teacher')`,
          [outsiderId],
        ),
      ),
    ).rejects.toThrow()
  })

  it('gives the anonymous role no access to any protected table', async () => {
    for (const table of [
      'profiles',
      'classes',
      'lessons',
      'lesson_documents',
      'conversations',
      'messages',
    ]) {
      await expect(
        as('anon', null, (client) => client.query(`select * from public.${table}`)),
        `table ${table} must not be readable by anon`,
      ).rejects.toThrow(/permission denied/i)
    }
  })

  /* ---------------------------------------------------------------------- */
  /* Classes                                                                 */
  /* ---------------------------------------------------------------------- */

  it('lets a teacher create a class and forbids a student from doing so', async () => {
    const { rows } = await as('authenticated', teacherId, (client) =>
      client.query(
        `insert into public.classes (title, description, is_published, created_by)
         values ('الصف التاسع', 'جبر', true, $1) returning id`,
        [teacherId],
      ),
    )
    publishedClassId = rows[0].id as string
    expect(publishedClassId).toBeTruthy()

    await expect(
      as('authenticated', studentAId, (client) =>
        client.query(
          `insert into public.classes (title, description, is_published, created_by)
           values ('صف مزيف', '', true, $1)`,
          [studentAId],
        ),
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('hides unpublished classes from students but shows them to the teacher', async () => {
    const { rows } = await as('authenticated', teacherId, (client) =>
      client.query(
        `insert into public.classes (title, description, is_published, created_by)
         values ('الصف المسودة', '', false, $1) returning id`,
        [teacherId],
      ),
    )
    draftClassId = rows[0].id as string

    const studentView = await as('authenticated', studentAId, (client) =>
      client.query(`select id from public.classes`),
    )
    expect(studentView.rows.map((r) => r.id)).toEqual([publishedClassId])

    const teacherView = await as('authenticated', teacherId, (client) =>
      client.query(`select id from public.classes`),
    )
    expect(teacherView.rows).toHaveLength(2)
  })

  it('ignores a student attempt to update or delete a class', async () => {
    await as('authenticated', studentAId, (client) =>
      client.query(`update public.classes set title = 'مُعدّل' where id = $1`, [publishedClassId]),
    )
    await as('authenticated', studentAId, (client) =>
      client.query(`delete from public.classes where id = $1`, [publishedClassId]),
    )

    const { rows } = await admin((client) =>
      client.query(`select title from public.classes where id = $1`, [publishedClassId]),
    )
    expect(rows[0].title).toBe('الصف التاسع')
  })

  it('lets a teacher rename a class', async () => {
    await as('authenticated', teacherId, (client) =>
      client.query(`update public.classes set title = 'الصف التاسع - المستوى الثاني' where id = $1`, [
        publishedClassId,
      ]),
    )
    const { rows } = await admin((client) =>
      client.query(`select title from public.classes where id = $1`, [publishedClassId]),
    )
    expect(rows[0].title).toBe('الصف التاسع - المستوى الثاني')
  })

  it('rejects a duplicate class name', async () => {
    await expect(
      as('authenticated', teacherId, (client) =>
        client.query(
          `insert into public.classes (title, description, created_by)
           values ('الصف التاسع - المستوى الثاني', '', $1)`,
          [teacherId],
        ),
      ),
    ).rejects.toThrow(/duplicate key|classes_title_unique_active/i)
  })

  /* ---------------------------------------------------------------------- */
  /* Lessons                                                                 */
  /* ---------------------------------------------------------------------- */

  it('lets a teacher create lessons and hides the unpublished ones from students', async () => {
    const published = await as('authenticated', teacherId, (client) =>
      client.query(
        `insert into public.lessons (class_id, title, description, is_published, created_by)
         values ($1, 'المعادلات التربيعية', 'حل المعادلات', true, $2) returning id`,
        [publishedClassId, teacherId],
      ),
    )
    publishedLessonId = published.rows[0].id as string

    const draft = await as('authenticated', teacherId, (client) =>
      client.query(
        `insert into public.lessons (class_id, title, description, is_published, created_by)
         values ($1, 'درس مسودة', '', false, $2) returning id`,
        [publishedClassId, teacherId],
      ),
    )
    draftLessonId = draft.rows[0].id as string

    const studentView = await as('authenticated', studentAId, (client) =>
      client.query(`select id from public.lessons`),
    )
    expect(studentView.rows.map((r) => r.id)).toEqual([publishedLessonId])
  })

  it('ignores a student attempt to create, update or delete a lesson', async () => {
    await expect(
      as('authenticated', studentAId, (client) =>
        client.query(
          `insert into public.lessons (class_id, title, created_by) values ($1, 'درس مزيف', $2)`,
          [publishedClassId, studentAId],
        ),
      ),
    ).rejects.toThrow(/row-level security/i)

    await as('authenticated', studentAId, (client) =>
      client.query(`update public.lessons set is_published = true where id = $1`, [draftLessonId]),
    )
    await as('authenticated', studentAId, (client) =>
      client.query(`delete from public.lessons where id = $1`, [publishedLessonId]),
    )

    const { rows } = await admin((client) =>
      client.query(`select is_published from public.lessons where id = $1`, [draftLessonId]),
    )
    expect(rows[0].is_published).toBe(false)

    const survivors = await admin((client) =>
      client.query(`select id from public.lessons where id = $1`, [publishedLessonId]),
    )
    expect(survivors.rows).toHaveLength(1)
  })

  it('hides lessons that belong to an unpublished class', async () => {
    await as('authenticated', teacherId, (client) =>
      client.query(
        `insert into public.lessons (class_id, title, is_published, created_by)
         values ($1, 'درس داخل صف مسودة', true, $2)`,
        [draftClassId, teacherId],
      ),
    )

    const studentView = await as('authenticated', studentAId, (client) =>
      client.query(`select id from public.lessons`),
    )
    expect(studentView.rows.map((r) => r.id)).toEqual([publishedLessonId])
  })

  /* ---------------------------------------------------------------------- */
  /* Documents                                                               */
  /* ---------------------------------------------------------------------- */

  it('lets a teacher attach a document and refuses a student', async () => {
    publishedDocumentId = '55555555-5555-4555-8555-555555555555'
    const path = `classes/${publishedClassId}/lessons/${publishedLessonId}/documents/${publishedDocumentId}/v1/handout.pdf`

    await as('authenticated', teacherId, (client) =>
      client.query(
        `insert into public.lesson_documents
           (id, lesson_id, title, file_path, original_file_name, mime_type, file_size, created_by)
         values ($1, $2, 'أوراق عمل', $3, 'handout.pdf', 'application/pdf', 204800, $4)`,
        [publishedDocumentId, publishedLessonId, path, teacherId],
      ),
    )

    // A second document that hangs from an *unpublished* lesson. Students must
    // not be able to see it, nor the file that belongs to it.
    draftDocumentId = '66666666-6666-4666-8666-666666666666'
    const draftPath = `classes/${publishedClassId}/lessons/${draftLessonId}/documents/${draftDocumentId}/v1/draft.pdf`
    await as('authenticated', teacherId, (client) =>
      client.query(
        `insert into public.lesson_documents
           (id, lesson_id, title, file_path, original_file_name, mime_type, file_size, created_by)
         values ($1, $2, 'مستند مسودة', $3, 'draft.pdf', 'application/pdf', 1024, $4)`,
        [draftDocumentId, draftLessonId, draftPath, teacherId],
      ),
    )

    await expect(
      as('authenticated', studentAId, (client) =>
        client.query(
          `insert into public.lesson_documents
             (id, lesson_id, title, file_path, original_file_name, mime_type, file_size, created_by)
           values ('77777777-7777-4777-8777-777777777777', $1, 'مستند مزيف', $2, 'x.pdf', 'application/pdf', 10, $3)`,
          [
            publishedLessonId,
            `classes/${publishedClassId}/lessons/${publishedLessonId}/documents/77777777-7777-4777-8777-777777777777/v1/x.pdf`,
            studentAId,
          ],
        ),
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('rejects a document whose storage path does not match its lesson', async () => {
    const id = '88888888-8888-4888-8888-888888888888'
    await expect(
      as('authenticated', teacherId, (client) =>
        client.query(
          `insert into public.lesson_documents
             (id, lesson_id, title, file_path, original_file_name, mime_type, file_size, created_by)
           values ($1, $2, 'مسار خاطئ', $3, 'x.pdf', 'application/pdf', 10, $4)`,
          [
            id,
            publishedLessonId,
            `classes/${publishedClassId}/lessons/${draftLessonId}/documents/${id}/v1/x.pdf`,
            teacherId,
          ],
        ),
      ),
    ).rejects.toThrow(/storage path lesson does not match/i)
  })

  it('rejects a disallowed mime type and an oversized file', async () => {
    const id = '99999999-9999-4999-8999-999999999999'
    const base = `classes/${publishedClassId}/lessons/${publishedLessonId}/documents/${id}/v1/x.exe`

    await expect(
      as('authenticated', teacherId, (client) =>
        client.query(
          `insert into public.lesson_documents
             (id, lesson_id, title, file_path, original_file_name, mime_type, file_size, created_by)
           values ($1, $2, 'ملف غير مسموح', $3, 'x.exe', 'application/x-msdownload', 10, $4)`,
          [id, publishedLessonId, base, teacherId],
        ),
      ),
    ).rejects.toThrow()

    await expect(
      as('authenticated', teacherId, (client) =>
        client.query(
          `insert into public.lesson_documents
             (id, lesson_id, title, file_path, original_file_name, mime_type, file_size, created_by)
           values ($1, $2, 'ملف ضخم', $3, 'x.pdf', 'application/pdf', 99999999, $4)`,
          [id, publishedLessonId, base, teacherId],
        ),
      ),
    ).rejects.toThrow()
  })

  it('shows a student only the documents of published lessons', async () => {
    const studentView = await as('authenticated', studentAId, (client) =>
      client.query(`select id from public.lesson_documents`),
    )
    expect(studentView.rows.map((r) => r.id)).toEqual([publishedDocumentId])

    const teacherView = await as('authenticated', teacherId, (client) =>
      client.query(`select id from public.lesson_documents`),
    )
    expect(teacherView.rows).toHaveLength(2)
  })

  /* ---------------------------------------------------------------------- */
  /* Storage objects                                                         */
  /* ---------------------------------------------------------------------- */

  it('lets a teacher manage storage objects', async () => {
    const path = `classes/${publishedClassId}/lessons/${publishedLessonId}/documents/${publishedDocumentId}/v1/handout.pdf`
    await as('authenticated', teacherId, (client) =>
      client.query(
        `insert into storage.objects (bucket_id, name, owner) values ('lesson-documents', $1, $2)`,
        [path, teacherId],
      ),
    )

    const { rows } = await as('authenticated', teacherId, (client) =>
      client.query(`select name from storage.objects`),
    )
    expect(rows).toHaveLength(1)
  })

  it('lets a student read the object of a published document', async () => {
    const { rows } = await as('authenticated', studentAId, (client) =>
      client.query(`select name from storage.objects`),
    )
    expect(rows).toHaveLength(1)
  })

  it('refuses to let a student insert or delete storage objects', async () => {
    await expect(
      as('authenticated', studentAId, (client) =>
        client.query(
          `insert into storage.objects (bucket_id, name, owner) values ('lesson-documents', 'classes/x.pdf', $1)`,
          [studentAId],
        ),
      ),
    ).rejects.toThrow(/row-level security/i)

    await as('authenticated', studentAId, (client) => client.query(`delete from storage.objects`))

    const { rows } = await admin((client) => client.query(`select name from storage.objects`))
    expect(rows).toHaveLength(1)
  })

  it('hides the object of an unpublished document from students', async () => {
    const path = `classes/${publishedClassId}/lessons/${draftLessonId}/documents/${draftDocumentId}/v1/draft.pdf`
    await as('authenticated', teacherId, (client) =>
      client.query(
        `insert into storage.objects (bucket_id, name, owner) values ('lesson-documents', $1, $2)`,
        [path, teacherId],
      ),
    )

    const studentView = await as('authenticated', studentAId, (client) =>
      client.query(`select name from storage.objects`),
    )
    expect(studentView.rows).toHaveLength(1)

    const teacherView = await as('authenticated', teacherId, (client) =>
      client.query(`select name from storage.objects`),
    )
    expect(teacherView.rows).toHaveLength(2)
  })

  /* ---------------------------------------------------------------------- */
  /* Messaging                                                               */
  /* ---------------------------------------------------------------------- */

  it('lets a student open a conversation with the teacher', async () => {
    const { rows } = await as('authenticated', studentAId, (client) =>
      client.query(
        `insert into public.conversations (student_id, teacher_id) values ($1, $2) returning id`,
        [studentAId, teacherId],
      ),
    )
    conversationId = rows[0].id as string
    expect(conversationId).toBeTruthy()
  })

  it('refuses to let a student open a conversation with another student', async () => {
    await expect(
      as('authenticated', studentAId, (client) =>
        client.query(`insert into public.conversations (student_id, teacher_id) values ($1, $2)`, [
          studentAId,
          studentBId,
        ]),
      ),
    ).rejects.toThrow(/teacher_id must reference an account with the teacher role/i)
  })

  it('keeps the conversations of two students isolated', async () => {
    const studentAView = await as('authenticated', studentAId, (client) =>
      client.query(`select id from public.conversations`),
    )
    expect(studentAView.rows.map((r) => r.id)).toEqual([conversationId])

    const studentBView = await as('authenticated', studentBId, (client) =>
      client.query(`select id from public.conversations`),
    )
    expect(studentBView.rows.map((r) => r.id)).toEqual([studentBConversationId])

    const teacherView = await as('authenticated', teacherId, (client) =>
      client.query(`select id from public.conversations`),
    )
    expect(teacherView.rows).toHaveLength(2)
  })

  it('refuses to let a student read another student’s messages', async () => {
    await as('authenticated', studentBId, (client) =>
      client.query(
        `insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'رسالة خاصة ب')`,
        [studentBConversationId, studentBId],
      ),
    )

    const studentAView = await as('authenticated', studentAId, (client) =>
      client.query(`select body from public.messages`),
    )
    expect(studentAView.rows).toHaveLength(0)
  })

  it('lets a participant send a message', async () => {
    await as('authenticated', studentAId, (client) =>
      client.query(
        `insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'مرحبًا أستاذ')`,
        [conversationId, studentAId],
      ),
    )

    const { rows } = await as('authenticated', teacherId, (client) =>
      client.query(`select body from public.messages where conversation_id = $1`, [conversationId]),
    )
    expect(rows).toHaveLength(1)
  })

  it('refuses to let a student send a message as the teacher', async () => {
    await expect(
      as('authenticated', studentAId, (client) =>
        client.query(
          `insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'انتحال')`,
          [conversationId, teacherId],
        ),
      ),
    ).rejects.toThrow(/only be sent on behalf of the authenticated user/i)
  })

  it('refuses to let a student post into a conversation they do not take part in', async () => {
    await expect(
      as('authenticated', studentAId, (client) =>
        client.query(
          `insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'تطفّل')`,
          [studentBConversationId, studentAId],
        ),
      ),
    ).rejects.toThrow(/not a participant of this conversation/i)
  })

  it('rejects an empty message body', async () => {
    await expect(
      as('authenticated', studentAId, (client) =>
        client.query(
          `insert into public.messages (conversation_id, sender_id, body) values ($1, $2, '   ')`,
          [conversationId, studentAId],
        ),
      ),
    ).rejects.toThrow()
  })

  it('lets the recipient mark a message as read but not the sender', async () => {
    const { rows } = await admin((client) =>
      client.query(`select id from public.messages where conversation_id = $1 and sender_id = $2`, [
        conversationId,
        studentAId,
      ]),
    )
    const messageId = rows[0].id as string

    await as('authenticated', teacherId, (client) =>
      client.query(`update public.messages set read_at = now() where id = $1`, [messageId]),
    )

    const { rows: read } = await admin((client) =>
      client.query(`select read_at from public.messages where id = $1`, [messageId]),
    )
    expect(read[0].read_at).not.toBeNull()

    await expect(
      as('authenticated', studentAId, (client) =>
        client.query(`update public.messages set read_at = now() where id = $1`, [messageId]),
      ),
    ).rejects.toThrow(/Only the recipient of a message can mark it as read/i)
  })

  it('refuses to let a participant rewrite a message body', async () => {
    const { rows } = await admin((client) =>
      client.query(`select id from public.messages where conversation_id = $1 and sender_id = $2`, [
        conversationId,
        studentAId,
      ]),
    )
    const messageId = rows[0].id as string

    await expect(
      as('authenticated', teacherId, (client) =>
        client.query(`update public.messages set body = 'معدّل' where id = $1`, [messageId]),
      ),
    ).rejects.toThrow(/cannot be edited after it was sent/i)
  })

  it('refuses to let a participant steal another conversation', async () => {
    await expect(
      as('authenticated', studentAId, (client) =>
        client.query(`update public.conversations set student_id = $1 where id = $2`, [
          studentBId,
          conversationId,
        ]),
      ),
    ).rejects.toThrow(/participants of a conversation cannot be changed/i)
  })
})
