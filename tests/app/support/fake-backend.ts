/**
 * An in-memory Supabase emulator for the *application level* test suite.
 *
 * WHAT THIS IS
 * ------------
 * The real permission model of the platform lives in the SQL migrations
 * (`supabase/migrations/…`) and is verified against a real PostgreSQL server
 * by `tests/db/rls.test.ts`. That suite is the source of truth.
 *
 * This file exists so that the **frontend** can be tested without a live
 * Supabase project: it implements the small part of the PostgREST query
 * builder that the application uses, and it enforces the *same* Row Level
 * Security rules, the *same* database triggers and the *same* storage
 * policies as the migrations.
 *
 * It is a faithful re-implementation, not a mock that always succeeds: a
 * student that tries to create a class really is rejected here, exactly as
 * PostgreSQL would reject it.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is not a PostgreSQL engine. It does not parse SQL, it does not check
 * index usage, and it does not measure performance. Claims about database
 * behaviour in the acceptance report always refer to the real PostgreSQL
 * suite, never to this file.
 */

export type FakeRole = 'student' | 'teacher'
export type FakeTable =
  | 'profiles'
  | 'classes'
  | 'lessons'
  | 'lesson_documents'
  | 'conversations'
  | 'messages'

export type FakeRow = Record<string, unknown>

export const BUCKET = 'lesson-documents'
export const MAX_FILE_SIZE = 25 * 1024 * 1024
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export class FakeApiError {
  readonly message: string
  readonly code: string
  readonly status: number
  readonly details: string
  readonly hint: string

  constructor(message: string, code = '42501', status = 403) {
    this.message = message
    this.code = code
    this.status = status
    this.details = ''
    this.hint = ''
  }
}

type Result = { data: unknown; error: FakeApiError | null }

const DENIED = () => new FakeApiError('row-level security violation', '42501', 403)
const NOT_FOUND = () => new FakeApiError('JSON object requested, multiple (or no) rows returned', 'PGRST116', 404)

/**
 * Strictly increasing timestamps.
 *
 * PostgreSQL stores `timestamptz` with microsecond precision, so two rows
 * inserted in the same millisecond still differ. The emulator uses
 * millisecond precision and therefore has to advance the clock manually —
 * otherwise the ordering and the `created_at < cursor` pagination would be
 * ambiguous.
 */
let lastTimestamp = 0

function nowIso(): string {
  const wallClock = Date.now()
  lastTimestamp = wallClock > lastTimestamp ? wallClock : lastTimestamp + 1
  return new Date(lastTimestamp).toISOString()
}

