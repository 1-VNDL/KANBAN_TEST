import React, { useState, useEffect } from 'react'
import { Database, FolderOpen, Plus, AlertCircle, Clock, X } from 'lucide-react'
import type { RecentDatabase } from '../../../shared/types'

interface StartupWizardProps {
  onComplete: () => void
}

export function StartupWizard({ onComplete }: StartupWizardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentDatabases, setRecentDatabases] = useState<RecentDatabase[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  // Load recent databases on mount
  useEffect(() => {
    const loadRecent = async () => {
      try {
        const recent = await window.electron.invoke('get-recent-databases') as RecentDatabase[]
        setRecentDatabases(recent)
      } catch (err) {
        console.error('Failed to load recent databases:', err)
      } finally {
        setLoadingRecent(false)
      }
    }
    loadRecent()
  }, [])

  const handleOpenRecent = async (dbPath: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electron.invoke('open-recent-database', dbPath) as {
        success: boolean
        error?: string
      }

      if (result.success) {
        onComplete()
      } else if (result.error) {
        setError(result.error)
        // Refresh recent list to remove invalid entries
        const recent = await window.electron.invoke('get-recent-databases') as RecentDatabase[]
        setRecentDatabases(recent)
      }
    } catch (err) {
      setError('Не удалось открыть базу данных')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveRecent = async (e: React.MouseEvent, dbPath: string) => {
    e.stopPropagation()
    try {
      await window.electron.invoke('remove-recent-database', dbPath)
      setRecentDatabases(prev => prev.filter(db => db.path !== dbPath))
    } catch (err) {
      console.error('Failed to remove recent database:', err)
    }
  }

  const handleCreateNew = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electron.invoke('create-new-database') as {
        success: boolean
        error?: string
        dbPath?: string
      }

      if (result.success) {
        onComplete()
      } else if (result.error && result.error !== 'Cancelled') {
        setError(result.error)
      }
    } catch (err) {
      setError('Не удалось создать базу данных')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectExisting = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electron.invoke('select-existing-database') as {
        success: boolean
        error?: string
        dbPath?: string
      }

      if (result.success) {
        onComplete()
      } else if (result.error && result.error !== 'Cancelled') {
        setError(result.error)
      }
    } catch (err) {
      setError('Не удалось открыть базу данных')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const hasRecentDatabases = recentDatabases.length > 0

  return (
    <div className="min-h-screen max-h-screen overflow-y-auto bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full my-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Database className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Добро пожаловать в Kanban Tracker!
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            {hasRecentDatabases
              ? 'Выберите недавнюю базу данных или создайте новую'
              : 'Выберите способ подключения к базе данных'}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Recent databases section - shown at top when available */}
        {!loadingRecent && hasRecentDatabases && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Быстрый доступ
            </h2>
            <div className="space-y-3">
              {recentDatabases.map((db) => (
                <button
                  key={db.path}
                  onClick={() => handleOpenRecent(db.path)}
                  disabled={isLoading}
                  className="group w-full p-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700
                             rounded-xl hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg
                             transition-all duration-300 text-left disabled:opacity-50 disabled:cursor-not-allowed
                             flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center
                                  group-hover:bg-blue-500 group-hover:scale-110 transition-all duration-300 flex-shrink-0">
                    <Database className="w-6 h-6 text-blue-600 dark:text-blue-400 group-hover:text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                      {db.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {db.path}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Последнее открытие: {formatDate(db.lastOpenedAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleRemoveRecent(e, db.path)}
                    className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30
                               transition-all duration-200"
                    title="Удалить из списка"
                  >
                    <X className="w-4 h-4 text-red-500" />
                  </button>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Divider when recent databases exist */}
        {hasRecentDatabases && (
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 text-gray-500 dark:text-gray-400">
                или выберите другой вариант
              </span>
            </div>
          </div>
        )}

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Option 1: Create new database */}
          <button
            onClick={handleCreateNew}
            disabled={isLoading}
            className="group p-8 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700
                       rounded-2xl hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-xl
                       transition-all duration-300 text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center mb-5
                            group-hover:bg-blue-500 group-hover:scale-110 transition-all duration-300">
              <Plus className="w-7 h-7 text-blue-600 dark:text-blue-400 group-hover:text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Создать новую базу данных
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              Выберите папку и имя файла для новой базы данных.
              Используйте эту опцию, если вы первый в команде создаете проект.
            </p>
          </button>

          {/* Option 2: Select existing database */}
          <button
            onClick={handleSelectExisting}
            disabled={isLoading}
            className="group p-8 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700
                       rounded-2xl hover:border-green-500 dark:hover:border-green-400 hover:shadow-xl
                       transition-all duration-300 text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-14 h-14 bg-green-100 dark:bg-green-900/50 rounded-xl flex items-center justify-center mb-5
                            group-hover:bg-green-500 group-hover:scale-110 transition-all duration-300">
              <FolderOpen className="w-7 h-7 text-green-600 dark:text-green-400 group-hover:text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Выбрать существующую базу данных
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              Откройте файл базы данных, созданный ранее.
              Используйте эту опцию, чтобы присоединиться к существующей команде.
            </p>
          </button>
        </div>

        {/* Info box */}
        <div className="mt-8 p-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-sm font-semibold">i</span>
            </div>
            <div>
              <p className="text-blue-800 dark:text-blue-300 text-sm font-medium mb-1">
                Важно для совместной работы
              </p>
              <p className="text-blue-700 dark:text-blue-400 text-sm">
                Все участники команды должны выбрать один и тот же файл базы данных
                на общем сетевом диске для синхронизации изменений в реальном времени.
              </p>
            </div>
          </div>
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-700 dark:text-gray-300">Подождите...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
