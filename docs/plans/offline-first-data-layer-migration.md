# Offline-First Calendar Data Layer Migration Plan

## Executive Summary

This document outlines a comprehensive migration plan to transform our calendar application from a hybrid online/offline data layer to a true offline-first architecture for calendar data. The goal is to create a unified data access layer where Dexie becomes the single source of truth for calendar-related data, handling all synchronization with Supabase in the background.

**Scope**: Calendar data only (events, personas, calendars, categories, annotations)
**Excluded**: AI chat conversations and messages (keep existing Mastra API patterns)

## Current State Analysis

### Existing Architecture Problems

#### 1. **Hybrid Data Access Pattern**
- Some hooks use Dexie (`lib/data/domains/`) with optimistic updates
- Others have scattered direct Supabase calls throughout components
- Inconsistent patterns across different data domains
- No clear offline behavior for some features

#### 2. **Data Synchronization Issues**
- No unified sync strategy across domains
- Manual cache invalidation patterns in components
- Race conditions between optimistic updates and server responses
- Realtime subscriptions update both Dexie and React Query independently

#### 3. **Developer Experience Issues**
- Developers must decide between local vs server data access per feature
- Mixed patterns make codebase harder to maintain
- Complex error handling for offline scenarios
- No clear offline state management

### Current Working Components

#### 1. **Unified Data Layer Foundation** (`lib/data/`)
- **Base Layer**: Solid foundation with client types, mapping, and Dexie setup
- **Domain Hooks**: Events, personas, calendars, categories, annotations working well with optimistic updates
- **Data Mapping & Assembly**: Clean server-to-client type mapping, proper data assembly
- **Realtime Sync**: Background sync via Supabase realtime subscriptions

#### 2. **Existing Dexie Implementation**
```typescript
// Current Dexie schema - already supports main calendar data
export class AppDB extends Dexie {
  events!: Table<ClientEvent, string>;
  event_details_personal!: Table<ClientEDP, [string, string]>;
  user_profiles!: Table<ClientUserProfile, string>;
  user_calendars!: Table<ClientCalendar, string>;
  user_categories!: Table<ClientCategory, string>;
  ai_personas!: Table<ClientPersona, string>;
  user_annotations!: Table<ClientAnnotation, string>;
}
```

#### 3. **TanStack Query Integration**
- Proper caching with stale-while-revalidate
- Query invalidation patterns
- Optimistic cache updates working for most domains

## Target Architecture

### Core Principles

#### 1. **Dexie as Single Source of Truth**
- All calendar app data reads go through Dexie
- No direct Supabase queries from components/hooks
- Dexie serves as the offline cache and primary data store

#### 2. **Background Synchronization**
- Separate sync layer handles Supabase communication
- Automatic conflict resolution using last-write-wins
- Queue-based offline operations
- Transparent online/offline transitions

#### 3. **Unified Data Access Interface**
- Single set of hooks for all data operations
- Consistent patterns across all domains
- Automatic offline handling
- No component awareness of sync state

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    React Components                         │
│               (Calendar, Events, Settings)                 │
├─────────────────────────────────────────────────────────────┤
│                  Unified Data Hooks                        │
│    (useEvents, usePersonas, useCalendars, etc.)            │
├─────────────────────────────────────────────────────────────┤
│                Dexie Local Database                        │
│           (Single Source of Truth)                         │
│  Events | Personas | Calendars | Categories | Annotations  │
├─────────────────────────────────────────────────────────────┤
│                  Sync Orchestrator                         │
│  Queue Manager | Conflict Resolution | Retry Logic         │
├─────────────────────────────────────────────────────────────┤
│                    Supabase Backend                        │
│  PostgreSQL | Realtime | Authentication | Storage          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   AI Chat System                           │
│              (Continues Existing Pattern)                  │
│   Components → Mastra API → Mastra Memory                  │
└─────────────────────────────────────────────────────────────┘
```

## Migration Strategy

### Phase 1: Sync Infrastructure (Week 1-2)

#### 1.1 Create Sync Orchestrator
**File**: `lib/data/sync/orchestrator.ts`

```typescript
interface SyncOperation {
  id: string
  table: string
  action: 'insert' | 'update' | 'delete'
  data: any
  timestamp: number
  retryCount: number
  userId: string
}

export class SyncOrchestrator {
  private queue: SyncOperation[] = []
  private isOnline: boolean = navigator.onLine
  private syncInProgress: boolean = false
  private managers: Map<string, BaseSyncManager<any>> = new Map()

  constructor() {
    // Register domain sync managers
    this.managers.set('events', new EventSyncManager())
    this.managers.set('ai_personas', new PersonaSyncManager())
    this.managers.set('user_calendars', new CalendarSyncManager())
    this.managers.set('user_categories', new CategorySyncManager())
    this.managers.set('user_annotations', new AnnotationSyncManager())

    // Set up online/offline listeners
    window.addEventListener('online', () => this.onOnline())
    window.addEventListener('offline', () => this.onOffline())

    // Start periodic sync
    this.startPeriodicSync()
  }

  // Queue operations for background sync
  async queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const queuedOp: SyncOperation = {
      ...operation,
      id: generateUUID(),
      timestamp: Date.now(),
      retryCount: 0
    }

    await queueDB.operations.put(queuedOp)

