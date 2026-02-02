// Custom attribute types
export type CustomAttributeType = 'text' | 'number' | 'date' | 'boolean';

// Custom attribute definition (shared in DB)
export interface CustomAttributeDefinition {
  id: number;
  name: string;
  type: CustomAttributeType;
  createdAt: string;
}

// Custom attribute value for a card
export interface CardCustomAttribute {
  attributeId: number;
  attributeName: string;
  attributeType: CustomAttributeType;
  value: string | null;
}

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
  customAttributes?: CardCustomAttribute[];
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

// Recent database entry
export interface RecentDatabase {
  path: string;
  name: string; // User-friendly name
  lastOpenedAt: string;
}

// Board entry (local, per-user)
export interface LocalBoard {
  id: string;
  dbPath: string;
  displayName: string; // User's custom name for the board
  createdAt: string;
}

// Local Configuration
export interface LocalConfig {
  dbPath: string;
  isConfigured: boolean;
  lastUserName?: string;
  recentDatabases?: RecentDatabase[];
  boards?: LocalBoard[];
  currentBoardId?: string;
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
  departments?: string[];
  assignees?: string[];
  statuses?: string[];
  dateFrom?: string;
  dateTo?: string;
  columns?: string[];
  customAttributes?: { attributeId: number; value: string }[];
}

// Board filter state (for UI)
export interface BoardFilters {
  stream: string | null;
  department: string | null;
  assignee: string | null;
  status: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  column: string | null;
}

// Export options
export interface ExportOptions {
  format: 'xlsx' | 'csv';
  includeArchived: boolean;
  filters?: CardFilters;
}
