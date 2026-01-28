# ТЕХНИЧЕСКОЕ ЗАДАНИЕ: ELECTRON КАНБАН-ТРЕКЕР ДЛЯ КОНСАЛТИНГОВОГО ПРОЕКТА

---

## 1. ОБЩЕЕ ОПИСАНИЕ ПРОЕКТА

### 1.1 Цель
Разработать desktop приложение на Electron для управления задачами консалтингового проекта в формате канбан-доски с возможностью многопользовательской работы через общий сетевой диск.

### 1.2 Ключевые ограничения
- **НЕТ** доступа к серверу компании
- **ТОЛЬКО** общий сетевой диск для хранения данных
- **ОБЯЗАТЕЛЬНА** синхронизация между пользователями в реальном времени
- **КРИТИЧНО** предотвращение конфликтов при одновременном редактировании
- **PORTABLE EXE** — приложение должно запускаться без установки и без админских прав

### 1.3 Целевая аудитория
Команда консультантов (5-20 человек), работающих одновременно над проектом.

---

## 2. ТЕХНИЧЕСКИЙ СТЕК

### 2.1 Обязательные технологии
```json
{
  "framework": "Electron (latest stable)",
  "frontend": "React 18+ с TypeScript",
  "styling": "Tailwind CSS",
  "database": "better-sqlite3 (WAL mode)",
  "drag-and-drop": "@dnd-kit/core или react-beautiful-dnd",
  "file-watching": "chokidar",
  "date-handling": "date-fns",
  "state-management": "Zustand или Redux Toolkit",
  "icons": "lucide-react",
  "notifications": "electron-notifications или react-hot-toast"
}
```

### 2.2 Структура проекта
```
kanban-tracker/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts
│   │   ├── database.ts          # SQLite операции
│   │   ├── fileWatcher.ts       # Мониторинг изменений БД
│   │   └── ipc-handlers.ts      # IPC коммуникация
│   ├── renderer/                # React приложение
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── KanbanBoard/
│   │   │   ├── Card/
│   │   │   ├── Settings/
│   │   │   ├── Archive/
│   │   │   └── StartupWizard/   # Мастер первого запуска
│   │   ├── hooks/
│   │   ├── stores/
│   │   └── types/
│   └── shared/                  # Общие типы
│       └── types.ts
├── database/                    # Сетевой диск
│   └── kanban.db
└── package.json
```

---

## 3. АРХИТЕКТУРА ДАННЫХ

### 3.1 Расположение базы данных и первый запуск

#### 3.1.1 Логика первого запуска (КРИТИЧНО)
При первом запуске приложения пользователю **ОБЯЗАТЕЛЬНО** предоставляется выбор из двух опций:

```typescript
// Конфигурация пути к БД
interface DatabaseConfig {
  path: string;
  isNew: boolean;
}

// Два режима работы при первом запуске
enum StartupMode {
  CREATE_NEW = 'create_new',      // Создать новую БД
  SELECT_EXISTING = 'select_existing'  // Выбрать существующую БД
}

// Хранение конфигурации в user data directory (portable)
const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
```

#### 3.1.2 Опция 1: Создать новую базу данных
```typescript
async function createNewDatabase(): Promise<DatabaseConfig> {
  // Открыть диалог выбора директории и имени файла
  const result = await dialog.showSaveDialog({
    title: 'Создать новую базу данных',
    defaultPath: 'kanban.db',
    filters: [
      { name: 'SQLite Database', extensions: ['db'] }
    ],
    properties: ['createDirectory', 'showOverwriteConfirmation']
  });

  if (result.canceled || !result.filePath) {
    throw new Error('Создание БД отменено пользователем');
  }

  const dbPath = result.filePath;
  
  // Создать новую БД и инициализировать схему
  const db = initNewDatabase(dbPath);
  
  // Сохранить путь в конфигурации
  saveConfig({ dbPath, isConfigured: true });
  
  return { path: dbPath, isNew: true };
}
```

#### 3.1.3 Опция 2: Выбрать существующую базу данных
```typescript
async function selectExistingDatabase(): Promise<DatabaseConfig> {
  // Открыть диалог выбора существующего файла
  const result = await dialog.showOpenDialog({
    title: 'Выбрать существующую базу данных',
    filters: [
      { name: 'SQLite Database', extensions: ['db'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    throw new Error('Выбор БД отменён пользователем');
  }

  const dbPath = result.filePaths[0];
  
  // Проверить что файл является валидной SQLite БД
  if (!validateSqliteFile(dbPath)) {
    throw new Error('Выбранный файл не является валидной базой данных');
  }
  
  // Проверить версию схемы БД и мигрировать при необходимости
  await checkAndMigrateSchema(dbPath);
  
  // Сохранить путь в конфигурации
  saveConfig({ dbPath, isConfigured: true });
  
  return { path: dbPath, isNew: false };
}
```

#### 3.1.4 Проверка при запуске
```typescript
// src/main/startup.ts

async function handleStartup(): Promise<void> {
  const config = loadConfig();
  
  if (!config.isConfigured || !config.dbPath) {
    // Первый запуск - показать мастер выбора
    await showStartupWizard();
    return;
  }
  
  // Проверить доступность БД
  if (!fs.existsSync(config.dbPath)) {
    // Файл БД не найден - предложить выбрать заново
    const choice = await dialog.showMessageBox({
      type: 'warning',
      title: 'База данных не найдена',
      message: `Файл базы данных не найден по пути:\n${config.dbPath}`,
      buttons: ['Создать новую', 'Выбрать другую', 'Выход'],
      defaultId: 1
    });
    
    switch (choice.response) {
      case 0: await createNewDatabase(); break;
      case 1: await selectExistingDatabase(); break;
      case 2: app.quit(); return;
    }
  }
  
  // Подключиться к БД
  await connectToDatabase(config.dbPath);
}
```

### 3.2 SQLite схема

#### 3.2.1 Таблица cards (карточки)
```sql
CREATE TABLE cards (
    uid TEXT PRIMARY KEY,                    -- Уникальный ID (UUID v4)
    stream TEXT NOT NULL,                    -- Стрим (FK к streams)
    department TEXT NOT NULL,                -- Отдел/управление
    planned_interview_date TEXT,             -- Дата в ISO формате (YYYY-MM-DD)
    actual_status TEXT NOT NULL,             -- Фактический статус (FK к card_statuses)
    column_id TEXT NOT NULL,                 -- ID колонки канбана (FK к columns)
    position INTEGER NOT NULL,               -- Позиция в колонке (для сортировки)
    color TEXT,                              -- Hex цвет карточки (#FF5733)
    created_at TEXT NOT NULL,                -- Timestamp создания
    updated_at TEXT NOT NULL,                -- Timestamp последнего обновления
    updated_by TEXT,                         -- Имя пользователя
    is_archived BOOLEAN DEFAULT 0,           -- Флаг архивации
    archived_at TEXT,                        -- Timestamp архивации
    auto_archive_scheduled_at TEXT,          -- Когда запланирована автоархивация
    FOREIGN KEY (stream) REFERENCES streams(name),
    FOREIGN KEY (actual_status) REFERENCES card_statuses(name),
    FOREIGN KEY (column_id) REFERENCES columns(id)
);

CREATE INDEX idx_cards_column ON cards(column_id, position);
CREATE INDEX idx_cards_archived ON cards(is_archived);
CREATE INDEX idx_cards_auto_archive ON cards(auto_archive_scheduled_at);
```

