import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { CalEvent } from '@/components/types'
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
    mutationFn: async (input: UpdateEventInput): Promise<CalEvent> => {
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
        'show_time_as', 'category_id', 'time_defense_level', 'ai_managed', 'ai_instructions'
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
          event_details_personal!left(
            show_time_as,
            time_defense_level,
            ai_managed,
            ai_instructions,
            user_categories(
              id,
              name,
              color
            )
          )
        `)
        .eq('id', id)
        .single()

      if (fetchError) {
        throw new Error(`Failed to fetch updated event: ${fetchError.message}`)
      }

      if (!updatedEvent) {
        throw new Error('Updated event not found')
      }

      // Find user's role and options (since we filtered by user.id in the query, these should be for the current user)
      const userRole = updatedEvent.event_user_roles?.[0]
      const userOptions = updatedEvent.event_details_personal?.[0]
      const userCategory = userOptions?.user_categories

      return {
        // Event fields (handle nullable values)
        id: updatedEvent.id,
        owner_id: updatedEvent.owner_id || '',
        creator_id: updatedEvent.creator_id || '',
        series_id: updatedEvent.series_id || undefined,
        title: updatedEvent.title || '',
        agenda: updatedEvent.agenda || undefined,
        online_event: updatedEvent.online_event || false,
        online_join_link: updatedEvent.online_join_link || undefined,
        online_chat_link: updatedEvent.online_chat_link || undefined,
        in_person: updatedEvent.in_person || false,
        start_time: updatedEvent.start_time || '',
        duration: updatedEvent.duration || 0,
        all_day: updatedEvent.all_day || false,
        private: updatedEvent.private || false,
        request_responses: updatedEvent.request_responses || false,
        allow_forwarding: updatedEvent.allow_forwarding || false,
        hide_attendees: updatedEvent.hide_attendees || false,
        invite_allow_reschedule_proposals: updatedEvent.invite_allow_reschedule_proposals ?? true,
        discovery: updatedEvent.discovery || 'audience_only',
        join_model: updatedEvent.join_model || 'invite_only',
        history: (Array.isArray(updatedEvent.history) ? updatedEvent.history : []) as unknown[],
        created_at: updatedEvent.created_at || '',
        updated_at: updatedEvent.updated_at || '',

        // User's role (determine if owner or from role table)
        user_role: userRole?.role || (updatedEvent.owner_id === user.id ? 'owner' : 'viewer'),
        invite_type: userRole?.invite_type || undefined,
        rsvp: userRole?.rsvp || undefined,
        rsvp_timestamp: userRole?.rsvp_timestamp || undefined,
        attendance_type: userRole?.attendance_type || undefined,
        following: userRole?.following || false,

        // User's event options (with defaults)
        show_time_as: userOptions?.show_time_as || 'busy',
        category_id: userCategory?.id || undefined,
        category_name: userCategory?.name || undefined,
        category_color: userCategory?.color || undefined,
        time_defense_level: userOptions?.time_defense_level || 'normal',
        ai_managed: userOptions?.ai_managed || false,
        ai_instructions: userOptions?.ai_instructions || undefined,

        // Computed fields for calendar rendering
        start: new Date(updatedEvent.start_time || '').getTime(),
        end: new Date(updatedEvent.start_time || '').getTime() + ((updatedEvent.duration || 0) * 60 * 1000),
        aiSuggested: false, // Not yet implemented in DB
      }
    },

    onSuccess: (updatedEvent) => {
      // Update the event in all relevant cache entries
      queryClient.setQueriesData(
        { queryKey: ['calendar-events', user?.id] },
        (oldData: CalEvent[] | undefined) => {
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