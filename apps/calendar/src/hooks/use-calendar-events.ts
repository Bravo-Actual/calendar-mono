import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { startOfDay, endOfDay } from 'date-fns'
import type { ShowTimeAs, TimeDefenseLevel, UserRole, InviteType, RsvpStatus, AttendanceType } from '@/types/database'

export interface CalendarEvent {
  // Event fields
  id: string
  owner: string
  creator: string
  series_id?: string
  title: string
  agenda?: string
  online_event: boolean
  online_join_link?: string
  online_chat_link?: string
  in_person: boolean
  start_time: string
  duration: number
  all_day: boolean
  private: boolean
  request_responses: boolean
  allow_forwarding: boolean
  hide_attendees: boolean
  history: any[]
  created_at: string
  updated_at: string

  // User's role and RSVP info
  user_role?: 'viewer' | 'contributor' | 'owner' | 'delegate_full'
  invite_type?: 'required' | 'optional'
  rsvp?: 'tentative' | 'accepted' | 'declined'
  rsvp_timestamp?: string
  attendance_type?: 'in_person' | 'virtual'
  following: boolean

  // User's event options
  show_time_as: 'free' | 'tentative' | 'busy' | 'oof' | 'working_elsewhere'
  user_category_id?: string
  user_category_name?: string
  user_category_color?: string
  time_defense_level: 'flexible' | 'normal' | 'high' | 'hard_block'
  ai_managed: boolean
  ai_instructions?: string
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
    queryFn: async (): Promise<CalendarEvent[]> => {
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
      const allEvents = [...(ownedEvents || []), ...(roleEvents || [])]
      const uniqueEvents = allEvents.reduce((acc, event) => {
        if (!acc.find(e => e.id === event.id)) {
          acc.push(event)
        }
        return acc
      }, [] as any[])

      // Transform the REST response to our CalendarEvent interface
      return uniqueEvents.map((event): CalendarEvent => {
        // Find user's role and options
        const userRole = event.event_user_roles?.find(role => role.user_id === user.id)
        const userOptions = event.user_event_options?.find(option => option.user_id === user.id)
        const userCategory = userOptions?.user_event_categories

        return {
          // Event fields
          id: event.id,
          owner: event.owner,
          creator: event.creator,
          series_id: event.series_id,
          title: event.title,
          agenda: event.agenda,
          online_event: event.online_event,
          online_join_link: event.online_join_link,
          online_chat_link: event.online_chat_link,
          in_person: event.in_person,
          start_time: event.start_time,
          duration: event.duration,
          all_day: event.all_day,
          private: event.private,
          request_responses: event.request_responses,
          allow_forwarding: event.allow_forwarding,
          hide_attendees: event.hide_attendees,
          history: event.history,
          created_at: event.created_at,
          updated_at: event.updated_at,

          // User's role (determine if owner or from role table)
          user_role: userRole?.role || (event.owner === user.id ? 'owner' : 'viewer'),
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

  return (updatedEvent: CalendarEvent) => {
    if (!user?.id) return

    // Update all cached queries that might contain this event
    queryClient.setQueriesData(
      { queryKey: ['calendar-events', user.id] },
      (oldData: CalendarEvent[] | undefined) => {
        if (!oldData) return oldData

        return oldData.map(event =>
          event.id === updatedEvent.id ? updatedEvent : event
        )
      }
    )
  }
}