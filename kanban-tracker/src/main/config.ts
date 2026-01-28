import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import type { LocalConfig } from '../shared/types'

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
    const portableDataPath = join(dirname(exePath), 'KanbanTracker_Data')

    try {
      if (!existsSync(portableDataPath)) {
        mkdirSync(portableDataPath, { recursive: true })
      }
      // Test write permissions
      const testFile = join(portableDataPath, '.test')
      writeFileSync(testFile, 'test')
      const fs = require('fs')
      fs.unlinkSync(testFile)
      return portableDataPath
    } catch {
      // Fallback to userData directory
      return app.getPath('userData')
    }
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
      isConfigured: false
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

  resetConfig(): void {
    this.saveConfig({
      dbPath: '',
      isConfigured: false
    })
  }
}