#### 3.2.2 Таблица card_assignees (связь карточек и ответственных)
```sql
CREATE TABLE card_assignees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_uid TEXT NOT NULL,
    assignee_name TEXT NOT NULL,             -- Имя из списка assignees
    created_at TEXT NOT NULL,
    FOREIGN KEY (card_uid) REFERENCES cards(uid) ON DELETE CASCADE,
    FOREIGN KEY (assignee_name) REFERENCES assignees(name),
    UNIQUE(card_uid, assignee_name)
);

CREATE INDEX idx_card_assignees_card ON card_assignees(card_uid);
```

#### 3.2.3 Таблица columns (колонки канбан-доски)
```sql
CREATE TABLE columns (
    id TEXT PRIMARY KEY,                     -- UUID v4
    name TEXT NOT NULL UNIQUE,               -- Название колонки
    position INTEGER NOT NULL,               -- Порядок отображения
    color TEXT,                              -- Hex цвет колонки (#4A90E2)
    is_closed_column BOOLEAN DEFAULT 0,      -- Флаг "Закрыто"
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_columns_position ON columns(position);

-- Обязательная колонка "Закрыто" создается при инициализации
INSERT INTO columns (id, name, position, is_closed_column, created_at, updated_at)
VALUES ('closed-column-id', 'Закрыто', 999, 1, datetime('now'), datetime('now'));
```

#### 3.2.4 Таблица streams (настраиваемый список стримов)
```sql
CREATE TABLE streams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT,                              -- Опциональный цвет
    created_at TEXT NOT NULL
);

-- Примеры данных
INSERT INTO streams (name, created_at) VALUES 
    ('Корпоративный центр', datetime('now')),
    ('Производство', datetime('now')),
    ('IT', datetime('now'));
```

#### 3.2.5 Таблица assignees (список ответственных)
```sql
CREATE TABLE assignees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    email TEXT,                              -- Опционально
    position TEXT,                           -- Должность (опционально)
    created_at TEXT NOT NULL
);

-- Примеры данных
INSERT INTO assignees (name, created_at) VALUES 
    ('Еремей Корнеплод', datetime('now')),
    ('Алебастр Гаврилов', datetime('now'));
```

#### 3.2.6 Таблица card_statuses (фактические статусы)
```sql
CREATE TABLE card_statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    created_at TEXT NOT NULL
);

-- Примеры данных
INSERT INTO card_statuses (name, created_at) VALUES 
    ('ожидаем назначения', datetime('now')),
    ('интервью назначено', datetime('now')),
    ('завершено', datetime('now'));
```

#### 3.2.7 Таблица sync_metadata (для синхронизации)
```sql
CREATE TABLE sync_metadata (
    id INTEGER PRIMARY KEY CHECK (id = 1),   -- Одна строка
    last_modified_at TEXT NOT NULL,          -- Timestamp последнего изменения
    last_modified_by TEXT,                   -- Пользователь
    db_version INTEGER DEFAULT 1             -- Версия схемы БД
);

INSERT INTO sync_metadata (id, last_modified_at) 
VALUES (1, datetime('now'));
```

#### 3.2.8 Таблица app_settings (настройки приложения)
```sql
CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Примеры настроек
INSERT INTO app_settings (key, value, updated_at) VALUES
    ('auto_archive_delay_minutes', '10', datetime('now')),
    ('current_user_name', 'Пользователь', datetime('now')),
    ('theme', 'light', datetime('now'));
```

### 3.3 TypeScript типы
```typescript
// src/shared/types.ts

export interface Card {
  uid: string;
  stream: string;
  department: string;
  assignees: string[];                    // Массив имен
  plannedInterviewDate: string | null;    // ISO date string или null
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

export interface Column {
  id: string;
  name: string;
  position: number;
  color?: string;
  isClosedColumn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Stream {
  id: number;
  name: string;
  color?: string;
  createdAt: string;
}

export interface Assignee {
  id: number;
  name: string;
  email?: string;
  position?: string;
  createdAt: string;
}

export interface CardStatus {
  id: number;
  name: string;
  color?: string;
  createdAt: string;
}

export interface AppSettings {
  autoArchiveDelayMinutes: number;
  currentUserName: string;
  theme: 'light' | 'dark';
}

export interface LocalConfig {
  dbPath: string;
  isConfigured: boolean;
  lastUserName?: string;
}
```

---

## 4. ФУНКЦИОНАЛЬНЫЕ ТРЕБОВАНИЯ

### 4.1 Главная страница (Канбан-доска)

#### 4.1.1 Управление колонками
```typescript
// Функционал создания колонки
interface CreateColumnParams {
  name: string;
  position: number;
  color?: string;
}

// Требования:
// - Кнопка "+ Добавить колонку" в правой части доски
// - Модальное окно для ввода названия и выбора цвета
// - Drag-and-drop для изменения порядка колонок
// - Двойной клик на название колонки = редактирование
// - Кнопка удаления колонки (с подтверждением)
// - НЕЛЬЗЯ удалить колонку "Закрыто"
// - При удалении колонки, карточки НЕ удаляются, а переносятся в первую колонку
```

#### 4.1.2 Управление карточками
```typescript
// Создание карточки
interface CreateCardParams {
  stream: string;
  department: string;
  assignees: string[];
  plannedInterviewDate: string | null;
  actualStatus: string;
  columnId: string;
  color?: string;
}

// Требования:
// - Кнопка "+ Добавить карточку" внизу каждой колонки
// - Модальное окно с формой создания карточки
// - Все поля обязательны кроме даты и цвета
// - Stream - dropdown из таблицы streams
// - Assignees - мультиселект из таблицы assignees
// - ActualStatus - dropdown из таблицы card_statuses
// - PlannedInterviewDate - date picker (формат DD.MM.YYYY для отображения)
// - Color - color picker (опционально)
// - UID генерируется автоматически (UUID v4)
```

#### 4.1.3 Drag-and-Drop карточек
```typescript
// Требования:
// - Перетаскивание карточек внутри колонки (изменение position)
// - Перетаскивание карточек между колонками (изменение columnId)
// - При перетаскивании в "Закрыто" - показать уведомление:
//   "Карточка будет автоматически архивирована через 10 минут"
// - Плавная анимация перемещения
// - Визуальная индикация места вставки
```

