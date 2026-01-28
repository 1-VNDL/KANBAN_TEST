import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { Modal, Input, Select, MultiSelect, DatePicker, ColorPicker, Button } from '../UI'
import { useKanbanStore } from '../../stores/kanbanStore'

interface CreateCardModalProps {
  isOpen: boolean
  onClose: () => void
  columnId: string
}

export function CreateCardModal({ isOpen, onClose, columnId }: CreateCardModalProps) {
  const { streams, assignees, cardStatuses, columns, createCard } = useKanbanStore()

  const [stream, setStream] = useState('')
  const [department, setDepartment] = useState('')
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])
  const [plannedDate, setPlannedDate] = useState<string | null>(null)
  const [actualStatus, setActualStatus] = useState('')
  const [color, setColor] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

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

    if (!validate()) return

    setIsLoading(true)
    try {
      const column = columns.find(c => c.id === columnId)

      await createCard({
        stream,
        department: department.trim(),
        assignees: selectedAssignees,
        plannedInterviewDate: plannedDate,
        actualStatus,
        columnId,
        color
      })

      if (column?.isClosedColumn) {
        toast.success('Карточка создана. Будет архивирована через 10 минут.')
      } else {
        toast.success('Карточка создана')
      }

      handleClose()
    } catch (err) {
      toast.error('Не удалось создать карточку')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setStream('')
    setDepartment('')
    setSelectedAssignees([])
    setPlannedDate(null)
    setActualStatus('')
    setColor(undefined)
    setErrors({})
    onClose()
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

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Создать карточку" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
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