    // Try immediate sync if online
    if (this.isOnline && !this.syncInProgress) {
      this.processSyncQueue()
    }
  }

  // Process sync queue when online
  async processSyncQueue(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) return

    this.syncInProgress = true
    try {
      const operations = await queueDB.operations.orderBy('timestamp').toArray()
      const groupedOps = this.groupOperationsByTable(operations)

      for (const [table, ops] of groupedOps) {
        const manager = this.managers.get(table)
        if (manager) {
          await manager.pushToServer(ops)
        }
      }
    } finally {
      this.syncInProgress = false
    }
  }

  // Pull latest data from server
  async pullFromServer(userId: string): Promise<void> {
    const lastSyncTimes = await this.getLastSyncTimes(userId)

    for (const [table, manager] of this.managers) {
      try {
        await manager.pullFromServer(userId, lastSyncTimes.get(table))
        await this.setLastSyncTime(userId, table, new Date())
      } catch (error) {
        console.warn(`Failed to sync ${table}:`, error)
      }
    }
  }

  private onOnline(): void {
    this.isOnline = true
    console.log('📶 Back online - starting sync')
    this.processSyncQueue()
  }

  private onOffline(): void {
    this.isOnline = false
    console.log('📱 Offline mode - queuing operations')
  }

  private startPeriodicSync(): void {
    setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        const userId = getCurrentUserId() // Get from auth context
        if (userId) {
          this.pullFromServer(userId)
          this.processSyncQueue()
        }
      }
    }, 30000) // Sync every 30 seconds when online
  }
}
```

#### 1.2 Offline Operations Queue
**File**: `lib/data/sync/queue.ts`

```typescript
interface QueuedOperation {
  id: string
  userId: string
  table: string
  action: 'insert' | 'update' | 'delete'
  data: any
  timestamp: number
  retryCount: number
  dependencies?: string[] // for operation ordering
}

// Separate Dexie database for queued operations
class QueueDB extends Dexie {
  operations!: Table<QueuedOperation, string>

  constructor() {
    super('sync-queue-db')
    this.version(1).stores({
      operations: 'id, userId, table, timestamp, retryCount, [userId+timestamp]'
    })
  }
}

export const queueDB = new QueueDB()
```

#### 1.3 Base Sync Manager
**File**: `lib/data/sync/base-manager.ts`

```typescript
export abstract class BaseSyncManager<T extends { id: string; updated_at: string }> {
  protected abstract tableName: string
  protected abstract supabaseTable: string

  abstract pullFromServer(userId: string, lastSync?: Date): Promise<void>
  abstract pushToServer(operations: QueuedOperation[]): Promise<void>
  abstract mapToServer(clientData: T): any
  abstract mapFromServer(serverData: any): T

  async resolveConflict(local: T, remote: any): Promise<T> {
    // Default: last-write-wins based on updated_at
    const localTime = new Date(local.updated_at).getTime()
    const remoteTime = new Date(remote.updated_at).getTime()

    return localTime > remoteTime ? local : this.mapFromServer(remote)
  }

  protected async handleSyncError(operation: QueuedOperation, error: any): Promise<void> {
    if (this.isNetworkError(error)) {
      // Retry with exponential backoff
      operation.retryCount++
      const delay = Math.min(1000 * Math.pow(2, operation.retryCount), 30000)

      setTimeout(async () => {
        await queueDB.operations.put(operation)
      }, delay)
    } else if (this.isConflictError(error)) {
      // Handle conflict resolution
      await this.resolveServerConflict(operation, error)
    } else {
      // Permanent error - log and remove from queue
      console.error('Permanent sync error:', error)
      await queueDB.operations.delete(operation.id)
    }
  }

  protected isNetworkError(error: any): boolean {
    return error.code === 'NETWORK_ERROR' || !navigator.onLine
  }

  protected isConflictError(error: any): boolean {
    return error.code === 'CONFLICT' || error.status === 409
  }
}
```

### Phase 2: Repository Pattern Implementation (Week 2-3)

#### 2.1 Create Data Repository Interface
**File**: `lib/data/repositories/base-repository.ts`

```typescript
export interface DataRepository<T> {
  // Read operations (always from Dexie)
  findById(id: string): Promise<T | undefined>
  findAll(filters?: Record<string, any>): Promise<T[]>
  findWhere(condition: (item: T) => boolean): Promise<T[]>
  findByIds(ids: string[]): Promise<T[]>

  // Write operations (optimistic + queue for sync)
  create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T>
  update(id: string, data: Partial<T>): Promise<T>
  delete(id: string): Promise<void>

  // Bulk operations
  bulkCreate(items: Omit<T, 'id' | 'created_at' | 'updated_at'>[]): Promise<T[]>
  bulkUpdate(updates: Array<{ id: string; data: Partial<T> }>): Promise<T[]>
  bulkDelete(ids: string[]): Promise<void>
}

