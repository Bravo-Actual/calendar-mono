import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { CalendarEvent } from '@/components/types'
import { db } from '@/lib/db/dexie'

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
  calendar_id?: string // Which calendar to assign the event to
  show_time_as?: 'free' | 'tentative' | 'busy' | 'oof' | 'working_elsewhere'
  category_id?: string
  time_defense_level?: 'flexible' | 'normal' | 'high' | 'hard_block'
  ai_managed?: boolean
  ai_instructions?: string
}

export function useCreateEvent() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateEventInput): Promise<CalendarEvent> => {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }

      // Get default calendar and category if not provided
      let finalCalendarId = input.calendar_id
      let finalCategoryId = input.category_id

      if (!finalCalendarId) {
        const defaultCalendar = await db.user_calendars.filter(cal => cal.type === 'default').first()
        finalCalendarId = defaultCalendar?.id
      }

      if (!finalCategoryId) {
        const defaultCategory = await db.user_categories.filter(cat => cat.is_default === true).first()
        finalCategoryId = defaultCategory?.id
      }

      // Create the event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert({
          owner_id: user.id,
          creator_id: user.id,
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

      // Always create event_details_personal to ensure we have calendar/category assigned
      const { error: optionsError } = await supabase
        .from('event_details_personal')
        .upsert({
          event_id: eventData.id,
          user_id: user.id,
          calendar_id: finalCalendarId || null, // Use default or explicit calendar
          show_time_as: input.show_time_as || 'busy',
          category_id: finalCategoryId || null, // Use default or explicit category
          time_defense_level: input.time_defense_level || 'normal',
          ai_managed: input.ai_managed || false,
          ai_instructions: input.ai_instructions,
        })

      if (optionsError) {
        console.warn('Failed to create user event options:', optionsError.message)
      }

      // Fetch the complete event data with all relations using REST
      const { data: createdEvent, error: fetchError } = await supabase
        .from('events')
        .select(`
          *,
          event_details_personal!left(
            calendar_id,
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
        .eq('id', eventData.id)
        .single()

      if (fetchError) {
        throw new Error(`Failed to fetch created event: ${fetchError.message}`)
      }

      if (!createdEvent) {
        throw new Error('Created event not found')
      }

      // Find user's options
      const userOptions = createdEvent.event_details_personal?.[0]
      const userCategory = userOptions?.user_categories

      return {
        // Event fields - handle nullable Supabase fields
        id: createdEvent.id,
        owner_id: createdEvent.owner_id,
        creator_id: createdEvent.creator_id || '',
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
        invite_allow_reschedule_proposals: createdEvent.invite_allow_reschedule_proposals ?? true,
        discovery: createdEvent.discovery || 'audience_only',
        join_model: createdEvent.join_model || 'invite_only',
        history: (createdEvent.history as unknown[]) || [],
        created_at: createdEvent.created_at || '',
        updated_at: createdEvent.updated_at || '',

        // User perspective fields
        viewing_user_id: user.id,

        // User's role (owner for created events)
        user_role: 'owner' as const,
        invite_type: undefined,
        rsvp: undefined,
        rsvp_timestamp: undefined,
        attendance_type: undefined,
        following: false,

        // User's event options (with defaults)
        calendar_id: userOptions?.calendar_id || undefined,
        calendar_name: undefined, // Would need to be fetched if needed
        calendar_color: undefined, // Would need to be fetched if needed
        show_time_as: userOptions?.show_time_as || 'busy',
        category_id: userCategory?.id || undefined,
        category_name: userCategory?.name || undefined,
        category_color: userCategory?.color || undefined,
        time_defense_level: userOptions?.time_defense_level || 'normal',
        ai_managed: userOptions?.ai_managed || false,
        ai_instructions: userOptions?.ai_instructions || undefined,

        // Computed fields for immediate UI display (realtime will update with official values)
        start_time_iso: createdEvent.start_time,
        start_time_ms: new Date(createdEvent.start_time).getTime(),
        end_time_ms: new Date(createdEvent.start_time).getTime() + (createdEvent.duration * 60 * 1000),
        ai_suggested: false,
      }
    },

    onSuccess: (newEvent) => {
      // Invalidate calendar events query to refresh the UI
      queryClient.invalidateQueries({
        queryKey: ['calendar-events', user?.id]
      })
    },

    onError: (error) => {
      console.error('Failed to create event:', error)
    },
  })
}