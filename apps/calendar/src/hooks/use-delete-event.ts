import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export function useDeleteEvent() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (eventId: string): Promise<void> => {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }

      // Delete the event (this will cascade delete user_event_options and event_user_roles)
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)
        .eq('owner', user.id) // Ensure user owns the event

      if (error) {
        throw new Error(`Failed to delete event: ${error.message}`)
      }
    },

    onSuccess: (_, eventId) => {
      // Remove the event from all relevant cache entries
      queryClient.setQueriesData(
        { queryKey: ['calendar-events', user?.id] },
        (oldData: any[] | undefined) => {
          if (!oldData) return oldData
          return oldData.filter(event => event.id !== eventId)
        }
      )
    },

    onError: (error) => {
      console.error('Failed to delete event:', error)
    },
  })
}