export class DexieRepository<T extends { id: string; user_id: string; updated_at: string }>
  implements DataRepository<T> {

  constructor(
    private table: Table<T, string>,
    private syncManager: BaseSyncManager<T>,
    private tableName: string
  ) {}

  async findById(id: string): Promise<T | undefined> {
    return await this.table.get(id)
  }

  async findAll(filters?: Record<string, any>): Promise<T[]> {
    let query = this.table.orderBy('updated_at').reverse()

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.filter(item => (item as any)[key] === value)
      })
    }

    return await query.toArray()
  }

  async findWhere(condition: (item: T) => boolean): Promise<T[]> {
    return await this.table.filter(condition).toArray()
  }

  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    const item = {
      ...data,
      id: generateUUID(),
      created_at: nowISO(),
      updated_at: nowISO()
    } as T

    // Optimistic write to Dexie
    await this.table.put(item)

    // Queue for background sync
    await syncOrchestrator.queueOperation({
      table: this.tableName,
      action: 'insert',
      data: item,
      userId: item.user_id
    })

    return item
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const existing = await this.table.get(id)
    if (!existing) {
      throw new Error(`${this.tableName} with id ${id} not found`)
    }

    const updated = {
      ...existing,
      ...data,
      updated_at: nowISO()
    } as T

    // Optimistic write to Dexie
    await this.table.put(updated)

    // Queue for background sync
    await syncOrchestrator.queueOperation({
      table: this.tableName,
      action: 'update',
      data: updated,
      userId: updated.user_id
    })

    return updated
  }

  async delete(id: string): Promise<void> {
    const existing = await this.table.get(id)
    if (!existing) return

    // Optimistic delete from Dexie
    await this.table.delete(id)

    // Queue for background sync
    await syncOrchestrator.queueOperation({
      table: this.tableName,
      action: 'delete',
      data: { id },
      userId: existing.user_id
    })
  }

  // ... implement bulk operations
}
```

#### 2.2 Domain-Specific Repositories
**File**: `lib/data/repositories/index.ts`

```typescript
import { db } from '../base/dexie'
import {
  EventSyncManager,
  PersonaSyncManager,
  CalendarSyncManager,
  CategorySyncManager,
  AnnotationSyncManager
} from '../sync/managers'

// Create typed repositories for each domain
export const eventsRepository = new DexieRepository(
  db.events,
  new EventSyncManager(),
  'events'
)

export const personasRepository = new DexieRepository(
  db.ai_personas,
  new PersonaSyncManager(),
  'ai_personas'
)

export const calendarsRepository = new DexieRepository(
  db.user_calendars,
  new CalendarSyncManager(),
  'user_calendars'
)

export const categoriesRepository = new DexieRepository(
  db.user_categories,
  new CategorySyncManager(),
  'user_categories'
)

export const annotationsRepository = new DexieRepository(
  db.user_annotations,
  new AnnotationSyncManager(),
  'user_annotations'
)

// Special repository for assembled events (events + personal details)
export class AssembledEventsRepository {
  async findEventsInRange(userId: string, from: number, to: number): Promise<AssembledEvent[]> {
    const events = await db.events
      .where('owner_id').equals(userId)
      .and(event => event.start_time_ms <= to && event.end_time_ms >= from)
      .toArray()

    return assembleEvents(events, userId)
  }

  async findEventById(userId: string, eventId: string): Promise<AssembledEvent | undefined> {
    const event = await db.events.get(eventId)
    if (!event) return undefined

    return assembleEvent(event, userId)
  }
}

export const assembledEventsRepository = new AssembledEventsRepository()
```

#### 2.3 Unified Hook Factory
**File**: `lib/data/hooks/factory.ts`

```typescript
function createDomainHooks<T extends { id: string; user_id: string }>(
  repository: DataRepository<T>,
  keyFactory: (userId: string, ...args: any[]) => QueryKey
) {
  return {
    useItems: (userId: string | undefined, filters?: any) =>
      useQuery({
        queryKey: userId ? keyFactory(userId, filters) : ['none'],
        enabled: !!userId,
        queryFn: () => repository.findAll({ user_id: userId, ...filters }),
        staleTime: Infinity // Background sync handles updates
      }),

    useItem: (userId: string | undefined, id: string | undefined) =>
      useQuery({
        queryKey: userId && id ? keyFactory(userId, id) : ['none'],
        enabled: !!userId && !!id,
        queryFn: () => repository.findById(id!),
        staleTime: Infinity
      }),

    useCreate: (userId?: string) => {
      const queryClient = useQueryClient()
      return useMutation({
        mutationFn: (data: any) => repository.create({ ...data, user_id: userId }),
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [keyFactory(userId!)[0]]
          })
        }
      })
    },

    useUpdate: (userId?: string) => {
      const queryClient = useQueryClient()
      return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<T> }) =>
          repository.update(id, data),
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [keyFactory(userId!)[0]]
          })
        }
      })
    },

    useDelete: (userId?: string) => {
      const queryClient = useQueryClient()
      return useMutation({
        mutationFn: (id: string) => repository.delete(id),
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [keyFactory(userId!)[0]]
          })
        }
      })
    }
  }
}

// Create hooks for each domain
export const eventHooks = createDomainHooks(eventsRepository, keys.events)
export const personaHooks = createDomainHooks(personasRepository, keys.personas)
export const calendarHooks = createDomainHooks(calendarsRepository, keys.calendars)
export const categoryHooks = createDomainHooks(categoriesRepository, keys.categories)
export const annotationHooks = createDomainHooks(annotationsRepository, keys.annotations)
```

### Phase 3: Domain Sync Managers (Week 3-4)

#### 3.1 Event Sync Manager
**File**: `lib/data/sync/managers/events.ts`

```typescript
export class EventSyncManager extends BaseSyncManager<ClientEvent> {
  protected tableName = 'events'
  protected supabaseTable = 'events'

