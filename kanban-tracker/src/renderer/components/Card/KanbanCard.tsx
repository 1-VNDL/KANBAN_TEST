import React, { useState, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, parseISO, differenceInDays, differenceInMinutes } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Clock, Archive } from 'lucide-react'
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

  // Check if date is soon (within 3 days) - but not in closed column
  const isDateSoon = card.plannedInterviewDate && !isInClosedColumn
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

  const handleClick = (e: React.MouseEvent) => {
    // Prevent click from interfering with drag
    if (!isSortableDragging) {
      onClick?.()
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`group bg-background rounded-lg border border-border shadow-sm
                 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer
                 ${isDragging || isSortableDragging ? 'shadow-xl scale-105 rotate-2 cursor-grabbing' : ''}`}
    >
      {/* Color stripe */}
      <div
        className="h-1.5 rounded-t-lg"
        style={{ backgroundColor: card.color || '#3B82F6' }}
      />

      <div className="p-3">
        {/* Archive indicator (only in closed column) */}
        {isInClosedColumn && (
          <div className="flex items-center justify-end gap-1 mb-2">
            {countdown && (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                <Clock className="w-3 h-3" />
                {countdown}
              </span>
            )}
            <Archive className="w-4 h-4 text-muted-foreground" />
          </div>
        )}

        {/* Department - PRIMARY (bold, prominent) */}
        <div className={isInClosedColumn ? '' : 'mb-2'}>
          <p className="text-sm font-semibold text-card-foreground truncate">{card.department}</p>
        </div>

        {/* Interview Date */}
        {card.plannedInterviewDate && (
          <div className="mb-2">
            <p className={`text-sm ${isDateSoon ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              {format(parseISO(card.plannedInterviewDate), 'dd.MM.yyyy', { locale: ru })}
            </p>
          </div>
        )}

        {/* Status */}
        <div>
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
    </div>
  )
}