function uuid(): string {
  const webCrypto = globalThis.crypto
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export type FakeUser = {
  id: string
  email: string
  password: string
  confirmed: boolean
  metadata: Record<string, unknown>
}

export type StorageObject = {
  bucket: string
  path: string
  contentType: string
  size: number
}

export class FakeDatabase {
  tables: Record<FakeTable, FakeRow[]> = {
    profiles: [],
    classes: [],
    lessons: [],
    lesson_documents: [],
    conversations: [],
    messages: [],
  }

  users = new Map<string, FakeUser>()
  objects = new Map<string, StorageObject>()
  currentUserId: string | null = null
  /** Every write that was rejected — used by the tests to assert the policy. */
  readonly denials: string[] = []

  /* ------------------------------------------------------------------ */
  /* helpers                                                             */
  /* ------------------------------------------------------------------ */

  roleOf(userId: string | null): FakeRole | null {
    if (!userId) return null
    const profile = this.tables.profiles.find((row) => row.id === userId)
    return (profile?.role as FakeRole | undefined) ?? null
  }

  isTeacher(): boolean {
    return this.roleOf(this.currentUserId) === 'teacher'
  }

  profileByEmail(email: string): FakeRow | undefined {
    return this.tables.profiles.find(
      (row) => String(row.email).toLowerCase() === email.trim().toLowerCase(),
    )
  }

  /** Remove every row and every object — used between test cases. */
  reset(): void {
    this.tables.profiles = []
    this.tables.classes = []
    this.tables.lessons = []
    this.tables.lesson_documents = []
    this.tables.conversations = []
    this.tables.messages = []
    this.users.clear()
    this.objects.clear()
    this.currentUserId = null
    this.denials.length = 0
  }

  addUser(user: FakeUser): FakeUser {
    this.users.set(user.id, user)
    this.tables.profiles.push({
      id: user.id,
      full_name: (user.metadata.full_name as string) ?? '',
      email: user.email,
      role: 'student',
      grade_level: (user.metadata.grade_level as string) ?? '',
      avatar_url: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    return user
  }

  signIn(userId: string): void {
    this.currentUserId = userId
  }

  signOut(): void {
    this.currentUserId = null
  }

  /* ------------------------------------------------------------------ */
  /* policy helpers (mirroring the SQL helper functions)                  */
  /* ------------------------------------------------------------------ */

  isTeacherProfile(userId: string): boolean {
    return this.roleOf(userId) === 'teacher'
  }

  canViewLesson(lessonId: string): boolean {
    const lesson = this.tables.lessons.find((row) => row.id === lessonId)
    if (!lesson) return false
    if (lesson.is_published !== true || lesson.is_archived === true) return false
    const classRow = this.tables.classes.find((row) => row.id === lesson.class_id)
    if (!classRow) return false
    return classRow.is_published === true && classRow.is_archived !== true
  }

  canViewDocument(documentId: string): boolean {
    const document = this.tables.lesson_documents.find((row) => row.id === documentId)
    if (!document) return false
    if (document.deleted_at !== null && document.deleted_at !== undefined) return false
    return this.canViewLesson(String(document.lesson_id))
  }

  isConversationParticipant(conversationId: string): boolean {
    const uid = this.currentUserId
    if (!uid) return false
    const conversation = this.tables.conversations.find((row) => row.id === conversationId)
    if (!conversation) return false
    return conversation.student_id === uid || conversation.teacher_id === uid
  }

  /** RLS `USING` clause of the SELECT policy of a table. */
  canSelect(table: FakeTable, row: FakeRow): boolean {
    const uid = this.currentUserId
    if (!uid) return false

    switch (table) {
      case 'profiles':
        return (
          row.id === uid ||
          row.role === 'teacher' ||
          this.isTeacher()
        )
      case 'classes':
        return this.isTeacher() || (row.is_published === true && row.is_archived !== true)
      case 'lessons':
        return this.isTeacher() || (row.is_published === true && this.canViewLesson(String(row.id)))
      case 'lesson_documents':
        return this.isTeacher() || this.canViewDocument(String(row.id))
      case 'conversations':
        return row.student_id === uid || row.teacher_id === uid
      case 'messages':
        return this.isConversationParticipant(String(row.conversation_id))
      default:
        return false
    }
  }

  /** RLS `USING` clause of the INSERT policy. */
  canInsert(table: FakeTable, row: FakeRow): boolean {
    const uid = this.currentUserId
    if (!uid) return false

    switch (table) {
      case 'profiles':
        // Profiles are created by the `handle_new_user` trigger only.
        return false
      case 'classes':
      case 'lessons':
      case 'lesson_documents':
        return this.isTeacher()
      case 'conversations':
        return (
          (row.student_id === uid && this.isTeacherProfile(String(row.teacher_id))) ||
          (row.teacher_id === uid && !this.isTeacherProfile(String(row.student_id)))
        )
      case 'messages':
        return row.sender_id === uid && this.isConversationParticipant(String(row.conversation_id))
      default:
        return false
    }
  }

  /** RLS `USING` clause of the UPDATE policy. */
  canUpdate(table: FakeTable, row: FakeRow): boolean {
    const uid = this.currentUserId
    if (!uid) return false

    switch (table) {
      case 'profiles':
        return row.id === uid
      case 'classes':
      case 'lessons':
      case 'lesson_documents':
        return this.isTeacher()
      case 'conversations':
        return row.student_id === uid || row.teacher_id === uid
      case 'messages':
        return this.isConversationParticipant(String(row.conversation_id))
      default:
        return false
    }
  }

  /** RLS `USING` clause of the DELETE policy. */
  canDelete(table: FakeTable, row: FakeRow): boolean {
    const uid = this.currentUserId
    if (!uid) return false

    switch (table) {
      case 'classes':
      case 'lessons':
      case 'lesson_documents':
        return this.isTeacher()
      case 'conversations':
        return this.isTeacher()
      case 'messages':
        return (
          row.sender_id === uid ||
          (this.isTeacher() && this.isConversationParticipant(String(row.conversation_id)))
        )
      case 'profiles':
        return false
      default:
        return false
    }
  }

  /** RLS `WITH CHECK` clause of the UPDATE policy. */
  passesUpdateCheck(table: FakeTable, row: FakeRow): boolean {
    const uid = this.currentUserId
    if (!uid) return false

    switch (table) {
      case 'profiles':
        return row.id === uid
      case 'classes':
      case 'lessons':
      case 'lesson_documents':
        return this.isTeacher()
      case 'conversations':
        return row.student_id === uid || row.teacher_id === uid
      case 'messages':
        return this.isConversationParticipant(String(row.conversation_id))
      default:
        return false
    }
  }

  /* ------------------------------------------------------------------ */
  /* trigger helpers (mirroring the SQL triggers)                        */
  /* ------------------------------------------------------------------ */

  validateProfileUpdate(before: FakeRow, after: FakeRow): FakeApiError | null {
    if (before.role !== after.role) {
      return new FakeApiError('the role of a profile cannot be changed', '42501', 403)
    }
    if (before.id !== after.id) {
      return new FakeApiError('the id of a profile cannot be changed', '42501', 403)
    }
    return null
  }

  validateConversationInsert(row: FakeRow): FakeApiError | null {
    const student = this.tables.profiles.find((profile) => profile.id === row.student_id)
    const teacher = this.tables.profiles.find((profile) => profile.id === row.teacher_id)
    if (!student || !teacher) {
      return new FakeApiError('both participants must exist', '23503', 409)
    }
    if (student.role !== 'student' || teacher.role !== 'teacher') {
      return new FakeApiError('invalid participant roles', '23514', 400)
    }
    if (row.student_id === row.teacher_id) {
      return new FakeApiError('a conversation needs two different participants', '23514', 400)
    }
    return null
  }

  validateConversationUpdate(before: FakeRow, after: FakeRow): FakeApiError | null {
    if (before.student_id !== after.student_id || before.teacher_id !== after.teacher_id) {
      return new FakeApiError('the participants of a conversation cannot be changed', '42501', 403)
    }
    return null
  }

  validateMessageInsert(row: FakeRow): FakeApiError | null {
    const uid = this.currentUserId
    if (!uid || row.sender_id !== uid) {
      return new FakeApiError('a message can only be sent as the authenticated user', '42501', 403)
    }
    if (!this.isConversationParticipant(String(row.conversation_id))) {
      return new FakeApiError('not a participant of this conversation', '42501', 403)
    }
    const body = String(row.body ?? '')
    if (body.trim().length === 0 || body.length > 4000) {
      return new FakeApiError('message body is out of range', '23514', 400)
    }
    return null
  }

  validateMessageUpdate(before: FakeRow, after: FakeRow): FakeApiError | null {
    if (before.body !== after.body) {
      return new FakeApiError('a message body cannot be rewritten', '42501', 403)
    }
    if (before.sender_id !== after.sender_id) {
      return new FakeApiError('the sender of a message cannot be changed', '42501', 403)
    }
    if (before.conversation_id !== after.conversation_id) {
      return new FakeApiError('a message cannot be moved to another conversation', '42501', 403)
    }
    return null
  }

  validateDocumentPath(row: FakeRow): FakeApiError | null {
    const path = String(row.file_path ?? '')
    const parts = path.split('/')
    if (parts.length !== 8) {
      return new FakeApiError('invalid storage path', '23514', 400)
    }
    if (parts[0] !== 'classes' || parts[2] !== 'lessons' || parts[4] !== 'documents') {
      return new FakeApiError('invalid storage path', '23514', 400)
    }
    if (parts[5] !== row.id) {
      return new FakeApiError('the storage path does not match the document', '23514', 400)
    }
    if (!/^v\d+$/.test(parts[6] ?? '')) {
      return new FakeApiError('invalid storage path version', '23514', 400)
    }
    const lesson = this.tables.lessons.find((lessonRow) => lessonRow.id === parts[3])
    if (!lesson) {
      return new FakeApiError('the storage path references an unknown lesson', '23503', 409)
    }
    if (lesson.class_id !== parts[1]) {
      return new FakeApiError('the storage path references a foreign class', '23514', 400)
    }
    if (row.lesson_id !== parts[3]) {
      return new FakeApiError('the storage path references a foreign lesson', '23514', 400)
    }
    return null
  }
}

/* -------------------------------------------------------------------------- */
/* query builder                                                               */
/* -------------------------------------------------------------------------- */

type RowPredicate = (row: FakeRow) => boolean

type Order = { column: string; ascending: boolean }

class FakeQuery implements PromiseLike<Result> {
  private readonly predicates: RowPredicate[] = []
  private readonly orders: Order[] = []
  private limitCount: number | null = null
  private rangeStart: number | null = null
  private rangeEnd: number | null = null
  private wantsCount = false
  private headOnly = false
  private returnSingle = false
  private returnMaybeSingle = false
  private selectExpression = '*'

  private readonly db: FakeDatabase
  private readonly table: FakeTable
  private readonly operation: 'select' | 'insert' | 'update' | 'delete'
  private readonly payload?: unknown

  constructor(
    db: FakeDatabase,
    table: FakeTable,
    operation: 'select' | 'insert' | 'update' | 'delete',
    payload?: unknown,
  ) {
    this.db = db
    this.table = table
    this.operation = operation
    this.payload = payload
  }

  select(expression = '*', options?: { count?: 'exact'; head?: boolean }): this {
    this.selectExpression = expression
    if (options?.count === 'exact') this.wantsCount = true
    if (options?.head) this.headOnly = true
    return this
  }

  insert(payload: unknown): this {
    return new FakeQuery(this.db, this.table, 'insert', payload) as this
  }

  update(payload: unknown): this {
    return new FakeQuery(this.db, this.table, 'update', payload) as this
  }

  delete(): this {
    return new FakeQuery(this.db, this.table, 'delete') as this
  }

  eq(column: string, value: unknown): this {
    this.predicates.push((row) => row[column] === value)
    return this
  }

  neq(column: string, value: unknown): this {
    this.predicates.push((row) => row[column] !== value)
    return this
  }

  in(column: string, values: readonly unknown[]): this {
    this.predicates.push((row) => values.includes(row[column]))
    return this
  }

  is(column: string, value: unknown): this {
    this.predicates.push((row) => {
      const actual = row[column]
      if (value === null) return actual === null || actual === undefined
      return actual === value
    })
    return this
  }

  lt(column: string, value: unknown): this {
    this.predicates.push((row) => String(row[column]) < String(value))
    return this
  }

  gt(column: string, value: unknown): this {
    this.predicates.push((row) => String(row[column]) > String(value))
    return this
  }

  lte(column: string, value: unknown): this {
    this.predicates.push((row) => String(row[column]) <= String(value))
    return this
  }

  gte(column: string, value: unknown): this {
    this.predicates.push((row) => String(row[column]) >= String(value))
    return this
  }

  like(column: string, pattern: string): this {
    this.predicates.push((row) => matchLike(String(row[column] ?? ''), pattern))
    return this
  }

  ilike(column: string, pattern: string): this {
    this.predicates.push((row) => matchLike(String(row[column] ?? '').toLowerCase(), pattern.toLowerCase()))
    return this
  }

  /** `column.operator.value` groups separated by commas. */
  or(expression: string): this {
    const groups = expression.split(',').map((part) => part.trim()).filter(Boolean)
    this.predicates.push((row) =>
      groups.some((group) => {
        const match = /^([A-Za-z0-9_]+)\.([A-Za-z]+)\.(.*)$/.exec(group)
        if (!match) return false
        const column = match[1] ?? ''
        const operator = match[2] ?? ''
        const value = match[3] ?? ''
        if (!column || !operator) return false
        const actual = String(row[column] ?? '')
        switch (operator) {
          case 'ilike':
            return matchLike(actual.toLowerCase(), value.toLowerCase())
          case 'like':
            return matchLike(actual, value)
          case 'eq':
            return actual === value
          case 'neq':
            return actual !== value
          default:
            return false
        }
      }),
    )
    return this
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orders.push({ column, ascending: options?.ascending ?? true })
    return this
  }

  range(from: number, to: number): this {
    this.rangeStart = from
    this.rangeEnd = to
    return this
  }

  limit(count: number): this {
    this.limitCount = count
    return this
  }

  single(): this {
    this.returnSingle = true
    return this
  }

  maybeSingle(): this {
    this.returnMaybeSingle = true
    return this
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  /* ------------------------------------------------------------------ */

  private matches(row: FakeRow): boolean {
    return this.predicates.every((predicate) => predicate(row))
  }

  private async execute(): Promise<Result> {
    const db = this.db

    if (!db.currentUserId) {
      db.denials.push(`${this.operation}:${this.table}:anonymous`)
      return { data: null, error: DENIED() }
    }

    switch (this.operation) {
      case 'select':
        return this.executeSelect()
      case 'insert':
        return this.executeInsert()
      case 'update':
        return this.executeUpdate()
      case 'delete':
        return this.executeDelete()
      default:
        return { data: null, error: new FakeApiError('unsupported operation', 'PGRST100', 400) }
    }
  }

  private executeSelect(): Result {
    const db = this.db
    const visible = db.tables[this.table].filter(
      (row) => db.canSelect(this.table, row) && this.matches(row),
    )

    const count = visible.length
    let rows = visible

    for (const order of [...this.orders].reverse()) {
      rows = [...rows].sort((a, b) => {
        const left = String(a[order.column] ?? '')
        const right = String(b[order.column] ?? '')
        return order.ascending ? left.localeCompare(right) : right.localeCompare(left)
      })
    }

    if (this.rangeStart !== null && this.rangeEnd !== null) {
      rows = rows.slice(this.rangeStart, this.rangeEnd + 1)
    } else if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount)
    }

    const projected = rows.map((row) => this.project(row))

    const result: Result = {
      data: this.headOnly ? null : projected,
      error: null,
    }
    if (this.wantsCount) {
      ;(result as { count?: number }).count = count
    }
    if (this.returnSingle) {
      if (projected.length !== 1) return { data: null, error: NOT_FOUND() }
      return { data: projected[0], error: null }
    }
    if (this.returnMaybeSingle) {
      return { data: projected[0] ?? null, error: null }
    }
    return result
  }

  /**
   * Resolve the embedded resources used by the conversation list.
   *
   * The row is always returned as a **copy**. PostgREST serialises every row
   * into fresh JSON, so a caller can never hold a live reference to a stored
   * row. Sharing the reference would let an update mutate a value the caller
   * still believes to be the old one (which is exactly what the replacement
   * flow relies on: it removes the *previous* file after the row was updated).
   */
  private project(row: FakeRow): FakeRow {
    if (!this.selectExpression.includes(':profiles!')) return { ...row }
    const projected: FakeRow = { ...row }
    const db = this.db
    const embed = (foreignKey: 'student_id' | 'teacher_id', key: 'student' | 'teacher') => {
      const targetId = row[foreignKey]
      const profile = db.tables.profiles.find((candidate) => candidate.id === targetId)
      projected[key] = profile && db.canSelect('profiles', profile) ? profile : null
    }
    embed('student_id', 'student')
    embed('teacher_id', 'teacher')
    return projected
  }

  private executeInsert(): Result {
    const db = this.db
    const input = (this.payload ?? {}) as FakeRow

    if (!db.canInsert(this.table, input)) {
      db.denials.push(`insert:${this.table}`)
      return { data: null, error: DENIED() }
    }

    const row: FakeRow = { ...input }

    switch (this.table) {
      case 'classes':
        row.id = row.id ?? uuid()
        row.display_order = row.display_order ?? 0
        row.is_published = row.is_published ?? false
        row.is_archived = row.is_archived ?? false
        row.created_by = row.created_by ?? db.currentUserId
        break
      case 'lessons':
        row.id = row.id ?? uuid()
        row.display_order = row.display_order ?? 0
        row.is_published = row.is_published ?? false
        row.is_archived = row.is_archived ?? false
        row.created_by = row.created_by ?? db.currentUserId
        break
      case 'lesson_documents':
        row.id = row.id ?? uuid()
        row.version = row.version ?? 1
        row.deleted_at = row.deleted_at ?? null
        row.created_by = row.created_by ?? db.currentUserId
        break
      case 'conversations': {
        row.id = row.id ?? uuid()
        const error = db.validateConversationInsert(row)
        if (error) return { data: null, error }
        const duplicate = db.tables.conversations.find(
          (candidate) =>
            candidate.student_id === row.student_id && candidate.teacher_id === row.teacher_id,
        )
        if (duplicate) {
          return { data: null, error: new FakeApiError('duplicate key', '23505', 409) }
        }
        break
      }
      case 'messages': {
        row.id = row.id ?? uuid()
        const error = db.validateMessageInsert(row)
        if (error) return { data: null, error }
        row.read_at = row.read_at ?? null
        break
      }
      default:
        break
    }

    if (this.table === 'lesson_documents') {
      const error = db.validateDocumentPath(row)
      if (error) return { data: null, error }
    }

    // `classes_title_unique_active` / `lessons_class_title_unique_active`
    if (this.table === 'classes') {
      const duplicate = db.tables.classes.find(
        (candidate) =>
          candidate.is_archived !== true &&
          String(candidate.title).toLowerCase() === String(row.title).toLowerCase(),
      )
      if (duplicate) {
        return { data: null, error: new FakeApiError('duplicate key', '23505', 409) }
      }
    }
    if (this.table === 'lessons') {
      const duplicate = db.tables.lessons.find(
        (candidate) =>
          candidate.class_id === row.class_id &&
          candidate.is_archived !== true &&
          String(candidate.title).toLowerCase() === String(row.title).toLowerCase(),
      )
      if (duplicate) {
        return { data: null, error: new FakeApiError('duplicate key', '23505', 409) }
      }
    }

    row.created_at = row.created_at ?? nowIso()
    row.updated_at = row.updated_at ?? nowIso()

    db.tables[this.table].push(row)

    // `touch_conversation_on_message`
    if (this.table === 'messages') {
      const conversation = db.tables.conversations.find(
        (candidate) => candidate.id === row.conversation_id,
      )
      if (conversation) {
        conversation.last_message_at = row.created_at
        conversation.updated_at = row.created_at
      }
    }

    return { data: this.project(row), error: null }
  }

  private executeUpdate(): Result {
    const db = this.db
    const patch = (this.payload ?? {}) as FakeRow
    const candidates = db.tables[this.table].filter(
      (row) => db.canUpdate(this.table, row) && this.matches(row),
    )

    if (candidates.length === 0) {
      db.denials.push(`update:${this.table}`)
      return { data: null, error: NOT_FOUND() }
    }

    const updated: FakeRow[] = []

    for (const before of candidates) {
      const after: FakeRow = { ...before, ...patch, updated_at: nowIso() }

      if (this.table === 'profiles') {
        const error = db.validateProfileUpdate(before, after)
        if (error) return { data: null, error }
      }
      if (this.table === 'conversations') {
        const error = db.validateConversationUpdate(before, after)
        if (error) return { data: null, error }
      }
      if (this.table === 'messages') {
        const error = db.validateMessageUpdate(before, after)
        if (error) return { data: null, error }
      }
      if (this.table === 'lesson_documents') {
        const error = db.validateDocumentPath(after)
        if (error) return { data: null, error }
      }

      if (!db.passesUpdateCheck(this.table, after)) {
        db.denials.push(`update-check:${this.table}`)
        return { data: null, error: DENIED() }
      }

      Object.assign(before, after)
      updated.push(before)
    }

    if (this.returnSingle) {
      if (updated.length !== 1) return { data: null, error: NOT_FOUND() }
      return { data: this.project(updated[0] as FakeRow), error: null }
    }
    if (this.returnMaybeSingle) {
      return { data: updated[0] ? this.project(updated[0]) : null, error: null }
    }
    return { data: updated.map((row) => this.project(row)), error: null }
  }

  private executeDelete(): Result {
    const db = this.db
    const candidates = db.tables[this.table].filter(
      (row) => db.canDelete(this.table, row) && this.matches(row),
    )

    if (candidates.length === 0) {
      db.denials.push(`delete:${this.table}`)
      return { data: null, error: NOT_FOUND() }
    }

    for (const row of candidates) {
      const index = db.tables[this.table].indexOf(row)
      if (index >= 0) db.tables[this.table].splice(index, 1)
    }

    // ON DELETE CASCADE
    if (this.table === 'classes') {
      const lessonIds = db.tables.lessons
        .filter((lesson) => candidates.some((row) => row.id === lesson.class_id))
        .map((lesson) => lesson.id)
      db.tables.lessons = db.tables.lessons.filter((lesson) => !lessonIds.includes(String(lesson.id)))
      db.tables.lesson_documents = db.tables.lesson_documents.filter(
        (document) => !lessonIds.includes(String(document.lesson_id)),
      )
    }
    if (this.table === 'lessons') {
      const lessonIds = candidates.map((row) => String(row.id))
      db.tables.lesson_documents = db.tables.lesson_documents.filter(
        (document) => !lessonIds.includes(String(document.lesson_id)),
      )
    }
    if (this.table === 'conversations') {
      const conversationIds = candidates.map((row) => String(row.id))
      db.tables.messages = db.tables.messages.filter(
        (message) => !conversationIds.includes(String(message.conversation_id)),
      )
    }

    return { data: null, error: null }
  }
}

function matchLike(value: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`^${escaped.replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i')
  return regex.test(value)
}

/* -------------------------------------------------------------------------- */
/* storage                                                                    */
/* -------------------------------------------------------------------------- */

class FakeStorageBucket {
  private readonly db: FakeDatabase
  private readonly bucket: string

  constructor(db: FakeDatabase, bucket: string) {
    this.db = db
    this.bucket = bucket
  }

  private isTeacher(): boolean {
    return this.db.isTeacher()
  }

  private documentIdFromPath(path: string): string | null {
    const parts = path.split('/')
    if (parts.length !== 8) return null
    if (parts[0] !== 'classes' || parts[4] !== 'documents') return null
    return parts[5] ?? null
  }

  private canRead(path: string): boolean {
    if (this.isTeacher()) return true
    const documentId = this.documentIdFromPath(path)
    if (!documentId) return false
    const document = this.db.tables.lesson_documents.find((row) => row.id === documentId)
    if (!document) return false
    if (document.deleted_at) return false
    const lesson = this.db.tables.lessons.find((row) => row.id === document.lesson_id)
    if (!lesson) return false
    if (lesson.is_published !== true || lesson.is_archived === true) return false
    const classRow = this.db.tables.classes.find((row) => row.id === lesson.class_id)
    if (!classRow) return false
    return classRow.is_published === true && classRow.is_archived !== true
  }

  async upload(
    path: string,
    file: Blob,
    options?: { contentType?: string; upsert?: boolean },
  ): Promise<Result> {
    if (!this.db.currentUserId) return { data: null, error: DENIED() }
    if (!this.isTeacher()) {
      this.db.denials.push('storage:upload')
      return { data: null, error: DENIED() }
    }
    const contentType = options?.contentType ?? file.type
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      return {
        data: null,
        error: new FakeApiError('mime type is not allowed', '413', 400),
      }
    }
    if (file.size > MAX_FILE_SIZE) {
      return { data: null, error: new FakeApiError('file is too large', '413', 400) }
    }
    const key = `${this.bucket}/${path}`
    if (!options?.upsert && this.db.objects.has(key)) {
      return { data: null, error: new FakeApiError('object already exists', '409', 409) }
    }
    this.db.objects.set(key, {
      bucket: this.bucket,
      path,
      contentType,
      size: file.size,
    })
    return { data: { path, id: key }, error: null }
  }

  async remove(paths: string[]): Promise<Result> {
    if (!this.db.currentUserId) return { data: null, error: DENIED() }
    if (!this.isTeacher()) {
      this.db.denials.push('storage:remove')
      return { data: null, error: DENIED() }
    }
    for (const path of paths) {
      this.db.objects.delete(`${this.bucket}/${path}`)
    }
    return { data: paths, error: null }
  }

  async createSignedUrl(
    path: string,
    ttl: number,
    options?: { download?: string },
  ): Promise<Result> {
    if (!this.db.currentUserId) return { data: null, error: DENIED() }
    if (!this.canRead(path)) {
      this.db.denials.push('storage:sign')
      return { data: null, error: DENIED() }
    }
    const suffix = options?.download ? `&download=${encodeURIComponent(options.download)}` : ''
    return {
      data: {
        signedUrl: `https://fake.supabase.co/storage/v1/object/sign/${this.bucket}/${path}?token=fake&expires=${ttl}${suffix}`,
        path,
      },
      error: null,
    }
  }

  async list(): Promise<Result> {
    if (!this.db.currentUserId) return { data: null, error: DENIED() }
    const objects = [...this.db.objects.values()].filter(
      (object) => object.bucket === this.bucket && this.canRead(object.path),
    )
    return { data: objects, error: null }
  }
}

