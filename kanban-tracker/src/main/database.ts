import Database, { Database as DatabaseType } from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type {
  Card,
  Column,
  Stream,
  Assignee,
  CardStatus,
  AppSettings,
  CreateCardParams,
  UpdateCardParams,
  CreateColumnParams,
  UpdateColumnParams,
  MoveCardParams,
  SyncMetadata,
  CardFilters,
  CustomAttributeDefinition,
  CardCustomAttribute,
  CustomAttributeType
} from '../shared/types'

export class DatabaseManager {
  private db: DatabaseType
  private dbPath: string

  constructor(dbPath: string) {
    this.dbPath = dbPath
    this.db = new Database(dbPath, { timeout: 5000 })
  }

  initialize(): void {
    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.db.pragma('cache_size = -64000')
    this.db.pragma('busy_timeout = 5000')
    this.db.pragma('foreign_keys = ON')

    // Create tables
    this.createTables()

    // Insert default data if needed
    this.insertDefaultData()
  }

  private createTables(): void {
    // Columns table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS columns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        position INTEGER NOT NULL,
        color TEXT,
        is_closed_column INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    // Streams table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS streams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT,
        created_at TEXT NOT NULL
      )
    `)

    // Assignees table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assignees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        email TEXT,
        position TEXT,
        created_at TEXT NOT NULL
      )
    `)

    // Card statuses table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS card_statuses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT,
        created_at TEXT NOT NULL
      )
    `)

    // Cards table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cards (
        uid TEXT PRIMARY KEY,
        stream TEXT NOT NULL,
        department TEXT NOT NULL,
        planned_interview_date TEXT,
        actual_status TEXT NOT NULL,
        column_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        color TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT,
        is_archived INTEGER DEFAULT 0,
        archived_at TEXT,
        auto_archive_scheduled_at TEXT,
        FOREIGN KEY (stream) REFERENCES streams(name),
        FOREIGN KEY (actual_status) REFERENCES card_statuses(name),
        FOREIGN KEY (column_id) REFERENCES columns(id)
      )
    `)

    // Card assignees table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS card_assignees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_uid TEXT NOT NULL,
        assignee_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (card_uid) REFERENCES cards(uid) ON DELETE CASCADE,
        FOREIGN KEY (assignee_name) REFERENCES assignees(name),
        UNIQUE(card_uid, assignee_name)
      )
    `)

    // Sync metadata table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_modified_at TEXT NOT NULL,
        last_modified_by TEXT,
        db_version INTEGER DEFAULT 1
      )
    `)

    // App settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    // Custom attribute definitions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS custom_attribute_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL CHECK(type IN ('text', 'number', 'date', 'boolean')),
        created_at TEXT NOT NULL
      )
    `)

    // Card custom attributes values table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS card_custom_attributes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_uid TEXT NOT NULL,
        attribute_id INTEGER NOT NULL,
        value TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (card_uid) REFERENCES cards(uid) ON DELETE CASCADE,
        FOREIGN KEY (attribute_id) REFERENCES custom_attribute_definitions(id) ON DELETE CASCADE,
        UNIQUE(card_uid, attribute_id)
      )
    `)

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_cards_column ON cards(column_id, position);
      CREATE INDEX IF NOT EXISTS idx_cards_archived ON cards(is_archived);
      CREATE INDEX IF NOT EXISTS idx_cards_auto_archive ON cards(auto_archive_scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_columns_position ON columns(position);
      CREATE INDEX IF NOT EXISTS idx_card_assignees_card ON card_assignees(card_uid);
      CREATE INDEX IF NOT EXISTS idx_card_custom_attrs_card ON card_custom_attributes(card_uid);
      CREATE INDEX IF NOT EXISTS idx_card_custom_attrs_attr ON card_custom_attributes(attribute_id);
    `)
  }

  private insertDefaultData(): void {
    const now = new Date().toISOString()

    // Check if closed column exists
    const closedColumn = this.db.prepare('SELECT id FROM columns WHERE is_closed_column = 1').get()
    if (!closedColumn) {
      const maxPos = this.db.prepare('SELECT MAX(position) as maxPos FROM columns').get() as { maxPos: number | null }
      this.db.prepare(`
        INSERT INTO columns (id, name, position, is_closed_column, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?)
      `).run('closed-column', 'Закрыто', (maxPos?.maxPos ?? -1) + 1000, now, now)
    }

    // Check if sync_metadata exists
    const syncMeta = this.db.prepare('SELECT id FROM sync_metadata WHERE id = 1').get()
    if (!syncMeta) {
      this.db.prepare(`
        INSERT INTO sync_metadata (id, last_modified_at, db_version)
        VALUES (1, ?, 1)
      `).run(now)
    }

    // Insert default settings if not exist
    const defaultSettings = [
      ['auto_archive_delay_minutes', '10'],
      ['current_user_name', 'Пользователь'],
      ['theme', 'light']
    ]

    const insertSetting = this.db.prepare(`
      INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
    `)

    for (const [key, value] of defaultSettings) {
      insertSetting.run(key, value, now)
    }

    // Insert sample streams if table is empty
    const streamCount = this.db.prepare('SELECT COUNT(*) as count FROM streams').get() as { count: number }
    if (streamCount.count === 0) {
      const insertStream = this.db.prepare('INSERT INTO streams (name, created_at) VALUES (?, ?)')
      insertStream.run('Корпоративный центр', now)
      insertStream.run('Производство', now)
      insertStream.run('IT', now)
    }

    // Insert sample assignees if table is empty
    const assigneeCount = this.db.prepare('SELECT COUNT(*) as count FROM assignees').get() as { count: number }
    if (assigneeCount.count === 0) {
      const insertAssignee = this.db.prepare('INSERT INTO assignees (name, created_at) VALUES (?, ?)')
      insertAssignee.run('Еремей Корнеплод', now)
      insertAssignee.run('Алебастр Гаврилов', now)
    }

    // Insert sample statuses if table is empty
    const statusCount = this.db.prepare('SELECT COUNT(*) as count FROM card_statuses').get() as { count: number }
    if (statusCount.count === 0) {
      const insertStatus = this.db.prepare('INSERT INTO card_statuses (name, color, created_at) VALUES (?, ?, ?)')
      insertStatus.run('ожидаем назначения', '#FEF3C7', now)
      insertStatus.run('интервью назначено', '#DBEAFE', now)
      insertStatus.run('завершено', '#D1FAE5', now)
    }

    // Insert default columns if none exist (except closed)
    const columnCount = this.db.prepare('SELECT COUNT(*) as count FROM columns WHERE is_closed_column = 0').get() as { count: number }
    if (columnCount.count === 0) {
      const insertColumn = this.db.prepare(`
        INSERT INTO columns (id, name, position, color, is_closed_column, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, ?, ?)
      `)
      insertColumn.run(uuidv4(), 'Новые', 0, '#EBF5FB', now, now)
      insertColumn.run(uuidv4(), 'В работе', 1, '#FEF5E7', now, now)
      insertColumn.run(uuidv4(), 'На проверке', 2, '#F4ECF7', now, now)
    }
  }

  private updateSyncMetadata(userName?: string): void {
    const now = new Date().toISOString()
    this.db.prepare(`
      UPDATE sync_metadata SET last_modified_at = ?, last_modified_by = ? WHERE id = 1
    `).run(now, userName || null)
  }

  // COLUMNS CRUD

  getAllColumns(): Column[] {
    const rows = this.db.prepare(`
      SELECT id, name, position, color, is_closed_column as isClosedColumn, created_at as createdAt, updated_at as updatedAt
      FROM columns ORDER BY position ASC
    `).all() as Column[]
    return rows.map(row => ({
      ...row,
      isClosedColumn: Boolean(row.isClosedColumn)
    }))
  }

  createColumn(params: CreateColumnParams): Column {
    const now = new Date().toISOString()
    const id = uuidv4()

    // Get max position (excluding closed column)
    const maxPos = this.db.prepare(
      'SELECT MAX(position) as maxPos FROM columns WHERE is_closed_column = 0'
    ).get() as { maxPos: number | null }

    const position = params.position ?? (maxPos?.maxPos ?? -1) + 1

    this.db.prepare(`
      INSERT INTO columns (id, name, position, color, is_closed_column, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(id, params.name, position, params.color || null, now, now)

    this.updateSyncMetadata()

    return {
      id,
      name: params.name,
      position,
      color: params.color,
      isClosedColumn: false,
      createdAt: now,
      updatedAt: now
    }
  }

  updateColumn(params: UpdateColumnParams): Column {
    const now = new Date().toISOString()
    const updates: string[] = []
    const values: unknown[] = []

    if (params.updates.name !== undefined) {
      updates.push('name = ?')
      values.push(params.updates.name)
    }
    if (params.updates.position !== undefined) {
      updates.push('position = ?')
      values.push(params.updates.position)
    }
    if (params.updates.color !== undefined) {
      updates.push('color = ?')
      values.push(params.updates.color)
    }

    updates.push('updated_at = ?')
    values.push(now)
    values.push(params.id)

    this.db.prepare(`
      UPDATE columns SET ${updates.join(', ')} WHERE id = ?
    `).run(...values)

    this.updateSyncMetadata()

    return this.getColumnById(params.id)!
  }

  getColumnById(id: string): Column | null {
    const row = this.db.prepare(`
      SELECT id, name, position, color, is_closed_column as isClosedColumn, created_at as createdAt, updated_at as updatedAt
      FROM columns WHERE id = ?
    `).get(id) as Column | undefined

    if (!row) return null

    return {
      ...row,
      isClosedColumn: Boolean(row.isClosedColumn)
    }
  }

  deleteColumn(id: string): boolean {
    // Check if it's the closed column
    const column = this.getColumnById(id)
    if (!column || column.isClosedColumn) {
      return false
    }

    // Get the first column to move cards to
    const firstColumn = this.db.prepare(`
      SELECT id FROM columns WHERE is_closed_column = 0 AND id != ? ORDER BY position ASC LIMIT 1
    `).get(id) as { id: string } | undefined

    if (firstColumn) {
      // Move cards to first column
      this.db.prepare(`
        UPDATE cards SET column_id = ? WHERE column_id = ?
      `).run(firstColumn.id, id)
    }

    this.db.prepare('DELETE FROM columns WHERE id = ?').run(id)
    this.updateSyncMetadata()

    return true
  }

  reorderColumns(columnIds: string[]): void {
    const update = this.db.prepare('UPDATE columns SET position = ? WHERE id = ?')
    const transaction = this.db.transaction(() => {
      columnIds.forEach((id, index) => {
        update.run(index, id)
      })
    })
    transaction()
    this.updateSyncMetadata()
  }

  // CARDS CRUD

  getAllCards(includeArchived: boolean = false): Card[] {
    const where = includeArchived ? '' : 'WHERE is_archived = 0'
    const rows = this.db.prepare(`
      SELECT uid, stream, department, planned_interview_date as plannedInterviewDate,
             actual_status as actualStatus, column_id as columnId, position, color,
             created_at as createdAt, updated_at as updatedAt, updated_by as updatedBy,
             is_archived as isArchived, archived_at as archivedAt,
             auto_archive_scheduled_at as autoArchiveScheduledAt
      FROM cards ${where}
      ORDER BY column_id, position ASC
    `).all() as Card[]

    // Get assignees for each card
    return rows.map(card => ({
      ...card,
      isArchived: Boolean(card.isArchived),
      assignees: this.getCardAssignees(card.uid),
      customAttributes: this.getCardCustomAttributes(card.uid)
    }))
  }

  getArchivedCards(filters?: CardFilters): Card[] {
    let query = `
      SELECT uid, stream, department, planned_interview_date as plannedInterviewDate,
             actual_status as actualStatus, column_id as columnId, position, color,
             created_at as createdAt, updated_at as updatedAt, updated_by as updatedBy,
             is_archived as isArchived, archived_at as archivedAt,
             auto_archive_scheduled_at as autoArchiveScheduledAt
      FROM cards WHERE is_archived = 1
    `
    const params: unknown[] = []

    if (filters?.search) {
      query += ` AND (stream LIKE ? OR department LIKE ?)`
      params.push(`%${filters.search}%`, `%${filters.search}%`)
    }
    if (filters?.streams?.length) {
      query += ` AND stream IN (${filters.streams.map(() => '?').join(',')})`
      params.push(...filters.streams)
    }
    if (filters?.dateFrom) {
      query += ` AND archived_at >= ?`
      params.push(filters.dateFrom)
    }
    if (filters?.dateTo) {
      query += ` AND archived_at <= ?`
      params.push(filters.dateTo)
    }

    query += ` ORDER BY archived_at DESC`

    const rows = this.db.prepare(query).all(...params) as Card[]

    return rows.map(card => ({
      ...card,
      isArchived: Boolean(card.isArchived),
      assignees: this.getCardAssignees(card.uid),
      customAttributes: this.getCardCustomAttributes(card.uid)
    }))
  }

  private getCardAssignees(cardUid: string): string[] {
    const rows = this.db.prepare(`
      SELECT assignee_name FROM card_assignees WHERE card_uid = ?
    `).all(cardUid) as { assignee_name: string }[]
    return rows.map(r => r.assignee_name)
  }

  createCard(params: CreateCardParams, userName?: string): Card {
    const now = new Date().toISOString()
    const uid = uuidv4()

    // Get max position in target column
    const maxPos = this.db.prepare(
      'SELECT MAX(position) as maxPos FROM cards WHERE column_id = ? AND is_archived = 0'
    ).get(params.columnId) as { maxPos: number | null }

    const position = (maxPos?.maxPos ?? -1) + 1

    // Check if target column is closed
    const column = this.getColumnById(params.columnId)
    const autoArchiveScheduledAt = column?.isClosedColumn
      ? new Date(Date.now() + this.getAutoArchiveDelay() * 60000).toISOString()
      : null

    this.db.prepare(`
      INSERT INTO cards (uid, stream, department, planned_interview_date, actual_status,
                        column_id, position, color, created_at, updated_at, updated_by,
                        is_archived, auto_archive_scheduled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      uid, params.stream, params.department, params.plannedInterviewDate,
      params.actualStatus, params.columnId, position, params.color || null,
      now, now, userName || null, autoArchiveScheduledAt
    )

    // Insert assignees
    if (params.assignees?.length) {
      const insertAssignee = this.db.prepare(`
        INSERT INTO card_assignees (card_uid, assignee_name, created_at) VALUES (?, ?, ?)
      `)
      for (const assignee of params.assignees) {
        insertAssignee.run(uid, assignee, now)
      }
    }

    this.updateSyncMetadata(userName)

    return {
      uid,
      stream: params.stream,
      department: params.department,
      plannedInterviewDate: params.plannedInterviewDate,
      actualStatus: params.actualStatus,
      columnId: params.columnId,
      position,
      color: params.color,
      createdAt: now,
      updatedAt: now,
      updatedBy: userName,
      isArchived: false,
      assignees: params.assignees || [],
      autoArchiveScheduledAt: autoArchiveScheduledAt || undefined
    }
  }

  updateCard(params: UpdateCardParams, userName?: string): Card {
    const now = new Date().toISOString()
    const { uid, updates, expectedUpdatedAt } = params

    // Check for conflicts if expectedUpdatedAt provided
    if (expectedUpdatedAt) {
      const current = this.db.prepare('SELECT updated_at FROM cards WHERE uid = ?').get(uid) as { updated_at: string } | undefined
      if (current && current.updated_at !== expectedUpdatedAt) {
        throw new Error('CONFLICT: Card was modified by another user')
      }
    }

    const updateFields: string[] = []
    const values: unknown[] = []

    if (updates.stream !== undefined) {
      updateFields.push('stream = ?')
      values.push(updates.stream)
    }
    if (updates.department !== undefined) {
      updateFields.push('department = ?')
      values.push(updates.department)
    }
    if (updates.plannedInterviewDate !== undefined) {
      updateFields.push('planned_interview_date = ?')
      values.push(updates.plannedInterviewDate)
    }
    if (updates.actualStatus !== undefined) {
      updateFields.push('actual_status = ?')
      values.push(updates.actualStatus)
    }
    if (updates.columnId !== undefined) {
      updateFields.push('column_id = ?')
      values.push(updates.columnId)

      // Check if moving to closed column
      const column = this.getColumnById(updates.columnId)
      if (column?.isClosedColumn) {
        updateFields.push('auto_archive_scheduled_at = ?')
        values.push(new Date(Date.now() + this.getAutoArchiveDelay() * 60000).toISOString())
      } else {
        updateFields.push('auto_archive_scheduled_at = ?')
        values.push(null)
      }
    }
    if (updates.position !== undefined) {
      updateFields.push('position = ?')
      values.push(updates.position)
    }
    if (updates.color !== undefined) {
      updateFields.push('color = ?')
      values.push(updates.color)
    }

    updateFields.push('updated_at = ?')
    values.push(now)
    updateFields.push('updated_by = ?')
    values.push(userName || null)

    values.push(uid)

    if (updateFields.length > 2) {
      this.db.prepare(`
        UPDATE cards SET ${updateFields.join(', ')} WHERE uid = ?
      `).run(...values)
    }

    // Update assignees if provided
    if (updates.assignees !== undefined) {
      this.db.prepare('DELETE FROM card_assignees WHERE card_uid = ?').run(uid)
      if (updates.assignees.length) {
        const insertAssignee = this.db.prepare(`
          INSERT INTO card_assignees (card_uid, assignee_name, created_at) VALUES (?, ?, ?)
        `)
        for (const assignee of updates.assignees) {
          insertAssignee.run(uid, assignee, now)
        }
      }
    }

    this.updateSyncMetadata(userName)

    return this.getCardByUid(uid)!
  }

  getCardByUid(uid: string): Card | null {
    const row = this.db.prepare(`
      SELECT uid, stream, department, planned_interview_date as plannedInterviewDate,
             actual_status as actualStatus, column_id as columnId, position, color,
             created_at as createdAt, updated_at as updatedAt, updated_by as updatedBy,
             is_archived as isArchived, archived_at as archivedAt,
             auto_archive_scheduled_at as autoArchiveScheduledAt
      FROM cards WHERE uid = ?
    `).get(uid) as Card | undefined

    if (!row) return null

    return {
      ...row,
      isArchived: Boolean(row.isArchived),
      assignees: this.getCardAssignees(uid),
      customAttributes: this.getCardCustomAttributes(uid)
    }
  }

  deleteCard(uid: string): boolean {
    this.db.prepare('DELETE FROM cards WHERE uid = ?').run(uid)
    this.updateSyncMetadata()
    return true
  }

  moveCard(params: MoveCardParams, userName?: string): void {
    const { cardUid, targetColumnId, targetPosition } = params
    const now = new Date().toISOString()

    // Shift other cards in target column
    this.db.prepare(`
      UPDATE cards SET position = position + 1
      WHERE column_id = ? AND position >= ? AND is_archived = 0
    `).run(targetColumnId, targetPosition)

    // Check if moving to closed column
    const column = this.getColumnById(targetColumnId)
    const autoArchiveScheduledAt = column?.isClosedColumn
      ? new Date(Date.now() + this.getAutoArchiveDelay() * 60000).toISOString()
      : null

    // Move card
    this.db.prepare(`
      UPDATE cards SET column_id = ?, position = ?, updated_at = ?, updated_by = ?, auto_archive_scheduled_at = ?
      WHERE uid = ?
    `).run(targetColumnId, targetPosition, now, userName || null, autoArchiveScheduledAt, cardUid)

    this.updateSyncMetadata(userName)
  }

  archiveCard(uid: string, userName?: string): void {
    const now = new Date().toISOString()
    this.db.prepare(`
      UPDATE cards SET is_archived = 1, archived_at = ?, auto_archive_scheduled_at = NULL,
                      updated_at = ?, updated_by = ?
      WHERE uid = ?
    `).run(now, now, userName || null, uid)
    this.updateSyncMetadata(userName)
  }

  restoreCard(uid: string, userName?: string): Card {
    const now = new Date().toISOString()

    // Get first non-closed column
    const firstColumn = this.db.prepare(`
      SELECT id FROM columns WHERE is_closed_column = 0 ORDER BY position ASC LIMIT 1
    `).get() as { id: string } | undefined

    if (!firstColumn) {
      throw new Error('No column available to restore card')
    }

    // Get max position in that column
    const maxPos = this.db.prepare(
      'SELECT MAX(position) as maxPos FROM cards WHERE column_id = ? AND is_archived = 0'
    ).get(firstColumn.id) as { maxPos: number | null }

    this.db.prepare(`
      UPDATE cards SET is_archived = 0, archived_at = NULL, column_id = ?, position = ?,
                      updated_at = ?, updated_by = ?
      WHERE uid = ?
    `).run(firstColumn.id, (maxPos?.maxPos ?? -1) + 1, now, userName || null, uid)

    this.updateSyncMetadata(userName)

    return this.getCardByUid(uid)!
  }

  getCardsToAutoArchive(): Card[] {
    const now = new Date().toISOString()
    const rows = this.db.prepare(`
      SELECT uid, stream, department, planned_interview_date as plannedInterviewDate,
             actual_status as actualStatus, column_id as columnId, position, color,
             created_at as createdAt, updated_at as updatedAt, updated_by as updatedBy,
             is_archived as isArchived, archived_at as archivedAt,
             auto_archive_scheduled_at as autoArchiveScheduledAt
      FROM cards
      WHERE auto_archive_scheduled_at IS NOT NULL
        AND auto_archive_scheduled_at <= ?
        AND is_archived = 0
    `).all(now) as Card[]

    return rows.map(card => ({
      ...card,
      isArchived: Boolean(card.isArchived),
      assignees: this.getCardAssignees(card.uid),
      customAttributes: this.getCardCustomAttributes(card.uid)
    }))
  }

  // STREAMS CRUD

  getAllStreams(): Stream[] {
    return this.db.prepare(`
      SELECT id, name, color, created_at as createdAt FROM streams ORDER BY name ASC
    `).all() as Stream[]
  }

  createStream(name: string, color?: string): Stream {
    const now = new Date().toISOString()
    const result = this.db.prepare(`
      INSERT INTO streams (name, color, created_at) VALUES (?, ?, ?)
    `).run(name, color || null, now)

    this.updateSyncMetadata()

    return {
      id: result.lastInsertRowid as number,
      name,
      color,
      createdAt: now
    }
  }

  updateStream(id: number, name: string, color?: string): Stream {
    this.db.prepare('UPDATE streams SET name = ?, color = ? WHERE id = ?').run(name, color || null, id)
    this.updateSyncMetadata()
    return this.db.prepare('SELECT id, name, color, created_at as createdAt FROM streams WHERE id = ?').get(id) as Stream
  }

  deleteStream(id: number): { success: boolean; cardsCount?: number } {
    const stream = this.db.prepare('SELECT name FROM streams WHERE id = ?').get(id) as { name: string } | undefined
    if (!stream) return { success: false }

    const cardsCount = this.db.prepare('SELECT COUNT(*) as count FROM cards WHERE stream = ?').get(stream.name) as { count: number }
    if (cardsCount.count > 0) {
      return { success: false, cardsCount: cardsCount.count }
    }

    this.db.prepare('DELETE FROM streams WHERE id = ?').run(id)
    this.updateSyncMetadata()
    return { success: true }
  }

  // ASSIGNEES CRUD

  getAllAssignees(): Assignee[] {
    return this.db.prepare(`
      SELECT id, name, email, position, created_at as createdAt FROM assignees ORDER BY name ASC
    `).all() as Assignee[]
  }

  createAssignee(name: string, email?: string, position?: string): Assignee {
    const now = new Date().toISOString()
    const result = this.db.prepare(`
      INSERT INTO assignees (name, email, position, created_at) VALUES (?, ?, ?, ?)
    `).run(name, email || null, position || null, now)

    this.updateSyncMetadata()

    return {
      id: result.lastInsertRowid as number,
      name,
      email,
      position,
      createdAt: now
    }
  }

  updateAssignee(id: number, name: string, email?: string, position?: string): Assignee {
    // Get old name for updating card_assignees
    const oldAssignee = this.db.prepare('SELECT name FROM assignees WHERE id = ?').get(id) as { name: string } | undefined

    this.db.prepare('UPDATE assignees SET name = ?, email = ?, position = ? WHERE id = ?')
      .run(name, email || null, position || null, id)

    // Update card_assignees if name changed
    if (oldAssignee && oldAssignee.name !== name) {
      this.db.prepare('UPDATE card_assignees SET assignee_name = ? WHERE assignee_name = ?')
        .run(name, oldAssignee.name)
    }

    this.updateSyncMetadata()
    return this.db.prepare('SELECT id, name, email, position, created_at as createdAt FROM assignees WHERE id = ?').get(id) as Assignee
  }

  deleteAssignee(id: number): { success: boolean; cardsCount?: number } {
    const assignee = this.db.prepare('SELECT name FROM assignees WHERE id = ?').get(id) as { name: string } | undefined
    if (!assignee) return { success: false }

    const cardsCount = this.db.prepare('SELECT COUNT(*) as count FROM card_assignees WHERE assignee_name = ?').get(assignee.name) as { count: number }
    if (cardsCount.count > 0) {
      return { success: false, cardsCount: cardsCount.count }
    }

    this.db.prepare('DELETE FROM assignees WHERE id = ?').run(id)
    this.updateSyncMetadata()
    return { success: true }
  }

  // CARD STATUSES CRUD

  getAllCardStatuses(): CardStatus[] {
    return this.db.prepare(`
      SELECT id, name, color, created_at as createdAt FROM card_statuses ORDER BY name ASC
    `).all() as CardStatus[]
  }

  createCardStatus(name: string, color?: string): CardStatus {
    const now = new Date().toISOString()
    const result = this.db.prepare(`
      INSERT INTO card_statuses (name, color, created_at) VALUES (?, ?, ?)
    `).run(name, color || null, now)

    this.updateSyncMetadata()

    return {
      id: result.lastInsertRowid as number,
      name,
      color,
      createdAt: now
    }
  }

  updateCardStatus(id: number, name: string, color?: string): CardStatus {
    // Get old name for updating cards
    const oldStatus = this.db.prepare('SELECT name FROM card_statuses WHERE id = ?').get(id) as { name: string } | undefined

    this.db.prepare('UPDATE card_statuses SET name = ?, color = ? WHERE id = ?').run(name, color || null, id)

    // Update cards if name changed
    if (oldStatus && oldStatus.name !== name) {
      this.db.prepare('UPDATE cards SET actual_status = ? WHERE actual_status = ?')
        .run(name, oldStatus.name)
    }

    this.updateSyncMetadata()
    return this.db.prepare('SELECT id, name, color, created_at as createdAt FROM card_statuses WHERE id = ?').get(id) as CardStatus
  }

  deleteCardStatus(id: number): { success: boolean; cardsCount?: number } {
    const status = this.db.prepare('SELECT name FROM card_statuses WHERE id = ?').get(id) as { name: string } | undefined
    if (!status) return { success: false }

    const cardsCount = this.db.prepare('SELECT COUNT(*) as count FROM cards WHERE actual_status = ?').get(status.name) as { count: number }
    if (cardsCount.count > 0) {
      return { success: false, cardsCount: cardsCount.count }
    }

    this.db.prepare('DELETE FROM card_statuses WHERE id = ?').run(id)
    this.updateSyncMetadata()
    return { success: true }
  }

  // APP SETTINGS

  getAppSettings(): AppSettings {
    const rows = this.db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[]
    const settings: Record<string, string> = {}
    for (const row of rows) {
      settings[row.key] = row.value
    }

    return {
      autoArchiveDelayMinutes: parseInt(settings.auto_archive_delay_minutes || '10'),
      currentUserName: settings.current_user_name || 'Пользователь',
      theme: (settings.theme as AppSettings['theme']) || 'light'
    }
  }

  updateAppSetting(key: string, value: string): void {
    const now = new Date().toISOString()
    this.db.prepare(`
      INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
    `).run(key, value, now)
    this.updateSyncMetadata()
  }

  private getAutoArchiveDelay(): number {
    const setting = this.db.prepare('SELECT value FROM app_settings WHERE key = ?').get('auto_archive_delay_minutes') as { value: string } | undefined
    return parseInt(setting?.value || '10')
  }

  // SYNC METADATA

  getSyncMetadata(): SyncMetadata {
    const row = this.db.prepare(`
      SELECT last_modified_at as lastModifiedAt, last_modified_by as lastModifiedBy, db_version as dbVersion
      FROM sync_metadata WHERE id = 1
    `).get() as SyncMetadata
    return row
  }

  // DATABASE VALIDATION

  static validateDatabase(dbPath: string): boolean {
    try {
      const db = new Database(dbPath, { readonly: true })
      const result = db.pragma('integrity_check')
      db.close()
      return result[0]?.integrity_check === 'ok'
    } catch {
      return false
    }
  }

  close(): void {
    this.db.close()
  }

  getDbPath(): string {
    return this.dbPath
  }

  // CUSTOM ATTRIBUTE DEFINITIONS CRUD

  getAllCustomAttributeDefinitions(): CustomAttributeDefinition[] {
    return this.db.prepare(`
      SELECT id, name, type, created_at as createdAt
      FROM custom_attribute_definitions ORDER BY name ASC
    `).all() as CustomAttributeDefinition[]
  }

  createCustomAttributeDefinition(name: string, type: CustomAttributeType): CustomAttributeDefinition {
    const now = new Date().toISOString()
    const result = this.db.prepare(`
      INSERT INTO custom_attribute_definitions (name, type, created_at) VALUES (?, ?, ?)
    `).run(name, type, now)

    this.updateSyncMetadata()

    return {
      id: result.lastInsertRowid as number,
      name,
      type,
      createdAt: now
    }
  }

  updateCustomAttributeDefinition(id: number, name: string): CustomAttributeDefinition {
    this.db.prepare('UPDATE custom_attribute_definitions SET name = ? WHERE id = ?').run(name, id)
    this.updateSyncMetadata()
    return this.db.prepare(
      'SELECT id, name, type, created_at as createdAt FROM custom_attribute_definitions WHERE id = ?'
    ).get(id) as CustomAttributeDefinition
  }

  deleteCustomAttributeDefinition(id: number): boolean {
    // Delete all card values for this attribute
    this.db.prepare('DELETE FROM card_custom_attributes WHERE attribute_id = ?').run(id)
    // Delete the definition
    this.db.prepare('DELETE FROM custom_attribute_definitions WHERE id = ?').run(id)
    this.updateSyncMetadata()
    return true
  }

  // CARD CUSTOM ATTRIBUTES CRUD

  getCardCustomAttributes(cardUid: string): CardCustomAttribute[] {
    return this.db.prepare(`
      SELECT cca.attribute_id as attributeId, cad.name as attributeName,
             cad.type as attributeType, cca.value
      FROM card_custom_attributes cca
      JOIN custom_attribute_definitions cad ON cca.attribute_id = cad.id
      WHERE cca.card_uid = ?
    `).all(cardUid) as CardCustomAttribute[]
  }

  setCardCustomAttribute(cardUid: string, attributeId: number, value: string | null): void {
    const now = new Date().toISOString()
    this.db.prepare(`
      INSERT OR REPLACE INTO card_custom_attributes (card_uid, attribute_id, value, created_at)
      VALUES (?, ?, ?, ?)
    `).run(cardUid, attributeId, value, now)
    this.updateSyncMetadata()
  }

  removeCardCustomAttribute(cardUid: string, attributeId: number): void {
    this.db.prepare('DELETE FROM card_custom_attributes WHERE card_uid = ? AND attribute_id = ?')
      .run(cardUid, attributeId)
    this.updateSyncMetadata()
  }

  // Get all unique departments for filtering
  getAllDepartments(): string[] {
    const rows = this.db.prepare(`
      SELECT DISTINCT department FROM cards WHERE is_archived = 0 ORDER BY department ASC
    `).all() as { department: string }[]
    return rows.map(r => r.department)
  }

  // Bulk import for streams (CSV/Excel)
  importStreams(names: string[]): { imported: number; skipped: number } {
    const now = new Date().toISOString()
    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO streams (name, created_at) VALUES (?, ?)
    `)

    let imported = 0
    let skipped = 0

    const transaction = this.db.transaction(() => {
      for (const name of names) {
        const trimmed = name.trim()
        if (trimmed) {
          const result = insertStmt.run(trimmed, now)
          if (result.changes > 0) {
            imported++
          } else {
            skipped++
          }
        }
      }
    })

    transaction()
    this.updateSyncMetadata()

    return { imported, skipped }
  }

  // Bulk import for assignees
  importAssignees(names: string[]): { imported: number; skipped: number } {
    const now = new Date().toISOString()
    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO assignees (name, created_at) VALUES (?, ?)
    `)

    let imported = 0
    let skipped = 0

    const transaction = this.db.transaction(() => {
      for (const name of names) {
        const trimmed = name.trim()
        if (trimmed) {
          const result = insertStmt.run(trimmed, now)
          if (result.changes > 0) {
            imported++
          } else {
            skipped++
          }
        }
      }
    })

    transaction()
    this.updateSyncMetadata()

    return { imported, skipped }
  }

  // Bulk import for card statuses
  importCardStatuses(names: string[]): { imported: number; skipped: number } {
    const now = new Date().toISOString()
    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO card_statuses (name, created_at) VALUES (?, ?)
    `)

    let imported = 0
    let skipped = 0

    const transaction = this.db.transaction(() => {
      for (const name of names) {
        const trimmed = name.trim()
        if (trimmed) {
          const result = insertStmt.run(trimmed, now)
          if (result.changes > 0) {
            imported++
          } else {
            skipped++
          }
        }
      }
    })

    transaction()
    this.updateSyncMetadata()

    return { imported, skipped }
  }
}
