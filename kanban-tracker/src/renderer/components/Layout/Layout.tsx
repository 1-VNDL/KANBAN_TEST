import React, { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { LayoutDashboard, Settings, Archive, Cog, Database, User, Search, Download, RefreshCw } from 'lucide-react'
import { useKanbanStore } from '../../stores/kanbanStore'
import { Button } from '../UI'

export function Layout() {
  const { isDatabaseConnected, appSettings, searchQuery, setSearchQuery, fetchAllData } = useKanbanStore()
  const location = useLocation()
  const [isExporting, setIsExporting] = useState(false)

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Доска' },
    { to: '/settings', icon: Settings, label: 'Настройки списков' },
    { to: '/archive', icon: Archive, label: 'Архив' },
    { to: '/app-settings', icon: Cog, label: 'Настройки' }
  ]

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Канбан-доска'
      case '/settings': return 'Настройки списков'
      case '/archive': return 'Архив'
      case '/app-settings': return 'Настройки приложения'
      default: return 'Kanban Tracker'
    }
  }

  const handleExport = async (format: 'xlsx' | 'csv') => {
    setIsExporting(true)
    try {
      const result = await window.electron.invoke('export-data', {
        format,
        includeArchived: false
      }) as { success: boolean; filePath?: string; error?: string }

      if (result.success) {
        toast.success(`Экспорт сохранен`)
      } else if (result.error && result.error !== 'Cancelled') {
        toast.error(result.error)
      }
    } catch {
      toast.error('Ошибка экспорта')
    } finally {
      setIsExporting(false)
    }
  }

  const handleRefresh = async () => {
    await fetchAllData()
    toast.success('Данные обновлены')
  }

  const isOnBoard = location.pathname === '/'

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-card-foreground">Kanban Tracker</h1>
              <p className="text-xs text-muted-foreground">v1.0.0</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                ${isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-card-foreground truncate">
                {appSettings?.currentUserName || 'Пользователь'}
              </p>
            </div>
          </div>

          {/* Database status */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs
                         ${isDatabaseConnected
                           ? 'bg-green-500/10 text-green-600'
                           : 'bg-destructive/10 text-destructive'}`}>
            <Database className="w-4 h-4" />
            <span>{isDatabaseConnected ? 'БД подключена' : 'БД недоступна'}</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card gap-4">
          <h2 className="text-xl font-semibold text-card-foreground flex-shrink-0">{getPageTitle()}</h2>

          {/* Search and actions - only on board page */}
          {isOnBoard && (
            <div className="flex items-center gap-3 flex-1 justify-end">
              {/* Search */}
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск карточек..."
                  className="w-full h-9 pl-10 pr-4 rounded-lg border border-input bg-background text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Export dropdown */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('xlsx')}
                  isLoading={isExporting}
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Excel
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