class FakeStorage {
  private readonly db: FakeDatabase

  constructor(db: FakeDatabase) {
    this.db = db
  }

  from(bucket: string): FakeStorageBucket {
    return new FakeStorageBucket(this.db, bucket)
  }
}

/* -------------------------------------------------------------------------- */
/* auth                                                                       */
/* -------------------------------------------------------------------------- */

class FakeAuth {
  private readonly db: FakeDatabase

  constructor(db: FakeDatabase) {
    this.db = db
  }

  async getUser(): Promise<{ data: { user: unknown }; error: unknown }> {
    const user = this.db.currentUserId ? this.db.users.get(this.db.currentUserId) : undefined
    if (!user) return { data: { user: null }, error: new FakeApiError('no session', '403', 403) }
    return { data: { user: { id: user.id, email: user.email } }, error: null }
  }

  async getSession(): Promise<{ data: { session: unknown }; error: unknown }> {
    const user = this.db.currentUserId ? this.db.users.get(this.db.currentUserId) : undefined
    if (!user) return { data: { session: null }, error: null }
    return {
      data: {
        session: { access_token: `token-${user.id}`, user: { id: user.id, email: user.email } },
      },
      error: null,
    }
  }

  async signInWithPassword(credentials: {
    email: string
    password: string
  }): Promise<{ data: unknown; error: unknown }> {
    const user = [...this.db.users.values()].find(
      (candidate) => candidate.email.toLowerCase() === credentials.email.trim().toLowerCase(),
    )
    if (!user || user.password !== credentials.password) {
      return { data: null, error: new FakeApiError('Invalid login credentials', '400', 400) }
    }
    this.db.signIn(user.id)
    return { data: { user: { id: user.id, email: user.email } }, error: null }
  }

