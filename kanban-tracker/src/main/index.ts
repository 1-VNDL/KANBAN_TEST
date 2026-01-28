import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { setupIpcHandlers } from './ipc-handlers'
import { DatabaseManager } from './database'
import { DatabaseWatcher } from './fileWatcher'
import { AutoArchiveManager } from './autoArchive'
import { ConfigManager } from './config'

let mainWindow: BrowserWindow | null = null
let databaseManager: DatabaseManager | null = null
let databaseWatcher: DatabaseWatcher | null = null
let autoArchiveManager: AutoArchiveManager | null = null
const configManager = new ConfigManager()

function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    title: 'Kanban Tracker',
    show: false
  })

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Load app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

async function initializeApp(): Promise<void> {
  // Ensure data directory exists
  const dataPath = configManager.getDataPath()
  if (!existsSync(dataPath)) {
    mkdirSync(dataPath, { recursive: true })
  }

  // Check if database is configured
  const config = configManager.loadConfig()

  if (config.isConfigured && config.dbPath && existsSync(config.dbPath)) {
    try {
      // Initialize database
      databaseManager = new DatabaseManager(config.dbPath)
      databaseManager.initialize()

      // Start file watcher
      databaseWatcher = new DatabaseWatcher(config.dbPath, () => {
        // Notify all windows about database change
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('database-changed', { timestamp: Date.now() })
        })
      })
      databaseWatcher.start()

      // Start auto-archive manager
      autoArchiveManager = new AutoArchiveManager(databaseManager, () => {
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('cards-auto-archived')
        })
      })
      autoArchiveManager.start()
    } catch (error) {
      console.error('Failed to initialize database:', error)
      // Reset config and let user choose again
      configManager.saveConfig({ dbPath: '', isConfigured: false })
    }
  }

  // Setup IPC handlers
  setupIpcHandlers({
    getDatabaseManager: () => databaseManager,
    getConfigManager: () => configManager,
    setDatabaseManager: (manager) => {
      databaseManager = manager
    },
    startWatcher: (dbPath: string) => {
      if (databaseWatcher) {
        databaseWatcher.stop()
      }
      databaseWatcher = new DatabaseWatcher(dbPath, () => {
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('database-changed', { timestamp: Date.now() })
        })
      })
      databaseWatcher.start()
    },
    startAutoArchive: () => {
      if (autoArchiveManager) {
        autoArchiveManager.stop()
      }
      if (databaseManager) {
        autoArchiveManager = new AutoArchiveManager(databaseManager, () => {
          BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.send('cards-auto-archived')
          })
        })
        autoArchiveManager.start()
      }
    }
  })
}

// App lifecycle
app.whenReady().then(async () => {
  await initializeApp()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Cleanup
  if (databaseWatcher) {
    databaseWatcher.stop()
  }
  if (autoArchiveManager) {
    autoArchiveManager.stop()
  }
  if (databaseManager) {
    databaseManager.close()
  }

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  dialog.showErrorBox(
    'Критическая ошибка',
    `Произошла непредвиденная ошибка:\n\n${error.message}`
  )
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason)
})
