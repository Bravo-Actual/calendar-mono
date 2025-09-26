"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, Loader2 } from "lucide-react"
import { WORK_SCHEDULE_PRESETS, type WorkScheduleDay, type UserWorkSchedule } from "@/types"
import { useUserWorkPeriods, useSaveUserWorkPeriods } from "@/lib/data"

interface WorkScheduleSettingsProps {
  userId: string
  timezone: string
  onSave?: (schedule: UserWorkSchedule) => void
  onHasChangesChange?: (hasChanges: boolean) => void
  onSaveHandler?: (saveFunction: () => void) => void
  isLoading?: boolean
  isSaving?: boolean
}

interface WorkPeriod {
  start_time: string
  end_time: string
}

const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
]

export function WorkScheduleSettings({
  userId,
  timezone,
  onSave,
  onHasChangesChange,
  onSaveHandler,
  isLoading = false,
  isSaving = false
}: WorkScheduleSettingsProps) {
  const { data: workPeriods, isLoading: isLoadingPeriods } = useUserWorkPeriods(userId)
  const saveWorkPeriods = useSaveUserWorkPeriods(userId)
  const [workDays, setWorkDays] = useState<WorkScheduleDay[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  // Convert work periods from database to UI format
  useEffect(() => {
    if (!workPeriods) {
      // Initialize empty schedule for all days
      const emptySchedule = Array.from({ length: 7 }, (_, i) => ({
        weekday: i,
        periods: [] as WorkPeriod[]
      }))
      setWorkDays(emptySchedule)
      return
    }

    // Group periods by weekday
    const scheduleMap = new Map<number, WorkPeriod[]>()

    workPeriods.forEach(period => {
      if (!scheduleMap.has(period.weekday)) {
        scheduleMap.set(period.weekday, [])
      }
      scheduleMap.get(period.weekday)!.push({
        start_time: period.start_time,
        end_time: period.end_time
      })
    })

    // Create schedule for all days
    const schedule = Array.from({ length: 7 }, (_, i) => ({
      weekday: i,
      periods: scheduleMap.get(i) || []
    }))

    setWorkDays(schedule)
  }, [workPeriods])

  const handleSave = useCallback(() => {
    // Prevent multiple saves
    if (saveWorkPeriods.isPending) {
      return
    }

    // Convert UI format to database format
    const periodsToSave = workDays.flatMap(day =>
      day.periods.map(period => ({
        weekday: day.weekday,
        start_time: period.start_time,
        end_time: period.end_time,
      }))
    )

    saveWorkPeriods.mutate(periodsToSave, {
      onSuccess: () => {
        setHasChanges(false)
        if (onSave) {
          const schedule: UserWorkSchedule = {
            user_id: userId,
            timezone,
            schedule: workDays.filter(day => day.periods.length > 0)
          }
          onSave(schedule)
        }
      }
    })
  }, [workDays, userId, timezone, saveWorkPeriods, onSave])

  // Notify parent about changes
  useEffect(() => {
    onHasChangesChange?.(hasChanges)
  }, [hasChanges, onHasChangesChange])

  // Provide save handler to parent
  useEffect(() => {
    onSaveHandler?.(handleSave)
  }, [onSaveHandler, handleSave])

  const applyPreset = (presetKey: keyof typeof WORK_SCHEDULE_PRESETS) => {
    const preset = WORK_SCHEDULE_PRESETS[presetKey]

    // Start with empty schedule
    const newSchedule = Array.from({ length: 7 }, (_, i) => ({
      weekday: i,
      periods: [] as WorkPeriod[]
    }))

    // Apply preset schedule
    preset.schedule.forEach(day => {
      newSchedule[day.weekday] = {
        weekday: day.weekday,
        periods: day.periods.map(p => ({ ...p }))
      }
    })

    setWorkDays(newSchedule)
    setHasChanges(true)
  }

  const toggleDay = (weekday: number, enabled: boolean) => {
    setWorkDays(prev => prev.map(day =>
      day.weekday === weekday
        ? {
            ...day,
            periods: enabled ? [{ start_time: "09:00", end_time: "17:00" }] : []
          }
        : day
    ))
    setHasChanges(true)
  }

  const addPeriod = (weekday: number) => {
    setWorkDays(prev => prev.map(day =>
      day.weekday === weekday
        ? {
            ...day,
            periods: [...day.periods, { start_time: "09:00", end_time: "17:00" }]
          }
        : day
    ))
    setHasChanges(true)
  }

  const removePeriod = (weekday: number, periodIndex: number) => {
    setWorkDays(prev => prev.map(day =>
      day.weekday === weekday
        ? {
            ...day,
            periods: day.periods.filter((_, i) => i !== periodIndex)
          }
        : day
    ))
    setHasChanges(true)
  }

  const updatePeriod = (weekday: number, periodIndex: number, field: keyof WorkPeriod, value: string) => {
    setWorkDays(prev => prev.map(day =>
      day.weekday === weekday
        ? {
            ...day,
            periods: day.periods.map((period, i) =>
              i === periodIndex ? { ...period, [field]: value } : period
            )
          }
        : day
    ))
    setHasChanges(true)
  }

  if (isLoading || isLoadingPeriods) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Work Schedule</h3>
        <p className="text-sm text-muted-foreground">
          Define your regular work hours so others can schedule meetings when you&apos;re available.
        </p>
      </div>

      {/* Presets */}
      <div className="space-y-2">
        <Label>Quick Setup</Label>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset('STANDARD_BUSINESS')}
          >
            Standard Business Hours
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset('WITH_LUNCH_BREAK')}
          >
            With Lunch Break
          </Button>
        </div>
      </div>

      {/* Daily Schedule */}
      <div className="space-y-0">
        {WEEKDAY_NAMES.map((dayName, weekday) => {
          const day = workDays.find(d => d.weekday === weekday)
          const isEnabled = day && day.periods.length > 0

          return (
            <div key={weekday}>
              {weekday > 0 && <div className="border-t my-4" />}

              <div className="space-y-3">
                {/* First row with day name and first time period */}
                <div className="flex items-center gap-4">
                  <div className="w-24 flex-shrink-0">
                    <Label className="text-sm font-medium">{dayName}</Label>
                  </div>

                  <Switch
                    checked={isEnabled || false}
                    onCheckedChange={(enabled) => toggleDay(weekday, enabled)}
                  />

                  {isEnabled && day?.periods.length > 0 && (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="time"
                        value={day.periods[0].start_time}
                        onChange={(e) => updatePeriod(weekday, 0, 'start_time', e.target.value)}
                        className="w-32"
                      />
                      <span className="text-muted-foreground text-sm">to</span>
                      <Input
                        type="time"
                        value={day.periods[0].end_time}
                        onChange={(e) => updatePeriod(weekday, 0, 'end_time', e.target.value)}
                        className="w-32"
                      />
                      {day.periods.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removePeriod(weekday, 0)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {/* Show add button after the last period */}
                      {day.periods.length === 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addPeriod(weekday)}
                          className="ml-2"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add period
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Additional periods for this day */}
                {isEnabled && day?.periods.slice(1).map((period, periodIndex) => (
                  <div key={periodIndex + 1} className="flex items-center gap-4">
                    <div className="w-24 flex-shrink-0"></div>
                    <div className="w-[38px]"></div>
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="time"
                        value={period.start_time}
                        onChange={(e) => updatePeriod(weekday, periodIndex + 1, 'start_time', e.target.value)}
                        className="w-32"
                      />
                      <span className="text-muted-foreground text-sm">to</span>
                      <Input
                        type="time"
                        value={period.end_time}
                        onChange={(e) => updatePeriod(weekday, periodIndex + 1, 'end_time', e.target.value)}
                        className="w-32"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePeriod(weekday, periodIndex + 1)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {/* Show add button after the very last period */}
                      {periodIndex === day.periods.length - 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addPeriod(weekday)}
                          className="ml-2"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add period
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}