import React, { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Search, RotateCcw, Trash2, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { useKanbanStore } from '../../stores/kanbanStore'
import { Button, Input, Select, DatePicker } from '../UI'
import { ConfirmDialog } from '../Modals/ConfirmDialog'
import type { Card, CardFilters } from '../../../shared/types'

const ITEMS_PER_PAGE = 50

export function ArchivePage() {
  const { archivedCards, streams, assignees, refreshArchivedCards, restoreCard, deleteCard } = useKanbanStore()

  const [filters, setFilters] = useState<CardFilters>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteCardUid, setDeleteCardUid] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // Load archived cards on mount
  useEffect(() => {
    refreshArchivedCards(filters)
  }, [filters])

  // Filter cards locally for search
  const filteredCards = useMemo(() => {
    if (!searchQuery) return archivedCards

    const query = searchQuery.toLowerCase()
    return archivedCards.filter(card =>
      card.stream.toLowerCase().includes(query) ||
      card.department.toLowerCase().includes(query) ||
      card.assignees.some(a => a.toLowerCase().includes(query)) ||
      card.actualStatus.toLowerCase().includes(query) ||
      card.uid.toLowerCase().includes(query)
    )
  }, [archivedCards, searchQuery])

  // Pagination
  const totalPages = Math.ceil(filteredCards.length / ITEMS_PER_PAGE)
  const paginatedCards = filteredCards.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const handleRestore = async (card: Card) => {
    try {
      await restoreCard(card.uid)
      toast.success('Карточка восстановлена')
    } catch {
      toast.error('Не удалось восстановить карточку')
    }
  }

  const handleDelete = async () => {
    if (!deleteCardUid) return
    try {
      await deleteCard(deleteCardUid)
      await refreshArchivedCards(filters)
      toast.success('Карточка удалена навсегда')
      setDeleteCardUid(null)
    } catch {
      toast.error('Не удалось удалить карточку')
    }
  }

  const handleExport = async (exportFormat: 'xlsx' | 'csv') => {
    setIsExporting(true)
    try {
      const result = await window.electron.invoke('export-data', {
        format: exportFormat,
        includeArchived: true,
        filters
      }) as { success: boolean; filePath?: string; error?: string }

      if (result.success) {
        toast.success(`Экспорт сохранен: ${result.filePath}`)
      } else if (result.error && result.error !== 'Cancelled') {
        toast.error(result.error)
      }
    } catch {
      toast.error('Ошибка экспорта')
    } finally {
      setIsExporting(false)
    }
  }

  const streamOptions = [
    { value: '', label: 'Все стримы' },
    ...streams.map(s => ({ value: s.name, label: s.name }))
  ]

  return (
    <div className="h-full flex flex-col p-6">
      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по стриму, отделу, ответственным..."
                className="w-full h-10 pl-10 pr-4 rounded-lg border border-input bg-background text-foreground
                         focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Stream filter */}
          <div className="w-48">
            <Select
              options={streamOptions}
              value={filters.streams?.[0] || ''}
              onChange={(value) => setFilters(prev => ({
                ...prev,
                streams: value ? [value] : undefined
              }))}
              placeholder="Стрим"
            />
          </div>

          {/* Date from */}
          <div className="w-44">
            <DatePicker
              value={filters.dateFrom || null}
              onChange={(date) => setFilters(prev => ({
                ...prev,
                dateFrom: date || undefined
              }))}
              placeholder="Дата от"
            />
          </div>

          {/* Date to */}
          <div className="w-44">
            <DatePicker
              value={filters.dateTo || null}
              onChange={(date) => setFilters(prev => ({
                ...prev,
                dateTo: date || undefined
              }))}
              placeholder="Дата до"
            />
          </div>

          {/* Export buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleExport('xlsx')}
              isLoading={isExporting}
            >
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('csv')}
              isLoading={isExporting}
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Cards list */}
      <div className="flex-1 overflow-auto">
        {paginatedCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <p className="text-lg">Архив пуст</p>
            <p className="text-sm">Архивированные карточки будут отображаться здесь</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedCards.map((card) => (
              <ArchiveCard
                key={card.uid}
                card={card}
                onRestore={() => handleRestore(card)}
                onDelete={() => setDeleteCardUid(card.uid)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Показано {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredCards.length)} из {filteredCards.length}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <span className="px-3 text-sm text-foreground">
              {currentPage} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteCardUid}
        onClose={() => setDeleteCardUid(null)}
        onConfirm={handleDelete}
        title="Удалить навсегда"
        message="Вы уверены, что хотите удалить эту карточку? Это действие необратимо."
        confirmText="Удалить навсегда"
        variant="destructive"
      />
    </div>
  )
}

// Archive Card Component
function ArchiveCard({
  card,
  onRestore,
  onDelete
}: {
  card: Card
  onRestore: () => void
  onDelete: () => void
}) {
  const { cardStatuses } = useKanbanStore()
  const status = cardStatuses.find(s => s.name === card.actualStatus)

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Color stripe */}
      <div
        className="h-1.5"
        style={{ backgroundColor: card.color || '#9CA3AF' }}
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono text-muted-foreground">
            ID {card.uid.slice(0, 8)}
          </span>
          <span className="text-xs text-muted-foreground">
            Архивирована: {card.archivedAt
              ? format(parseISO(card.archivedAt), 'dd.MM.yyyy HH:mm', { locale: ru })
              : '-'}
          </span>
        </div>

        {/* Stream */}
        <div className="mb-2">
          <span className="text-xs text-muted-foreground">Стрим:</span>
          <p className="text-sm font-medium text-card-foreground">{card.stream}</p>
        </div>

        {/* Department */}
        <div className="mb-2">
          <span className="text-xs text-muted-foreground">Отдел:</span>
          <p className="text-sm text-card-foreground">{card.department}</p>
        </div>

        {/* Assignees */}
        {card.assignees.length > 0 && (
          <div className="mb-2">
            <span className="text-xs text-muted-foreground">Ответственные:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {card.assignees.map((assignee) => (
                <span
                  key={assignee}
                  className="inline-block px-2 py-0.5 bg-accent text-accent-foreground text-xs rounded"
                >
                  {assignee}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Status */}
        <div className="mb-3">
          <span
            className="inline-block px-2 py-0.5 text-xs rounded font-medium"
            style={{
              backgroundColor: status?.color || '#E5E7EB',
              color: '#1F2937'
            }}
          >
            {card.actualStatus}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t border-border">
          <Button size="sm" variant="outline" className="flex-1" onClick={onRestore}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Восстановить
          </Button>
          <Button size="sm" variant="destructive" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
