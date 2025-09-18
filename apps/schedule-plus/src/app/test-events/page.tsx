"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateEvent } from "@/hooks/use-create-event";
import { useDeleteEvent } from "@/hooks/use-delete-event";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startOfDay, endOfDay } from "date-fns";

export default function TestEventsPage() {
  const { user } = useAuth();
  const [title, setTitle] = useState("Test Event");
  const [duration, setDuration] = useState(60);

  // Hooks for CRUD operations
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();

  // Fetch events for today to test reading
  const today = new Date();
  const { data: events = [], isLoading, error } = useCalendarEvents({
    startDate: startOfDay(today),
    endDate: endOfDay(today),
    enabled: !!user
  });

  const handleCreateEvent = () => {
    const now = new Date();
    createEvent.mutate({
      title,
      start_time: now.toISOString(),
      duration,
      all_day: false,
      show_time_as: 'busy',
      time_defense_level: 'normal',
      ai_managed: false,
    });
  };

  const handleDeleteEvent = (eventId: string) => {
    deleteEvent.mutate(eventId);
  };

  if (!user) {
    return <div>Please log in to test events.</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Event CRUD Test</h1>

      {/* Create Event Section */}
      <div className="mb-8 p-4 border rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Create Event</h2>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Event title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
          />
          <Input
            type="number"
            placeholder="Duration (minutes)"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
            className="w-32"
          />
          <Button
            onClick={handleCreateEvent}
            disabled={createEvent.isPending}
          >
            {createEvent.isPending ? "Creating..." : "Create Event"}
          </Button>
        </div>

        {createEvent.isError && (
          <div className="text-red-600 text-sm">
            Error: {createEvent.error?.message}
          </div>
        )}

        {createEvent.isSuccess && (
          <div className="text-green-600 text-sm">
            Event created successfully!
          </div>
        )}
      </div>

      {/* Events List Section */}
      <div className="mb-8 p-4 border rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Today&apos;s Events</h2>

        {isLoading && <div>Loading events...</div>}

        {error && (
          <div className="text-red-600 text-sm">
            Error loading events: {error.message}
          </div>
        )}

        {events.length === 0 ? (
          <div className="text-gray-500">No events found for today.</div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-2 border rounded">
                <div>
                  <div className="font-medium">{event.title}</div>
                  <div className="text-sm text-gray-500">
                    {new Date(event.start_time).toLocaleString()} ({event.duration} min)
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteEvent(event.id)}
                  disabled={deleteEvent.isPending}
                >
                  {deleteEvent.isPending ? "Deleting..." : "Delete"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Debug Information */}
      <div className="p-4 border rounded-lg bg-gray-50">
        <h2 className="text-lg font-semibold mb-4">Debug Info</h2>
        <div className="text-sm space-y-1">
          <div>User ID: {user.id}</div>
          <div>Events count: {events.length}</div>
          <div>Create mutation status: {createEvent.status}</div>
          <div>Delete mutation status: {deleteEvent.status}</div>
        </div>
      </div>
    </div>
  );
}