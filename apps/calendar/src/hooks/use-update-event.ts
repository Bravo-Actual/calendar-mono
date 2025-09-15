import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { CalendarEvent } from './use-calendar-events'

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
  show_time_as?: 'free' | 'tentative' | 'busy' | 'oof' | 'working_elsewhere'
  user_category_id?: string
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
      const eventUpdates: Record<string, any> = {}
      const userOptionUpdates: Record<string, any> = {}

      // Event table fields
      const eventFields = [
        'title', 'start_time', 'duration', 'all_day', 'agenda',
        'online_event', 'online_join_link', 'online_chat_link', 'in_person',
        'private', 'request_responses', 'allow_forwarding', 'hide_attendees'
      ]

      // User option fields
      const userOptionFields = [
        'show_time_as', 'user_category_id', 'time_defense_level', 'ai_managed', 'ai_instructions'
      ]

      // Split updates
      Object.entries(updates).forEach(([key, value]) => {
        if (eventFields.includes(key)) {
          eventUpdates[key] = value
        } else if (userOptionFields.includes(key)) {
          if (key === 'user_category_id') {
            userOptionUpdates.category = value
          } else {
            userOptionUpdates[key] = value
          }
        }
      })

      // Update event if there are event field changes
      if (Object.keys(eventUpdates).length > 0) {
        const { error: eventError } = await supabase
          .from('events')
          .update(eventUpdates)
          .eq('id', id)
          .eq('owner', user.id) // Ensure user owns the event

        if (eventError) {
          throw new Error(`Failed to update event: ${eventError.message}`)
        }
      }

      // Update user event options if there are option changes
      if (Object.keys(userOptionUpdates).length > 0) {
        const { error: optionsError } = await supabase
          .from('user_event_options')
          .upsert({
            event_id: id,
            user_id: user.id,
            ...userOptionUpdates,
          })

        if (optionsError) {
          throw new Error(`Failed to update event options: ${optionsError.message}`)
        }
      }

      // Fetch the updated event data with all relations using REST
      const { data: updatedEvent, error: fetchError } = await supabase
        .from('events')
        .select(`
          *,
          event_user_roles!left(
            role,
            invite_type,
            rsvp,
            rsvp_timestamp,
            attendance_type,
            following
          ),
          user_event_options!left(
            show_time_as,
            time_defense_level,
            ai_managed,
            ai_instructions,
            user_event_categories(
              id,
              name,
              color
            )
          )
        `)
        .eq('id', id)
        .or(`owner.eq.${user.id},event_user_roles.user_id.eq.${user.id}`)
        .single()

      if (fetchError) {
        throw new Error(`Failed to fetch updated event: ${fetchError.message}`)
      }

      if (!updatedEvent) {
        throw new Error('Updated event not found')
      }

      // Find user's role and options
      const userRole = updatedEvent.event_user_roles?.find(role => role.user_id === user.id)
      const userOptions = updatedEvent.user_event_options?.find(option => option.user_id === user.id)
      const userCategory = userOptions?.user_event_categories

      return {
        // Event fields
        id: updatedEvent.id,
        owner: updatedEvent.owner,
        creator: updatedEvent.creator,
        series_id: updatedEvent.series_id,
        title: updatedEvent.title,
        agenda: updatedEvent.agenda,
        online_event: updatedEvent.online_event,
        online_join_link: updatedEvent.online_join_link,
        online_chat_link: updatedEvent.online_chat_link,
        in_person: updatedEvent.in_person,
        start_time: updatedEvent.start_time,
        duration: updatedEvent.duration,
        all_day: updatedEvent.all_day,
        private: updatedEvent.private,
        request_responses: updatedEvent.request_responses,
        allow_forwarding: updatedEvent.allow_forwarding,
        hide_attendees: updatedEvent.hide_attendees,
        history: updatedEvent.history,
        created_at: updatedEvent.created_at,
        updated_at: updatedEvent.updated_at,

        // User's role (determine if owner or from role table)
        user_role: userRole?.role || (updatedEvent.owner === user.id ? 'owner' : 'viewer'),
        invite_type: userRole?.invite_type,
        rsvp: userRole?.rsvp,
        rsvp_timestamp: userRole?.rsvp_timestamp,
        attendance_type: userRole?.attendance_type,
        following: userRole?.following || false,

        // User's event options (with defaults)
        show_time_as: userOptions?.show_time_as || 'busy',
        user_category_id: userCategory?.id,
        user_category_name: userCategory?.name,
        user_category_color: userCategory?.color,
        time_defense_level: userOptions?.time_defense_level || 'normal',
        ai_managed: userOptions?.ai_managed || false,
        ai_instructions: userOptions?.ai_instructions,
      }
    },

    onSuccess: (updatedEvent) => {
      // Update the event in all relevant cache entries
      queryClient.setQueriesData(
        { queryKey: ['calendar-events', user?.id] },
        (oldData: CalendarEvent[] | undefined) => {
          if (!oldData) return oldData
          return oldData.map(event =>
            event.id === updatedEvent.id ? updatedEvent : event
          )
        }
      )
    },

    onError: (error) => {
      console.error('Failed to update event:', error)
    },
  })
}