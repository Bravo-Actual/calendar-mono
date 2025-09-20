"use client"

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Brain, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { AIPersona } from '@/hooks/use-ai-personas'

interface MemoriesViewProps {
  assistant: AIPersona
  onBack: () => void
}

interface MemoryResource {
  resource_id: string
  working_memory: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export function MemoriesView({ assistant, onBack }: MemoriesViewProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [editingMemory, setEditingMemory] = useState(false)
  const [memoryText, setMemoryText] = useState('')

  // Calculate the resource ID that the agent uses for this persona
  const resourceId = user?.id ? `${user.id}-${assistant.id}` : null

  const { data: memoryData, isLoading, error, refetch } = useQuery({
    queryKey: ['agent-memory', resourceId],
    queryFn: async () => {
      if (!resourceId) return null

      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('resource_id', resourceId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data as MemoryResource | null
    },
    enabled: !!resourceId,
  })

  const clearMemoryMutation = useMutation({
    mutationFn: async () => {
      if (!resourceId) throw new Error('No resource ID')

      const { error } = await supabase
        .from('resources')
        .update({
          working_memory: null,
          updated_at: new Date().toISOString()
        })
        .eq('resource_id', resourceId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-memory'] })
      toast.success('Memory cleared successfully')
    },
    onError: (error) => {
      toast.error('Failed to clear memory: ' + error.message)
    }
  })

  const updateMemoryMutation = useMutation({
    mutationFn: async (newMemory: string) => {
      if (!resourceId) throw new Error('No resource ID')

      const { error } = await supabase
        .from('resources')
        .upsert({
          resource_id: resourceId,
          working_memory: newMemory,
          metadata: memoryData?.metadata || {},
          created_at: memoryData?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-memory'] })
      setEditingMemory(false)
      toast.success('Memory updated successfully')
    },
    onError: (error) => {
      toast.error('Failed to update memory: ' + error.message)
    }
  })

  // Update local state when memory data changes
  useEffect(() => {
    if (memoryData?.working_memory) {
      setMemoryText(memoryData.working_memory)
    }
  }, [memoryData])

  const handleSaveMemory = () => {
    updateMemoryMutation.mutate(memoryText)
  }

  const handleClearMemory = () => {
    if (confirm('Are you sure you want to clear all memories for this assistant? This action cannot be undone.')) {
      clearMemoryMutation.mutate()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          <h1 className="text-2xl font-bold">Memories for {assistant.name}</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Working Memory</CardTitle>
              <div className="flex gap-2">
                {!editingMemory ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingMemory(true)}
                    disabled={isLoading}
                  >
                    Edit
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingMemory(false)
                        setMemoryText(memoryData?.working_memory || '')
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveMemory}
                      disabled={updateMemoryMutation.isPending}
                    >
                      Save
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                This is what {assistant.name} remembers about you across all conversations:
              </div>

              {isLoading ? (
                <div className="rounded-lg border p-4 bg-muted/50">
                  <p className="text-sm text-muted-foreground">Loading memory data...</p>
                </div>
              ) : error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-700">Error loading memory: {error.message}</p>
                </div>
              ) : !memoryData || !memoryData.working_memory ? (
                <div className="rounded-lg border p-4 bg-muted/50">
                  <p className="text-sm text-muted-foreground italic">
                    No working memory found. {assistant.name} will start building memories as you have conversations.
                  </p>
                </div>
              ) : editingMemory ? (
                <Textarea
                  value={memoryText}
                  onChange={(e) => setMemoryText(e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                  placeholder="Enter working memory..."
                />
              ) : (
                <div className="rounded-lg border p-4 bg-slate-50">
                  <pre className="text-sm whitespace-pre-wrap">{memoryData.working_memory}</pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Memory Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium">Resource ID:</div>
                  <div className="text-muted-foreground font-mono">{resourceId}</div>
                </div>
                <div>
                  <div className="font-medium">Agent:</div>
                  <div className="text-muted-foreground">{assistant.name}</div>
                </div>
                {memoryData && (
                  <>
                    <div>
                      <div className="font-medium">Created:</div>
                      <div className="text-muted-foreground">
                        {new Date(memoryData.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">Updated:</div>
                      <div className="text-muted-foreground">
                        {new Date(memoryData.updated_at).toLocaleString()}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearMemory}
                  disabled={clearMemoryMutation.isPending || !memoryData?.working_memory}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Memories
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}