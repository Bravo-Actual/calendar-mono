"use client";

import React, { useState, useCallback } from 'react';
import { CalendarGrid, EventCard, type CalendarOperations } from '@/components/calendar-grid';
import { startOfDay, addDays, addMinutes } from '@/components/calendar-grid/utils';
import { useHydrated } from '@/hooks/useHydrated';

// Type-agnostic calendar item interface
interface CalendarItem {
  id: string;
  start_time: Date;
  end_time: Date;
  type: string; // Calendar doesn't care what this is
  [key: string]: any; // Allow any additional properties
}

// Event-specific interface (extends CalendarItem)
interface Event extends CalendarItem {
  type: 'event';
  title: string;
  description?: string;
  color?: string;
}

// Use the imported type
type CalendarItemOperations = CalendarOperations<CalendarItem>;

// Fake event store (simulates your Dexie hooks)
class FakeEventStore {
  private events: Event[] = [];
  private listeners: Set<() => void> = new Set();

  constructor(initialEvents: Event[]) {
    this.events = [...initialEvents];
  }

  // Subscribe to changes (like your Dexie hooks)
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Get events for date range (like useEvents hook)
  getEventsInRange(startDate: Date, endDate: Date): Event[] {
    return this.events.filter(event =>
      event.start_time >= startDate && event.start_time <= endDate
    );
  }

  // Event operations (like your CRUD hooks)
  async addEvent(event: Omit<Event, 'id'>): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
    const newEvent: Event = {
      id: `event-${Date.now()}`,
      type: 'event' as const,
      title: event.title,
      start_time: event.start_time,
      end_time: event.end_time,
      description: event.description,
      color: event.color
    };
    this.events.push(newEvent);
    this.notifyListeners();
  }

  async moveEvent(id: string, newTimes: {start: Date, end: Date}): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
    const index = this.events.findIndex(event => event.id === id);
    if (index !== -1) {
      this.events[index] = {
        ...this.events[index],
        start_time: newTimes.start,
        end_time: newTimes.end
      };
      this.notifyListeners();
    }
  }

  async deleteEvent(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
    this.events = this.events.filter(event => event.id !== id);
    this.notifyListeners();
  }

  async deleteEvents(ids: string[]): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
    this.events = this.events.filter(event => !ids.includes(event.id));
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }
}

// Sample events for testing
const createSampleEvents = (): Event[] => {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);

  return [
    {
      id: '1',
      type: 'event',
      start_time: addMinutes(today, 9 * 60), // 9:00 AM
      end_time: addMinutes(today, 10 * 60), // 10:00 AM
      title: 'Morning Standup',
      description: 'Daily team sync and planning',
      color: 'blue',
    },
    {
      id: '2',
      type: 'event',
      start_time: addMinutes(today, 9 * 60 + 30), // 9:30 AM (overlapping)
      end_time: addMinutes(today, 11 * 60), // 11:00 AM
      title: 'Design Review',
      description: 'Review mockups for new feature',
      color: 'green',
    },
    {
      id: '3',
      type: 'event',
      start_time: addMinutes(today, 14 * 60), // 2:00 PM
      end_time: addMinutes(today, 15 * 60 + 30), // 3:30 PM
      title: 'Client Meeting',
      description: 'Quarterly business review',
      color: 'red',
    },
    {
      id: '4',
      type: 'event',
      start_time: addMinutes(tomorrow, 10 * 60), // 10:00 AM tomorrow
      end_time: addMinutes(tomorrow, 11 * 60 + 30), // 11:30 AM tomorrow
      title: 'Product Demo',
      description: 'Show new features to stakeholders',
      color: 'purple',
    },
    {
      id: '5',
      type: 'event',
      start_time: addMinutes(tomorrow, 13 * 60), // 1:00 PM tomorrow
      end_time: addMinutes(tomorrow, 14 * 60), // 2:00 PM tomorrow
      title: 'Lunch & Learn',
      description: 'Tech talk on React patterns',
      color: 'orange',
    },
    {
      id: '6',
      type: 'event',
      start_time: addMinutes(dayAfter, 9 * 60), // 9:00 AM day after
      end_time: addMinutes(dayAfter, 17 * 60), // 5:00 PM day after
      title: 'Conference',
      description: 'Full day tech conference',
      color: 'indigo',
    },
  ];
};

// Create fake event store instance
const eventStore = new FakeEventStore(createSampleEvents());