  async pullFromServer(userId: string, lastSync?: Date): Promise<void> {
    const query = supabase
      .from('events')
      .select('*')
      .eq('owner_id', userId)

    if (lastSync) {
      query.gte('updated_at', lastSync.toISOString())
    }

    const { data, error } = await query

    if (error) throw error

    const clientEvents = (data || []).map(mapEventFromServer)
    await db.events.bulkPut(clientEvents)

    // Also pull related EDP data for these events
    if (clientEvents.length > 0) {
      await this.syncEventDetails(userId, clientEvents.map(e => e.id))
    }
  }

  async pushToServer(operations: QueuedOperation[]): Promise<void> {
    for (const op of operations) {
      try {
        await this.validateOperation(op)

        switch (op.action) {
          case 'insert':
            await supabase.from('events').insert(this.mapToServer(op.data))
            break
          case 'update':
            await supabase
              .from('events')
              .update(this.mapToServer(op.data))
              .eq('id', op.data.id)
            break
          case 'delete':
            await supabase
              .from('events')
              .delete()
              .eq('id', op.data.id)
              .eq('owner_id', op.userId)
            break
        }

        // Remove from queue on success
        await queueDB.operations.delete(op.id)
      } catch (error) {
        await this.handleSyncError(op, error)
      }
    }
  }

  mapToServer(clientEvent: ClientEvent): any {
    return {
      id: clientEvent.id,
      owner_id: clientEvent.owner_id,
      creator_id: clientEvent.creator_id,
      title: clientEvent.title,
      agenda: clientEvent.agenda,
      start_time: clientEvent.start_time,
      end_time: clientEvent.end_time,
      all_day: clientEvent.all_day,
      private: clientEvent.private,
      online_event: clientEvent.online_event,
      in_person: clientEvent.in_person,
      // ... other fields
      updated_at: clientEvent.updated_at
    }
  }

  mapFromServer(serverEvent: any): ClientEvent {
    return mapEventFromServer(serverEvent) // Use existing mapping
  }

  private async syncEventDetails(userId: string, eventIds: string[]): Promise<void> {
    const { data, error } = await supabase
      .from('event_details_personal')
      .select('*')
      .eq('user_id', userId)
      .in('event_id', eventIds)

    if (error) throw error

    const clientEDPs = (data || []).map(mapEDPFromServer)
    await db.event_details_personal.bulkPut(clientEDPs)
  }

  private async validateOperation(op: QueuedOperation): Promise<void> {
    // Add validation logic for events
    if (!op.data.title || !op.data.start_time || !op.data.end_time) {
      throw new Error('Invalid event data: missing required fields')
    }
  }
}
```

#### 3.2 Persona Sync Manager
**File**: `lib/data/sync/managers/personas.ts`

```typescript
export class PersonaSyncManager extends BaseSyncManager<ClientPersona> {
  protected tableName = 'ai_personas'
  protected supabaseTable = 'ai_personas'

  async pullFromServer(userId: string, lastSync?: Date): Promise<void> {
    const query = supabase
      .from('ai_personas')
      .select('*')
      .eq('user_id', userId)
      .order('name')

    if (lastSync) {
      query.gte('updated_at', lastSync.toISOString())
    }

    const { data, error } = await query

    if (error) throw error

    const clientPersonas = (data || []).map(mapPersonaFromServer)
    await db.ai_personas.bulkPut(clientPersonas)
  }

  async pushToServer(operations: QueuedOperation[]): Promise<void> {
    for (const op of operations) {
      try {
        switch (op.action) {
          case 'insert':
            await supabase.from('ai_personas').insert(this.mapToServer(op.data))
            break
          case 'update':
            await supabase
              .from('ai_personas')
              .update(this.mapToServer(op.data))
              .eq('id', op.data.id)
              .eq('user_id', op.userId)
            break
          case 'delete':
            await supabase
              .from('ai_personas')
              .delete()
              .eq('id', op.data.id)
              .eq('user_id', op.userId)
              .eq('is_default', false) // Prevent deletion of default persona
            break
        }

        await queueDB.operations.delete(op.id)
      } catch (error) {
        await this.handleSyncError(op, error)
      }
    }
  }

  mapToServer(clientPersona: ClientPersona): any {
    return {
      id: clientPersona.id,
      user_id: clientPersona.user_id,
      name: clientPersona.name,
      avatar_url: clientPersona.avatar_url,
      traits: clientPersona.traits,
      instructions: clientPersona.instructions,
      greeting: clientPersona.greeting,
      agent_id: clientPersona.agent_id,
      model_id: clientPersona.model_id,
      temperature: clientPersona.temperature,
      top_p: clientPersona.top_p,
      is_default: clientPersona.is_default,
      properties_ext: clientPersona.properties_ext,
      updated_at: clientPersona.updated_at
    }
  }

  mapFromServer(serverPersona: any): ClientPersona {
    return mapPersonaFromServer(serverPersona)
  }
}
```

#### 3.3 Annotation Sync Manager
**File**: `lib/data/sync/managers/annotations.ts`

```typescript
export class AnnotationSyncManager extends BaseSyncManager<ClientAnnotation> {
  protected tableName = 'user_annotations'
  protected supabaseTable = 'user_annotations'

  async pullFromServer(userId: string, lastSync?: Date): Promise<void> {
    const query = supabase
      .from('user_annotations')
      .select('*')
      .eq('user_id', userId)

    if (lastSync) {
      query.gte('updated_at', lastSync.toISOString())
    }

    const { data, error } = await query

    if (error) throw error

    const clientAnnotations = (data || []).map(mapAnnotationFromServer)
    await db.user_annotations.bulkPut(clientAnnotations)
  }

