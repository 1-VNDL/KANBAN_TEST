import { create } from 'zustand'
import type {
  Card,
  Column,
  Stream,
  Assignee,
  CardStatus,
  AppSettings,
  CreateCardParams,
  UpdateCardParams,
  CreateColumnParams,
  UpdateColumnParams,
  MoveCardParams,
  CardFilters
} from '../../shared/types'

interface KanbanState {
  // Data
  columns: Column[]
  cards: Card[]
  archivedCards: Card[]
  streams: Stream[]
  assignees: Assignee[]
  cardStatuses: CardStatus[]
  appSettings: AppSettings | null

  // UI State
  isLoading: boolean
  isDatabaseConnected: boolean
  searchQuery: string
  filters: CardFilters

  // Actions
  setLoading: (loading: boolean) => void
  setDatabaseConnected: (connected: boolean) => void
  setSearchQuery: (query: string) => void
  setFilters: (filters: CardFilters) => void

  // Data actions
  fetchAllData: () => Promise<void>
  refreshCards: () => Promise<void>
  refreshColumns: () => Promise<void>
  refreshArchivedCards: (filters?: CardFilters) => Promise<void>

  // Column actions
  createColumn: (params: CreateColumnParams) => Promise<Column>
  updateColumn: (params: UpdateColumnParams) => Promise<Column>
  deleteColumn: (id: string) => Promise<boolean>
  reorderColumns: (columnIds: string[]) => Promise<void>

  // Card actions
  createCard: (params: CreateCardParams) => Promise<Card>
  updateCard: (params: UpdateCardParams) => Promise<Card>
  deleteCard: (uid: string) => Promise<boolean>
  moveCard: (params: MoveCardParams) => Promise<void>
  archiveCard: (uid: string) => Promise<void>
  restoreCard: (uid: string) => Promise<Card>

  // Stream actions
  createStream: (name: string, color?: string) => Promise<Stream>
  updateStream: (id: number, name: string, color?: string) => Promise<Stream>
  deleteStream: (id: number) => Promise<{ success: boolean; cardsCount?: number }>

  // Assignee actions
  createAssignee: (name: string, email?: string, position?: string) => Promise<Assignee>
  updateAssignee: (id: number, name: string, email?: string, position?: string) => Promise<Assignee>
  deleteAssignee: (id: number) => Promise<{ success: boolean; cardsCount?: number }>

  // Status actions
  createCardStatus: (name: string, color?: string) => Promise<CardStatus>
  updateCardStatus: (id: number, name: string, color?: string) => Promise<CardStatus>
  deleteCardStatus: (id: number) => Promise<{ success: boolean; cardsCount?: number }>

  // Settings actions
  updateAppSetting: (key: string, value: string) => Promise<void>
  refreshSettings: () => Promise<void>
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  // Initial state
  columns: [],
  cards: [],
  archivedCards: [],
  streams: [],
  assignees: [],
  cardStatuses: [],
  appSettings: null,
  isLoading: false,
  isDatabaseConnected: false,
  searchQuery: '',
  filters: {},

