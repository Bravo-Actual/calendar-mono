import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { DbUserWorkPeriod, DbUserWorkPeriodInsert, UserWorkSchedule, WorkScheduleDay } from '@/types'

// Query key factory
const workScheduleKeys = {
  all: ['work-schedule'] as const,
  user: (userId: string) => [...workScheduleKeys.all, 'user', userId] as const,
}

/**
 * Hook to fetch a user's work schedule
 */
export function useUserWorkSchedule(userId: string | undefined) {
  return useQuery({
    queryKey: workScheduleKeys.user(userId || ''),
    queryFn: async (): Promise<UserWorkSchedule | null> => {
      if (!userId) return null

      const { data: workPeriods, error } = await supabase
        .from('user_work_periods')
        .select('*')
        .eq('user_id', userId)
        .order('weekday', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) {
        console.error('Error fetching work schedule:', error)
        throw new Error('Failed to load work schedule')
      }

      if (!workPeriods || workPeriods.length === 0) {
        return null
      }

      // Get user's timezone from profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('timezone')
        .eq('id', userId)
        .single()

      // Group work periods by weekday
      const scheduleMap = new Map<number, WorkScheduleDay>()

      workPeriods.forEach(period => {
        if (!scheduleMap.has(period.weekday)) {
          scheduleMap.set(period.weekday, {
            weekday: period.weekday,
            periods: []
          })
        }

        scheduleMap.get(period.weekday)!.periods.push({
          start_time: period.start_time,
          end_time: period.end_time
        })
      })

      return {
        user_id: userId,
        timezone: profile?.timezone || 'UTC',
        schedule: Array.from(scheduleMap.values()).sort((a, b) => a.weekday - b.weekday)
      }
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to save/update a user's work schedule
 */
export function useSaveWorkSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (schedule: UserWorkSchedule) => {
      const { user_id, schedule: workDays } = schedule

      // Delete existing work periods for this user
      const { error: deleteError } = await supabase
        .from('user_work_periods')
        .delete()
        .eq('user_id', user_id)

      if (deleteError) {
        console.error('Error deleting existing work periods:', deleteError)
        throw new Error('Failed to update work schedule')
      }

      // Insert new work periods
      if (workDays.length > 0) {
        const workPeriods: DbUserWorkPeriodInsert[] = []

        workDays.forEach(day => {
          day.periods.forEach(period => {
            workPeriods.push({
              user_id,
              weekday: day.weekday,
              start_time: period.start_time,
              end_time: period.end_time
            })
          })
        })

        const { error: insertError } = await supabase
          .from('user_work_periods')
          .insert(workPeriods)

        if (insertError) {
          console.error('Error inserting work periods:', insertError)
          throw new Error('Failed to save work schedule')
        }
      }

      return schedule
    },
    onSuccess: (schedule) => {
      // Invalidate and refetch work schedule
      queryClient.invalidateQueries({
        queryKey: workScheduleKeys.user(schedule.user_id)
      })
      toast.success('Work schedule saved successfully')
    },
    onError: (error) => {
      console.error('Error saving work schedule:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save work schedule')
    },
  })
}

/**
 * Hook to delete a user's work schedule
 */
export function useDeleteWorkSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_work_periods')
        .delete()
        .eq('user_id', userId)

      if (error) {
        console.error('Error deleting work schedule:', error)
        throw new Error('Failed to delete work schedule')
      }

      return userId
    },
    onSuccess: (userId) => {
      // Invalidate and refetch work schedule
      queryClient.invalidateQueries({
        queryKey: workScheduleKeys.user(userId)
      })
      toast.success('Work schedule deleted successfully')
    },
    onError: (error) => {
      console.error('Error deleting work schedule:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete work schedule')
    },
  })
}

/**
 * Hook to query multiple users' work schedules (for scheduling meetings)
 */
export function useMultipleUserWorkSchedules(userIds: string[]) {
  return useQuery({
    queryKey: [...workScheduleKeys.all, 'multiple', userIds.sort()],
    queryFn: async (): Promise<UserWorkSchedule[]> => {
      if (userIds.length === 0) return []

      // Get work periods for all users
      const { data: workPeriods, error: periodsError } = await supabase
        .from('user_work_periods')
        .select('*')
        .in('user_id', userIds)
        .order('user_id')
        .order('weekday', { ascending: true })
        .order('start_time', { ascending: true })

      if (periodsError) {
        console.error('Error fetching multiple work schedules:', periodsError)
        throw new Error('Failed to load work schedules')
      }

      // Get user profiles for timezones
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, timezone')
        .in('id', userIds)

      if (profilesError) {
        console.error('Error fetching user profiles:', profilesError)
        throw new Error('Failed to load user profiles')
      }

      const profileMap = new Map(profiles?.map(p => [p.id, p.timezone || 'UTC']) || [])

      // Group by user_id
      const userScheduleMap = new Map<string, WorkScheduleDay[]>()

      workPeriods?.forEach(period => {
        if (!userScheduleMap.has(period.user_id!)) {
          userScheduleMap.set(period.user_id!, [])
        }

        const userSchedule = userScheduleMap.get(period.user_id!)!
        let day = userSchedule.find(d => d.weekday === period.weekday)

        if (!day) {
          day = { weekday: period.weekday, periods: [] }
          userSchedule.push(day)
        }

        day.periods.push({
          start_time: period.start_time,
          end_time: period.end_time
        })
      })

      return userIds.map(userId => ({
        user_id: userId,
        timezone: profileMap.get(userId) || 'UTC',
        schedule: userScheduleMap.get(userId) || []
      }))
    },
    enabled: userIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}