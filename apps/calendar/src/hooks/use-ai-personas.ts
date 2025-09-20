'use client'

import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { getDefaultPersonaConfig } from '@/config/default-persona'
import type { Json } from '@/lib/supabase-types'

const supabase = createClient()

export interface AIPersona {
  id: string
  user_id: string
  name: string
  avatar_url?: string | null
  traits?: string | null
  instructions?: string | null
  greeting?: string | null
  agent_id?: string | null
  model_id?: string | null
  temperature?: number | null
  top_p?: number | null
  is_default: boolean
  properties_ext?: Json
  created_at: string
  updated_at: string
}

export interface CreateAIPersonaInput {
  name: string
  agent_id?: string | null
  model_id?: string | null
  avatar_url?: string | null
  traits?: string | null
  instructions?: string | null
  greeting?: string | null
  temperature?: number | null
  top_p?: number | null
  is_default?: boolean
  properties_ext?: Json
}

export interface UpdateAIPersonaInput extends Partial<CreateAIPersonaInput> {
  id: string
}

export function useAIPersonas() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isCreatingDefault, setIsCreatingDefault] = React.useState(false)

  // Fetch all AI personas for the current user
  const { data: personas = [], isLoading, error } = useQuery({
    queryKey: ['ai-personas', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error } = await supabase
        .from('ai_personas')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching AI personas:', error)
        throw error
      }

      return data as AIPersona[]
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours - personas rarely change
    gcTime: 1000 * 60 * 60 * 24, // 24 hours - keep in cache for a day
  })

  // Create persona mutation
  const createPersonaMutation = useMutation({
    mutationFn: async (input: CreateAIPersonaInput) => {
      if (!user?.id) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('ai_personas')
        .insert({
          ...input,
          user_id: user.id,
          temperature: input.temperature ?? 0.7,
          is_default: input.is_default ?? false,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating AI persona:', error)
        throw error
      }

      return data as AIPersona
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-personas', user?.id] })
    },
    onError: (error) => {
      toast.error('Failed to create AI persona')
      console.error('Create persona error:', error)
    },
  })

  // Update persona mutation
  const updatePersonaMutation = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateAIPersonaInput) => {
      if (!user?.id) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('ai_personas')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()

      if (error) {
        console.error('Error updating AI persona:', error)
        throw error
      }

      return data[0] as AIPersona
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-personas', user?.id] })
    },
    onError: (error) => {
      toast.error('Failed to update AI persona')
      console.error('Update persona error:', error)
    },
  })

  // Delete persona mutation
  const deletePersonaMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('User not authenticated')

      const { error } = await supabase
        .from('ai_personas')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error deleting AI persona:', error)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-personas', user?.id] })
    },
    onError: (error) => {
      toast.error('Failed to delete AI persona')
      console.error('Delete persona error:', error)
    },
  })

  // Upload avatar function
  const uploadAvatar = async (file: File): Promise<{ publicUrl: string }> => {
    if (!user?.id) throw new Error('User not authenticated')

    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw uploadError
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    return { publicUrl }
  }

  // Function to create default persona if none exists
  const createDefaultPersona = React.useCallback(async (): Promise<AIPersona> => {
    if (!user?.id) throw new Error('User not authenticated')

    const defaultConfig = getDefaultPersonaConfig()
    const { data, error } = await supabase
      .from('ai_personas')
      .insert({
        ...defaultConfig,
        user_id: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating default persona:', error)
      throw error
    }

    return data as AIPersona
  }, [user?.id])

  // Check if user has personas (no auto-creation)
  const hasAnyPersona = personas.length > 0
  const hasDefaultPersona = personas.some(p => p.is_default)

  return {
    personas,
    isLoading,
    error,
    hasDefaultPersona,
    defaultPersona: personas.find(p => p.is_default),
    createPersona: createPersonaMutation.mutate,
    updatePersona: updatePersonaMutation.mutate,
    deletePersona: deletePersonaMutation.mutate,
    uploadAvatar,
    createDefaultPersona,
    isCreating: createPersonaMutation.isPending,
    isUpdating: updatePersonaMutation.isPending,
    isDeleting: deletePersonaMutation.isPending,
  }
}