'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  useEventCategories,
  useCreateUserCategory,
  useUpdateUserCategory,
  useDeleteUserCategory,
  type UserEventCategory
} from '@/lib/data/queries'
import { categoryColors, getCategoryColor } from '@/lib/category-colors'
import type { EventCategory } from '@/components/types'
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
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Loader2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EventCategoriesSettings() {
  const { user } = useAuth()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingColor, setEditingColor] = useState<EventCategory>('neutral')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState<EventCategory>('neutral')
  const [deleteCategory, setDeleteCategory] = useState<UserEventCategory | null>(null)

  const { data: categories = [], isLoading } = useEventCategories(user?.id)
  const createMutation = useCreateUserCategory()
  const updateMutation = useUpdateUserCategory()
  const deleteMutation = useDeleteUserCategory()

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !user?.id) return

    try {
      await createMutation.mutateAsync({
        userId: user.id,
        name: newCategoryName.trim(),
        color: newCategoryColor,
      })
      setNewCategoryName('')
      setNewCategoryColor('neutral')
    } catch (error) {
      // Error handling is done in the mutation
    }
  }

  const startEditing = (category: UserEventCategory) => {
    setEditingId(category.id)
    setEditingName(category.name)
    setEditingColor(category.color || 'neutral')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingName('')
    setEditingColor('neutral')
  }

  const saveEdit = async () => {
    if (!editingId || !editingName.trim() || !user?.id) return

    try {
      await updateMutation.mutateAsync({
        userId: user.id,
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

  const handleDeleteCategory = async () => {
    if (!deleteCategory || !user?.id) return

    try {
      await deleteMutation.mutateAsync({
        userId: user.id,
        categoryId: deleteCategory.id,
      })
      setDeleteCategory(null)
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
        <h3 className="text-lg font-medium">Event Categories</h3>
        <p className="text-sm text-muted-foreground">
          Create and manage custom categories for organizing your events.
          Deleting a category won&apos;t delete events that use it. The default category cannot be deleted.
        </p>
      </div>

      <div className="space-y-4">
        {/* Add new category row */}
        <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-muted-foreground/25">
          <div className="w-4 h-4 rounded-full border border-muted-foreground/25 bg-muted/50" />
          <Input
            placeholder="Add new category..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="flex-1 border-0 shadow-none focus-visible:ring-0 bg-transparent"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newCategoryName.trim()) {
                handleCreateCategory()
              }
            }}
          />
          <Select
            value={newCategoryColor}
            onValueChange={(value: EventCategory) => setNewCategoryColor(value)}
          >
            <SelectTrigger className="w-24 border-0 shadow-none bg-transparent">
              <div
                className={cn(
                  "w-4 h-4 rounded-full border",
                  `bg-${newCategoryColor}-500 border-${newCategoryColor}-600`
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
            onClick={handleCreateCategory}
            disabled={!newCategoryName.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Existing categories */}
        {categories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No categories created yet.</p>
            <p className="text-sm">Type a name above to create your first category.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((category) => {
              const colorConfig = getCategoryColor(category.color || 'neutral')
              const isEditing = editingId === category.id

              return (
                <div
                  key={category.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    colorConfig.bgClass,
                    colorConfig.borderClass
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border",
                      `bg-${isEditing ? editingColor : category.color}-500 border-${isEditing ? editingColor : category.color}-600`
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
                        onValueChange={(value: EventCategory) => setEditingColor(value)}
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
                        {category.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditing(category)}
                          className={colorConfig.hoverClass}
                        >
                          Edit
                        </Button>
                        {!category.is_default && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteCategory(category)}
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
      <AlertDialog open={!!deleteCategory} onOpenChange={() => setDeleteCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteCategory?.name}&quot;?
              This action cannot be undone. Events that use this category will be automatically
              moved to your default category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
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