#### 4.1.4 Отображение карточки
```tsx
// Пример структуры карточки
<Card>
  <CardHeader color={card.color}>
    <CardId>ID {card.uid.slice(0, 8)}</CardId>
    <EditButton onClick={handleEdit} />
  </CardHeader>
  
  <CardBody>
    <Field>
      <Label>Стрим:</Label>
      <Value>{card.stream}</Value>
    </Field>
    
    <Field>
      <Label>Отдел/управление:</Label>
      <Value>{card.department}</Value>
    </Field>
    
    <Field>
      <Label>Ответственные:</Label>
      <AssigneesList>
        {card.assignees.map(name => (
          <AssigneeBadge key={name}>{name}</AssigneeBadge>
        ))}
      </AssigneesList>
    </Field>
    
    <Field>
      <Label>Планируемая дата интервью:</Label>
      <DateValue highlighted={isDateSoon(card.plannedInterviewDate)}>
        {formatDate(card.plannedInterviewDate, 'dd.MM.yyyy')}
      </DateValue>
    </Field>
    
    <Field>
      <Label>Фактический статус:</Label>
      <StatusBadge color={getStatusColor(card.actualStatus)}>
        {card.actualStatus}
      </StatusBadge>
    </Field>
  </CardBody>
  
  <CardFooter>
    <UpdateInfo>
      Обновлено: {formatDate(card.updatedAt, 'dd.MM.yyyy HH:mm')}
      {card.updatedBy && ` • ${card.updatedBy}`}
    </UpdateInfo>
  </CardFooter>
</Card>

// Требования к отображению:
// - Компактный дизайн (карточка ~250-300px ширина)
// - Цветовая полоска слева (card.color)
// - Подсветка даты красным если < 3 дней до интервью
// - Иконка "архив" если находится в колонке "Закрыто"
```

#### 4.1.5 Редактирование карточки
```typescript
// Требования:
// - Клик на карточку или кнопка "редактировать" = модальное окно
// - Все поля доступны для изменения кроме UID
// - Кнопка "Удалить карточку" (с подтверждением)
// - История изменений не требуется
// - При сохранении обновляется updated_at и updated_by
```

#### 4.1.6 Цветовая индикация колонок
```typescript
// Требования:
// - Каждая колонка может иметь цвет фона (полупрозрачный)
// - Color picker при создании/редактировании колонки
// - Предустановленные цвета: 
//   ['#EBF5FB', '#FDECEA', '#FEF5E7', '#EAFAF1', '#F4ECF7']
// - Возможность сброса цвета (прозрачный фон)
```

### 4.2 Вкладка "Настройки списков"

#### 4.2.1 Управление стримами
```tsx
<SettingsSection title="Стримы">
  <Table>
    <thead>
      <tr>
        <th>Название</th>
        <th>Цвет</th>
        <th>Действия</th>
      </tr>
    </thead>
    <tbody>
      {streams.map(stream => (
        <tr key={stream.id}>
          <td>
            <EditableText value={stream.name} onSave={handleUpdate} />
          </td>
          <td>
            <ColorPicker value={stream.color} onChange={handleColorChange} />
          </td>
          <td>
            <DeleteButton onClick={() => handleDelete(stream.id)} />
          </td>
        </tr>
      ))}
    </tbody>
  </Table>
  
  <AddButton onClick={handleAddStream}>+ Добавить стрим</AddButton>
</SettingsSection>

// Требования:
// - Inline редактирование названия (двойной клик)
// - НЕЛЬЗЯ удалить стрим, если есть карточки с этим стримом
// - При удалении - показать предупреждение с количеством карточек
// - Сортировка по алфавиту
```

#### 4.2.2 Управление ответственными
```tsx
<SettingsSection title="Ответственные">
  <Table>
    <thead>
      <tr>
        <th>Имя</th>
        <th>Email</th>
        <th>Должность</th>
        <th>Действия</th>
      </tr>
    </thead>
    <tbody>
      {assignees.map(assignee => (
        <tr key={assignee.id}>
          <td><EditableText value={assignee.name} /></td>
          <td><EditableText value={assignee.email} optional /></td>
          <td><EditableText value={assignee.position} optional /></td>
          <td><DeleteButton /></td>
        </tr>
      ))}
    </tbody>
  </Table>
  
  <AddButton>+ Добавить ответственного</AddButton>
</SettingsSection>

// Требования:
// - Email и должность - опциональные поля
// - НЕЛЬЗЯ удалить ответственного, если назначен на карточки
// - При удалении - показать список карточек где назначен
// - Сортировка по имени
```

#### 4.2.3 Управление фактическими статусами
```tsx
<SettingsSection title="Фактические статусы">
  <Table>
    <thead>
      <tr>
        <th>Название</th>
        <th>Цвет метки</th>
        <th>Действия</th>
      </tr>
    </thead>
    <tbody>
      {cardStatuses.map(status => (
        <tr key={status.id}>
          <td><EditableText value={status.name} /></td>
          <td><ColorPicker value={status.color} /></td>
          <td><DeleteButton /></td>
        </tr>
      ))}
    </tbody>
  </Table>
  
  <AddButton>+ Добавить статус</AddButton>
</SettingsSection>

// Требования:
// - НЕЛЬЗЯ удалить статус, используемый в карточках
// - Цвет отображается в badge на карточке
```

### 4.3 Вкладка "Архив"

#### 4.3.1 Просмотр архивных карточек
```tsx
<ArchivePage>
  <Filters>
    <SearchInput placeholder="Поиск по стриму, отделу..." />
    <DateRangePicker label="Дата архивации" />
    <StreamFilter options={streams} />
    <AssigneeFilter options={assignees} />
  </Filters>
  
  <ArchiveList>
    {archivedCards.map(card => (
      <ArchiveCard key={card.uid}>
        {/* Та же структура что и обычная карточка */}
        <Actions>
          <RestoreButton onClick={() => handleRestore(card.uid)}>
            Восстановить
          </RestoreButton>
          <DeleteButton onClick={() => handleDelete(card.uid)}>
            Удалить навсегда
          </DeleteButton>
        </Actions>
      </ArchiveCard>
    ))}
  </ArchiveList>
  
  <Pagination />
</ArchivePage>

// Требования:
// - Отображение только карточек с is_archived = 1
// - Сортировка по дате архивации (новые сверху)
// - Пагинация по 50 карточек
// - Восстановление карточки = is_archived = 0, возврат в первую колонку
// - Удаление навсегда - с подтверждением (необратимо)
// - Экспорт архива в Excel/CSV
```

### 4.4 Автоархивация