  async pushToServer(operations: QueuedOperation[]): Promise<void> {
    for (const op of operations) {
      try {
        switch (op.action) {
          case 'insert':
            await supabase.from('user_annotations').insert(this.mapToServer(op.data))
            break
          case 'update':
            await supabase
              .from('user_annotations')
              .update(this.mapToServer(op.data))
              .eq('id', op.data.id)
              .eq('user_id', op.userId)
            break
          case 'delete':
            await supabase
              .from('user_annotations')
              .delete()
              .eq('id', op.data.id)
              .eq('user_id', op.userId)
            break
        }

        await queueDB.operations.delete(op.id)
      } catch (error) {
        await this.handleSyncError(op, error)
      }
    }
  }

  mapToServer(clientAnnotation: ClientAnnotation): any {
    return {
      id: clientAnnotation.id,
      user_id: clientAnnotation.user_id,
      type: clientAnnotation.type,
      title: clientAnnotation.title,
      description: clientAnnotation.description,
      start_time: clientAnnotation.start_time,
      end_time: clientAnnotation.end_time,
      all_day: clientAnnotation.all_day,
      recurrence_rule: clientAnnotation.recurrence_rule,
      color: clientAnnotation.color,
      metadata: clientAnnotation.metadata,
      ai_generated: clientAnnotation.ai_generated,
      ai_persona_id: clientAnnotation.ai_persona_id,
      ai_reasoning: clientAnnotation.ai_reasoning,
      updated_at: clientAnnotation.updated_at
    }
  }

  mapFromServer(serverAnnotation: any): ClientAnnotation {
    return mapAnnotationFromServer(serverAnnotation)
  }
}
```

### Phase 4: Updated Domain Hooks (Week 4-5)

#### 4.1 Updated Events Domain Hook
**File**: `lib/data/domains/events.ts` (updated)

```typescript
// Replace existing implementations with repository-based ones

export function useEventsRange(uid: string | undefined, range: { from: number; to: number }) {
  return useQuery({
    queryKey: uid ? keys.eventsRange(uid, range.from, range.to) : ['events:none'],
    enabled: !!uid,
    queryFn: async (): Promise<AssembledEvent[]> => {
      // Always read from Dexie first - no direct Supabase calls
      return await assembledEventsRepository.findEventsInRange(uid!, range.from, range.to)
    },
    staleTime: Infinity, // Background sync handles updates
  })
}

export function useEvent(uid: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: uid && id ? keys.event(uid, id) : ['event:none'],
    enabled: !!uid && !!id,
    queryFn: async (): Promise<AssembledEvent | undefined> => {
      // Always read from Dexie first
      return await assembledEventsRepository.findEventById(uid!, id!)
    },
    staleTime: Infinity,
  })
}

export function useCreateEvent(uid?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateEventInput): Promise<AssembledEvent> => {
      if (!uid) throw new Error('user required')

      // Use repository pattern instead of direct Dexie + Supabase
      const event = await eventsRepository.create({
        owner_id: uid,
        creator_id: uid,
        title: input.title,
        start_time: input.start_time,
        end_time: input.end_time,
        start_time_ms: Date.parse(input.start_time),
        end_time_ms: Date.parse(input.end_time),
        // ... other required fields with defaults
      })

      // Handle personal details through separate repository if needed
      if (input.calendar_id || input.category_id || input.show_time_as) {
        // Create EDP record through repository
        await edpRepository.create({
          event_id: event.id,
          user_id: uid,
          calendar_id: input.calendar_id || null,
          category_id: input.category_id || null,
          show_time_as: input.show_time_as || 'busy',
          // ... other EDP fields
        })
      }

      return await assembledEventsRepository.findEventById(uid, event.id) as AssembledEvent
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['events'] }),
  })
}

// Similar updates for useUpdateEvent, useDeleteEvent, etc.
// All should use repository pattern instead of direct DB calls
```

#### 4.2 Updated Personas Domain Hook
**File**: `lib/data/domains/personas.ts` (updated)

```typescript
export function useAIPersonas(uid: string | undefined) {
  return useQuery({
    queryKey: uid ? keys.personas(uid) : ['personas:none'],
    enabled: !!uid,
    queryFn: async (): Promise<ClientPersona[]> => {
      // Always read from Dexie via repository
      return await personasRepository.findAll({ user_id: uid })
    },
    staleTime: Infinity, // Background sync handles updates
  })
}

export function useCreateAIPersona(uid?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreatePersonaInput): Promise<ClientPersona> => {
      if (!uid) throw new Error('user required')

      // Use repository instead of manual optimistic + server calls
      return await personasRepository.create({
        user_id: uid,
        name: input.name,
        avatar_url: input.avatar_url ?? null,
        traits: input.traits ?? null,
        instructions: input.instructions ?? null,
        greeting: input.greeting ?? null,
        agent_id: input.agent_id ?? 'dynamicPersonaAgent',
        model_id: input.model_id ?? null,
        temperature: input.temperature ?? null,
        top_p: input.top_p ?? null,
        is_default: false,
        properties_ext: input.properties_ext ?? null,
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.personas(uid!) }),
  })
}

