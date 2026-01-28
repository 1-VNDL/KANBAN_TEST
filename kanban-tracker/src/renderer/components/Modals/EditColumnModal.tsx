import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Modal, Input, ColorPicker, Button } from '../UI'
import { useKanbanStore } from '../../stores/kanbanStore'
import type { Column } from '../../../shared/types'

interface EditColumnModalProps {
  isOpen: boolean
  onClose: () => void
  column: Column | null
}

export function EditColumnModal({ isOpen, onClose, column }: EditColumnModalProps) {
  const { updateColumn } = useKanbanStore()
  const [name, setName] = useState('')
  const [color, setColor] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (column) {
      setName(column.name)
      setColor(column.color)
    }
  }, [column])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!column) return

    if (!name.trim()) {
      setError('Введите название колонки')
      return
    }

    setIsLoading(true)
    try {
      await updateColumn({
        id: column.id,
        updates: { name: name.trim(), color }
      })
      toast.success('Колонка обновлена')
      onClose()
    } catch (err) {
      setError('Не удалось обновить колонку')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Редактировать колонку">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Название"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError('')
          }}
          placeholder="Например: В работе"
          error={error}
          required
          autoFocus
        />

        <ColorPicker
          label="Цвет фона"
          value={color}
          onChange={setColor}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Сохранить
          </Button>
        </div>
      </form>
    </Modal>
  )
}