#### 4.4.1 Механизм автоархивации
```typescript
// Логика в main process
class AutoArchiveManager {
  private timer: NodeJS.Timeout | null = null;
  
  start() {
    // Проверка каждую минуту
    this.timer = setInterval(() => {
      this.checkAndArchive();
    }, 60000);
  }
  
  async checkAndArchive() {
    const now = new Date().toISOString();
    
    // Найти карточки где auto_archive_scheduled_at <= now
    const cardsToArchive = db.prepare(`
      SELECT uid FROM cards 
      WHERE auto_archive_scheduled_at IS NOT NULL 
      AND auto_archive_scheduled_at <= ?
      AND is_archived = 0
    `).all(now);
    
    for (const card of cardsToArchive) {
      // Архивировать карточку
      db.prepare(`
        UPDATE cards 
        SET is_archived = 1, 
            archived_at = ?,
            auto_archive_scheduled_at = NULL
        WHERE uid = ?
      `).run(now, card.uid);
      
      // Уведомить все открытые окна
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('card-auto-archived', card.uid);
      });
    }
    
    // Обновить sync_metadata
    this.updateSyncMetadata();
  }
}

// Требования:
// - При перемещении карточки в колонку "Закрыто":
//   auto_archive_scheduled_at = NOW + 10 минут
// - Если карточку переместили из "Закрыто" до автоархивации:
//   auto_archive_scheduled_at = NULL
// - Показать countdown timer на карточке в колонке "Закрыто"
// - Toast уведомление: "Карточка {uid} автоматически архивирована"
```

### 4.5 Общие настройки приложения

#### 4.5.1 Настройки пользователя
```tsx
<SettingsPage>
  <Section title="Профиль">
    <Input 
      label="Ваше имя" 
      value={currentUserName}
      onChange={handleNameChange}
      hint="Будет отображаться в истории изменений"
    />
  </Section>
  
  <Section title="Поведение">
    <NumberInput
      label="Задержка автоархивации (минуты)"
      value={autoArchiveDelay}
      onChange={handleDelayChange}
      min={1}
      max={60}
    />
  </Section>
  
  <Section title="Тема">
    <RadioGroup value={theme} onChange={handleThemeChange}>
      <Radio value="light">Светлая</Radio>
      <Radio value="dark">Темная</Radio>
      <Radio value="auto">Системная</Radio>
    </RadioGroup>
  </Section>
  
  <Section title="База данных">
    <PathDisplay>{dbPath}</PathDisplay>
    <Button onClick={handleChangeDbPath}>Изменить расположение БД</Button>
    <Button variant="danger" onClick={handleResetDb}>
      Сбросить БД (удалить все данные)
    </Button>
  </Section>
</SettingsPage>
```

---

## 5. СИСТЕМА СИНХРОНИЗАЦИИ

### 5.1 Стратегия синхронизации

#### 5.1.1 Мониторинг файла БД
```typescript
// src/main/fileWatcher.ts

import chokidar from 'chokidar';
import { BrowserWindow } from 'electron';

export class DatabaseWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private lastKnownMtime: number = 0;
  private debounceTimeout: NodeJS.Timeout | null = null;
  
  start(dbPath: string) {
    // Получить начальное время модификации
    this.lastKnownMtime = fs.statSync(dbPath).mtimeMs;
    
    // Следить за изменениями
    this.watcher = chokidar.watch(dbPath, {
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,  // Ждать 100ms стабильности
        pollInterval: 50
      }
    });
    
    this.watcher.on('change', (path) => {
      // Debounce для избежания множественных обновлений
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }
      
      this.debounceTimeout = setTimeout(() => {
        const currentMtime = fs.statSync(path).mtimeMs;
        
        // Проверить что файл действительно изменился
        if (currentMtime > this.lastKnownMtime) {
          this.lastKnownMtime = currentMtime;
          
          // Уведомить все окна о необходимости обновления
          BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.send('database-changed', {
              timestamp: currentMtime
            });
          });
        }
      }, 200);
    });
  }
  
  stop() {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}
```

#### 5.1.2 Обработка изменений в renderer
```typescript
// src/renderer/hooks/useDatabaseSync.ts

import { useEffect } from 'react';
import { useStore } from '../stores/kanbanStore';

export function useDatabaseSync() {
  const refreshData = useStore(state => state.refreshAllData);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number>(0);
  
  useEffect(() => {
    // Слушать событие изменения БД
    const handleDatabaseChanged = (event, { timestamp }) => {
      // Избежать обновления если это наше собственное изменение
      if (timestamp > lastSyncTimestamp) {
        console.log('Database changed by another user, refreshing...');
        
        // Показать уведомление
        toast.info('Доска обновлена другим пользователем');
        
        // Обновить все данные
        refreshData();
        
        setLastSyncTimestamp(timestamp);
      }
    };
    
    window.electron.ipcRenderer.on('database-changed', handleDatabaseChanged);
    
    return () => {
      window.electron.ipcRenderer.removeListener('database-changed', handleDatabaseChanged);
    };
  }, [lastSyncTimestamp, refreshData]);
}
```

### 5.2 Конфликт-резолюшен

#### 5.2.1 SQLite в режиме WAL
```typescript
// src/main/database.ts

import Database from 'better-sqlite3';

export function initDatabase(dbPath: string) {
  const db = new Database(dbPath, {
    timeout: 5000,  // 5 секунд таймаут на блокировку
  });
  
  // КРИТИЧЕСКИ ВАЖНО: Включить WAL режим
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000');  // 64MB кэш
  db.pragma('busy_timeout = 5000');
  
  // Создать таблицы если не существуют
  initTables(db);
  
  return db;
}
```

#### 5.2.2 Оптимистичная блокировка
```typescript
// Стратегия "последняя запись побеждает" (Last Write Wins)

interface UpdateCardParams {
  uid: string;
  updates: Partial<Card>;
  expectedUpdatedAt: string;  // Для проверки версии
}

async function updateCard({ uid, updates, expectedUpdatedAt }: UpdateCardParams) {
  const currentCard = db.prepare('SELECT updated_at FROM cards WHERE uid = ?').get(uid);
  
  if (!currentCard) {
    throw new Error('Card not found');
  }
  
  // Проверка оптимистичной блокировки
  if (currentCard.updated_at !== expectedUpdatedAt) {
    // Карточка была изменена другим пользователем
    throw new ConflictError('Card was modified by another user. Please refresh and try again.');
  }
  
  // Обновление с новым timestamp
  const now = new Date().toISOString();
  const currentUser = await getCurrentUserName();
  
  const query = db.prepare(`
    UPDATE cards 
    SET ${Object.keys(updates).map(k => `${k} = ?`).join(', ')},
        updated_at = ?,
        updated_by = ?
    WHERE uid = ?
  `);
  
  query.run(...Object.values(updates), now, currentUser, uid);
  
  // Обновить sync_metadata
  updateSyncMetadata(now, currentUser);
  
  return { success: true, updatedAt: now };
}
```

