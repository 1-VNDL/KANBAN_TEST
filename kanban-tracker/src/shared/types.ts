// Card entity
export interface Card {
  uid: string;
  stream: string;
  department: string;
  assignees: string[];
  plannedInterviewDate: string | null;
  actualStatus: string;
  columnId: string;
  position: number;
  color?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  isArchived: boolean;
  archivedAt?: string;
  autoArchiveScheduledAt?: string;
}

// Column entity
export interface Column {
  id: string;
  name: string;
  position: number;
  color?: string;
  isClosedColumn: boolean;
  createdAt: string;
  updatedAt: string;
}

// Stream entity
export interface Stream {
  id: number;
  name: string;
  color?: string;
  createdAt: string;
}

// Assignee entity
export interface Assignee {
  id: number;
  name: string;
  email?: string;
  position?: string;
  createdAt: string;
}

// Card Status entity
export interface CardStatus {
  id: number;
  name: string;
  color?: string;
  createdAt: string;
}

// App Settings
export interface AppSettings {
  autoArchiveDelayMinutes: number;
  currentUserName: string;
  theme: 'light' | 'dark' | 'system';
}

// Local Configuration
export interface LocalConfig {
  dbPath: string;
  isConfigured: boolean;
  lastUserName?: string;
}

// Sync Metadata
export interface SyncMetadata {
  lastModifiedAt: string;
  lastModifiedBy?: string;
  dbVersion: number;
}

// Database change event
export interface DatabaseChangeEvent {
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  recordId: string | number;
  timestamp: number;
}

// Create/Update params
export interface CreateCardParams {
  stream: string;
  department: string;
  assignees: string[];
  plannedInterviewDate: string | null;
  actualStatus: string;
  columnId: string;
  color?: string;
}

export interface UpdateCardParams {
  uid: string;
  updates: Partial<Omit<Card, 'uid' | 'createdAt'>>;
  expectedUpdatedAt?: string;
}

export interface CreateColumnParams {
  name: string;
  position?: number;
  color?: string;
}

export interface UpdateColumnParams {
  id: string;
  updates: Partial<Omit<Column, 'id' | 'createdAt' | 'isClosedColumn'>>;
}

export interface MoveCardParams {
  cardUid: string;
  targetColumnId: string;
  targetPosition: number;
}

// IPC response types
export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Startup mode
export enum StartupMode {
  CREATE_NEW = 'create_new',
  SELECT_EXISTING = 'select_existing'
}

// Filter types
export interface CardFilters {
  search?: string;
  streams?: string[];
  assignees?: string[];
  statuses?: string[];
  dateFrom?: string;
  dateTo?: string;
}

// Export options
export interface ExportOptions {
  format: 'xlsx' | 'csv';
  includeArchived: boolean;
  filters?: CardFilters;
}
