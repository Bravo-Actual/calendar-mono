import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { CalendarEvent } from '@/lib/db/dexie'
import type { Database } from '@repo/supabase'

type EventUpdate = Partial<Database['public']['Tables']['events']['Update']>
type UserOptionUpdate = Partial<Database['public']['Tables']['event_details_personal']['Update']>

interface UpdateEventInput {
  id: string
  title?: string
  start_time?: string // ISO timestamp
  duration?: number // minutes
  all_day?: boolean
  agenda?: string
  online_event?: boolean
  online_join_link?: string
  online_chat_link?: string
  in_person?: boolean
  private?: boolean
  request_responses?: boolean
  allow_forwarding?: boolean
  hide_attendees?: boolean
  // User's event options
  calendar_id?: string
  show_time_as?: 'free' | 'tentative' | 'busy' | 'oof' | 'working_elsewhere'
  category_id?: string
  time_defense_level?: 'flexible' | 'normal' | 'high' | 'hard_block'
  ai_managed?: boolean
  ai_instructions?: string
}

export function useUpdateEvent() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateEventInput): Promise<CalendarEvent> => {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }

      const { id, ...updates } = input

      // Separate event updates from user option updates
      const eventUpdates: EventUpdate = {}
      const userOptionUpdates: UserOptionUpdate = {}

      // Event table fields
      const eventFields = [
        'title', 'start_time', 'duration', 'all_day', 'agenda',
        'online_event', 'online_join_link', 'online_chat_link', 'in_person',
        'private', 'request_responses', 'allow_forwarding', 'hide_attendees'
      ]

      // User option fields
      const userOptionFields = [
        'calendar_id', 'show_time_as', 'category_id', 'time_defense_level', 'ai_managed', 'ai_instructions'
      ]

      // Split updates
      Object.entries(updates).forEach(([key, value]) => {
        if (eventFields.includes(key)) {
          (eventUpdates as Record<string, unknown>)[key] = value
        } else if (userOptionFields.includes(key)) {
          if (key === 'category_id') {
            userOptionUpdates.category_id = value as string
          } else {
            (userOptionUpdates as Record<string, unknown>)[key] = value
          }
        }
      })

      // Update event if there are event field changes
      if (Object.keys(eventUpdates).length > 0) {
        const { error: eventError } = await supabase
          .from('events')
          .update(eventUpdates)
          .eq('id', id)
          .eq('owner_id', user.id) // Ensure user owns the event

        if (eventError) {
          throw new Error(`Failed to update event: ${eventError.message}`)
        }
      }

      // Update user event options if there are option changes
      if (Object.keys(userOptionUpdates).length > 0) {
        const { error: optionsError } = await supabase
          .from('event_details_personal')
          .upsert({
            event_id: id,
            user_id: user.id,
            ...userOptionUpdates,
          })

        if (optionsError) {
          console.error('❌ Failed to update event_details_personal:', optionsError);
          throw new Error(`Failed to update event options: ${optionsError.message}`)
        }
      }

      // Fetch the updated event from the calendar_events_view
      const { data: updatedEvent, error: fetchError } = await supabase
        .from('calendar_events_view')
        .select('*')
        .eq('id', id)
        .eq('viewing_user_id', user.id)
        .single()

      if (fetchError) {
        console.error('❌ Failed to fetch updated event from view:', fetchError);
        throw new Error(`Failed to fetch updated event: ${fetchError.message}`)
      }

      if (!updatedEvent) {
        console.error('❌ Updated event not found in view');
        throw new Error('Updated event not found')
      }

      return updatedEvent as CalendarEvent
    },

    onSuccess: (updatedEvent) => {
      // Update the specific event in cache by ID across all date range queries
      queryClient.setQueriesData(
        { queryKey: ['calendar-events', user?.id] },
        (oldData: CalendarEvent[] | undefined) => {
          if (!oldData) return oldData
          const newData = oldData.map(event =>
            event.id === updatedEvent.id ? updatedEvent : event
          );
          return newData;
        }
      )
    },

    onError: (error) => {
      console.error('Failed to update event:', error)
    },
  })
}