#### 5.2.3 Обработка конфликтов в UI
```typescript
// src/renderer/components/Card/EditCardModal.tsx

const [optimisticLockError, setOptimisticLockError] = useState(false);

const handleSave = async () => {
  try {
    await window.electron.ipcRenderer.invoke('update-card', {
      uid: card.uid,
      updates: formData,
      expectedUpdatedAt: card.updatedAt  // Текущая версия
    });
    
    onClose();
    toast.success('Карточка обновлена');
    
  } catch (error) {
    if (error.code === 'CONFLICT') {
      setOptimisticLockError(true);
      
      // Показать диалог с выбором
      const choice = await showConflictDialog({
        message: 'Карточка была изменена другим пользователем.',
        options: [
          'Обновить и потерять мои изменения',
          'Перезаписать изменения другого пользователя',
          'Отмена'
        ]
      });
      
      if (choice === 0) {
        // Перезагрузить карточку
        await refreshCard(card.uid);
      } else if (choice === 1) {
        // Принудительное сохранение
        await window.electron.ipcRenderer.invoke('force-update-card', {
          uid: card.uid,
          updates: formData
        });
      }
    }
  }
};
```

### 5.3 Производительность синхронизации

#### 5.3.1 Инкрементальные обновления
```typescript
// Вместо перезагрузки всей доски, обновлять только измененные данные

interface DatabaseChangeEvent {
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  recordId: string | number;
}

// Отправлять детальную информацию об изменениях
window.electron.ipcRenderer.send('database-changed', {
  changes: [
    { table: 'cards', operation: 'UPDATE', recordId: 'card-uuid-123' },
    { table: 'columns', operation: 'INSERT', recordId: 'column-uuid-456' }
  ]
});

// В renderer обрабатывать только измененные сущности
const handleDatabaseChanged = (event, { changes }) => {
  for (const change of changes) {
    switch (change.table) {
      case 'cards':
        if (change.operation === 'DELETE') {
          removeCardFromStore(change.recordId);
        } else {
          fetchAndUpdateCard(change.recordId);
        }
        break;
      case 'columns':
        fetchAndUpdateColumn(change.recordId);
        break;
    }
  }
};
```

---

## 6. ПОЛЬЗОВАТЕЛЬСКИЙ ИНТЕРФЕЙС

### 6.1 Общий макет
```tsx
<AppLayout>
  <Sidebar>
    <Logo />
    <NavItem to="/" icon={<KanbanIcon />}>Доска</NavItem>
    <NavItem to="/settings" icon={<SettingsIcon />}>Настройки списков</NavItem>
    <NavItem to="/archive" icon={<ArchiveIcon />}>Архив</NavItem>
    <NavItem to="/app-settings" icon={<CogIcon />}>Настройки</NavItem>
    
    <Spacer />
    
    <UserInfo>
      <Avatar>{currentUser[0]}</Avatar>
      <UserName>{currentUser}</UserName>
    </UserInfo>
    
    <DbStatus connected={isConnected}>
      {isConnected ? 'БД подключена' : 'БД недоступна'}
    </DbStatus>
  </Sidebar>
  
  <MainContent>
    <Header>
      <PageTitle>{pageTitle}</PageTitle>
      <SearchBar />
      <ExportButton />
    </Header>
    
    <PageContent>
      <Outlet />
    </PageContent>
  </MainContent>
</AppLayout>
```

### 6.2 Анимации и переходы
```typescript
// Tailwind CSS классы для анимаций
const animations = {
  cardEnter: 'animate-in fade-in slide-in-from-bottom-2 duration-200',
  cardExit: 'animate-out fade-out slide-out-to-bottom-2 duration-200',
  modalEnter: 'animate-in fade-in zoom-in-95 duration-200',
  modalExit: 'animate-out fade-out zoom-out-95 duration-200',
  toastEnter: 'animate-in slide-in-from-right duration-300',
  toastExit: 'animate-out slide-out-to-right duration-300',
};

// Drag-and-drop анимация
const dragStyles = {
  dragging: 'opacity-50 scale-105 shadow-xl rotate-2',
  dropTarget: 'bg-blue-100 border-2 border-blue-500 border-dashed',
};
```

### 6.3 Темная тема
```typescript
// Tailwind CSS конфигурация
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Светлая тема
        background: '#FFFFFF',
        foreground: '#1A1A1A',
        card: '#F8F9FA',
        border: '#E5E7EB',
        
        // Темная тема (dark:)
        'dark-background': '#1A1A1A',
        'dark-foreground': '#FFFFFF',
        'dark-card': '#2D2D2D',
        'dark-border': '#404040',
      }
    }
  }
};
```

---

## 7. ОБРАБОТКА ОШИБОК

### 7.1 Типы ошибок
```typescript
// src/shared/errors.ts

export class DatabaseError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ConflictError extends DatabaseError {
  constructor(message: string) {
    super(message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### 7.2 Централизованная обработка
```typescript
// src/main/errorHandler.ts

import { dialog, BrowserWindow } from 'electron';
import logger from './logger';

export function setupErrorHandling() {
  // Необработанные исключения
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    
    dialog.showErrorBox(
      'Критическая ошибка',
      `Произошла непредвиденная ошибка. Приложение будет закрыто.\n\n${error.message}`
    );
    
    process.exit(1);
  });
  
  // Необработанные Promise rejection
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  });
}

// Обработка ошибок IPC
export function handleIpcError(error: Error, event: IpcMainInvokeEvent) {
  logger.error('IPC error:', error);
  
  if (error instanceof ConflictError) {
    return { error: true, code: 'CONFLICT', message: error.message };
  }
  
  if (error instanceof DatabaseError) {
    // Показать уведомление
    BrowserWindow.fromWebContents(event.sender)?.webContents.send('error', {
      title: 'Ошибка базы данных',
      message: error.message
    });
  }
  
  return { error: true, code: 'UNKNOWN', message: error.message };
}
```

### 7.3 Логирование
```typescript
// src/main/logger.ts

import winston from 'winston';
import path from 'path';
import { app } from 'electron';

const logsPath = path.join(app.getPath('userData'), 'logs');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Запись в файл
    new winston.transports.File({ 
      filename: path.join(logsPath, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(logsPath, 'combined.log') 
    }),
  ],
});

// В development режиме также выводить в консоль
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

