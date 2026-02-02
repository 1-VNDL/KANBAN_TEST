import React, { useState, useEffect, useRef } from 'react'
import { Filter, X, ChevronDown, Calendar } from 'lucide-react'
import { useKanbanStore } from '../../stores/kanbanStore'
import type { BoardFilters } from '../../../shared/types'

interface FilterPanelProps {
  filters: BoardFilters
  onFiltersChange: (filters: BoardFilters) => void
  activeFiltersCount: number
}

export function FilterPanel({ filters, onFiltersChange, activeFiltersCount }: FilterPanelProps) {
  const { streams, assignees, cardStatuses, columns } = useKanbanStore()
  const [isOpen, setIsOpen] = useState(false)
  const [departments, setDepartments] = useState<string[]>([])
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const deps = await window.electron.invoke('get-all-departments') as string[]
        setDepartments(deps)
      } catch (err) {
        console.error('Failed to load departments:', err)
      }
    }
    loadDepartments()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleClearFilters = () => {
    onFiltersChange({
      stream: null,
      department: null,
      assignee: null,
      status: null,
      dateFrom: null,
      dateTo: null,
      column: null
    })
  }

  const updateFilter = (key: keyof BoardFilters, value: string | null) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const nonClosedColumns = columns.filter(c => !c.isClosedColumn)

  return (
    <div className="relative" ref={panelRef}>
      {/* Filter button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors
                   ${activeFiltersCount > 0
                     ? 'bg-primary text-primary-foreground border-primary'
                     : 'bg-background border-input hover:bg-accent'}`}
      >
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Фильтры</span>
        {activeFiltersCount > 0 && (
          <span className="w-5 h-5 rounded-full bg-white text-primary text-xs font-bold flex items-center justify-center">
            {activeFiltersCount}
          </span>
        )}
      </button>

      {/* Filter panel dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 z-50 w-80 bg-card border border-border rounded-xl shadow-xl animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-semibold text-card-foreground">Фильтры</h3>
            {activeFiltersCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="text-sm text-muted-foreground hover:text-destructive flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Сбросить
              </button>
            )}
          </div>

          {/* Filter options */}
          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            {/* Stream filter */}
            <FilterSelect
              label="Стрим"
              value={filters.stream}
              onChange={(val) => updateFilter('stream', val)}
              options={streams.map(s => ({ value: s.name, label: s.name }))}
              placeholder="Все стримы"
            />

            {/* Department filter */}
            <FilterSelect
              label="Отдел/Управление"
              value={filters.department}
              onChange={(val) => updateFilter('department', val)}
              options={departments.map(d => ({ value: d, label: d }))}
              placeholder="Все отделы"
            />

            {/* Assignee filter */}
            <FilterSelect
              label="Ответственный"
              value={filters.assignee}
              onChange={(val) => updateFilter('assignee', val)}
              options={assignees.map(a => ({ value: a.name, label: a.name }))}
              placeholder="Все ответственные"
            />

            {/* Status filter */}
            <FilterSelect
              label="Статус"
              value={filters.status}
              onChange={(val) => updateFilter('status', val)}
              options={cardStatuses.map(s => ({ value: s.name, label: s.name }))}
              placeholder="Все статусы"
            />

            {/* Column filter */}
            <FilterSelect
              label="Колонка"
              value={filters.column}
              onChange={(val) => updateFilter('column', val)}
              options={nonClosedColumns.map(c => ({ value: c.id, label: c.name }))}
              placeholder="Все колонки"
            />

            {/* Date range */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-card-foreground">Дата интервью</label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="date"
                    value={filters.dateFrom || ''}
                    onChange={(e) => updateFilter('dateFrom', e.target.value || null)}
                    className="w-full pl-10 pr-3 py-2 text-sm rounded-lg border border-input bg-background
                             focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="От"
                  />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="date"
                    value={filters.dateTo || ''}
                    onChange={(e) => updateFilter('dateTo', e.target.value || null)}
                    className="w-full pl-10 pr-3 py-2 text-sm rounded-lg border border-input bg-background
                             focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="До"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper component for filter select
interface FilterSelectProps {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  options: { value: string; label: string }[]
  placeholder: string
}

function FilterSelect({ label, value, onChange, options, placeholder }: FilterSelectProps) {
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
    <div className="space-y-1.5" ref={ref}>
      <label className="text-sm font-medium text-card-foreground">{label}</label>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg border border-input
                    bg-background hover:bg-accent transition-colors text-left"
        >
          <span className={selectedOption ? 'text-card-foreground' : 'text-muted-foreground'}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            <button
              onClick={() => {
                onChange(null)
                setIsOpen(false)
              }}
              className={`w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors
                        ${!value ? 'bg-accent/50 text-primary' : 'text-muted-foreground'}`}
            >
              {placeholder}
            </button>
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors
                          ${value === option.value ? 'bg-accent/50 text-primary' : 'text-card-foreground'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
