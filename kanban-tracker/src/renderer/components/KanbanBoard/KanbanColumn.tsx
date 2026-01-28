import React, { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import { Plus, MoreVertical, Pencil, Trash2, GripVertical, Archive } from 'lucide-react'
import { useKanbanStore } from '../../stores/kanbanStore'
import { KanbanCard } from '../Card/KanbanCard'
import { EditColumnModal } from '../Modals/EditColumnModal'
import { ConfirmDialog } from '../Modals/ConfirmDialog'
import type { Card, Column } from '../../../shared/types'

interface KanbanColumnProps {
  column: Column
  cards: Card[]
  onAddCard: () => void
  onEditCard: (card: Card) => void
}

export function KanbanColumn({ column, cards, onAddCard, onEditCard }: KanbanColumnProps) {
  const { deleteColumn } = useKanbanStore()
  const [showMenu, setShowMenu] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: column.id,
    data: { type: 'column', column },
    disabled: column.isClosedColumn
  })

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', column }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const handleDelete = async () => {
    await deleteColumn(column.id)
    setIsDeleteConfirmOpen(false)
  }

  // Combine refs
  const setRef = (node: HTMLDivElement | null) => {
    setSortableRef(node)
    setDroppableRef(node)
  }

  return (
    <>
      <div
        ref={setRef}
        style={style}
        className={`flex-shrink-0 w-72 flex flex-col rounded-xl bg-card border border-border
                   ${isOver ? 'ring-2 ring-primary ring-opacity-50' : ''}
                   ${isDragging ? 'shadow-xl' : ''}`}
      >
        {/* Column header */}
        <div
          className="flex items-center gap-2 p-3 border-b border-border rounded-t-xl"
          style={{ backgroundColor: column.color ? `${column.color}40` : undefined }}
        >
          {!column.isClosedColumn && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-accent/50"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </button>
          )}

          {column.isClosedColumn && (
            <Archive className="w-4 h-4 text-muted-foreground" />
          )}

          <h3 className="flex-1 font-medium text-card-foreground truncate">
            {column.name}
          </h3>

          <span className="text-sm text-muted-foreground">
            {cards.length}
          </span>

          {!column.isClosedColumn && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded hover:bg-accent transition-colors"
              >
                <MoreVertical className="w-4 h-4 text-muted-foreground" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-36 animate-fade-in">
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        setIsEditOpen(true)
                      }}
                      className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-accent transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      Редактировать
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        setIsDeleteConfirmOpen(true)
                      }}
                      className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-accent text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Удалить
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Cards list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          <SortableContext
            items={cards.map(c => c.uid)}
            strategy={verticalListSortingStrategy}
          >
            {cards.map((card) => (
              <KanbanCard
                key={card.uid}
                card={card}
                onClick={() => onEditCard(card)}
                isInClosedColumn={column.isClosedColumn}
              />
            ))}
          </SortableContext>

          {cards.length === 0 && (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {isOver ? 'Отпустите карточку' : 'Нет карточек'}
            </div>
          )}
        </div>

        {/* Add card button */}
        <div className="p-2 border-t border-border">
          <button
            onClick={onAddCard}
            className="w-full py-2 px-3 rounded-lg text-sm text-muted-foreground
                      hover:bg-accent hover:text-accent-foreground transition-colors
                      flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Добавить карточку
          </button>
        </div>
      </div>

      {/* Edit column modal */}
      <EditColumnModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        column={column}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Удалить колонку"
        message={`Вы уверены, что хотите удалить колонку "${column.name}"? Все карточки будут перемещены в первую колонку.`}
        confirmText="Удалить"
        variant="destructive"
      />
    </>
  )
}
