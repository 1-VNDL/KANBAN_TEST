import React, { useState, useRef, useEffect } from 'react'
import { Palette, X } from 'lucide-react'

interface ColorPickerProps {
  label?: string
  value: string | undefined
  onChange: (color: string | undefined) => void
  presetColors?: string[]
}

const DEFAULT_COLORS = [
  '#EBF5FB', '#FDECEA', '#FEF5E7', '#EAFAF1', '#F4ECF7',
  '#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
]

export function ColorPicker({
  label,
  value,
  onChange,
  presetColors = DEFAULT_COLORS
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customColor, setCustomColor] = useState(value || '#3B82F6')
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

  return (
    <div className="w-full" ref={ref}>
      {label && (
        <label className="block text-sm font-medium text-foreground mb-1.5">
          {label}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full h-10 px-3 rounded-lg border border-input bg-background flex items-center gap-2
                    focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          {value ? (
            <>
              <span
                className="w-6 h-6 rounded border border-border"
                style={{ backgroundColor: value }}
              />
              <span className="text-foreground flex-1 text-left">{value}</span>
              <X
                className="w-4 h-4 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(undefined)
                }}
              />
            </>
          ) : (
            <>
              <Palette className="w-5 h-5 text-muted-foreground" />
              <span className="text-muted-foreground flex-1 text-left">Выбрать цвет</span>
            </>
          )}
        </button>

        {isOpen && (
          <div className="absolute z-10 w-64 mt-1 p-3 bg-card border border-border rounded-lg shadow-lg animate-fade-in">
            <div className="grid grid-cols-5 gap-2 mb-3">
              {presetColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    onChange(color)
                    setIsOpen(false)
                  }}
                  className={`w-8 h-8 rounded border-2 transition-transform hover:scale-110
                             ${value === color ? 'border-primary' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-border">
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="flex-1 h-8 px-2 text-sm rounded border border-input bg-background"
                placeholder="#000000"
              />
              <button
                type="button"
                onClick={() => {
                  onChange(customColor)
                  setIsOpen(false)
                }}
                className="px-3 h-8 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