export default function TestCalendarPage() {
  const hydrated = useHydrated();

  // Generate 7 days starting from today for date range
  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i));
  const dateRange = { start: days[0], end: days[days.length - 1] };

  // Get calendar items (type-agnostic)
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>(() =>
    eventStore.getEventsInRange(dateRange.start, dateRange.end)
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  // Subscribe to event store changes
  React.useEffect(() => {
    const unsubscribe = eventStore.subscribe(() => {
      setCalendarItems(eventStore.getEventsInRange(dateRange.start, dateRange.end));
    });
    return () => {
      unsubscribe();
    };
  }, [dateRange.start, dateRange.end]);

  // Type-agnostic calendar operations (parent dispatches by type)
  const calendarOperations: CalendarItemOperations = {
    move: async (item: CalendarItem, newTimes: {start: Date, end: Date}) => {
      console.log('Moving item:', item.id, item.type, newTimes);
      if (item.type === 'event') {
        await eventStore.moveEvent(item.id, newTimes);
      }
      // Future: add other types here (tasks, reminders, etc.)
    },
    resize: async (item: CalendarItem, newTimes: {start: Date, end: Date}) => {
      console.log('Resizing item:', item.id, item.type, newTimes);
      if (item.type === 'event') {
        await eventStore.moveEvent(item.id, newTimes); // Same as move for events
      }
    },
    delete: async (item: CalendarItem) => {
      console.log('Deleting item:', item.id, item.type);
      if (item.type === 'event') {
        await eventStore.deleteEvent(item.id);
      }
    }
  };

  // Custom render function (parent dispatches by type)
  const renderCalendarItem = useCallback((props: {
    item: CalendarItem;
    layout: any;
    selected: boolean;
    onMouseDownSelect: (e: React.MouseEvent, id: string) => void;
    drag: any;
  }) => {
    const { item, layout, selected, onMouseDownSelect, drag } = props;
    if (item.type === 'event') {
      const event = item as Event;
      return (
        <EventCard
          item={event}
          layout={layout}
          selected={selected}
          onMouseDownSelect={onMouseDownSelect}
          drag={drag}
        />
      );
    }
    // Future: add other types here (tasks, reminders, etc.)
    return null;
  }, []);

  const handleSelectionChange = useCallback((newSelectedIds: string[]) => {
    console.log('Selection changed:', newSelectedIds);
    setSelectedIds(newSelectedIds);
  }, []);

  const addRandomEvent = async () => {
    const randomDay = days[Math.floor(Math.random() * days.length)];
    const randomHour = Math.floor(Math.random() * 16) + 8; // 8 AM to 11 PM
    const duration = [30, 60, 90, 120][Math.floor(Math.random() * 4)]; // Random duration
    const colors = ['blue', 'green', 'red', 'purple', 'orange', 'indigo'];

    const newEvent: Omit<Event, 'id'> = {
      type: 'event',
      start_time: addMinutes(randomDay, randomHour * 60),
      end_time: addMinutes(randomDay, randomHour * 60 + duration),
      title: `Random Event ${calendarItems.length + 1}`,
      description: 'Generated test event',
      color: colors[Math.floor(Math.random() * colors.length)],
    };

    await eventStore.addEvent(newEvent);
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    // Delete from appropriate stores based on item type
    for (const id of selectedIds) {
      const item = calendarItems.find(item => item.id === id);
      if (item) {
        await calendarOperations.delete(item);
      }
    }
    setSelectedIds([]);
  };

  // Don't render until hydrated to prevent hydration mismatches
  if (!hydrated) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Test controls */}
      <div className="p-4 border-b bg-card">
        <h1 className="text-2xl font-bold mb-4">Calendar Grid Test Page</h1>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={addRandomEvent}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Add Random Event
          </button>
          <button
            onClick={clearSelection}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
          >
            Clear Selection
          </button>
          <button
            onClick={deleteSelected}
            disabled={selectedIds.length === 0}
            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete Selected ({selectedIds.length})
          </button>
          <div className="text-sm text-muted-foreground self-center ml-4">
            Total events: {calendarItems.length} | Selected: {selectedIds.length}
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-hidden">
        <CalendarGrid
          items={calendarItems}
          days={days}
          expandedDay={expandedDay}
          onExpandedDayChange={setExpandedDay}
          operations={calendarOperations}
          onSelectionChange={handleSelectionChange}
          renderItem={renderCalendarItem}
          pxPerHour={80}
          snapMinutes={15}
          timeZones={[
            { label: 'Local', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, hour12: true }
          ]}
        />
      </div>
    </div>
  );
}