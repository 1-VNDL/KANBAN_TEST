import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, X } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
  color?: string
}

interface SelectProps {
  label?: string
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  required?: boolean
}

export function Select({
  label,
  options,
  value,
  onChange,
  placeholder = 'Выберите...',
  error,
  required
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find(o => o.value === value)

  return (
    <div className="w-full" ref={ref}>
      {label && (
        <label className="block text-sm font-medium text-foreground mb-1.5">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full h-10 px-3 rounded-lg border bg-background text-left flex items-center justify-between
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                     ${error ? 'border-destructive' : 'border-input'}`}
        >
          <span className={selectedOption ? 'text-foreground' : 'text-muted-foreground'}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-auto animate-fade-in">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-accent transition-colors
                           ${option.value === value ? 'bg-accent' : ''}`}
              >
                {option.color && (
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: option.color }}
                  />
                )}
                <span className="flex-1 text-card-foreground">{option.label}</span>
                {option.value === value && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}

interface MultiSelectProps {
  label?: string
  options: SelectOption[]
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  error?: string
  required?: boolean
}

export function MultiSelect({
  label,
  options,
  values,
  onChange,
  placeholder = 'Выберите...',
  error,
  required
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleValue = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter(v => v !== value))
    } else {
      onChange([...values, value])
    }
  }

  const removeValue = (value: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(values.filter(v => v !== value))
  }

  const selectedOptions = options.filter(o => values.includes(o.value))

  return (
    <div className="w-full" ref={ref}>
      {label && (
        <label className="block text-sm font-medium text-foreground mb-1.5">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full min-h-10 px-3 py-1.5 rounded-lg border bg-background text-left flex items-center justify-between gap-2
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                     ${error ? 'border-destructive' : 'border-input'}`}
        >
          <div className="flex-1 flex flex-wrap gap-1">
            {selectedOptions.length > 0 ? (
              selectedOptions.map((option) => (
                <span
                  key={option.value}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent rounded text-sm"
                >
                  {option.label}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-destructive"
                    onClick={(e) => removeValue(option.value, e)}
                  />
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-auto animate-fade-in">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleValue(option.value)}
                className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-accent transition-colors
                           ${values.includes(option.value) ? 'bg-accent' : ''}`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center
                               ${values.includes(option.value) ? 'bg-primary border-primary' : 'border-input'}`}>
                  {values.includes(option.value) && (
                    <Check className="w-3 h-3 text-primary-foreground" />
                  )}
                </div>
                <span className="text-card-foreground">{option.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
