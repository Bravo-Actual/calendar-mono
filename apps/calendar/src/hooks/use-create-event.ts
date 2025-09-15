import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { startOfDay, endOfDay } from 'date-fns'
import type { CalEvent } from '@/components/types'

interface CreateEventInput {
  title: string
  start_time: string // ISO timestamp
  duration: number // minutes
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

export function useCreateEvent() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateEventInput): Promise<CalEvent> => {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }

      // Create the event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert({
          owner: user.id,
          creator: user.id,
          title: input.title,
          agenda: input.agenda,
          online_event: input.online_event || false,
          online_join_link: input.online_join_link,
          online_chat_link: input.online_chat_link,
          in_person: input.in_person || false,
          start_time: input.start_time,
          duration: input.duration,
          all_day: input.all_day || false,
          private: input.private || false,
          request_responses: input.request_responses || false,
          allow_forwarding: input.allow_forwarding !== false, // default true
          hide_attendees: input.hide_attendees || false,
        })
        .select('*')
        .single()

      if (eventError) {
        throw new Error(`Failed to create event: ${eventError.message}`)
      }

      // Update user_event_options if any custom options were provided
      if (
        input.show_time_as ||
        input.user_category_id ||
        input.time_defense_level ||
        input.ai_managed ||
        input.ai_instructions
      ) {
        const { error: optionsError } = await supabase
          .from('user_event_options')
          .upsert({
            event_id: eventData.id,
            user_id: user.id,
            show_time_as: input.show_time_as || 'busy',
            category: input.user_category_id || null,
            time_defense_level: input.time_defense_level || 'normal',
            ai_managed: input.ai_managed || false,
            ai_instructions: input.ai_instructions,
          })

        if (optionsError) {
          console.warn('Failed to create user event options:', optionsError.message)
        }
      }

      // Fetch the complete event data with all relations using REST
      const { data: createdEvent, error: fetchError } = await supabase
        .from('events')
        .select(`
          *,
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
        .eq('id', eventData.id)
        .eq('user_event_options.user_id', user.id)
        .single()

      if (fetchError) {
        throw new Error(`Failed to fetch created event: ${fetchError.message}`)
      }

      if (!createdEvent) {
        throw new Error('Created event not found')
      }

      // Find user's options
      const userOptions = createdEvent.user_event_options?.[0]
      const userCategory = userOptions?.user_event_categories

      return {
        // Event fields - handle nullable Supabase fields
        id: createdEvent.id,
        owner: createdEvent.owner,
        creator: createdEvent.creator || '',
        series_id: createdEvent.series_id || undefined,
        title: createdEvent.title,
        agenda: createdEvent.agenda || undefined,
        online_event: createdEvent.online_event || false,
        online_join_link: createdEvent.online_join_link || undefined,
        online_chat_link: createdEvent.online_chat_link || undefined,
        in_person: createdEvent.in_person || false,
        start_time: createdEvent.start_time,
        duration: createdEvent.duration,
        all_day: createdEvent.all_day || false,
        private: createdEvent.private || false,
        request_responses: createdEvent.request_responses || false,
        allow_forwarding: createdEvent.allow_forwarding || false,
        hide_attendees: createdEvent.hide_attendees || false,
        history: (createdEvent.history as unknown[]) || [],
        created_at: createdEvent.created_at || '',
        updated_at: createdEvent.updated_at || '',

        // User's role (owner for created events)
        user_role: 'owner' as const,
        invite_type: undefined,
        rsvp: undefined,
        rsvp_timestamp: undefined,
        attendance_type: undefined,
        following: false,

        // User's event options (with defaults)
        show_time_as: userOptions?.show_time_as || 'busy',
        user_category_id: userCategory?.id || undefined,
        user_category_name: userCategory?.name || undefined,
        user_category_color: userCategory?.color || undefined,
        time_defense_level: userOptions?.time_defense_level || 'normal',
        ai_managed: userOptions?.ai_managed || false,
        ai_instructions: userOptions?.ai_instructions || undefined,

        // Computed fields for calendar rendering
        start: new Date(createdEvent.start_time).getTime(),
        end: new Date(createdEvent.start_time).getTime() + (createdEvent.duration * 60 * 1000),
        aiSuggested: false,
      }
    },

    onSuccess: (newEvent) => {
      // Don't do any cache manipulation here to avoid interfering with
      // optimistic updates from the calendar page
      console.log('Event created successfully:', newEvent.id)
    },

    onError: (error) => {
      console.error('Failed to create event:', error)
    },
  })
}