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
      // Respond to main db file OR WAL file changes (WAL contains uncommitted changes)
      if (!path.endsWith('.db') && !path.endsWith('-wal')) return

      // Debounce to avoid multiple updates
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout)
      }

      this.debounceTimeout = setTimeout(() => {
        try {
          // Check main db file mtime
          const currentMtime = statSync(this.dbPath).mtimeMs

          // Also check WAL file mtime if it exists
          let walMtime = 0
          try {
            walMtime = statSync(`${this.dbPath}-wal`).mtimeMs
          } catch {
            // WAL file might not exist, that's ok
          }

          const maxMtime = Math.max(currentMtime, walMtime)

          // Check if file actually changed
          if (maxMtime > this.lastKnownMtime) {
            this.lastKnownMtime = maxMtime
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