export default logger;
```

---

## 8. КОМАНДЫ ДЛЯ CLAUDE CODE

### 8.1 Пошаговое создание проекта

#### Шаг 1: Инициализация
```bash
claude-code "Создай Electron проект с React 18 + TypeScript + Tailwind CSS:
- Используй electron-vite для сборки
- Настрой hot reload для renderer
- Добавь ESLint и Prettier
- Структура: src/main, src/renderer, src/shared
- Убедись что проект корректно собирается в PORTABLE EXE без установки"
```

#### Шаг 2: База данных
```bash
claude-code "Настрой better-sqlite3 для Electron:
- Функция initDatabase с WAL режимом
- Создание всех таблиц (cards, columns, streams, assignees, card_statuses, card_assignees, sync_metadata, app_settings)
- Функции CRUD для каждой таблицы
- IPC handlers для всех операций
- Поддержка хранения конфигурации в portable mode (app.getPath('userData'))"
```

#### Шаг 3: Мастер первого запуска (КРИТИЧНО)
```bash
claude-code "Создай мастер первого запуска с ДВУМЯ опциями:

1. Опция 'Создать новую базу данных':
   - Диалог выбора директории и имени файла (showSaveDialog)
   - Создание новой БД и инициализация схемы
   - Сохранение пути в локальную конфигурацию

2. Опция 'Выбрать существующую базу данных':
   - Диалог выбора файла (showOpenDialog)
   - Валидация что файл является SQLite БД
   - Проверка версии схемы и миграция при необходимости
   - Сохранение пути в локальную конфигурацию

3. Проверка при каждом запуске:
   - Если конфигурация не найдена - показать мастер
   - Если файл БД не найден - предложить выбрать заново
   - Индикатор подключения к БД в sidebar

4. UI:
   - Минималистичный дизайн с Tailwind
   - Две большие кнопки-карточки для выбора опции
   - Иконки для каждой опции
   - Информационные подсказки"
```

#### Шаг 4: State Management
```bash
claude-code "Настрой Zustand store:
- Store для cards, columns, streams, assignees, cardStatuses
- Actions: fetchAll, create, update, delete для каждой сущности
- Selectors для фильтрации и сортировки
- Интеграция с IPC для вызова main process"
```

#### Шаг 5: Канбан-доска
```bash
claude-code "Создай компонент KanbanBoard:
- Отображение колонок горизонтально с @dnd-kit
- Drag-and-drop колонок и карточек
- Кнопка добавления колонки справа
- Кнопка добавления карточки внизу каждой колонки
- Виртуализация для большого количества карточек"
```

#### Шаг 6: Компонент карточки
```bash
claude-code "Создай компонент Card:
- Отображение всех полей карточки
- Цветовая полоска слева
- Badge для ответственных
- Подсветка даты если близко
- Кнопка редактирования
- Countdown timer в колонке 'Закрыто'"
```

#### Шаг 7: Модальные окна
```bash
claude-code "Создай модальные окна:
1. CreateCardModal:
   - Форма со всеми полями
   - Dropdown для stream (из БД)
   - Multi-select для assignees (из БД)
   - Date picker для plannedInterviewDate
   - Color picker

2. EditCardModal:
   - Аналогично CreateCardModal
   - Кнопка удаления
   - Отображение updated_at и updated_by

3. CreateColumnModal:
   - Название и цвет

Используй react-hook-form для валидации"
```

#### Шаг 8: Страница настроек списков
```bash
claude-code "Создай страницу Settings с тремя секциями:
1. Управление стримами (таблица с inline редактированием)
2. Управление ответственными (имя, email, должность)
3. Управление фактическими статусами

Требования:
- Валидация при удалении (проверка использования)
- Color picker для цветов
- Toast уведомления о действиях"
```

#### Шаг 9: Страница архива
```bash
claude-code "Создай страницу Archive:
- Список архивных карточек
- Фильтры: поиск, дата, стрим, ответственные
- Кнопки: восстановить, удалить навсегда
- Пагинация по 50 элементов
- Экспорт в Excel/CSV"
```

#### Шаг 10: Синхронизация
```bash
claude-code "Реализуй синхронизацию между пользователями:
- chokidar watcher для файла БД
- IPC события при изменении
- Debounce 200ms
- Toast уведомление 'Доска обновлена'
- Оптимистичная блокировка при редактировании
- Диалог разрешения конфликтов"
```

#### Шаг 11: Автоархивация
```bash
claude-code "Реализуй автоархивацию:
- При перемещении в 'Закрыто' - установить auto_archive_scheduled_at
- Countdown timer на карточке (осталось X минут)
- Проверка каждую минуту в main process
- При архивации - уведомление всех окон
- Возможность изменить задержку в настройках"
```

#### Шаг 12: Настройки приложения
```bash
claude-code "Создай страницу AppSettings:
- Имя пользователя
- Задержка автоархивации (минуты)
- Выбор темы (светлая/темная/системная)
- Отображение текущего пути к БД
- Кнопка изменения пути (диалог выбора: создать новую или выбрать существующую)
- Кнопка сброса БД (с подтверждением)
- Сохранение в app_settings таблицу"
```

#### Шаг 13: Экспорт и поиск
```bash
claude-code "Добавь функционал экспорта и поиска:

Экспорт:
- Кнопка 'Экспорт' в header доски
- Диалог выбора формата (XLSX/CSV)
- Опция включения архивных карточек
- Генерация файла с помощью xlsx библиотеки
- Сохранение через Electron dialog

Поиск:
- SearchBar в header
- Real-time поиск с debounce 300ms
- Поиск по всем текстовым полям
- Фильтры по стриму, ответственным, статусу, дате
- Подсветка найденных карточек
- Счетчик результатов"
```

#### Шаг 14: Горячие клавиши и UX
```bash
claude-code "Улучши UX:
- Добавь глобальный обработчик горячих клавиш
- Ctrl+N: открыть модальное создание карточки
- Ctrl+F: фокус на поиск
- Ctrl+E: экспорт
- Escape: закрыть модальное окно
- F5: обновить данные
- Добавь анимации transitions для drag-and-drop
- Hover эффекты на карточках
- Loading состояния при сохранении
- Skeleton loaders при загрузке"
```

#### Шаг 15: Логирование и сборка PORTABLE EXE (КРИТИЧНО)
```bash
claude-code "Финализация:
- Настрой winston logger в main process
- Логируй все операции с БД
- Обработка необработанных исключений
- Меню Help -> 'Открыть папку логов'
- Настрой electron-builder для сборки PORTABLE EXE:
  * НЕ использовать NSIS installer
  * Использовать target: 'portable'
  * Приложение должно запускаться без установки
  * Приложение должно работать БЕЗ админских прав
  * Конфигурация должна храниться в portable режиме
- Добавь иконку приложения
- Создай README с инструкциями по запуску (не установке)
- Протестируй на Windows без админских прав"
```

### 8.2 Полная команда для Claude Code (единая)

```bash
claude-code "Создай Electron desktop приложение - канбан-трекер для консалтингового проекта со следующими требованиями:

ТЕХНИЧЕСКИЙ СТЕК:
- Electron с React 18 + TypeScript
- Tailwind CSS
- better-sqlite3 для БД (в режиме WAL)
- @dnd-kit/core для drag-and-drop
- chokidar для мониторинга файлов
- zustand для state management
- date-fns, lucide-react, react-hot-toast, xlsx

