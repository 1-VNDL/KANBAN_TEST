import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { useKanbanStore } from '../../stores/kanbanStore'
import { Button, Input, ColorPicker } from '../UI'
import { ConfirmDialog } from '../Modals/ConfirmDialog'

export function SettingsPage() {
  return (
    <div className="h-full overflow-auto p-6 space-y-8">
      <StreamsSection />
      <AssigneesSection />
      <StatusesSection />
    </div>
  )
}

// Streams Section
function StreamsSection() {
  const { streams, createStream, updateStream, deleteStream } = useKanbanStore()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string | undefined>()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState<string | undefined>()
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await createStream(newName.trim(), newColor)
      setNewName('')
      setNewColor(undefined)
      toast.success('Стрим добавлен')
    } catch {
      toast.error('Не удалось добавить стрим')
    }
  }

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return
    try {
      await updateStream(id, editName.trim(), editColor)
      setEditingId(null)
      toast.success('Стрим обновлен')
    } catch {
      toast.error('Не удалось обновить стрим')
    }
  }

  const handleDelete = async () => {
    if (deleteId === null) return
    const result = await deleteStream(deleteId)
    if (result.success) {
      toast.success('Стрим удален')
      setDeleteId(null)
    } else {
      setDeleteError(`Нельзя удалить: используется в ${result.cardsCount} карточках`)
    }
  }

  const startEdit = (stream: typeof streams[0]) => {
    setEditingId(stream.id)
    setEditName(stream.name)
    setEditColor(stream.color)
  }

  return (
    <section>
      <h3 className="text-lg font-semibold text-foreground mb-4">Стримы</h3>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Название</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground w-32">Цвет</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground w-24">Действия</th>
            </tr>
          </thead>
          <tbody>
            {streams.map((stream) => (
              <tr key={stream.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  {editingId === stream.id ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8"
                      autoFocus
                    />
                  ) : (
                    <span className="text-card-foreground">{stream.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === stream.id ? (
                    <ColorPicker value={editColor} onChange={setEditColor} />
                  ) : stream.color ? (
                    <span
                      className="inline-block w-6 h-6 rounded border border-border"
                      style={{ backgroundColor: stream.color }}
                    />
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {editingId === stream.id ? (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleUpdate(stream.id)}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(stream)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteId(stream.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {/* New stream row */}
            <tr className="bg-muted/30">
              <td className="px-4 py-3">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Новый стрим"
                  className="h-8"
                />
              </td>
              <td className="px-4 py-3">
                <ColorPicker value={newColor} onChange={setNewColor} />
              </td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
                  <Plus className="w-4 h-4 mr-1" />
                  Добавить
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => { setDeleteId(null); setDeleteError(null) }}
        onConfirm={handleDelete}
        title="Удалить стрим"
        message={deleteError || "Вы уверены, что хотите удалить этот стрим?"}
        confirmText="Удалить"
        variant="destructive"
      />
    </section>
  )
}

// Assignees Section
function AssigneesSection() {
  const { assignees, createAssignee, updateAssignee, deleteAssignee } = useKanbanStore()
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPosition, setNewPosition] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPosition, setEditPosition] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await createAssignee(newName.trim(), newEmail.trim() || undefined, newPosition.trim() || undefined)
      setNewName('')
      setNewEmail('')
      setNewPosition('')
      toast.success('Ответственный добавлен')
    } catch {
      toast.error('Не удалось добавить ответственного')
    }
  }

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return
    try {
      await updateAssignee(id, editName.trim(), editEmail.trim() || undefined, editPosition.trim() || undefined)
      setEditingId(null)
      toast.success('Ответственный обновлен')
    } catch {
      toast.error('Не удалось обновить ответственного')
    }
  }

  const handleDelete = async () => {
    if (deleteId === null) return
    const result = await deleteAssignee(deleteId)
    if (result.success) {
      toast.success('Ответственный удален')
      setDeleteId(null)
    } else {
      setDeleteError(`Нельзя удалить: назначен на ${result.cardsCount} карточек`)
    }
  }

  const startEdit = (assignee: typeof assignees[0]) => {
    setEditingId(assignee.id)
    setEditName(assignee.name)
    setEditEmail(assignee.email || '')
    setEditPosition(assignee.position || '')
  }

  return (
    <section>
      <h3 className="text-lg font-semibold text-foreground mb-4">Ответственные</h3>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Имя</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Должность</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground w-24">Действия</th>
            </tr>
          </thead>
          <tbody>
            {assignees.map((assignee) => (
              <tr key={assignee.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  {editingId === assignee.id ? (
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" autoFocus />
                  ) : (
                    <span className="text-card-foreground">{assignee.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === assignee.id ? (
                    <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-8" />
                  ) : (
                    <span className="text-muted-foreground">{assignee.email || '-'}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === assignee.id ? (
                    <Input value={editPosition} onChange={(e) => setEditPosition(e.target.value)} className="h-8" />
                  ) : (
                    <span className="text-muted-foreground">{assignee.position || '-'}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {editingId === assignee.id ? (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleUpdate(assignee.id)}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(assignee)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteId(assignee.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {/* New assignee row */}
            <tr className="bg-muted/30">
              <td className="px-4 py-3">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Имя" className="h-8" />
              </td>
              <td className="px-4 py-3">
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email" className="h-8" />
              </td>
              <td className="px-4 py-3">
                <Input value={newPosition} onChange={(e) => setNewPosition(e.target.value)} placeholder="Должность" className="h-8" />
              </td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
                  <Plus className="w-4 h-4 mr-1" />
                  Добавить
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => { setDeleteId(null); setDeleteError(null) }}
        onConfirm={handleDelete}
        title="Удалить ответственного"
        message={deleteError || "Вы уверены, что хотите удалить этого ответственного?"}
        confirmText="Удалить"
        variant="destructive"
      />
    </section>
  )
}

// Statuses Section
function StatusesSection() {
  const { cardStatuses, createCardStatus, updateCardStatus, deleteCardStatus } = useKanbanStore()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string | undefined>()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState<string | undefined>()
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await createCardStatus(newName.trim(), newColor)
      setNewName('')
      setNewColor(undefined)
      toast.success('Статус добавлен')
    } catch {
      toast.error('Не удалось добавить статус')
    }
  }

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return
    try {
      await updateCardStatus(id, editName.trim(), editColor)
      setEditingId(null)
      toast.success('Статус обновлен')
    } catch {
      toast.error('Не удалось обновить статус')
    }
  }

  const handleDelete = async () => {
    if (deleteId === null) return
    const result = await deleteCardStatus(deleteId)
    if (result.success) {
      toast.success('Статус удален')
      setDeleteId(null)
    } else {
      setDeleteError(`Нельзя удалить: используется в ${result.cardsCount} карточках`)
    }
  }

  const startEdit = (status: typeof cardStatuses[0]) => {
    setEditingId(status.id)
    setEditName(status.name)
    setEditColor(status.color)
  }

  return (
    <section>
      <h3 className="text-lg font-semibold text-foreground mb-4">Фактические статусы</h3>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Название</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground w-32">Цвет метки</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground w-24">Действия</th>
            </tr>
          </thead>
          <tbody>
            {cardStatuses.map((status) => (
              <tr key={status.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  {editingId === status.id ? (
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" autoFocus />
                  ) : (
                    <span className="text-card-foreground">{status.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === status.id ? (
                    <ColorPicker value={editColor} onChange={setEditColor} />
                  ) : status.color ? (
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: status.color, color: '#1F2937' }}
                    >
                      {status.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {editingId === status.id ? (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleUpdate(status.id)}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(status)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteId(status.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {/* New status row */}
            <tr className="bg-muted/30">
              <td className="px-4 py-3">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Новый статус" className="h-8" />
              </td>
              <td className="px-4 py-3">
                <ColorPicker value={newColor} onChange={setNewColor} />
              </td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
                  <Plus className="w-4 h-4 mr-1" />
                  Добавить
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => { setDeleteId(null); setDeleteError(null) }}
        onConfirm={handleDelete}
        title="Удалить статус"
        message={deleteError || "Вы уверены, что хотите удалить этот статус?"}
        confirmText="Удалить"
        variant="destructive"
      />
    </section>
  )
}