  async signUp(input: {
    email: string
    password: string
    options?: { data?: Record<string, unknown> }
  }): Promise<{ data: unknown; error: unknown }> {
    const email = input.email.trim().toLowerCase()
    if ([...this.db.users.values()].some((candidate) => candidate.email.toLowerCase() === email)) {
      return { data: null, error: new FakeApiError('User already registered', '422', 422) }
    }
    const user = this.db.addUser({
      id: uuid(),
      email,
      password: input.password,
      confirmed: true,
      metadata: input.options?.data ?? {},
    })
    this.db.signIn(user.id)
    return { data: { user: { id: user.id, email: user.email }, session: {} }, error: null }
  }

  async signOut(): Promise<{ error: unknown }> {
    this.db.signOut()
    return { error: null }
  }

  async resetPasswordForEmail(): Promise<{ error: unknown }> {
    return { error: null }
  }

  async updateUser(): Promise<{ error: unknown }> {
    return { error: null }
  }

  onAuthStateChange(): { data: { subscription: { unsubscribe: () => void } } } {
    return { data: { subscription: { unsubscribe: () => undefined } } }
  }
}

/* -------------------------------------------------------------------------- */
/* the client                                                                 */
/* -------------------------------------------------------------------------- */

export type FakeSupabase = {
  from: (table: FakeTable) => FakeQuery
  storage: FakeStorage
  auth: FakeAuth
  __db: FakeDatabase
}

export function createFakeSupabase(): FakeSupabase {
  const db = new FakeDatabase()
  return {
    from: (table: FakeTable) => new FakeQuery(db, table, 'select'),
    storage: new FakeStorage(db),
    auth: new FakeAuth(db),
    __db: db,
  }
}
