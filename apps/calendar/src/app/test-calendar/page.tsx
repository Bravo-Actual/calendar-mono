"use client";

import React, { useState, useCallback } from 'react';
import { CalendarGrid, type TimeItem } from '@/components/calendar-grid';
import { startOfDay, addDays, addMinutes } from '@/components/calendar-grid/utils';

// Sample data for testing
const createSampleItems = (): TimeItem[] => {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);

  return [
    {
      id: '1',
      start_time: addMinutes(today, 9 * 60), // 9:00 AM
      end_time: addMinutes(today, 10 * 60), // 10:00 AM
      title: 'Morning Standup',
      description: 'Daily team sync and planning',
    },
    {
      id: '2',
      start_time: addMinutes(today, 9 * 60 + 30), // 9:30 AM (overlapping)
      end_time: addMinutes(today, 11 * 60), // 11:00 AM
      title: 'Design Review',
      description: 'Review mockups for new feature',
    },
    {
      id: '3',
      start_time: addMinutes(today, 14 * 60), // 2:00 PM
      end_time: addMinutes(today, 15 * 60 + 30), // 3:30 PM
      title: 'Client Meeting',
      description: 'Quarterly business review',
    },
    {
      id: '4',
      start_time: addMinutes(tomorrow, 10 * 60), // 10:00 AM tomorrow
      end_time: addMinutes(tomorrow, 11 * 60 + 30), // 11:30 AM tomorrow
      title: 'Product Demo',
      description: 'Show new features to stakeholders',
    },
    {
      id: '5',
      start_time: addMinutes(tomorrow, 13 * 60), // 1:00 PM tomorrow
      end_time: addMinutes(tomorrow, 14 * 60), // 2:00 PM tomorrow
      title: 'Lunch & Learn',
      description: 'Tech talk on React patterns',
    },
    {
      id: '6',
      start_time: addMinutes(dayAfter, 9 * 60), // 9:00 AM day after
      end_time: addMinutes(dayAfter, 17 * 60), // 5:00 PM day after
      title: 'Conference',
      description: 'Full day tech conference',
    },
  ];
};

export default function TestCalendarPage() {
  const [items, setItems] = useState<TimeItem[]>(createSampleItems());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  // Generate 7 days starting from today
  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i));

  const handleItemUpdate = async (item: TimeItem, newTimes: { start: Date; end: Date }) => {
    console.log('Item update:', item.id, newTimes);

    // Simulate async update
    await new Promise(resolve => setTimeout(resolve, 100));

    setItems(prev => prev.map(i =>
      i.id === item.id
        ? { ...i, start_time: newTimes.start, end_time: newTimes.end }
        : i
    ));
  };

  const handleSelectionChange = useCallback((newSelectedIds: string[]) => {
    console.log('Selection changed:', newSelectedIds);
    setSelectedIds(newSelectedIds);
  }, []);

  const addRandomEvent = () => {
    const randomDay = days[Math.floor(Math.random() * days.length)];
    const randomHour = Math.floor(Math.random() * 16) + 8; // 8 AM to 11 PM
    const duration = [30, 60, 90, 120][Math.floor(Math.random() * 4)]; // Random duration

    const newItem: TimeItem = {
      id: `random-${Date.now()}`,
      start_time: addMinutes(randomDay, randomHour * 60),
      end_time: addMinutes(randomDay, randomHour * 60 + duration),
      title: `Random Event ${items.length + 1}`,
      description: 'Generated test event',
    };

    setItems(prev => [...prev, newItem]);
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0) return;
    setItems(prev => prev.filter(item => !selectedIds.includes(item.id)));
    setSelectedIds([]);
  };

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
            Total events: {items.length} | Selected: {selectedIds.length}
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-hidden">
        <CalendarGrid
          items={items}
          days={days}
          expandedDay={expandedDay}
          onExpandedDayChange={setExpandedDay}
          onItemUpdate={handleItemUpdate}
          onSelectionChange={handleSelectionChange}
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