import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { startOfDay, endOfDay } from 'date-fns'
import type { CalEvent } from '@/components/types'
import type { Database } from '@/lib/supabase-types'

// Type for the Supabase query result
type EventWithRelations = Database['public']['Tables']['events']['Row'] & {
  event_user_roles?: Database['public']['Tables']['event_user_roles']['Row'][]
  user_event_options?: (Database['public']['Tables']['user_event_options']['Row'] & {
    user_event_categories?: Database['public']['Tables']['user_event_categories']['Row']
  })[]
}


interface UseCalendarEventsOptions {
  startDate: Date
  endDate: Date
  enabled?: boolean
  staleTime?: number
}

export function useCalendarEvents({
  startDate,
  endDate,
  enabled = true,
  staleTime = 5 * 60 * 1000, // 5 minutes
}: UseCalendarEventsOptions) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Create query key based on user and date range
  const queryKey = [
    'calendar-events',
    user?.id,
    startOfDay(startDate).toISOString(),
    endOfDay(endDate).toISOString(),
  ]

  return useQuery({
    queryKey,
    queryFn: async (): Promise<CalEvent[]> => {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }

      // First, fetch events owned by the user
      const { data: ownedEvents, error: ownedError } = await supabase
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
        .eq('owner', user.id)
        .gte('start_time', startOfDay(startDate).toISOString())
        .lte('start_time', endOfDay(endDate).toISOString())

      if (ownedError) {
        throw new Error(`Failed to fetch owned events: ${ownedError.message}`)
      }

      // Then, fetch events where user has roles
      const { data: roleEvents, error: roleError } = await supabase
        .from('events')
        .select(`
          *,
          event_user_roles!inner(
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
        .eq('event_user_roles.user_id', user.id)
        .gte('start_time', startOfDay(startDate).toISOString())
        .lte('start_time', endOfDay(endDate).toISOString())

      if (roleError) {
        throw new Error(`Failed to fetch role events: ${roleError.message}`)
      }

      // Combine and deduplicate events
      const allEvents = [...(ownedEvents || []), ...(roleEvents || [])] as EventWithRelations[]
      const uniqueEvents = allEvents.reduce((acc, event) => {
        if (!acc.find(e => e.id === event.id)) {
          acc.push(event)
        }
        return acc
      }, [] as EventWithRelations[])

      // Transform the REST response to our CalEvent interface
      return uniqueEvents.map((event): CalEvent => {
        // Handle nested PostgREST response structure
        // event_user_roles and user_event_options are nested objects, not arrays
        const userRole = Array.isArray(event.event_user_roles)
          ? event.event_user_roles?.find(role => role.user_id === user.id)
          : event.event_user_roles
        const userOptions = Array.isArray(event.user_event_options)
          ? event.user_event_options?.find(option => option.user_id === user.id)
          : event.user_event_options?.[0] // PostgREST might return as single-item array
        const userCategory = userOptions?.user_event_categories

        return {
          // Event fields - handle nullable Supabase fields
          id: event.id,
          owner: event.owner,
          creator: event.creator || '',
          series_id: event.series_id || undefined,
          title: event.title,
          agenda: event.agenda || undefined,
          online_event: event.online_event || false,
          online_join_link: event.online_join_link || undefined,
          online_chat_link: event.online_chat_link || undefined,
          in_person: event.in_person || false,
          start_time: event.start_time,
          duration: event.duration,
          all_day: event.all_day || false,
          private: event.private || false,
          request_responses: event.request_responses || false,
          allow_forwarding: event.allow_forwarding || false,
          hide_attendees: event.hide_attendees || false,
          history: (event.history as unknown[]) || [],
          created_at: event.created_at || '',
          updated_at: event.updated_at || '',

          // User's role (determine if owner or from role table)
          user_role: userRole?.role || (event.owner === user.id ? 'owner' : 'viewer'),
          invite_type: userRole?.invite_type || undefined,
          rsvp: userRole?.rsvp || undefined,
          rsvp_timestamp: userRole?.rsvp_timestamp || undefined,
          attendance_type: userRole?.attendance_type || undefined,
          following: userRole?.following || false,

          // User's event options (with defaults)
          show_time_as: userOptions?.show_time_as || 'busy',
          user_category_id: userCategory?.id || undefined,
          user_category_name: userCategory?.name || undefined,
          user_category_color: userCategory?.color || undefined,
          time_defense_level: userOptions?.time_defense_level || 'normal',
          ai_managed: userOptions?.ai_managed || false,
          ai_instructions: userOptions?.ai_instructions || undefined,

          // Computed fields for calendar rendering
          start: new Date(event.start_time).getTime(),
          end: new Date(event.start_time).getTime() + (event.duration * 60 * 1000), // duration is in minutes
          aiSuggested: false,
        }
      })
    },
    enabled: enabled && !!user?.id,
    staleTime,
    // Cache for 10 minutes
    gcTime: 10 * 60 * 1000,
  })
}

// Utility function to invalidate calendar events for a specific date range
export function useInvalidateCalendarEvents() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return (startDate?: Date, endDate?: Date) => {
    if (startDate && endDate && user?.id) {
      // Invalidate specific date range
      queryClient.invalidateQueries({
        queryKey: [
          'calendar-events',
          user.id,
          startOfDay(startDate).toISOString(),
          endOfDay(endDate).toISOString(),
        ],
      })
    } else {
      // Invalidate all calendar events for this user
      queryClient.invalidateQueries({
        queryKey: ['calendar-events', user?.id],
      })
    }
  }
}

// Utility function to update a single event in the cache
export function useUpdateCalendarEventCache() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return (updatedEvent: CalEvent) => {
    if (!user?.id) return

    // Update all cached queries that might contain this event
    queryClient.setQueriesData(
      { queryKey: ['calendar-events', user.id] },
      (oldData: CalEvent[] | undefined) => {
        if (!oldData) return oldData

        return oldData.map(event =>
          event.id === updatedEvent.id ? updatedEvent : event
        )
      }
    )
  }
}