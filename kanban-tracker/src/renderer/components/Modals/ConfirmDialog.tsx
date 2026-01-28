import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal, Button } from '../UI'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  variant = 'default'
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${variant === 'destructive' ? 'bg-destructive/10' : 'bg-primary/10'}`}>
            <AlertTriangle className={`w-5 h-5 ${variant === 'destructive' ? 'text-destructive' : 'text-primary'}`} />
          </div>
          <p className="text-sm text-muted-foreground flex-1">{message}</p>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'primary'}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