АРХИТЕКТУРА ДАННЫХ:
База SQLite с таблицами:
1. cards: uid(PK), stream, department, planned_interview_date, actual_status, column_id, position, color, created_at, updated_at, updated_by, is_archived, archived_at, auto_archive_scheduled_at
2. card_assignees: связь M:M между cards и assignees
3. columns: id(PK), name, position, color, is_closed_column
4. streams: настраиваемый список стримов
5. assignees: список ответственных с email и position
6. card_statuses: фактические статусы карточек
7. sync_metadata: для синхронизации между пользователями
8. app_settings: настройки приложения

МАСТЕР ПЕРВОГО ЗАПУСКА (КРИТИЧНО):
При первом запуске показать экран с ДВУМЯ опциями:
1. 'Создать новую базу данных' - открывает диалог выбора пути и имени файла
2. 'Выбрать существующую базу данных' - открывает file explorer для выбора .db файла

При каждом запуске:
- Проверять наличие конфигурации
- Если файл БД не найден - предложить выбрать заново
- Показывать индикатор подключения к БД

ФУНКЦИОНАЛ:

1. КАНБАН-ДОСКА (главная страница):
- Пользовательские колонки (создание/редактирование/удаление/переименование)
- Обязательная колонка 'Закрыто' - нельзя удалить
- Drag-and-drop карточек между колонками и внутри
- Цветовая индикация колонок
- Карточки с полями: uid, стрим (dropdown), отдел (text), ответственные (multi-select), дата интервью (date picker), фактический статус (dropdown), цвет
- Модальное окно создания/редактирования карточки
- Автоархивация: при перемещении в 'Закрыто' карточка архивируется через 10 минут
- Countdown timer на карточках в колонке 'Закрыто'

2. НАСТРОЙКИ СПИСКОВ (отдельная вкладка):
- Управление стримами (CRUD, inline редактирование, цвета)
- Управление ответственными (имя, email, должность)
- Управление фактическими статусами (цвета)
- Валидация: нельзя удалить если используется в карточках

3. АРХИВ (отдельная вкладка):
- Просмотр архивных карточек
- Фильтры: поиск, дата, стрим, ответственные
- Восстановление карточки
- Удаление навсегда
- Экспорт в Excel/CSV
- Пагинация

4. НАСТРОЙКИ ПРИЛОЖЕНИЯ:
- Имя пользователя
- Задержка автоархивации (минуты)
- Тема (светлая/темная/системная)
- Путь к БД (с возможностью изменить: создать новую или выбрать существующую)
- Сброс БД

5. СИНХРОНИЗАЦИЯ:
- chokidar отслеживает изменения файла БД
- При изменении - уведомление всех окон через IPC
- Автообновление UI с toast уведомлением
- Оптимистичная блокировка при редактировании карточек
- Индикатор подключения к БД

6. ДОПОЛНИТЕЛЬНО:
- Поиск и фильтры на главной странице
- Экспорт в Excel/CSV
- Горячие клавиши (Ctrl+N, Ctrl+F, Ctrl+E, Escape, F5)
- Desktop notifications
- Winston logger
- Обработка ошибок и конфликтов

UI/UX:
- Минимализм, Tailwind CSS
- Боковое меню навигации
- Плавные анимации и transitions
- Responsive (мин. 1366x768)
- Loading состояния
- Toast уведомления

КРИТИЧНО - СБОРКА PORTABLE EXE:
- Использовать electron-builder с target: 'portable'
- НЕ использовать NSIS installer
- Приложение должно запускаться БЕЗ УСТАНОВКИ
- Приложение должно работать БЕЗ АДМИНСКИХ ПРАВ на корпоративном ноутбуке
- Конфигурация хранится в portable режиме рядом с exe или в AppData
- Результат: один .exe файл который можно просто запустить

КРИТИЧНО - ОБЩИЕ ТРЕБОВАНИЯ:
- WAL режим для SQLite
- Debounce для file watcher (200ms)
- Обработка одновременного редактирования
- Все операции с БД через IPC
- TypeScript strict mode
- Error handling

Создай полный проект с возможностью сборки в PORTABLE .exe файл"
```

---

## 9. КРИТЕРИИ ПРИЕМКИ

### 9.1 Обязательные функции
- ✅ Создание/редактирование/удаление карточек
- ✅ Создание/редактирование/удаление колонок
- ✅ Drag-and-drop карточек
- ✅ Управление настраиваемыми списками
- ✅ Автоархивация через 10 минут
- ✅ Просмотр и управление архивом
- ✅ Синхронизация между пользователями
- ✅ Экспорт в Excel
- ✅ Поиск и фильтрация
- ✅ Мастер первого запуска с двумя опциями (создать/выбрать БД)
- ✅ Portable EXE без установки

### 9.2 Производительность
- Загрузка доски < 2 секунд (до 1000 карточек)
- Обновление при синхронизации < 500 мс
- Плавный drag-and-drop (60 FPS)
- Debounce поиска 300ms

### 9.3 Надежность
- Нет потери данных при одновременном редактировании
- Корректная работа при сбое сети (сетевой диск недоступен)
- Автосохранение при закрытии приложения
- Восстановление после краша

### 9.4 Безопасность
- Логирование всех операций
- Валидация всех пользовательских вводов
- Предотвращение SQL injection (prepared statements)
- Ограничение прав на БД файл

### 9.5 Портативность (КРИТИЧНО)
- Приложение запускается без установки
- Приложение работает без админских прав
- Конфигурация сохраняется корректно в portable режиме
- Приложение работает на корпоративных ноутбуках с ограничениями

---

## 10. РАЗВЕРТЫВАНИЕ И ДИСТРИБУЦИЯ

### 10.1 Сборка PORTABLE приложения (КРИТИЧНО)
```json
// package.json
{
  "name": "kanban-tracker",
  "version": "1.0.0",
  "build": {
    "appId": "com.company.kanban-tracker",
    "productName": "Канбан-Трекер",
    "directories": {
      "output": "dist"
    },
    "win": {
      "target": [
        {
          "target": "portable",
          "arch": ["x64"]
        }
      ],
      "icon": "build/icon.ico"
    },
    "portable": {
      "artifactName": "KanbanTracker-${version}-portable.exe",
      "requestExecutionLevel": "user"
    },
    "extraResources": [
      {
        "from": "resources/",
        "to": "resources/"
      }
    ]
  }
}
```

### 10.2 Portable режим хранения данных
```typescript
// src/main/config.ts

import { app } from 'electron';
import path from 'path';
import fs from 'fs';

