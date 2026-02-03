import { app } from 'electron'
import { join, dirname, basename } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import type { LocalConfig, RecentDatabase, LocalBoard } from '../shared/types'

export class ConfigManager {
  private configPath: string
  private dataPath: string

  constructor() {
    this.dataPath = this.determineDataPath()
    this.configPath = join(this.dataPath, 'config.json')
  }

  private determineDataPath(): string {
    // Try portable mode first (data folder next to exe)
    const exePath = app.getPath('exe')
    const exeDir = dirname(exePath)
    const portableDataPath = join(exeDir, 'KanbanTracker_Data')

    // Check if we're running from a typical "portable" location
    // Avoid creating data folder in system directories
    const isSystemPath = exeDir.includes('Windows') ||
                         exeDir.includes('Program Files') ||
                         exeDir.includes('/usr') ||
                         exeDir.includes('/bin')

    if (!isSystemPath) {
      try {
        if (!existsSync(portableDataPath)) {
          mkdirSync(portableDataPath, { recursive: true })
        }
        // Test write permissions
        const testFile = join(portableDataPath, '.test')
        writeFileSync(testFile, 'test')
        const fs = require('fs')
        fs.unlinkSync(testFile)
        console.log('Using portable data path:', portableDataPath)
        return portableDataPath
      } catch (err) {
        console.log('Portable data path failed, using userData:', err)
      }
    }

    // Fallback to userData directory
    const userDataPath = app.getPath('userData')
    console.log('Using userData path:', userDataPath)
    return userDataPath
  }

  getDataPath(): string {
    return this.dataPath
  }

  getLogsPath(): string {
    const logsPath = join(this.dataPath, 'logs')
    if (!existsSync(logsPath)) {
      mkdirSync(logsPath, { recursive: true })
    }
    return logsPath
  }

  loadConfig(): LocalConfig {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8')
        return JSON.parse(data)
      }
    } catch (error) {
      console.error('Failed to load config:', error)
    }
    return {
      dbPath: '',
      isConfigured: false,
      recentDatabases: [],
      boards: []
    }
  }

  saveConfig(config: LocalConfig): void {
    try {
      if (!existsSync(this.dataPath)) {
        mkdirSync(this.dataPath, { recursive: true })
      }
      writeFileSync(this.configPath, JSON.stringify(config, null, 2))
    } catch (error) {
      console.error('Failed to save config:', error)
      throw error
    }
  }

  addRecentDatabase(dbPath: string, customName?: string): void {
    const config = this.loadConfig()
    const recentDatabases = config.recentDatabases || []

    // Remove if already exists
    const filtered = recentDatabases.filter(db => db.path !== dbPath)

    // Add to beginning
    const newEntry: RecentDatabase = {
      path: dbPath,
      name: customName || basename(dbPath, '.db'),
      lastOpenedAt: new Date().toISOString()
    }

    // Keep only last 3
    const updated = [newEntry, ...filtered].slice(0, 3)

    this.saveConfig({
      ...config,
      recentDatabases: updated
    })
  }

  getRecentDatabases(): RecentDatabase[] {
    const config = this.loadConfig()
    return (config.recentDatabases || []).filter(db => existsSync(db.path))
  }

  removeRecentDatabase(dbPath: string): void {
    const config = this.loadConfig()
    const recentDatabases = (config.recentDatabases || []).filter(db => db.path !== dbPath)
    this.saveConfig({
      ...config,
      recentDatabases
    })
  }

  // Board management methods
  getBoards(): LocalBoard[] {
    const config = this.loadConfig()
    return config.boards || []
  }

  addBoard(dbPath: string, displayName: string): LocalBoard {
    const config = this.loadConfig()
    const boards = config.boards || []

    // Check if board with this dbPath already exists
    const existing = boards.find(b => b.dbPath === dbPath)
    if (existing) {
      return existing
    }

    const newBoard: LocalBoard = {
      id: randomUUID(),
      dbPath,
      displayName,
      createdAt: new Date().toISOString()
    }

    this.saveConfig({
      ...config,
      boards: [...boards, newBoard],
      currentBoardId: newBoard.id
    })

    return newBoard
  }

  updateBoard(boardId: string, displayName: string): void {
    const config = this.loadConfig()
    const boards = (config.boards || []).map(b =>
      b.id === boardId ? { ...b, displayName } : b
    )
    this.saveConfig({
      ...config,
      boards
    })
  }

  deleteBoard(boardId: string): void {
    const config = this.loadConfig()
    const boards = (config.boards || []).filter(b => b.id !== boardId)
    const currentBoardId = config.currentBoardId === boardId
      ? boards[0]?.id
      : config.currentBoardId

    this.saveConfig({
      ...config,
      boards,
      currentBoardId
    })
  }

  getCurrentBoard(): LocalBoard | null {
    const config = this.loadConfig()
    const boards = config.boards || []
    return boards.find(b => b.id === config.currentBoardId) || boards[0] || null
  }

  setCurrentBoard(boardId: string): void {
    const config = this.loadConfig()
    this.saveConfig({
      ...config,
      currentBoardId: boardId
    })
  }

  resetConfig(): void {
    const config = this.loadConfig()
    this.saveConfig({
      dbPath: '',
      isConfigured: false,
      recentDatabases: [],
      boards: [],
      userId: config.userId // Keep the userId across resets
    })
  }

  // Get or generate a unique user ID
  getUserId(): string {
    const config = this.loadConfig()
    if (config.userId) {
      return config.userId
    }

    // Generate new user ID
    const userId = randomUUID()
    this.saveConfig({
      ...config,
      userId
    })
    return userId
  }

  // Get last user name (for display purposes)
  getLastUserName(): string | undefined {
    return this.loadConfig().lastUserName
  }

  // Set last user name
  setLastUserName(name: string): void {
    const config = this.loadConfig()
    this.saveConfig({
      ...config,
      lastUserName: name
    })
  }
}
