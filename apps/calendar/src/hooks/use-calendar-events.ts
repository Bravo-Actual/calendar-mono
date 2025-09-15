import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { startOfDay, endOfDay } from 'date-fns'

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

      // Use GraphQL to fetch events with all related data
      const { data, error } = await supabase.graphql(`
        query getCalendarEvents($userId: UUID!, $startDate: Datetime!, $endDate: Datetime!) {
          eventsCollection(
            filter: {
              and: [
                { start_time: { gte: $startDate } },
                { start_time: { lte: $endDate } },
                {
                  or: [
                    { owner: { eq: $userId } },
                    { event_user_rolesCollection: { filter: { user_id: { eq: $userId } } } }
                  ]
                }
              ]
            }
          ) {
            edges {
              node {
                id
                owner
                creator
                series_id
                title
                agenda
                online_event
                online_join_link
                online_chat_link
                in_person
                start_time
                duration
                all_day
                private
                request_responses
                allow_forwarding
                hide_attendees
                history
                created_at
                updated_at

                # User's role information
                event_user_rolesCollection(filter: { user_id: { eq: $userId } }) {
                  edges {
                    node {
                      role
                      invite_type
                      rsvp
                      rsvp_timestamp
                      attendance_type
                      following
                    }
                  }
                }

                # User's event options
                user_event_optionsCollection(filter: { user_id: { eq: $userId } }) {
                  edges {
                    node {
                      show_time_as
                      time_defense_level
                      ai_managed
                      ai_instructions

                      # User's custom category
                      user_event_categories {
                        id
                        name
                        color
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `, {
        userId: user.id,
        startDate: startOfDay(startDate).toISOString(),
        endDate: endOfDay(endDate).toISOString(),
      })

      if (error) {
        throw new Error(`Failed to fetch calendar events: ${error.message}`)
      }

      // Transform the GraphQL response to our CalendarEvent interface
      return data.eventsCollection.edges.map(({ node: event }: any): CalendarEvent => {
        const userRole = event.event_user_rolesCollection.edges[0]?.node
        const userOptions = event.user_event_optionsCollection.edges[0]?.node
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