function getPortableDataPath(): string {
  // Проверяем, запущено ли приложение в portable режиме
  const exePath = app.getPath('exe');
  const portableDataPath = path.join(path.dirname(exePath), 'KanbanTracker_Data');
  
  // Если папка существует или её можно создать - используем portable режим
  try {
    if (!fs.existsSync(portableDataPath)) {
      fs.mkdirSync(portableDataPath, { recursive: true });
    }
    return portableDataPath;
  } catch {
    // Fallback на стандартную директорию userData если нет прав
    return app.getPath('userData');
  }
}

export function getConfigPath(): string {
  return path.join(getPortableDataPath(), 'config.json');
}

export function getLogsPath(): string {
  return path.join(getPortableDataPath(), 'logs');
}
```

### 10.3 Первый запуск - мастер выбора БД
```tsx
// src/renderer/components/StartupWizard/StartupWizard.tsx

import React, { useState } from 'react';
import { Database, FolderOpen, Plus } from 'lucide-react';

interface StartupWizardProps {
  onComplete: () => void;
}

export function StartupWizard({ onComplete }: StartupWizardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateNew = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await window.electron.ipcRenderer.invoke('create-new-database');
      if (result.success) {
        onComplete();
      }
    } catch (err) {
      setError('Не удалось создать базу данных');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectExisting = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await window.electron.ipcRenderer.invoke('select-existing-database');
      if (result.success) {
        onComplete();
      }
    } catch (err) {
      setError('Не удалось открыть базу данных');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <Database className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Добро пожаловать в Канбан-Трекер!
          </h1>
          <p className="text-gray-600">
            Выберите способ подключения к базе данных
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Опция 1: Создать новую БД */}
          <button
            onClick={handleCreateNew}
            disabled={isLoading}
            className="p-8 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 
                       hover:shadow-lg transition-all duration-200 text-left group
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4
                            group-hover:bg-blue-500 transition-colors">
              <Plus className="w-6 h-6 text-blue-600 group-hover:text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Создать новую базу данных
            </h3>
            <p className="text-gray-600 text-sm">
              Выберите папку и имя файла для новой базы данных. 
              Используйте эту опцию, если вы первый в команде.
            </p>
          </button>

          {/* Опция 2: Выбрать существующую БД */}
          <button
            onClick={handleSelectExisting}
            disabled={isLoading}
            className="p-8 bg-white border-2 border-gray-200 rounded-xl hover:border-green-500 
                       hover:shadow-lg transition-all duration-200 text-left group
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4
                            group-hover:bg-green-500 transition-colors">
              <FolderOpen className="w-6 h-6 text-green-600 group-hover:text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Выбрать существующую базу данных
            </h3>
            <p className="text-gray-600 text-sm">
              Откройте файл базы данных, созданный ранее. 
              Используйте, чтобы присоединиться к команде.
            </p>
          </button>
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 text-sm">
            <strong>Важно:</strong> Для совместной работы все участники команды 
            должны выбрать один и тот же файл базы данных на общем сетевом диске.
          </p>
        </div>

        {isLoading && (
          <div className="mt-6 text-center text-gray-600">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent 
                            rounded-full mx-auto mb-2"></div>
            Подождите...
          </div>
        )}
      </div>
    </div>
  );
}
```

### 10.4 Инструкция для пользователей
```markdown
# Запуск Канбан-Трекер

## Системные требования
- Windows 10/11 (64-bit)
- Доступ к сетевому диску (для совместной работы)
- Минимум 100 МБ свободного места

## Запуск приложения
1. Скачайте файл KanbanTracker-portable.exe
2. Поместите файл в любую папку (например, на рабочий стол)
3. Запустите файл двойным кликом
4. **Установка НЕ требуется!**
5. **Админские права НЕ требуются!**

## Первый запуск
При первом запуске вам будет предложено:

### Вариант 1: Создать новую базу данных
- Выберите эту опцию, если вы первый в команде
- Укажите папку на **сетевом диске** и имя файла
- Рекомендуемое имя: `kanban.db`

### Вариант 2: Выбрать существующую базу данных
- Выберите эту опцию, чтобы присоединиться к команде
- Найдите файл базы данных на **сетевом диске**

## Важно для совместной работы
Все участники команды должны:
- Выбрать **ОДИНАКОВЫЙ** файл базы данных на сетевом диске
- Иметь права чтения/записи на сетевой диск

## Где хранятся данные
- Конфигурация: в папке `KanbanTracker_Data` рядом с exe файлом
- Логи: в папке `KanbanTracker_Data/logs`
- База данных: в выбранном вами месте

## Перенос на другой компьютер
Просто скопируйте файл KanbanTracker-portable.exe — все настройки 
сохранятся в папке рядом с программой.
```

---

## 11. ПОДДЕРЖКА И ОБСЛУЖИВАНИЕ

### 11.1 Резервное копирование
```typescript
// Автоматический бэкап БД раз в день
function createBackup() {
  const dbPath = getDbPath();
  const backupPath = path.join(
    path.dirname(dbPath),
    'backups',
    `kanban-backup-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.db`
  );
  
  fs.copyFileSync(dbPath, backupPath);
  
  // Удалять бэкапы старше 30 дней
  cleanOldBackups(30);
}
```

### 11.2 Обновления
```typescript
// Для portable приложения - ручное обновление
// При запуске проверяем версию и показываем уведомление если есть новая

async function checkForUpdates() {
  try {
    const response = await fetch('https://your-server.com/kanban/version.json');
    const { latestVersion, downloadUrl } = await response.json();
    
    if (latestVersion > app.getVersion()) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Доступно обновление',
        message: `Доступна новая версия ${latestVersion}.\n\nТекущая версия: ${app.getVersion()}`,
        buttons: ['Скачать', 'Позже'],
        defaultId: 0
      }).then(result => {
        if (result.response === 0) {
          shell.openExternal(downloadUrl);
        }
      });
    }
  } catch {
    // Игнорируем ошибки проверки обновлений
  }
}
```

---

## 12. ПРИМЕР КАРТОЧКИ

```
┌─────────────────────────────────────────────┐
│ ID 1                                    [✎] │ ← Заголовок
│─────────────────────────────────────────────│
│ Стрим: Корпоративный центр                  │
│                                             │
│ Отдел/управление: Маркетинг                 │
│                                             │
│ Ответственные:                              │
│ [Еремей Корнеплод] [Алебастр Гаврилов]     │
│                                             │
│ Планируемая дата интервью:                  │
│ 02.02.2026                                  │
│                                             │
│ Фактический статус:                         │
│ [ожидаем назначения]                        │
│─────────────────────────────────────────────│
│ Обновлено: 28.01.2026 14:30 • Иван Иванов │ ← Футер
└─────────────────────────────────────────────┘
```

---

КОНЕЦ ТЕХНИЧЕСКОГО ЗАДАНИЯ

---

Date created: 28 Jan 2026
