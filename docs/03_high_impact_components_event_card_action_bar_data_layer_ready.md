# High‑Impact Components — Event Card & Action Bar (Data‑Layer Ready)

> Drop‑in replacements wired to the unified data layer (Dexie + TanStack + Supabase Realtime). No direct Supabase calls. Optimistic by default.

---

## 1) `components/event/EventCard.tsx`

```tsx
'use client'

import * as React from 'react'
import { MoreHorizontal, CalendarDays, Clock, Shield, Brain, Trash2, Pencil } from 'lucide-react'
import {
  useUpdateEvent,
  useDeleteEvent,
  useUpdateEventCalendar,
  useUpdateEventCategory,
  useUpdateEventShowTimeAs,
  useUpdateEventTimeDefense,
  useUpdateEventAI,
  useUserCalendars,
  useUserCategories,
} from '@/lib/data/queries'
import type { AssembledEvent } from '@/lib/data/base/client-types'
import { cn } from '@/lib/ui/cn' // <- if you have a classnames helper; otherwise replace with template strings

// shadcn/ui imports (adjust paths to your setup)
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'

export type EventCardProps = {
  userId?: string
  event: AssembledEvent
  onOpenDetails?: (id: string) => void
  className?: string
}

export function EventCard({ userId, event, onOpenDetails, className }: EventCardProps) {
  const update = useUpdateEvent(userId)
  const del = useDeleteEvent(userId)
  const setCal = useUpdateEventCalendar(userId)
  const setCat = useUpdateEventCategory(userId)
  const setShow = useUpdateEventShowTimeAs(userId)
  const setDef = useUpdateEventTimeDefense(userId)
  const setAI = useUpdateEventAI(userId)

  const { data: calendars = [] } = useUserCalendars(userId)
  const { data: categories = [] } = useUserCategories(userId)

  const start = new Date(event.start_time)
  const end = new Date(event.start_timestamp_ms + (event.duration ?? 0) * 60_000)

  const color = event.category?.color ?? event.calendar?.color

  return (
    <Card className={cn('relative overflow-hidden group', className)}>
      {/* color bar */}
      <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: color ?? 'var(--muted)' }} />

      <CardHeader className="pb-2 pr-12">
        <div className="flex items-center gap-2">
          <button
            className="text-base font-medium line-clamp-1 text-left hover:underline"
            onClick={() => onOpenDetails?.(event.id)}
          >
            {event.title || '(no title)'}
          </button>
          {event.ai_managed ? (
            <Badge variant="secondary" className="ml-1 gap-1">
              <Brain className="h-3 w-3" /> AI
            </Badge>
          ) : null}
          {event.private ? <Badge variant="secondary">Private</Badge> : null}
        </div>
      </CardHeader>

      <CardContent className="grid gap-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            {event.all_day ? 'All day' : `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span className="truncate">
            {event.calendar?.name ?? 'No calendar'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span className="truncate capitalize">
            {event.time_defense_level}
          </span>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Category picker */}
          <Select
            onValueChange={(categoryId) => setCat.mutate({ eventId: event.id, categoryId })}
            value={event.category?.id ?? ''}
          >
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key="none" value="">
                No category
              </SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Calendar picker */}
          <Select
            onValueChange={(calendarId) => setCal.mutate({ eventId: event.id, calendarId })}
            value={event.calendar?.id ?? ''}
          >
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue placeholder="Calendar" />
            </SelectTrigger>
            <SelectContent>
              {calendars.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Availability</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setShow.mutate({ eventId: event.id, showTimeAs: 'busy' })}>
                Show as Busy
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShow.mutate({ eventId: event.id, showTimeAs: 'free' })}>
                Show as Free
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShow.mutate({ eventId: event.id, showTimeAs: 'tentative' })}>
                Show as Tentative
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Time Defense</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setDef.mutate({ eventId: event.id, timeDefenseLevel: 'normal' })}>Normal</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDef.mutate({ eventId: event.id, timeDefenseLevel: 'protected' })}>Protected</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDef.mutate({ eventId: event.id, timeDefenseLevel: 'sacred' })}>Sacred</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>AI</DropdownMenuLabel>
              {event.ai_managed ? (
                <DropdownMenuItem onClick={() => setAI.mutate({ eventId: event.id, aiManaged: false })}>
                  Disable AI for this event
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setAI.mutate({ eventId: event.id, aiManaged: true })}>
                  Enable AI for this event
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onOpenDetails?.(event.id)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit details
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => del.mutate(event.id)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardFooter>
    </Card>
  )
}
```

**Notes**
- Fully assembled `AssembledEvent` is expected; no joins done in UI.
- All updates are optimistic (no refetches). Realtime reconciles.
- Replace `cn`/UI imports with your local paths.

---

## 2) `components/event/EventActionBar.tsx` (Bulk actions)

```tsx
'use client'

import * as React from 'react'
import { Check, Trash2, CalendarDays, Tag, Brain, Loader2 } from 'lucide-react'
import {
  useUpdateEvent,
  useDeleteEvent,
  useBulkUpdateEventCalendars,
  useBulkUpdateEventCategories,
  useBulkUpdateEventAIManagement,
  useUserCalendars,
  useUserCategories,
} from '@/lib/data/queries'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'

export type EventActionBarProps = {
  userId?: string
  selectedIds: string[]
  onClearSelection?: () => void
}

