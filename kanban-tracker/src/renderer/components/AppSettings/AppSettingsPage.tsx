import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { User, Clock, Palette, Database, FolderOpen, Trash2 } from 'lucide-react'
import { useKanbanStore } from '../../stores/kanbanStore'
import { Button, Input } from '../UI'
import { ConfirmDialog } from '../Modals/ConfirmDialog'

export function AppSettingsPage() {
  const { appSettings, updateAppSetting, refreshSettings } = useKanbanStore()
  const [dbPath, setDbPath] = useState<string>('')
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)

  // Local state for form
  const [userName, setUserName] = useState('')
  const [archiveDelay, setArchiveDelay] = useState(10)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light')

  // Load settings
  useEffect(() => {
    if (appSettings) {
      setUserName(appSettings.currentUserName)
      setArchiveDelay(appSettings.autoArchiveDelayMinutes)
      setTheme(appSettings.theme)
    }

    // Get database path
    window.electron.invoke('get-database-path').then((path) => {
      if (path) setDbPath(path as string)
    })
  }, [appSettings])

  // Apply theme
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'light') {
      root.classList.remove('dark')
    } else {
      // System preference
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }, [theme])

  const handleSaveUserName = async () => {
    if (!userName.trim()) return
    try {
      await updateAppSetting('current_user_name', userName.trim())
      toast.success('Имя пользователя сохранено')
    } catch {
      toast.error('Не удалось сохранить настройку')
    }
  }

  const handleSaveArchiveDelay = async () => {
    if (archiveDelay < 1 || archiveDelay > 60) return
    try {
      await updateAppSetting('auto_archive_delay_minutes', String(archiveDelay))
      toast.success('Настройка сохранена')
    } catch {
      toast.error('Не удалось сохранить настройку')
    }
  }

  const handleSaveTheme = async (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
    try {
      await updateAppSetting('theme', newTheme)
      toast.success('Тема изменена')
    } catch {
      toast.error('Не удалось сохранить настройку')
    }
  }

  const handleChangeDatabase = async () => {
    const result = await window.electron.invoke('show-message-box', {
      type: 'question',
      title: 'Изменить базу данных',
      message: 'Что вы хотите сделать?',
      buttons: ['Создать новую', 'Выбрать существующую', 'Отмена'],
      defaultId: 2
    }) as { response: number }

    if (result.response === 0) {
      const createResult = await window.electron.invoke('create-new-database') as { success: boolean }
      if (createResult.success) {
        window.location.reload()
      }
    } else if (result.response === 1) {
      const selectResult = await window.electron.invoke('select-existing-database') as { success: boolean }
      if (selectResult.success) {
        window.location.reload()
      }
    }
  }

  const handleOpenLogs = async () => {
    await window.electron.invoke('open-logs-folder')
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* User Profile */}
        <section className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <User className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-card-foreground">Профиль</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Ваше имя
              </label>
              <div className="flex gap-3">
                <Input
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Введите ваше имя"
                  className="flex-1"
                />
                <Button onClick={handleSaveUserName}>Сохранить</Button>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Будет отображаться в истории изменений карточек
              </p>
            </div>
          </div>
        </section>

        {/* Behavior */}
        <section className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-card-foreground">Поведение</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Задержка автоархивации (минуты)
              </label>
              <div className="flex gap-3">
                <Input
                  type="number"
                  value={archiveDelay}
                  onChange={(e) => setArchiveDelay(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                  min={1}
                  max={60}
                  className="w-32"
                />
                <Button onClick={handleSaveArchiveDelay}>Сохранить</Button>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Карточки в колонке "Закрыто" будут автоматически архивироваться через указанное время
              </p>
            </div>
          </div>
        </section>

        {/* Theme */}
        <section className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Palette className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-card-foreground">Тема</h3>
          </div>

          <div className="flex gap-3">
            <ThemeButton
              label="Светлая"
              isActive={theme === 'light'}
              onClick={() => handleSaveTheme('light')}
            />
            <ThemeButton
              label="Темная"
              isActive={theme === 'dark'}
              onClick={() => handleSaveTheme('dark')}
            />
            <ThemeButton
              label="Системная"
              isActive={theme === 'system'}
              onClick={() => handleSaveTheme('system')}
            />
          </div>
        </section>

        {/* Database */}
        <section className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-card-foreground">База данных</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Расположение базы данных
              </label>
              <div className="px-3 py-2 bg-muted rounded-lg text-sm text-muted-foreground font-mono break-all">
                {dbPath || 'Не подключена'}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleChangeDatabase}>
                <FolderOpen className="w-4 h-4 mr-2" />
                Изменить БД
              </Button>
              <Button variant="outline" onClick={handleOpenLogs}>
                Открыть папку логов
              </Button>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-card rounded-xl border border-destructive/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-destructive">Опасная зона</h3>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Эти действия необратимы. Будьте осторожны.
          </p>

          <Button variant="destructive" onClick={() => setIsResetConfirmOpen(true)}>
            Сбросить конфигурацию
          </Button>
        </section>
      </div>

      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={async () => {
          // Reset config and reload
          await window.electron.invoke('reset-config')
          window.location.reload()
        }}
        title="Сбросить конфигурацию"
        message="Вы уверены? Это отключит текущую базу данных и вы вернетесь к выбору базы данных при следующем запуске."
        confirmText="Сбросить"
        variant="destructive"
      />
    </div>
  )
}

function ThemeButton({
  label,
  isActive,
  onClick
}: {
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all
                ${isActive
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/50'}`}
    >
      {label}
    </button>
  )
}