  // UI actions
  setLoading: (loading) => set({ isLoading: loading }),
  setDatabaseConnected: (connected) => set({ isDatabaseConnected: connected }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setFilters: (filters) => set({ filters }),

  // Fetch all data
  fetchAllData: async () => {
    set({ isLoading: true })
    try {
      const [columns, cards, streams, assignees, cardStatuses, appSettings] = await Promise.all([
        window.electron.invoke('get-all-columns') as Promise<Column[]>,
        window.electron.invoke('get-all-cards') as Promise<Card[]>,
        window.electron.invoke('get-all-streams') as Promise<Stream[]>,
        window.electron.invoke('get-all-assignees') as Promise<Assignee[]>,
        window.electron.invoke('get-all-card-statuses') as Promise<CardStatus[]>,
        window.electron.invoke('get-app-settings') as Promise<AppSettings>
      ])

      set({
        columns,
        cards,
        streams,
        assignees,
        cardStatuses,
        appSettings,
        isDatabaseConnected: true
      })
    } catch (error) {
      console.error('Failed to fetch data:', error)
      set({ isDatabaseConnected: false })
    } finally {
      set({ isLoading: false })
    }
  },

  refreshCards: async () => {
    try {
      const cards = await window.electron.invoke('get-all-cards') as Card[]
      set({ cards })
    } catch (error) {
      console.error('Failed to refresh cards:', error)
    }
  },

  refreshColumns: async () => {
    try {
      const columns = await window.electron.invoke('get-all-columns') as Column[]
      set({ columns })
    } catch (error) {
      console.error('Failed to refresh columns:', error)
    }
  },

  refreshArchivedCards: async (filters?: CardFilters) => {
    try {
      const archivedCards = await window.electron.invoke('get-archived-cards', filters) as Card[]
      set({ archivedCards })
    } catch (error) {
      console.error('Failed to refresh archived cards:', error)
    }
  },

  // Column actions
  createColumn: async (params) => {
    const column = await window.electron.invoke('create-column', params) as Column
    await get().refreshColumns()
    return column
  },

  updateColumn: async (params) => {
    const column = await window.electron.invoke('update-column', params) as Column
    await get().refreshColumns()
    return column
  },

  deleteColumn: async (id) => {
    const result = await window.electron.invoke('delete-column', id) as boolean
    if (result) {
      await Promise.all([get().refreshColumns(), get().refreshCards()])
    }
    return result
  },

  reorderColumns: async (columnIds) => {
    await window.electron.invoke('reorder-columns', columnIds)
    await get().refreshColumns()
  },

  // Card actions
  createCard: async (params) => {
    const { appSettings } = get()
    const card = await window.electron.invoke('create-card', params, appSettings?.currentUserName) as Card
    await get().refreshCards()
    return card
  },

  updateCard: async (params) => {
    const { appSettings } = get()
    const card = await window.electron.invoke('update-card', params, appSettings?.currentUserName) as Card
    await get().refreshCards()
    return card
  },

  deleteCard: async (uid) => {
    const result = await window.electron.invoke('delete-card', uid) as boolean
    await get().refreshCards()
    return result
  },

  moveCard: async (params) => {
    const { appSettings } = get()
    await window.electron.invoke('move-card', params, appSettings?.currentUserName)
    await get().refreshCards()
  },

  archiveCard: async (uid) => {
    const { appSettings } = get()
    await window.electron.invoke('archive-card', uid, appSettings?.currentUserName)
    await get().refreshCards()
  },

  restoreCard: async (uid) => {
    const { appSettings } = get()
    const card = await window.electron.invoke('restore-card', uid, appSettings?.currentUserName) as Card
    await Promise.all([get().refreshCards(), get().refreshArchivedCards()])
    return card
  },

  // Stream actions
  createStream: async (name, color) => {
    const stream = await window.electron.invoke('create-stream', name, color) as Stream
    const streams = await window.electron.invoke('get-all-streams') as Stream[]
    set({ streams })
    return stream
  },

  updateStream: async (id, name, color) => {
    const stream = await window.electron.invoke('update-stream', id, name, color) as Stream
    const streams = await window.electron.invoke('get-all-streams') as Stream[]
    set({ streams })
    return stream
  },

  deleteStream: async (id) => {
    const result = await window.electron.invoke('delete-stream', id) as { success: boolean; cardsCount?: number }
    if (result.success) {
      const streams = await window.electron.invoke('get-all-streams') as Stream[]
      set({ streams })
    }
    return result
  },

  // Assignee actions
  createAssignee: async (name, email, position) => {
    const assignee = await window.electron.invoke('create-assignee', name, email, position) as Assignee
    const assignees = await window.electron.invoke('get-all-assignees') as Assignee[]
    set({ assignees })
    return assignee
  },

  updateAssignee: async (id, name, email, position) => {
    const assignee = await window.electron.invoke('update-assignee', id, name, email, position) as Assignee
    const assignees = await window.electron.invoke('get-all-assignees') as Assignee[]
    set({ assignees })
    return assignee
  },

  deleteAssignee: async (id) => {
    const result = await window.electron.invoke('delete-assignee', id) as { success: boolean; cardsCount?: number }
    if (result.success) {
      const assignees = await window.electron.invoke('get-all-assignees') as Assignee[]
      set({ assignees })
    }
    return result
  },

  // Status actions
  createCardStatus: async (name, color) => {
    const status = await window.electron.invoke('create-card-status', name, color) as CardStatus
    const cardStatuses = await window.electron.invoke('get-all-card-statuses') as CardStatus[]
    set({ cardStatuses })
    return status
  },

  updateCardStatus: async (id, name, color) => {
    const status = await window.electron.invoke('update-card-status', id, name, color) as CardStatus
    const cardStatuses = await window.electron.invoke('get-all-card-statuses') as CardStatus[]
    set({ cardStatuses })
    return status
  },

  deleteCardStatus: async (id) => {
    const result = await window.electron.invoke('delete-card-status', id) as { success: boolean; cardsCount?: number }
    if (result.success) {
      const cardStatuses = await window.electron.invoke('get-all-card-statuses') as CardStatus[]
      set({ cardStatuses })
    }
    return result
  },

  // Settings actions
  updateAppSetting: async (key, value) => {
    await window.electron.invoke('update-app-setting', key, value)
    await get().refreshSettings()
  },

  refreshSettings: async () => {
    try {
      const appSettings = await window.electron.invoke('get-app-settings') as AppSettings
      set({ appSettings })
    } catch (error) {
      console.error('Failed to refresh settings:', error)
    }
  }
}))