// Similar updates for useUpdateAIPersona, useDeleteAIPersona, etc.
```

### Phase 5: Component Migration (Week 5-6)

#### 5.1 Component Updates Required

**Files to Update**:

1. **Calendar Components**
   - `components/calendar-day-range.tsx` - Already uses domain hooks, no changes needed
   - `components/calendar-view/event-card.tsx` - Already uses domain hooks, no changes needed
   - `components/event-details-panel.tsx` - May need updates if using direct queries

2. **Settings Components**
   - `components/settings-modal.tsx` - Update to use repository-based persona hooks
   - `components/settings/` - Update any direct Supabase calls

3. **AI Components** (NO CHANGES)
   - `components/ai-assistant-panel.tsx` - Keep existing Mastra API pattern
   - `hooks/use-chat-conversations.ts` - Keep unchanged
   - `hooks/use-conversation-messages.ts` - Keep unchanged

#### 5.2 Remove Direct Supabase Imports

**Search and Replace Pattern**:
```typescript
// Before: Direct Supabase calls in components
import { supabase } from '@/lib/supabase'
const { data } = await supabase.from('events').select()

// After: Repository-based access
import { useEvents } from '@/lib/data'
const { data } = useEvents(userId, filters)
```

#### 5.3 Add Offline State Management

**File**: `lib/data/hooks/use-sync-status.ts`

```typescript
export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingOperations, setPendingOperations] = useState<QueuedOperation[]>([])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Monitor pending operations
    const interval = setInterval(async () => {
      const ops = await queueDB.operations.toArray()
      setPendingOperations(ops)
    }, 1000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  return {
    isOnline,
    hasPendingOperations: pendingOperations.length > 0,
    pendingCount: pendingOperations.length,
    pendingOperations
  }
}
```

**File**: `components/ui/offline-indicator.tsx`

```typescript
export function OfflineIndicator() {
  const { isOnline, hasPendingOperations, pendingCount } = useSyncStatus()

  if (isOnline && !hasPendingOperations) return null

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1 text-sm rounded-md",
      !isOnline
        ? "bg-red-100 text-red-800"
        : "bg-yellow-100 text-yellow-800"
    )}>
      {!isOnline ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span>Offline - changes will sync when online</span>
        </>
      ) : (
        <>
          <Clock className="h-4 w-4" />
          <span>Syncing {pendingCount} changes...</span>
        </>
      )}
    </div>
  )
}
```

## Implementation Details

### Database Schema Extensions

#### 1. Sync Metadata Tracking
```typescript
// Add to main Dexie database
this.version(10).stores({
  // ... existing tables
  sync_metadata: 'table, user_id, last_sync_at, [table+user_id]'
})

interface SyncMetadata {
  table: string
  user_id: string
  last_sync_at: string
  sync_token?: string // For future incremental sync optimization
}
```

#### 2. Operation Queue Indexes
```typescript
// Optimize queue database for common access patterns
this.version(1).stores({
  operations: 'id, userId, table, timestamp, retryCount, [userId+table], [userId+timestamp]'
})
```

### Error Handling & Recovery

#### 1. Network Error Recovery
```typescript
class NetworkErrorHandler {
  async handleError(operation: QueuedOperation, error: any): Promise<void> {
    if (this.isNetworkError(error)) {
      // Exponential backoff with jitter
      const baseDelay = 1000
      const maxDelay = 30000
      const jitter = Math.random() * 0.1
      const delay = Math.min(
        baseDelay * Math.pow(2, operation.retryCount) * (1 + jitter),
        maxDelay
      )

      operation.retryCount++
      setTimeout(() => this.retryOperation(operation), delay)
    } else if (this.isConflictError(error)) {
      await this.resolveConflict(operation, error)
    } else {
      // Permanent error - log and remove
      console.error('Permanent sync error:', error)
      await queueDB.operations.delete(operation.id)
    }
  }

  private async resolveConflict(operation: QueuedOperation, error: any): Promise<void> {
    try {
      // Fetch current server state
      const { data } = await supabase
        .from(operation.table)
        .select('*')
        .eq('id', operation.data.id)
        .single()

      // Get current local state
      const localData = await this.getLocalData(operation.table, operation.data.id)

      // Resolve conflict using domain-specific logic
      const syncManager = this.getSyncManager(operation.table)
      const resolved = await syncManager.resolveConflict(localData, data)

      // Update local data with resolved version
      await this.updateLocalData(operation.table, resolved)

      // Remove operation from queue
      await queueDB.operations.delete(operation.id)
    } catch (resolveError) {
      console.error('Conflict resolution failed:', resolveError)
      // Could not resolve - mark for manual intervention
      operation.retryCount = 999 // Prevent further retries
      await queueDB.operations.put(operation)
    }
  }
}
```

#### 2. Data Validation
```typescript
class DataValidator {
  private schemas = new Map<string, any>()

  constructor() {
    // Define Zod schemas for each table
    this.schemas.set('events', eventSchema)
    this.schemas.set('ai_personas', personaSchema)
    this.schemas.set('user_calendars', calendarSchema)
    this.schemas.set('user_categories', categorySchema)
    this.schemas.set('user_annotations', annotationSchema)
  }

