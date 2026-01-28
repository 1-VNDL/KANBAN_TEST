import React from 'react'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Calendar, X } from 'lucide-react'

interface DatePickerProps {
  label?: string
  value: string | null
  onChange: (date: string | null) => void
  placeholder?: string
  error?: string
  required?: boolean
  min?: string
  max?: string
}

export function DatePicker({
  label,
  value,
  onChange,
  placeholder = 'Выберите дату',
  error,
  required,
  min,
  max
}: DatePickerProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue || null)
  }

  const handleClear = () => {
    onChange(null)
  }

  // Format display value
  const displayValue = value
    ? format(parseISO(value), 'dd.MM.yyyy', { locale: ru })
    : ''

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-foreground mb-1.5">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <Calendar className="w-4 h-4 text-muted-foreground" />
        </div>

        <input
          type="date"
          value={value || ''}
          onChange={handleChange}
          min={min}
          max={max}
          className={`w-full h-10 pl-10 pr-10 rounded-lg border bg-background text-foreground
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                     ${error ? 'border-destructive' : 'border-input'}
                     [&::-webkit-calendar-picker-indicator]:opacity-0
                     [&::-webkit-calendar-picker-indicator]:absolute
                     [&::-webkit-calendar-picker-indicator]:inset-0
                     [&::-webkit-calendar-picker-indicator]:w-full
                     [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
        />

        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
