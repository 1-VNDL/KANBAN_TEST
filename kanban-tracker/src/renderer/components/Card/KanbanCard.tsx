import React, { useState, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, parseISO, differenceInDays, differenceInMinutes } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Pencil, Clock, Archive } from 'lucide-react'
import { useKanbanStore } from '../../stores/kanbanStore'
import type { Card } from '../../../shared/types'

interface KanbanCardProps {
  card: Card
  onClick?: () => void
  isDragging?: boolean
  isInClosedColumn?: boolean
}

export function KanbanCard({ card, onClick, isDragging, isInClosedColumn }: KanbanCardProps) {
  const { cardStatuses } = useKanbanStore()
  const [countdown, setCountdown] = useState<string | null>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging
  } = useSortable({
    id: card.uid,
    data: { type: 'card', card }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1
  }

  // Get status color
  const status = cardStatuses.find(s => s.name === card.actualStatus)
  const statusColor = status?.color || '#E5E7EB'

  // Check if date is soon (within 3 days)
  const isDateSoon = card.plannedInterviewDate
    ? differenceInDays(parseISO(card.plannedInterviewDate), new Date()) <= 3
    : false

  // Countdown timer for auto-archive
  useEffect(() => {
    if (!card.autoArchiveScheduledAt) {
      setCountdown(null)
      return
    }

    const updateCountdown = () => {
      const scheduledTime = parseISO(card.autoArchiveScheduledAt!)
      const minutesLeft = differenceInMinutes(scheduledTime, new Date())

      if (minutesLeft <= 0) {
        setCountdown('Архивируется...')
      } else if (minutesLeft < 60) {
        setCountdown(`${minutesLeft} мин`)
      } else {
        const hours = Math.floor(minutesLeft / 60)
        const mins = minutesLeft % 60
        setCountdown(`${hours}ч ${mins}м`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [card.autoArchiveScheduledAt])

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group bg-background rounded-lg border border-border shadow-sm
                 hover:shadow-md hover:border-primary/50 transition-all cursor-grab active:cursor-grabbing
                 ${isDragging || isSortableDragging ? 'shadow-xl scale-105 rotate-2' : ''}`}
    >
      {/* Color stripe */}
      <div
        className="h-1.5 rounded-t-lg"
        style={{ backgroundColor: card.color || '#3B82F6' }}
      />

      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-muted-foreground">
            ID {card.uid.slice(0, 8)}
          </span>
          <div className="flex items-center gap-1">
            {isInClosedColumn && countdown && (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                <Clock className="w-3 h-3" />
                {countdown}
              </span>
            )}
            {isInClosedColumn && (
              <Archive className="w-4 h-4 text-muted-foreground" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClick?.()
              }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-all"
            >
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Stream */}
        <div className="mb-2">
          <span className="text-xs text-muted-foreground">Стрим:</span>
          <p className="text-sm font-medium text-card-foreground truncate">{card.stream}</p>
        </div>

        {/* Department */}
        <div className="mb-2">
          <span className="text-xs text-muted-foreground">Отдел/управление:</span>
          <p className="text-sm text-card-foreground truncate">{card.department}</p>
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

        {/* Planned date */}
        {card.plannedInterviewDate && (
          <div className="mb-2">
            <span className="text-xs text-muted-foreground">Дата интервью:</span>
            <p className={`text-sm ${isDateSoon ? 'text-destructive font-medium' : 'text-card-foreground'}`}>
              {format(parseISO(card.plannedInterviewDate), 'dd.MM.yyyy', { locale: ru })}
            </p>
          </div>
        )}

        {/* Status */}
        <div className="mb-2">
          <span className="text-xs text-muted-foreground">Статус:</span>
          <div className="mt-1">
            <span
              className="inline-block px-2 py-0.5 text-xs rounded font-medium"
              style={{
                backgroundColor: statusColor,
                color: statusColor === '#E5E7EB' ? '#374151' : '#1F2937'
              }}
            >
              {card.actualStatus}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 mt-2 border-t border-border text-xs text-muted-foreground">
          Обновлено: {format(parseISO(card.updatedAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
          {card.updatedBy && ` • ${card.updatedBy}`}
        </div>
      </div>
    </div>
  )
}