  async validateOperation(operation: QueuedOperation): Promise<boolean> {
    const schema = this.schemas.get(operation.table)
    if (!schema) {
      console.warn(`No validation schema for table: ${operation.table}`)
      return true
    }

    const result = schema.safeParse(operation.data)
    if (!result.success) {
      console.error('Data validation failed:', {
        table: operation.table,
        errors: result.error.issues,
        data: operation.data
      })
      return false
    }

    return true
  }
}
```

### Performance Optimizations

#### 1. Efficient Query Patterns
```typescript
// Optimize Dexie indexes for common calendar queries
this.version(10).stores({
  events: 'id, owner_id, start_time_ms, end_time_ms, updated_at, [owner_id+start_time_ms], [owner_id+end_time_ms]',
  user_annotations: 'id, user_id, type, start_time_ms, end_time_ms, visible, updated_at, [user_id+start_time_ms], [user_id+visible]'
})
```

#### 2. Batch Sync Operations
```typescript
class BatchSyncProcessor {
  private batchSize = 10
  private flushInterval = 5000 // 5 seconds

  async processBatch(operations: QueuedOperation[]): Promise<void> {
    // Group by table for efficient batch processing
    const grouped = this.groupByTable(operations)

    for (const [table, ops] of grouped) {
      // Process operations in batches
      const batches = this.chunk(ops, this.batchSize)

      for (const batch of batches) {
        try {
          await this.processBatchForTable(table, batch)
        } catch (error) {
          // Handle individual operations on batch failure
          await this.handleFailedBatch(batch, error)
        }
      }
    }
  }

  private async processBatchForTable(table: string, operations: QueuedOperation[]): Promise<void> {
    const inserts = operations.filter(op => op.action === 'insert')
    const updates = operations.filter(op => op.action === 'update')
    const deletes = operations.filter(op => op.action === 'delete')

    // Batch inserts
    if (inserts.length > 0) {
      await supabase.from(table).insert(inserts.map(op => op.data))
    }

    // Batch updates
    for (const update of updates) {
      await supabase.from(table).update(update.data).eq('id', update.data.id)
    }

    // Batch deletes
    if (deletes.length > 0) {
      const deleteIds = deletes.map(op => op.data.id)
      await supabase.from(table).delete().in('id', deleteIds)
    }

    // Remove successful operations from queue
    await queueDB.operations.bulkDelete(operations.map(op => op.id))
  }
}
```

#### 3. Smart Sync Intervals
```typescript
class AdaptiveSyncScheduler {
  private baseInterval = 30000 // 30 seconds
  private maxInterval = 300000 // 5 minutes
  private currentInterval = this.baseInterval

