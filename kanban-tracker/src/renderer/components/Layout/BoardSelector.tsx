import React, { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { ChevronDown, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { ConfirmDialog } from '../Modals/ConfirmDialog'
import type { LocalBoard } from '../../../shared/types'

interface BoardSelectorProps {
  onBoardChange: () => void
}

export function BoardSelector({ onBoardChange }: BoardSelectorProps) {
  const [boards, setBoards] = useState<LocalBoard[]>([])
  const [currentBoard, setCurrentBoard] = useState<LocalBoard | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadBoards = async () => {
    try {
      const [boardsList, current] = await Promise.all([
        window.electron.invoke('get-boards') as Promise<LocalBoard[]>,
        window.electron.invoke('get-current-board') as Promise<LocalBoard | null>
      ])
      setBoards(boardsList)
      setCurrentBoard(current)
      if (current) {
        setEditName(current.displayName)
      }
    } catch (err) {
      console.error('Failed to load boards:', err)
    }
  }

  useEffect(() => {
    loadBoards()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSwitchBoard = async (boardId: string) => {
    if (currentBoard?.id === boardId) {
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    try {
      const result = await window.electron.invoke('switch-board', boardId) as {
        success: boolean
        error?: string
      }

      if (result.success) {
        await loadBoards()
        onBoardChange()
        toast.success('Доска переключена')
      } else if (result.error) {
        toast.error(result.error)
      }
    } catch (err) {
      toast.error('Не удалось переключить доску')
    } finally {
      setIsLoading(false)
      setIsOpen(false)
    }
  }

  const handleCreateNewBoard = async () => {
    setIsOpen(false)

    // This will show the dialog to create/select database
    const result = await window.electron.invoke('create-new-database') as {
      success: boolean
      error?: string
    }

    if (result.success) {
      await loadBoards()
      onBoardChange()
      toast.success('Новая доска создана')
    }
  }

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentBoard) {
      setEditName(currentBoard.displayName)
      setIsEditing(true)
    }
  }

  const handleSaveEdit = async () => {
    if (!currentBoard || !editName.trim()) {
      setIsEditing(false)
      return
    }

    try {
      await window.electron.invoke('update-board', currentBoard.id, editName.trim())
      await loadBoards()
      toast.success('Название доски обновлено')
    } catch (err) {
      toast.error('Не удалось обновить название')
    } finally {
      setIsEditing(false)
    }
  }

  const handleCancelEdit = () => {
    if (currentBoard) {
      setEditName(currentBoard.displayName)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!currentBoard) return

    try {
      await window.electron.invoke('delete-board', currentBoard.id)
      await loadBoards()

      // Check if we still have boards, otherwise show startup wizard
      const remainingBoards = await window.electron.invoke('get-boards') as LocalBoard[]
      if (remainingBoards.length === 0) {
        // Reset config to show startup wizard
        await window.electron.invoke('reset-config')
        window.location.reload()
      } else {
        // Switch to first remaining board
        const first = remainingBoards[0]
        await handleSwitchBoard(first.id)
      }

      toast.success('Доска удалена')
    } catch (err) {
      toast.error('Не удалось удалить доску')
    } finally {
      setIsDeleteConfirmOpen(false)
    }
  }

  if (!currentBoard) {
    return <h2 className="text-xl font-semibold text-card-foreground">Канбан-доска</h2>
  }

  return (
    <>
      <div className="flex items-center gap-2" ref={dropdownRef}>
        {/* Board name / Dropdown trigger */}
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="text-xl font-semibold text-card-foreground bg-transparent border-b-2 border-primary focus:outline-none px-1"
            />
            <button
              onClick={handleSaveEdit}
              className="p-1 rounded hover:bg-accent text-green-600"
              title="Сохранить"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-1 rounded hover:bg-accent text-muted-foreground"
              title="Отмена"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              disabled={isLoading}
              className="flex items-center gap-2 text-xl font-semibold text-card-foreground hover:text-primary transition-colors disabled:opacity-50"
            >
              <span>{currentBoard.displayName}</span>
              <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown menu */}
            {isOpen && (
              <div className="absolute top-full left-0 mt-2 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-64 animate-fade-in">
                {/* Board list */}
                {boards.map((board) => (
                  <button
                    key={board.id}
                    onClick={() => handleSwitchBoard(board.id)}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between hover:bg-accent transition-colors
                              ${board.id === currentBoard.id ? 'bg-accent/50' : ''}`}
                  >
                    <span className="truncate">{board.displayName}</span>
                    {board.id === currentBoard.id && (
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                ))}

                {/* Divider */}
                <div className="my-1 border-t border-border" />

                {/* Create new board */}
                <button
                  onClick={handleCreateNewBoard}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-accent transition-colors text-primary"
                >
                  <Plus className="w-4 h-4" />
                  Создать новую доску
                </button>
              </div>
            )}
          </div>
        )}

        {/* Edit button */}
        {!isEditing && (
          <button
            onClick={handleStartEdit}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title="Редактировать название"
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        {/* Delete button */}
        {!isEditing && (
          <button
            onClick={handleDeleteClick}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title="Удалить доску"
          >
            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
          </button>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Удалить доску"
        message={`Вы уверены, что хотите удалить доску "${currentBoard.displayName}"? Это действие удалит только ваше подключение к доске, база данных останется на диске.`}
        confirmText="Удалить"
        variant="destructive"
      />
    </>
  )
}
