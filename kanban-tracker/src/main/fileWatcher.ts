import chokidar, { FSWatcher } from 'chokidar'
import { statSync } from 'fs'

export class DatabaseWatcher {
  private watcher: FSWatcher | null = null
  private lastKnownMtime: number = 0
  private debounceTimeout: NodeJS.Timeout | null = null
  private dbPath: string
  private onChangeCallback: () => void

  constructor(dbPath: string, onChangeCallback: () => void) {
    this.dbPath = dbPath
    this.onChangeCallback = onChangeCallback
  }

  start(): void {
    try {
      // Get initial modification time
      this.lastKnownMtime = statSync(this.dbPath).mtimeMs
    } catch (error) {
      console.error('Failed to get initial mtime:', error)
      this.lastKnownMtime = 0
    }

    // Watch the database file and related WAL files
    this.watcher = chokidar.watch([this.dbPath, `${this.dbPath}-wal`, `${this.dbPath}-shm`], {
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      },
      ignoreInitial: true
    })

    this.watcher.on('change', (path) => {
      // Only respond to main db file changes
      if (!path.endsWith('.db')) return

      // Debounce to avoid multiple updates
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout)
      }

      this.debounceTimeout = setTimeout(() => {
        try {
          const currentMtime = statSync(this.dbPath).mtimeMs

          // Check if file actually changed
          if (currentMtime > this.lastKnownMtime) {
            this.lastKnownMtime = currentMtime
            this.onChangeCallback()
          }
        } catch (error) {
          console.error('Error checking file mtime:', error)
        }
      }, 200)
    })

    this.watcher.on('error', (error) => {
      console.error('File watcher error:', error)
    })
  }

  stop(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout)
      this.debounceTimeout = null
    }

    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }

  // Update the known mtime (call after local changes)
  updateLastKnownMtime(): void {
    try {
      this.lastKnownMtime = statSync(this.dbPath).mtimeMs
    } catch (error) {
      console.error('Failed to update mtime:', error)
    }
  }
}
