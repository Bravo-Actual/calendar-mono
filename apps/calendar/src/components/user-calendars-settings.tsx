'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  useUserCalendars,
  useCreateUserCalendar,
  useUpdateUserCalendar,
  useDeleteUserCalendar,
  type ClientCalendar
} from '@/lib/data'
import { categoryColors, getCategoryColor } from '@/lib/category-colors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Plus, Trash2, Loader2, Check, X, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export function UserCalendarsSettings() {
  const { user } = useAuth()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingColor, setEditingColor] = useState<NonNullable<ClientCalendar['color']>>('neutral')
  const [newCalendarName, setNewCalendarName] = useState('')
  const [newCalendarColor, setNewCalendarColor] = useState<NonNullable<ClientCalendar['color']>>('neutral')
  const [deleteCalendar, setDeleteCalendar] = useState<ClientCalendar | null>(null)

  const { data: calendars = [], isLoading } = useUserCalendars(user?.id)
  const createMutation = useCreateUserCalendar(user?.id)
  const updateMutation = useUpdateUserCalendar(user?.id)
  const deleteMutation = useDeleteUserCalendar(user?.id)

  const handleCreateCalendar = async () => {
    if (!newCalendarName.trim()) return

    try {
      await createMutation.mutateAsync({
        name: newCalendarName.trim(),
        color: newCalendarColor,
      })
      setNewCalendarName('')
      setNewCalendarColor('neutral')
    } catch (error) {
      // Error handling is done in the mutation
    }
  }

  const startEditing = (calendar: ClientCalendar) => {
    setEditingId(calendar.id)
    setEditingName(calendar.name)
    setEditingColor(calendar.color || 'neutral')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingName('')
    setEditingColor('neutral')
  }

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return

    try {
      await updateMutation.mutateAsync({
        id: editingId,
        name: editingName.trim(),
        color: editingColor,
      })
      setEditingId(null)
      setEditingName('')
      setEditingColor('neutral')
    } catch (error) {
      // Error handling is done in the mutation
    }
  }

  const handleDeleteCalendar = async () => {
    if (!deleteCalendar) return

    try {
      await deleteMutation.mutateAsync(deleteCalendar.id)
      setDeleteCalendar(null)
    } catch (error) {
      // Error handling is done in the mutation
    }
  }

  const handleToggleVisibility = async (calendarId: string, visible: boolean) => {
    try {
      await updateMutation.mutateAsync({ id: calendarId, visible })
    } catch (error) {
      // Error handling is done in the mutation
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Calendars</h3>
        <p className="text-sm text-muted-foreground">
          Create and manage your personal calendars for organizing events.
          The default calendar cannot be deleted.
        </p>
      </div>

      <div className="space-y-4">
        {/* Add new calendar row */}
        <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-muted-foreground/25">
          <div className="w-4 h-4 rounded-full border border-muted-foreground/25 bg-muted/50" />
          <Input
            placeholder="Add new calendar..."
            value={newCalendarName}
            onChange={(e) => setNewCalendarName(e.target.value)}
            className="flex-1 border-0 shadow-none focus-visible:ring-0 bg-transparent"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newCalendarName.trim()) {
                handleCreateCalendar()
              }
            }}
          />
          <Select
            value={newCalendarColor}
            onValueChange={(value) => setNewCalendarColor(value as NonNullable<ClientCalendar['color']>)}
          >
            <SelectTrigger className="w-24 border-0 shadow-none bg-transparent">
              <div
                className={cn(
                  "w-4 h-4 rounded-full border",
                  `bg-${newCalendarColor}-500 border-${newCalendarColor}-600`
                )}
              />
            </SelectTrigger>
            <SelectContent>
              {categoryColors.map((color) => (
                <SelectItem key={color.value} value={color.value}>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border",
                        `bg-${color.value}-500 border-${color.value}-600`
                      )}
                    />
                    {color.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleCreateCalendar}
            disabled={!newCalendarName.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Existing calendars */}
        {calendars.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No calendars found.</p>
            <p className="text-sm">Type a name above to create your first calendar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {calendars.map((calendar) => {
              const colorConfig = getCategoryColor(calendar.color || 'neutral')
              const isEditing = editingId === calendar.id

              return (
                <div
                  key={calendar.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    colorConfig.bgClass,
                    colorConfig.borderClass
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border",
                      `bg-${isEditing ? editingColor : calendar.color}-500 border-${isEditing ? editingColor : calendar.color}-600`
                    )}
                  />

                  {isEditing ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 border-0 shadow-none focus-visible:ring-0 bg-transparent"
                        autoComplete="off"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editingName.trim()) {
                            saveEdit()
                          } else if (e.key === 'Escape') {
                            cancelEditing()
                          }
                        }}
                        autoFocus
                      />
                      <Select
                        value={editingColor}
                        onValueChange={(value) => setEditingColor(value as NonNullable<ClientCalendar['color']>)}
                      >
                        <SelectTrigger className="w-24 border-0 shadow-none bg-transparent">
                          <div
                            className={cn(
                              "w-4 h-4 rounded-full border",
                              `bg-${editingColor}-500 border-${editingColor}-600`
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {categoryColors.map((color) => (
                            <SelectItem key={color.value} value={color.value}>
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "w-4 h-4 rounded-full border",
                                    `bg-${color.value}-500 border-${color.value}-600`
                                  )}
                                />
                                {color.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={saveEdit}
                          disabled={!editingName.trim() || updateMutation.isPending}
                        >
                          {updateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEditing}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className={cn("flex-1 font-medium", colorConfig.textClass)}>
                        {calendar.name}
                        {calendar.type === 'default' && (
                          <span className="ml-2 text-xs text-muted-foreground">(Default)</span>
                        )}
                        {calendar.type === 'archive' && (
                          <span className="ml-2 text-xs text-muted-foreground">(Archive)</span>
                        )}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleVisibility(calendar.id, !calendar.visible)}
                          className={colorConfig.hoverClass}
                        >
                          {calendar.visible ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditing(calendar)}
                          className={colorConfig.hoverClass}
                        >
                          Edit
                        </Button>
                        {calendar.type === 'user' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteCalendar(calendar)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCalendar} onOpenChange={() => setDeleteCalendar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Calendar</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteCalendar?.name}&quot;?
              This action cannot be undone. Events in this calendar will be automatically
              moved to your default calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCalendar}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}