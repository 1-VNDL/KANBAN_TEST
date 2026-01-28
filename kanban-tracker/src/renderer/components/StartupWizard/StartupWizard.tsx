import React, { useState } from 'react'
import { Database, FolderOpen, Plus, AlertCircle } from 'lucide-react'

interface StartupWizardProps {
  onComplete: () => void
}

export function StartupWizard({ onComplete }: StartupWizardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Database className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Добро пожаловать в Kanban Tracker!
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Выберите способ подключения к базе данных
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-400">{error}</p>
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
