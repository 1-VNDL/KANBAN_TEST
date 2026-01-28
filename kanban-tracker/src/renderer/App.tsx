import React, { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useKanbanStore } from './stores/kanbanStore'
import { StartupWizard } from './components/StartupWizard/StartupWizard'
import { Layout } from './components/Layout/Layout'
import { KanbanBoard } from './components/KanbanBoard/KanbanBoard'
import { SettingsPage } from './components/Settings/SettingsPage'
import { ArchivePage } from './components/Archive/ArchivePage'
import { AppSettingsPage } from './components/AppSettings/AppSettingsPage'

export default function App() {
  const { fetchAllData, isDatabaseConnected, setDatabaseConnected, refreshCards, refreshArchivedCards } = useKanbanStore()
  const [isLoading, setIsLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)

  // Check if database is configured
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const isConnected = await window.electron.invoke('is-database-connected') as boolean

        if (isConnected) {
          await fetchAllData()
          setNeedsSetup(false)
        } else {
          setNeedsSetup(true)
          setDatabaseConnected(false)
        }
      } catch (error) {
        console.error('Failed to check config:', error)
        setNeedsSetup(true)
      } finally {
        setIsLoading(false)
      }
    }

    checkConfig()
  }, [])

  // Listen for database changes (sync)
  useEffect(() => {
    if (!isDatabaseConnected) return

    const unsubscribe = window.electron.on('database-changed', () => {
      console.log('Database changed by another user')
      toast('Доска обновлена другим пользователем', { icon: '🔄' })
      fetchAllData()
    })

    return () => {
      unsubscribe()
    }
  }, [isDatabaseConnected, fetchAllData])

  // Listen for auto-archived cards
  useEffect(() => {
    if (!isDatabaseConnected) return

    const unsubscribe = window.electron.on('cards-auto-archived', () => {
      toast('Карточки автоматически архивированы', { icon: '📦' })
      refreshCards()
      refreshArchivedCards()
    })

    return () => {
      unsubscribe()
    }
  }, [isDatabaseConnected, refreshCards, refreshArchivedCards])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F5 - Refresh
      if (e.key === 'F5') {
        e.preventDefault()
        fetchAllData()
        toast.success('Данные обновлены')
      }

      // Ctrl+F - Focus search (would need to implement search focus)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        // Will be handled by search component
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fetchAllData])

  // Apply theme from settings
  useEffect(() => {
    const applyTheme = async () => {
      if (!isDatabaseConnected) return

      try {
        const settings = await window.electron.invoke('get-app-settings') as { theme: string } | null
        if (settings?.theme === 'dark') {
          document.documentElement.classList.add('dark')
        } else if (settings?.theme === 'light') {
          document.documentElement.classList.remove('dark')
        } else {
          // System preference
          if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark')
          }
        }
      } catch {
        // Ignore
      }
    }

    applyTheme()
  }, [isDatabaseConnected])

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (needsSetup) {
    return (
      <StartupWizard
        onComplete={async () => {
          await fetchAllData()
          setNeedsSetup(false)
        }}
      />
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<KanbanBoard />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="archive" element={<ArchivePage />} />
        <Route path="app-settings" element={<AppSettingsPage />} />
      </Route>
    </Routes>
  )
}