  startAdaptiveSync(): void {
    const sync = async () => {
      const startTime = Date.now()

      try {
        await syncOrchestrator.processSyncQueue()

        // Successful sync - reduce interval
        this.currentInterval = Math.max(
          this.baseInterval,
          this.currentInterval * 0.9
        )
      } catch (error) {
        // Failed sync - increase interval
        this.currentInterval = Math.min(
          this.maxInterval,
          this.currentInterval * 1.5
        )

        console.warn('Sync failed, backing off:', {
          error,
          nextInterval: this.currentInterval
        })
      }

      // Schedule next sync
      setTimeout(sync, this.currentInterval)
    }

    // Start initial sync
    sync()
  }
}
```

## Testing Strategy

### 1. Offline Behavior Testing
```typescript
describe('Offline-first behavior', () => {
  beforeEach(() => {
    // Mock offline state
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  })

  it('should queue operations when offline', async () => {
    const { result } = renderHook(() => useCreateEvent(userId))

    await act(async () => {
      await result.current.mutateAsync(testEventData)
    })

    // Verify operation was queued
    const queuedOps = await queueDB.operations.where({ userId }).toArray()
    expect(queuedOps).toHaveLength(1)
    expect(queuedOps[0].action).toBe('insert')
    expect(queuedOps[0].table).toBe('events')
  })

  it('should sync queued operations when back online', async () => {
    // Add operations to queue while offline
    await queueDB.operations.put({
      id: 'test-op',
      userId,
      table: 'events',
      action: 'insert',
      data: testEventData,
      timestamp: Date.now(),
      retryCount: 0
    })

    // Go back online
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    window.dispatchEvent(new Event('online'))

    // Wait for sync
    await waitFor(() => {
      expect(queueDB.operations.count()).resolves.toBe(0)
    })
  })
})
```

### 2. Conflict Resolution Testing
```typescript
describe('Conflict resolution', () => {
  it('should resolve conflicts using last-write-wins', async () => {
    const localEvent = {
      id: '1',
      title: 'Local Title',
      updated_at: '2024-01-02T00:00:00Z'
    }
    const remoteEvent = {
      id: '1',
      title: 'Remote Title',
      updated_at: '2024-01-01T00:00:00Z'
    }

    const eventSyncManager = new EventSyncManager()
    const resolved = await eventSyncManager.resolveConflict(localEvent, remoteEvent)

    expect(resolved.title).toBe('Local Title') // Local is newer
  })

  it('should handle complex field-level conflicts', async () => {
    // Test more sophisticated conflict resolution scenarios
  })
})
```

### 3. Performance Testing
```typescript
describe('Performance', () => {
  it('should handle large datasets efficiently', async () => {
    const largeEventSet = Array.from({ length: 10000 }, (_, i) => ({
      id: `event-${i}`,
      owner_id: userId,
      title: `Event ${i}`,
      start_time: new Date(Date.now() + i * 3600000).toISOString(),
      end_time: new Date(Date.now() + i * 3600000 + 3600000).toISOString(),
      start_time_ms: Date.now() + i * 3600000,
      end_time_ms: Date.now() + i * 3600000 + 3600000,
      updated_at: new Date().toISOString()
    }))

    const startTime = performance.now()
    await db.events.bulkPut(largeEventSet)
    const endTime = performance.now()

    expect(endTime - startTime).toBeLessThan(1000) // Should complete in under 1s
  })

  it('should query ranges efficiently', async () => {
    // Test range queries performance
    const startTime = performance.now()
    const events = await assembledEventsRepository.findEventsInRange(
      userId,
      Date.now(),
      Date.now() + 86400000 // 1 day
    )
    const endTime = performance.now()

    expect(endTime - startTime).toBeLessThan(100) // Under 100ms
  })
})
```

## Migration Timeline

### Week 1-2: Infrastructure Foundation
- [ ] **Day 1-3**: Create sync orchestrator and base classes
- [ ] **Day 4-6**: Implement operation queue system
- [ ] **Day 7-10**: Add conflict resolution framework
- [ ] **Day 11-14**: Set up online/offline detection and periodic sync

### Week 2-3: Repository Pattern Implementation
- [ ] **Day 15-17**: Create repository interfaces and base implementations
- [ ] **Day 18-20**: Implement domain-specific repositories
- [ ] **Day 21-24**: Create unified hook factory system
- [ ] **Day 25-28**: Add comprehensive error handling

### Week 3-4: Domain Sync Managers
- [ ] **Day 29-31**: Implement event sync manager with EDP handling
- [ ] **Day 32-34**: Create persona, calendar, category sync managers
- [ ] **Day 35-37**: Implement annotation sync manager
- [ ] **Day 38-42**: Add validation, retry logic, and batch processing

### Week 4-5: Domain Hook Migration
- [ ] **Day 43-45**: Update events domain hooks to use repositories
- [ ] **Day 46-48**: Update personas, calendars, categories domain hooks
- [ ] **Day 49-52**: Update annotations and remaining domain hooks
- [ ] **Day 53-56**: Remove all direct Supabase calls from domains

### Week 5-6: Component Migration & Testing
- [ ] **Day 57-59**: Update calendar components to use new patterns
- [ ] **Day 60-62**: Update settings and other components
- [ ] **Day 63-65**: Add offline indicators and sync status UI
- [ ] **Day 66-70**: Comprehensive testing, edge cases, performance optimization

## Risk Mitigation

### 1. Data Safety
- **Pre-migration backup**: Full database export before starting
- **Gradual rollout**: Feature flags to enable new system progressively
- **Dual-write period**: Brief period where both old and new systems write
- **Automatic rollback**: Monitoring to detect issues and revert if needed

### 2. Performance Monitoring
- **Query timing**: Track all Dexie query performance
- **Sync metrics**: Monitor sync operation success rates and timing
- **Memory usage**: Track local database size and memory consumption
- **Network efficiency**: Monitor background sync network usage

### 3. User Experience Protection
- **Optimistic UI**: Maintain immediate feedback for all user actions
- **Graceful degradation**: Clear messaging when offline
- **Error boundaries**: Prevent sync issues from breaking UI
- **Progressive enhancement**: Core features work even if sync fails

## Success Criteria

### Functional Requirements
- [ ] **Complete offline functionality**: All calendar features work without network
- [ ] **Automatic synchronization**: Changes sync automatically when online
- [ ] **Zero data loss**: No user data lost during offline periods
- [ ] **Conflict resolution**: Conflicts resolved automatically using sensible rules
- [ ] **Real-time updates**: Changes from other devices appear via realtime subscriptions

### Performance Requirements
- [ ] **Fast local queries**: Data queries complete under 100ms from Dexie
- [ ] **Efficient sync**: Background sync completes within 30 seconds
- [ ] **Low memory usage**: Local database stays under 50MB for typical usage
- [ ] **Non-blocking sync**: Background sync never blocks the UI

### Developer Experience
- [ ] **Unified patterns**: Single consistent API for all calendar data access
- [ ] **Zero sync awareness**: Components don't need to know about online/offline state
- [ ] **Clear debugging**: Comprehensive logging and error messages
- [ ] **Easy testing**: Simple mocking and testing patterns

### Backward Compatibility
- [ ] **No breaking changes**: Existing component APIs remain the same
- [ ] **Preserved UX**: User experience unchanged during migration
- [ ] **AI chat unchanged**: Chat functionality continues working as before

## Post-Migration Benefits

### For Users
- **Robust offline experience**: Full calendar functionality without internet
- **Faster app performance**: Instant data access from local database
- **Seamless sync**: Automatic background synchronization
- **Better reliability**: Reduced dependency on network connectivity

### For Developers
- **Simplified data access**: Single pattern for all calendar data operations
- **Easier testing**: Mock data access layer instead of network calls
- **Better error handling**: Centralized error handling and retry logic
- **Cleaner architecture**: Clear separation between data access and business logic

### For Product
- **Enhanced user engagement**: Users can work offline confidently
- **Reduced support issues**: Fewer network-related problems
- **Improved performance metrics**: Faster app responsiveness
- **Future-proof foundation**: Ready for advanced offline features

## Conclusion

This migration plan transforms our calendar application into a true offline-first system while maintaining the current user experience and excluding AI chat functionality. The phased approach minimizes risk while ensuring a clean, maintainable architecture.

The key to success is the gradual migration approach - we maintain existing working patterns while building the new system alongside, then switch over domain by domain. This ensures we never break the working application while moving to a superior offline-first architecture.

The result will be a more robust, performant, and maintainable calendar application that works seamlessly online and offline, with a unified data access pattern that simplifies development and testing.