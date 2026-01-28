import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Trash2 } from 'lucide-react'
import { Modal, Input, Select, MultiSelect, DatePicker, ColorPicker, Button } from '../UI'
import { ConfirmDialog } from './ConfirmDialog'
import { useKanbanStore } from '../../stores/kanbanStore'
import type { Card } from '../../../shared/types'

interface EditCardModalProps {
  isOpen: boolean
  onClose: () => void
  card: Card | null
}

export function EditCardModal({ isOpen, onClose, card }: EditCardModalProps) {
  const { streams, assignees, cardStatuses, updateCard, deleteCard } = useKanbanStore()

  const [stream, setStream] = useState('')
  const [department, setDepartment] = useState('')
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])
  const [plannedDate, setPlannedDate] = useState<string | null>(null)
  const [actualStatus, setActualStatus] = useState('')
  const [color, setColor] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (card) {
      setStream(card.stream)
      setDepartment(card.department)
      setSelectedAssignees(card.assignees)
      setPlannedDate(card.plannedInterviewDate)
      setActualStatus(card.actualStatus)
      setColor(card.color)
    }
  }, [card])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!stream) newErrors.stream = 'Выберите стрим'
    if (!department.trim()) newErrors.department = 'Введите отдел/управление'
    if (selectedAssignees.length === 0) newErrors.assignees = 'Выберите ответственных'
    if (!actualStatus) newErrors.actualStatus = 'Выберите статус'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!card || !validate()) return

    setIsLoading(true)
    try {
      await updateCard({
        uid: card.uid,
        updates: {
          stream,
          department: department.trim(),
          assignees: selectedAssignees,
          plannedInterviewDate: plannedDate,
          actualStatus,
          color
        },
        expectedUpdatedAt: card.updatedAt
      })

      toast.success('Карточка обновлена')
      onClose()
    } catch (err: any) {
      if (err?.message?.includes('CONFLICT')) {
        toast.error('Карточка была изменена другим пользователем. Обновите страницу.')
      } else {
        toast.error('Не удалось обновить карточку')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!card) return

    try {
      await deleteCard(card.uid)
      toast.success('Карточка удалена')
      setIsDeleteConfirmOpen(false)
      onClose()
    } catch (err) {
      toast.error('Не удалось удалить карточку')
    }
  }

  const streamOptions = streams.map(s => ({
    value: s.name,
    label: s.name,
    color: s.color
  }))

  const assigneeOptions = assignees.map(a => ({
    value: a.name,
    label: a.name
  }))

  const statusOptions = cardStatuses.map(s => ({
    value: s.name,
    label: s.name,
    color: s.color
  }))

  if (!card) return null

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Редактировать карточку" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Card info */}
          <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">
              ID: <span className="font-mono">{card.uid.slice(0, 8)}</span>
            </span>
            <span className="text-sm text-muted-foreground">
              Обновлено: {format(parseISO(card.updatedAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
              {card.updatedBy && ` • ${card.updatedBy}`}
            </span>
          </div>

          <Select
            label="Стрим"
            options={streamOptions}
            value={stream}
            onChange={(value) => {
              setStream(value)
              setErrors(prev => ({ ...prev, stream: '' }))
            }}
            placeholder="Выберите стрим"
            error={errors.stream}
            required
          />

          <Input
            label="Отдел/управление"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value)
              setErrors(prev => ({ ...prev, department: '' }))
            }}
            placeholder="Например: Маркетинг"
            error={errors.department}
            required
          />

          <MultiSelect
            label="Ответственные"
            options={assigneeOptions}
            values={selectedAssignees}
            onChange={(values) => {
              setSelectedAssignees(values)
              setErrors(prev => ({ ...prev, assignees: '' }))
            }}
            placeholder="Выберите ответственных"
            error={errors.assignees}
            required
          />

          <DatePicker
            label="Планируемая дата интервью"
            value={plannedDate}
            onChange={setPlannedDate}
          />

          <Select
            label="Фактический статус"
            options={statusOptions}
            value={actualStatus}
            onChange={(value) => {
              setActualStatus(value)
              setErrors(prev => ({ ...prev, actualStatus: '' }))
            }}
            placeholder="Выберите статус"
            error={errors.actualStatus}
            required
          />

          <ColorPicker
            label="Цвет карточки"
            value={color}
            onChange={setColor}
          />

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setIsDeleteConfirmOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Удалить
            </Button>

            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={onClose}>
                Отмена
              </Button>
              <Button type="submit" isLoading={isLoading}>
                Сохранить
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Удалить карточку"
        message="Вы уверены, что хотите удалить эту карточку? Это действие необратимо."
        confirmText="Удалить"
        variant="destructive"
      />
    </>
  )
}