export function EventActionBar({ userId, selectedIds, onClearSelection }: EventActionBarProps) {
  const { data: calendars = [] } = useUserCalendars(userId)
  const { data: categories = [] } = useUserCategories(userId)

  const bulkCal = useBulkUpdateEventCalendars(userId)
  const bulkCat = useBulkUpdateEventCategories(userId)
  const bulkAI = useBulkUpdateEventAIManagement(userId)
  const del = useDeleteEvent(userId)

  const busy = bulkCal.isPending || bulkCat.isPending || bulkAI.isPending || del.isPending

  if (selectedIds.length === 0) return null

  async function moveToCalendar(calendarId: string) {
    await bulkCal.mutateAsync({ eventIds: selectedIds, calendarId })
    onClearSelection?.()
  }

  async function setCategory(categoryId: string) {
    await bulkCat.mutateAsync({ eventIds: selectedIds, categoryId })
    onClearSelection?.()
  }

  async function toggleAI(aiManaged: boolean) {
    await bulkAI.mutateAsync({ eventIds: selectedIds, aiManaged })
    onClearSelection?.()
  }

  async function deleteSelected() {
    await Promise.all(selectedIds.map((id) => del.mutateAsync(id)))
    onClearSelection?.()
  }

  return (
    <div className="sticky bottom-4 mx-auto flex w-fit items-center gap-2 rounded-full border bg-background/95 px-3 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2">
        {/* Move to calendar */}
        <Select onValueChange={moveToCalendar}>
          <SelectTrigger className="h-8 w-[200px]">
            <CalendarDays className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Move to calendar" />
          </SelectTrigger>
          <SelectContent>
            {calendars.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Set category */}
        <Select onValueChange={setCategory}>
          <SelectTrigger className="h-8 w-[180px]">
            <Tag className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Set category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem key="none" value="">
              No category
            </SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* AI toggle */}
        <Button variant="secondary" size="sm" onClick={() => toggleAI(true)}>
          <Brain className="mr-2 h-4 w-4" /> Enable AI
        </Button>
        <Button variant="ghost" size="sm" onClick={() => toggleAI(false)}>
          Disable AI
        </Button>

        {/* Delete */}
        <Button variant="destructive" size="sm" onClick={deleteSelected} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
          Delete
        </Button>

        {/* Done */}
        <Button variant="default" size="sm" onClick={onClearSelection}>
          <Check className="mr-2 h-4 w-4" /> Done
        </Button>
      </div>
    </div>
  )
}
```

**Notes**
- Uses bulk mutations from the data layer (calendars/categories/AI). If you don’t have the bulk helpers, replace with `Promise.all` over `useUpdateEvent`.
- Sits as a sticky pill above the calendar grid when selection is non‑empty.

---

## 3) Optional: `components/event/EventContextMenu.tsx`

> For grid cells that need a right‑click menu without the full card footer.

```tsx
'use client'

import * as React from 'react'
import { MoreHorizontal, Trash2, Pencil, Brain } from 'lucide-react'
import {
  useUpdateEventCalendar,
  useUpdateEventCategory,
  useUpdateEventAI,
  useDeleteEvent,
  useUserCalendars,
  useUserCategories,
} from '@/lib/data/queries'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export function EventContextMenu({ userId, eventId, onEdit }: { userId?: string; eventId: string; onEdit?: () => void }) {
  const del = useDeleteEvent(userId)
  const setCal = useUpdateEventCalendar(userId)
  const setCat = useUpdateEventCategory(userId)
  const setAI = useUpdateEventAI(userId)
  const { data: calendars = [] } = useUserCalendars(userId)
  const { data: categories = [] } = useUserCategories(userId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="More">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Calendar</DropdownMenuLabel>
        {calendars.map((c) => (
          <DropdownMenuItem key={c.id} onClick={() => setCal.mutate({ eventId, calendarId: c.id })}>
            {c.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Category</DropdownMenuLabel>
        {categories.map((c) => (
          <DropdownMenuItem key={c.id} onClick={() => setCat.mutate({ eventId, categoryId: c.id })}>
            {c.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setAI.mutate({ eventId, aiManaged: true })}>
          <Brain className="mr-2 h-4 w-4" /> Enable AI
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit?.()}>
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" onClick={() => del.mutate(eventId)}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

---

## 4) Usage Examples

**Grid cell renderer**
```tsx
<EventCard userId={user?.id} event={evt} onOpenDetails={(id) => openDetails(id)} />
```

**Selection toolbar**
```tsx
<EventActionBar userId={user?.id} selectedIds={selectedIds} onClearSelection={() => setSelectedIds([])} />
```

---

## 5) Implementation Notes

- All hooks come from the data layer; they patch TanStack caches and Dexie, so these components do **not** refetch on success.
- If your project doesn’t use shadcn/ui, swap the UI imports with your own components—the logic stays the same.
- For timezone display, replace `toLocaleTimeString` with your existing formatter if you have one (e.g., `formatZonedTime`).
- Deletion is optimistic with rollback handled by the mutation itself.

---

## 6) Follow‑ups

- Add a confirmation dialog on destructive actions (`AlertDialog`).
- Add inline toasts on success/error (hook into your existing toast helper).
- If you support drag/resize on the grid, use `useUpdateEvent` with `{ start_time, duration }` from the handler.
```

