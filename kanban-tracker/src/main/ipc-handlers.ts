import { ipcMain, dialog, shell } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { DatabaseManager } from './database'
import { ConfigManager } from './config'
import type {
  CreateCardParams,
  UpdateCardParams,
  CreateColumnParams,
  UpdateColumnParams,
  MoveCardParams,
  CardFilters,
  ExportOptions
} from '../shared/types'
import * as XLSX from 'xlsx'

interface IpcContext {
  getDatabaseManager: () => DatabaseManager | null
  getConfigManager: () => ConfigManager
  setDatabaseManager: (manager: DatabaseManager) => void
  startWatcher: (dbPath: string) => void
  startAutoArchive: () => void
}

export function setupIpcHandlers(context: IpcContext): void {
  const { getDatabaseManager, getConfigManager, setDatabaseManager, startWatcher, startAutoArchive } = context

  // Helper to ensure database is connected
  const withDatabase = <T>(handler: (db: DatabaseManager) => T): T => {
    const db = getDatabaseManager()
    if (!db) {
      throw new Error('Database not connected')
    }
    return handler(db)
  }

  // ============ CONFIG HANDLERS ============

  ipcMain.handle('get-config', () => {
    return getConfigManager().loadConfig()
  })

  ipcMain.handle('get-user-id', () => {
    return getConfigManager().getUserId()
  })

  ipcMain.handle('is-database-connected', () => {
    return getDatabaseManager() !== null
  })

  ipcMain.handle('get-database-path', () => {
    const db = getDatabaseManager()
    return db ? db.getDbPath() : null
  })

  ipcMain.handle('create-new-database', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Создать новую базу данных',
      defaultPath: 'kanban.db',
      filters: [
        { name: 'SQLite Database', extensions: ['db'] }
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    })

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Cancelled' }
    }

    const dbPath = result.filePath

    try {
      // Ensure directory exists
      const dir = dirname(dbPath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      // Create and initialize database
      const db = new DatabaseManager(dbPath)
      db.initialize()
      setDatabaseManager(db)

      // Save config and add to recent databases
      const configManager = getConfigManager()
      configManager.saveConfig({ ...configManager.loadConfig(), dbPath, isConfigured: true })
      configManager.addRecentDatabase(dbPath)
      configManager.addBoard(dbPath, 'Канбан-доска')

      // Register user as assignee
      const userId = configManager.getUserId()
      const lastUserName = configManager.getLastUserName()
      db.registerUser(userId, lastUserName)

      // Start watcher and auto-archive
      startWatcher(dbPath)
      startAutoArchive()

      return { success: true, dbPath }
    } catch (error) {
      console.error('Failed to create database:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('select-existing-database', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Выбрать существующую базу данных',
      filters: [
        { name: 'SQLite Database', extensions: ['db'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Cancelled' }
    }

    const dbPath = result.filePaths[0]

    try {
      // Validate database
      if (!DatabaseManager.validateDatabase(dbPath)) {
        return { success: false, error: 'Выбранный файл не является валидной базой данных' }
      }

      // Open database
      const db = new DatabaseManager(dbPath)
      db.initialize()
      setDatabaseManager(db)

      // Save config and add to recent databases
      const configManager = getConfigManager()
      configManager.saveConfig({ ...configManager.loadConfig(), dbPath, isConfigured: true })
      configManager.addRecentDatabase(dbPath)
      configManager.addBoard(dbPath, 'Канбан-доска')

      // Register user as assignee
      const userId = configManager.getUserId()
      const lastUserName = configManager.getLastUserName()
      db.registerUser(userId, lastUserName)

      // Start watcher and auto-archive
      startWatcher(dbPath)
      startAutoArchive()

      return { success: true, dbPath }
    } catch (error) {
      console.error('Failed to open database:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('open-recent-database', async (_, dbPath: string) => {
    try {
      // Validate database still exists and is valid
      if (!existsSync(dbPath)) {
        // Remove from recent if file no longer exists
        getConfigManager().removeRecentDatabase(dbPath)
        return { success: false, error: 'Файл базы данных не найден' }
      }

      if (!DatabaseManager.validateDatabase(dbPath)) {
        return { success: false, error: 'Выбранный файл не является валидной базой данных' }
      }

      // Open database
      const db = new DatabaseManager(dbPath)
      db.initialize()
      setDatabaseManager(db)

      // Update config and recent databases
      const configManager = getConfigManager()
      configManager.saveConfig({ ...configManager.loadConfig(), dbPath, isConfigured: true })
      configManager.addRecentDatabase(dbPath) // This updates lastOpenedAt

      // Register user as assignee
      const userId = configManager.getUserId()
      const lastUserName = configManager.getLastUserName()
      db.registerUser(userId, lastUserName)

      // Start watcher and auto-archive
      startWatcher(dbPath)
      startAutoArchive()

      return { success: true, dbPath }
    } catch (error) {
      console.error('Failed to open recent database:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('get-recent-databases', () => {
    return getConfigManager().getRecentDatabases()
  })

  ipcMain.handle('remove-recent-database', (_, dbPath: string) => {
    getConfigManager().removeRecentDatabase(dbPath)
    return { success: true }
  })

  ipcMain.handle('change-database', async () => {
    // Show dialog with options
    const choice = await dialog.showMessageBox({
      type: 'question',
      title: 'Изменить базу данных',
      message: 'Что вы хотите сделать?',
      buttons: ['Создать новую', 'Выбрать существующую', 'Отмена'],
      defaultId: 2
    })

    if (choice.response === 0) {
      return ipcMain.emit('create-new-database')
    } else if (choice.response === 1) {
      return ipcMain.emit('select-existing-database')
    }

    return { success: false, error: 'Cancelled' }
  })

  // ============ COLUMNS HANDLERS ============

  ipcMain.handle('get-all-columns', () => {
    return withDatabase(db => db.getAllColumns())
  })

  ipcMain.handle('create-column', (_, params: CreateColumnParams) => {
    return withDatabase(db => db.createColumn(params))
  })

  ipcMain.handle('update-column', (_, params: UpdateColumnParams) => {
    return withDatabase(db => db.updateColumn(params))
  })

  ipcMain.handle('delete-column', (_, id: string) => {
    return withDatabase(db => db.deleteColumn(id))
  })

  ipcMain.handle('reorder-columns', (_, columnIds: string[]) => {
    return withDatabase(db => db.reorderColumns(columnIds))
  })

  // ============ CARDS HANDLERS ============

  ipcMain.handle('get-all-cards', (_, includeArchived?: boolean) => {
    return withDatabase(db => db.getAllCards(includeArchived))
  })

  ipcMain.handle('get-archived-cards', (_, filters?: CardFilters) => {
    return withDatabase(db => db.getArchivedCards(filters))
  })

  ipcMain.handle('get-card', (_, uid: string) => {
    return withDatabase(db => db.getCardByUid(uid))
  })

  ipcMain.handle('create-card', (_, params: CreateCardParams, userName?: string) => {
    return withDatabase(db => db.createCard(params, userName))
  })

  ipcMain.handle('update-card', (_, params: UpdateCardParams, userName?: string) => {
    return withDatabase(db => db.updateCard(params, userName))
  })

  ipcMain.handle('delete-card', (_, uid: string) => {
    return withDatabase(db => db.deleteCard(uid))
  })

  ipcMain.handle('move-card', (_, params: MoveCardParams, userName?: string) => {
    return withDatabase(db => db.moveCard(params, userName))
  })

  ipcMain.handle('archive-card', (_, uid: string, userName?: string) => {
    return withDatabase(db => db.archiveCard(uid, userName))
  })

  ipcMain.handle('restore-card', (_, uid: string, userName?: string) => {
    return withDatabase(db => db.restoreCard(uid, userName))
  })

  // ============ STREAMS HANDLERS ============

  ipcMain.handle('get-all-streams', () => {
    return withDatabase(db => db.getAllStreams())
  })

  ipcMain.handle('create-stream', (_, name: string, color?: string) => {
    return withDatabase(db => db.createStream(name, color))
  })

  ipcMain.handle('update-stream', (_, id: number, name: string, color?: string) => {
    return withDatabase(db => db.updateStream(id, name, color))
  })

  ipcMain.handle('delete-stream', (_, id: number) => {
    return withDatabase(db => db.deleteStream(id))
  })

  // ============ ASSIGNEES HANDLERS ============

  ipcMain.handle('get-all-assignees', () => {
    return withDatabase(db => db.getAllAssignees())
  })

  ipcMain.handle('create-assignee', (_, name: string, email?: string, position?: string) => {
    return withDatabase(db => db.createAssignee(name, email, position))
  })

  ipcMain.handle('update-assignee', (_, id: number, name: string, email?: string, position?: string) => {
    return withDatabase(db => db.updateAssignee(id, name, email, position))
  })

  ipcMain.handle('delete-assignee', (_, id: number) => {
    return withDatabase(db => db.deleteAssignee(id))
  })

  ipcMain.handle('register-user', (_, userId: string, defaultName?: string) => {
    return withDatabase(db => db.registerUser(userId, defaultName))
  })

  ipcMain.handle('update-user-name', (_, userId: string, newName: string) => {
    return withDatabase(db => db.updateUserName(userId, newName))
  })

  ipcMain.handle('get-assignee-by-user-id', (_, userId: string) => {
    return withDatabase(db => db.getAssigneeByUserId(userId))
  })

  // ============ CARD STATUSES HANDLERS ============

  ipcMain.handle('get-all-card-statuses', () => {
    return withDatabase(db => db.getAllCardStatuses())
  })

  ipcMain.handle('create-card-status', (_, name: string, color?: string) => {
    return withDatabase(db => db.createCardStatus(name, color))
  })

  ipcMain.handle('update-card-status', (_, id: number, name: string, color?: string) => {
    return withDatabase(db => db.updateCardStatus(id, name, color))
  })

  ipcMain.handle('delete-card-status', (_, id: number) => {
    return withDatabase(db => db.deleteCardStatus(id))
  })

  // ============ APP SETTINGS HANDLERS ============

  ipcMain.handle('get-app-settings', () => {
    return withDatabase(db => db.getAppSettings())
  })

  ipcMain.handle('update-app-setting', (_, key: string, value: string) => {
    return withDatabase(db => db.updateAppSetting(key, value))
  })

  // ============ SYNC HANDLERS ============

  ipcMain.handle('get-sync-metadata', () => {
    return withDatabase(db => db.getSyncMetadata())
  })

  // ============ EXPORT HANDLERS ============

  ipcMain.handle('export-data', async (_, options: ExportOptions) => {
    const db = getDatabaseManager()
    if (!db) {
      return { success: false, error: 'Database not connected' }
    }

    try {
      const cards = options.includeArchived
        ? db.getAllCards(true)
        : db.getAllCards(false)

      // Prepare data for export
      const exportData = cards.map(card => ({
        'ID': card.uid,
        'Стрим': card.stream,
        'Отдел': card.department,
        'Ответственные': card.assignees.join(', '),
        'Дата интервью': card.plannedInterviewDate || '',
        'Статус': card.actualStatus,
        'Архивирована': card.isArchived ? 'Да' : 'Нет',
        'Дата создания': card.createdAt,
        'Дата обновления': card.updatedAt,
        'Обновлено': card.updatedBy || ''
      }))

      // Create workbook
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)
      XLSX.utils.book_append_sheet(wb, ws, 'Карточки')

      // Show save dialog
      const result = await dialog.showSaveDialog({
        title: 'Экспорт данных',
        defaultPath: `kanban-export-${new Date().toISOString().split('T')[0]}.${options.format}`,
        filters: [
          options.format === 'xlsx'
            ? { name: 'Excel', extensions: ['xlsx'] }
            : { name: 'CSV', extensions: ['csv'] }
        ]
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Cancelled' }
      }

      // Write file
      XLSX.writeFile(wb, result.filePath, {
        bookType: options.format === 'xlsx' ? 'xlsx' : 'csv'
      })

      return { success: true, filePath: result.filePath }
    } catch (error) {
      console.error('Export failed:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // ============ UTILITY HANDLERS ============

  ipcMain.handle('open-logs-folder', () => {
    const logsPath = getConfigManager().getLogsPath()
    shell.openPath(logsPath)
  })

  ipcMain.handle('show-message-box', async (_, options: Electron.MessageBoxOptions) => {
    return dialog.showMessageBox(options)
  })

  ipcMain.handle('reset-config', () => {
    getConfigManager().resetConfig()
    return { success: true }
  })

  // ============ BOARD MANAGEMENT HANDLERS ============

  ipcMain.handle('get-boards', () => {
    return getConfigManager().getBoards()
  })

  ipcMain.handle('get-current-board', () => {
    return getConfigManager().getCurrentBoard()
  })

  ipcMain.handle('add-board', (_, dbPath: string, displayName: string) => {
    const board = getConfigManager().addBoard(dbPath, displayName)
    return { success: true, board }
  })

  ipcMain.handle('update-board', (_, boardId: string, displayName: string) => {
    getConfigManager().updateBoard(boardId, displayName)
    return { success: true }
  })

  ipcMain.handle('delete-board', (_, boardId: string) => {
    getConfigManager().deleteBoard(boardId)
    return { success: true }
  })

  ipcMain.handle('switch-board', async (_, boardId: string) => {
    const configManager = getConfigManager()
    const boards = configManager.getBoards()
    const board = boards.find(b => b.id === boardId)

    if (!board) {
      return { success: false, error: 'Доска не найдена' }
    }

    try {
      // Validate database still exists
      if (!existsSync(board.dbPath)) {
        return { success: false, error: 'Файл базы данных не найден' }
      }

      if (!DatabaseManager.validateDatabase(board.dbPath)) {
        return { success: false, error: 'База данных повреждена' }
      }

      // Open new database
      const db = new DatabaseManager(board.dbPath)
      db.initialize()
      setDatabaseManager(db)

      // Update current board
      configManager.setCurrentBoard(boardId)
      configManager.saveConfig({ ...configManager.loadConfig(), dbPath: board.dbPath, isConfigured: true })

      // Start watcher and auto-archive
      startWatcher(board.dbPath)
      startAutoArchive()

      return { success: true, board }
    } catch (error) {
      console.error('Failed to switch board:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // ============ CUSTOM ATTRIBUTES HANDLERS ============

  ipcMain.handle('get-all-custom-attribute-definitions', () => {
    return withDatabase(db => db.getAllCustomAttributeDefinitions())
  })

  ipcMain.handle('create-custom-attribute-definition', (_, name: string, type: string) => {
    return withDatabase(db => db.createCustomAttributeDefinition(name, type as 'text' | 'number' | 'date' | 'boolean'))
  })

  ipcMain.handle('update-custom-attribute-definition', (_, id: number, name: string) => {
    return withDatabase(db => db.updateCustomAttributeDefinition(id, name))
  })

  ipcMain.handle('delete-custom-attribute-definition', (_, id: number) => {
    return withDatabase(db => db.deleteCustomAttributeDefinition(id))
  })

  ipcMain.handle('get-card-custom-attributes', (_, cardUid: string) => {
    return withDatabase(db => db.getCardCustomAttributes(cardUid))
  })

  ipcMain.handle('set-card-custom-attribute', (_, cardUid: string, attributeId: number, value: string | null) => {
    return withDatabase(db => {
      db.setCardCustomAttribute(cardUid, attributeId, value)
      return { success: true }
    })
  })

  ipcMain.handle('remove-card-custom-attribute', (_, cardUid: string, attributeId: number) => {
    return withDatabase(db => {
      db.removeCardCustomAttribute(cardUid, attributeId)
      return { success: true }
    })
  })

  // ============ FILTERING DATA HANDLERS ============

  ipcMain.handle('get-all-departments', () => {
    return withDatabase(db => db.getAllDepartments())
  })

  // ============ IMPORT HANDLERS ============

  ipcMain.handle('import-list-from-file', async (_, listType: 'streams' | 'assignees' | 'statuses') => {
    const result = await dialog.showOpenDialog({
      title: 'Импортировать список из файла',
      filters: [
        { name: 'Excel/CSV', extensions: ['xlsx', 'xls', 'csv'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Cancelled' }
    }

    try {
      const filePath = result.filePaths[0]
      const workbook = XLSX.readFile(filePath)
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][]

      // Extract values from first column (skip header if present)
      const values: string[] = []
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        if (row && row[0]) {
          const val = String(row[0]).trim()
          if (val && val.toLowerCase() !== 'name' && val.toLowerCase() !== 'название') {
            values.push(val)
          }
        }
      }

      if (values.length === 0) {
        return { success: false, error: 'Файл не содержит данных' }
      }

      const db = getDatabaseManager()
      if (!db) {
        return { success: false, error: 'База данных не подключена' }
      }

      let importResult: { imported: number; skipped: number }
      switch (listType) {
        case 'streams':
          importResult = db.importStreams(values)
          break
        case 'assignees':
          importResult = db.importAssignees(values)
          break
        case 'statuses':
          importResult = db.importCardStatuses(values)
          break
        default:
          return { success: false, error: 'Неизвестный тип списка' }
      }

      return {
        success: true,
        imported: importResult.imported,
        skipped: importResult.skipped
      }
    } catch (error) {
      console.error('Import failed:', error)
      return { success: false, error: (error as Error).message }
    }
  })
}
