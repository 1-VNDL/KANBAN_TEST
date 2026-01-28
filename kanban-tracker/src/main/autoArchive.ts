import { DatabaseManager } from './database'

export class AutoArchiveManager {
  private timer: NodeJS.Timeout | null = null
  private databaseManager: DatabaseManager
  private onArchiveCallback: () => void

  constructor(databaseManager: DatabaseManager, onArchiveCallback: () => void) {
    this.databaseManager = databaseManager
    this.onArchiveCallback = onArchiveCallback
  }

  start(): void {
    // Check every minute for cards to archive
    this.timer = setInterval(() => {
      this.checkAndArchive()
    }, 60000)

    // Also check immediately on start
    this.checkAndArchive()
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private checkAndArchive(): void {
    try {
      const cardsToArchive = this.databaseManager.getCardsToAutoArchive()

      if (cardsToArchive.length > 0) {
        for (const card of cardsToArchive) {
          this.databaseManager.archiveCard(card.uid, 'Автоархивация')
          console.log(`Auto-archived card: ${card.uid}`)
        }

        // Notify about archived cards
        this.onArchiveCallback()
      }
    } catch (error) {
      console.error('Error during auto-archive check:', error)
    }
  }
}
