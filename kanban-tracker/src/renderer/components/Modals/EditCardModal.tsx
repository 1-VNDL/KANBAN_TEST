import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Trash2, Plus, X, Type, Hash, Calendar, CheckSquare } from 'lucide-react'
import { Modal, Input, Select, MultiSelect, DatePicker, ColorPicker, Button } from '../UI'
import { ConfirmDialog } from './ConfirmDialog'
import { useKanbanStore } from '../../stores/kanbanStore'
import type { Card, CustomAttributeDefinition, CardCustomAttribute, CustomAttributeType } from '../../../shared/types'

interface EditCardModalProps {
  isOpen: boolean
  onClose: () => void
  card: Card | null
}

const attributeTypeIcons: Record<CustomAttributeType, React.ReactNode> = {
  text: <Type className="w-4 h-4" />,
  number: <Hash className="w-4 h-4" />,
  date: <Calendar className="w-4 h-4" />,
  boolean: <CheckSquare className="w-4 h-4" />
}

const attributeTypeLabels: Record<CustomAttributeType, string> = {
  text: 'ABC',
  number: '123',
  date: '📅',
  boolean: '✓/✗'
}

export function EditCardModal({ isOpen, onClose, card }: EditCardModalProps) {
  const { streams, assignees, cardStatuses, customAttributeDefinitions, updateCard, deleteCard, createCustomAttributeDefinition, refreshCustomAttributeDefinitions, refreshCards } = useKanbanStore()

  const [stream, setStream] = useState('')
  const [department, setDepartment] = useState('')
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])
  const [plannedDate, setPlannedDate] = useState<string | null>(null)
  const [actualStatus, setActualStatus] = useState('')
  const [color, setColor] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Custom attributes state
  const [cardCustomAttrs, setCardCustomAttrs] = useState<CardCustomAttribute[]>([])
  const [showAddAttribute, setShowAddAttribute] = useState(false)
  const [newAttrName, setNewAttrName] = useState('')
  const [newAttrType, setNewAttrType] = useState<CustomAttributeType>('text')
  const [showAddExisting, setShowAddExisting] = useState(false)

  useEffect(() => {
    if (card) {
      setStream(card.stream)
      setDepartment(card.department)
      setSelectedAssignees(card.assignees)
      setPlannedDate(card.plannedInterviewDate)
      setActualStatus(card.actualStatus)
      setColor(card.color)
      setCardCustomAttrs(card.customAttributes || [])
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

  const handleCreateNewAttribute = async () => {
    if (!newAttrName.trim()) {
      toast.error('Введите название атрибута')
      return
    }

    try {
      const attr = await createCustomAttributeDefinition(newAttrName.trim(), newAttrType)
      // Add to card immediately
      if (card) {
        await window.electron.invoke('set-card-custom-attribute', card.uid, attr.id, '')
        setCardCustomAttrs(prev => [...prev, {
          attributeId: attr.id,
          attributeName: attr.name,
          attributeType: attr.type,
          value: ''
        }])
      }
      setNewAttrName('')
      setNewAttrType('text')
      setShowAddAttribute(false)
      toast.success('Атрибут создан')
    } catch (err) {
      toast.error('Не удалось создать атрибут')
    }
  }

  const handleAddExistingAttribute = async (attrDef: CustomAttributeDefinition) => {
    if (!card) return

    try {
      await window.electron.invoke('set-card-custom-attribute', card.uid, attrDef.id, '')
      setCardCustomAttrs(prev => [...prev, {
        attributeId: attrDef.id,
        attributeName: attrDef.name,
        attributeType: attrDef.type,
        value: ''
      }])
      setShowAddExisting(false)
      toast.success('Атрибут добавлен')
    } catch (err) {
      toast.error('Не удалось добавить атрибут')
    }
  }

  const handleUpdateCustomAttribute = async (attrId: number, value: string) => {
    if (!card) return

    try {
      await window.electron.invoke('set-card-custom-attribute', card.uid, attrId, value)
      setCardCustomAttrs(prev => prev.map(attr =>
        attr.attributeId === attrId ? { ...attr, value } : attr
      ))
    } catch (err) {
      toast.error('Не удалось обновить атрибут')
    }
  }

  const handleRemoveCustomAttribute = async (attrId: number) => {
    if (!card) return

    try {
      await window.electron.invoke('remove-card-custom-attribute', card.uid, attrId)
      setCardCustomAttrs(prev => prev.filter(attr => attr.attributeId !== attrId))
      toast.success('Атрибут удален из карточки')
    } catch (err) {
      toast.error('Не удалось удалить атрибут')
    }
  }

  // Get attributes that can be added (not already on card)
  const availableAttributes = customAttributeDefinitions.filter(
    def => !cardCustomAttrs.some(attr => attr.attributeId === def.id)
  )

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
              ID: <span className="font-mono font-medium text-card-foreground">{card.uid.slice(0, 8)}</span>
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

          {/* Custom Attributes Section */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-card-foreground">Дополнительные атрибуты</h4>
              <div className="flex gap-2">
                {availableAttributes.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddExisting(!showAddExisting)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Добавить существующий
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddAttribute(!showAddAttribute)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Создать новый
                </Button>
              </div>
            </div>

            {/* Add existing attribute dropdown */}
            {showAddExisting && availableAttributes.length > 0 && (
              <div className="mb-3 p-3 bg-muted rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground mb-2">Выберите атрибут для добавления:</p>
                {availableAttributes.map(attr => (
                  <button
                    key={attr.id}
                    type="button"
                    onClick={() => handleAddExistingAttribute(attr)}
                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors text-left"
                  >
                    <span className="w-8 h-8 rounded bg-background flex items-center justify-center text-xs font-medium">
                      {attributeTypeLabels[attr.type]}
                    </span>
                    <span className="text-sm">{attr.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Create new attribute form */}
            {showAddAttribute && (
              <div className="mb-3 p-3 bg-muted rounded-lg space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={newAttrName}
                    onChange={(e) => setNewAttrName(e.target.value)}
                    placeholder="Название атрибута"
                    className="flex-1"
                  />
                  <div className="flex gap-1">
                    {(Object.keys(attributeTypeLabels) as CustomAttributeType[]).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewAttrType(type)}
                        className={`w-10 h-10 rounded flex items-center justify-center text-sm font-medium transition-colors
                                  ${newAttrType === type
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-background hover:bg-accent'}`}
                        title={type === 'text' ? 'Текст' : type === 'number' ? 'Число' : type === 'date' ? 'Дата' : 'Да/Нет'}
                      >
                        {attributeTypeLabels[type]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddAttribute(false)}>
                    Отмена
                  </Button>
                  <Button type="button" size="sm" onClick={handleCreateNewAttribute}>
                    Создать
                  </Button>
                </div>
              </div>
            )}

            {/* Existing custom attributes */}
            {cardCustomAttrs.length > 0 ? (
              <div className="space-y-2">
                {cardCustomAttrs.map(attr => (
                  <div key={attr.attributeId} className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs font-medium flex-shrink-0">
                      {attributeTypeLabels[attr.attributeType]}
                    </span>
                    <span className="text-sm text-muted-foreground w-32 flex-shrink-0 truncate">
                      {attr.attributeName}:
                    </span>
                    {attr.attributeType === 'text' && (
                      <input
                        type="text"
                        value={attr.value || ''}
                        onChange={(e) => handleUpdateCustomAttribute(attr.attributeId, e.target.value)}
                        className="flex-1 h-8 px-2 rounded border border-input bg-background text-sm"
                      />
                    )}
                    {attr.attributeType === 'number' && (
                      <input
                        type="number"
                        value={attr.value || ''}
                        onChange={(e) => handleUpdateCustomAttribute(attr.attributeId, e.target.value)}
                        className="flex-1 h-8 px-2 rounded border border-input bg-background text-sm"
                      />
                    )}
                    {attr.attributeType === 'date' && (
                      <input
                        type="date"
                        value={attr.value || ''}
                        onChange={(e) => handleUpdateCustomAttribute(attr.attributeId, e.target.value)}
                        className="flex-1 h-8 px-2 rounded border border-input bg-background text-sm"
                      />
                    )}
                    {attr.attributeType === 'boolean' && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={attr.value === 'true'}
                          onChange={(e) => handleUpdateCustomAttribute(attr.attributeId, e.target.checked ? 'true' : 'false')}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{attr.value === 'true' ? 'Да' : 'Нет'}</span>
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomAttribute(attr.attributeId)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Удалить атрибут из карточки"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-3">
                Нет дополнительных атрибутов
              </p>
            )}
          </div>

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
