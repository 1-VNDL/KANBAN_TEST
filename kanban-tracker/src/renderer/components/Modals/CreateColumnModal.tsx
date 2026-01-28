import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { Modal, Input, ColorPicker, Button } from '../UI'
import { useKanbanStore } from '../../stores/kanbanStore'

interface CreateColumnModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateColumnModal({ isOpen, onClose }: CreateColumnModalProps) {
  const { createColumn } = useKanbanStore()
  const [name, setName] = useState('')
  const [color, setColor] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Введите название колонки')
      return
    }

    setIsLoading(true)
    try {
      await createColumn({ name: name.trim(), color })
      toast.success('Колонка создана')
      handleClose()
    } catch (err) {
      setError('Не удалось создать колонку')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setName('')
    setColor(undefined)
    setError('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Создать колонку">
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
          <Button type="button" variant="ghost" onClick={handleClose}>
            Отмена
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Создать
          </Button>
        </div>
      </form>
    </Modal>
  )
}
