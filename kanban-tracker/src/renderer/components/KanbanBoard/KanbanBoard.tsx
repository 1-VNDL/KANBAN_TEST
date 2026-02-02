import React, { useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { useKanbanStore } from '../../stores/kanbanStore'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from '../Card/KanbanCard'
import { CreateColumnModal } from '../Modals/CreateColumnModal'
import { CreateCardModal } from '../Modals/CreateCardModal'
import { EditCardModal } from '../Modals/EditCardModal'
import type { Card, Column } from '../../../shared/types'

export function KanbanBoard() {
  const { columns, cards, searchQuery, boardFilters, moveCard, reorderColumns } = useKanbanStore()

  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [activeColumn, setActiveColumn] = useState<Column | null>(null)
  const [isCreateColumnOpen, setIsCreateColumnOpen] = useState(false)
  const [createCardColumnId, setCreateCardColumnId] = useState<string | null>(null)
  const [editingCard, setEditingCard] = useState<Card | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  // Filter cards based on search query and board filters
  const filteredCards = useMemo(() => {
    let filtered = cards

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(card =>
        card.stream.toLowerCase().includes(query) ||
        card.department.toLowerCase().includes(query) ||
        card.assignees.some(a => a.toLowerCase().includes(query)) ||
        card.actualStatus.toLowerCase().includes(query) ||
        card.uid.toLowerCase().includes(query)
      )
    }

    // Apply board filters
    if (boardFilters.stream) {
      filtered = filtered.filter(card => card.stream === boardFilters.stream)
    }
    if (boardFilters.department) {
      filtered = filtered.filter(card => card.department === boardFilters.department)
    }
    if (boardFilters.assignee) {
      filtered = filtered.filter(card => card.assignees.includes(boardFilters.assignee!))
    }
    if (boardFilters.status) {
      filtered = filtered.filter(card => card.actualStatus === boardFilters.status)
    }
    if (boardFilters.column) {
      filtered = filtered.filter(card => card.columnId === boardFilters.column)
    }
    if (boardFilters.dateFrom) {
      filtered = filtered.filter(card =>
        card.plannedInterviewDate && card.plannedInterviewDate >= boardFilters.dateFrom!
      )
    }
    if (boardFilters.dateTo) {
      filtered = filtered.filter(card =>
        card.plannedInterviewDate && card.plannedInterviewDate <= boardFilters.dateTo!
      )
    }

    return filtered
  }, [cards, searchQuery, boardFilters])

  // Group cards by column
  const cardsByColumn = useMemo(() => {
    const grouped: Record<string, Card[]> = {}
    columns.forEach(col => {
      grouped[col.id] = filteredCards
        .filter(card => card.columnId === col.id)
        .sort((a, b) => a.position - b.position)
    })
    return grouped
  }, [columns, filteredCards])

  // Sort columns: regular columns by position, then closed column at the end
  const sortedColumns = useMemo(() => {
    const regularColumns = columns.filter(c => !c.isClosedColumn).sort((a, b) => a.position - b.position)
    const closedColumn = columns.find(c => c.isClosedColumn)
    return closedColumn ? [...regularColumns, closedColumn] : regularColumns
  }, [columns])

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const activeType = active.data.current?.type

    if (activeType === 'card') {
      const card = cards.find(c => c.uid === active.id)
      if (card) setActiveCard(card)
    } else if (activeType === 'column') {
      const column = columns.find(c => c.id === active.id)
      if (column) setActiveColumn(column)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeType = active.data.current?.type
    const overType = over.data.current?.type

    if (activeType !== 'card') return

    const activeCardId = active.id as string
    const overId = over.id as string

    // Find containers
    const activeCard = cards.find(c => c.uid === activeCardId)
    if (!activeCard) return

    let overColumnId: string | null = null

    if (overType === 'column') {
      overColumnId = overId
    } else if (overType === 'card') {
      const overCard = cards.find(c => c.uid === overId)
      if (overCard) {
        overColumnId = overCard.columnId
      }
    }

    if (!overColumnId || activeCard.columnId === overColumnId) return

    // Update local state for visual feedback (actual move happens on drag end)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    setActiveCard(null)
    setActiveColumn(null)

    if (!over) return

    const activeType = active.data.current?.type
    const overType = over.data.current?.type

    // Handle column reordering
    if (activeType === 'column' && overType === 'column') {
      const activeColumnData = columns.find(c => c.id === active.id)
      const overColumnData = columns.find(c => c.id === over.id)

      // Don't allow moving closed column
      if (activeColumnData?.isClosedColumn || overColumnData?.isClosedColumn) return

      const oldIndex = sortedColumns.findIndex(c => c.id === active.id)
      const newIndex = sortedColumns.findIndex(c => c.id === over.id)

      if (oldIndex !== newIndex) {
        const newOrder = arrayMove(
          sortedColumns.filter(c => !c.isClosedColumn),
          oldIndex,
          newIndex
        ).map(c => c.id)

        await reorderColumns(newOrder)
      }
      return
    }

    // Handle card moving
    if (activeType === 'card') {
      const activeCardId = active.id as string
      const activeCard = cards.find(c => c.uid === activeCardId)
      if (!activeCard) return

      let targetColumnId = activeCard.columnId
      let targetPosition = activeCard.position

      if (overType === 'column') {
        targetColumnId = over.id as string
        // Add to end of column
        const columnCards = cardsByColumn[targetColumnId] || []
        targetPosition = columnCards.length > 0
          ? Math.max(...columnCards.map(c => c.position)) + 1
          : 0
      } else if (overType === 'card') {
        const overCard = cards.find(c => c.uid === over.id)
        if (overCard) {
          targetColumnId = overCard.columnId
          targetPosition = overCard.position
        }
      }

      // Only move if something changed
      if (targetColumnId !== activeCard.columnId || targetPosition !== activeCard.position) {
        await moveCard({
          cardUid: activeCardId,
          targetColumnId,
          targetPosition
        })
      }
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Board content */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full">
            <SortableContext
              items={sortedColumns.map(c => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              {sortedColumns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={cardsByColumn[column.id] || []}
                  onAddCard={() => setCreateCardColumnId(column.id)}
                  onEditCard={setEditingCard}
                />
              ))}
            </SortableContext>

            {/* Add column button */}
            <button
              onClick={() => setIsCreateColumnOpen(true)}
              className="flex-shrink-0 w-72 h-fit p-4 rounded-xl border-2 border-dashed border-border
                        hover:border-primary hover:bg-accent/50 transition-colors
                        flex items-center justify-center gap-2 text-muted-foreground hover:text-primary"
            >
              <Plus className="w-5 h-5" />
              <span>Добавить колонку</span>
            </button>
          </div>

          <DragOverlay>
            {activeCard && (
              <div className="opacity-90 rotate-3">
                <KanbanCard card={activeCard} isDragging />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modals */}
      <CreateColumnModal
        isOpen={isCreateColumnOpen}
        onClose={() => setIsCreateColumnOpen(false)}
      />

      <CreateCardModal
        isOpen={!!createCardColumnId}
        onClose={() => setCreateCardColumnId(null)}
        columnId={createCardColumnId || ''}
      />

      <EditCardModal
        isOpen={!!editingCard}
        onClose={() => setEditingCard(null)}
        card={editingCard}
      />
    </div>
  )
}
