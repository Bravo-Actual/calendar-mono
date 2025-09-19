import { useQuery } from '@tanstack/react-query'
import { MastraClient } from '@mastra/client-js'
import { useAuth } from '@/contexts/AuthContext'

export interface AIAgent {
  id: string
  name: string
  description?: string
}

/**
 * Hook to fetch available AI agents from Mastra API using the official client SDK
 */
export function useAIAgents() {
  const { session } = useAuth()

  return useQuery({
    queryKey: ['ai-agents'],
    queryFn: async (): Promise<AIAgent[]> => {
      const client = new MastraClient({
        baseUrl: process.env.NEXT_PUBLIC_AGENT_URL!,
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`
        } : undefined
      })

      try {
        // Use the Mastra client to get available agents
        const agents = await client.getAgents()

        // Transform the response to match our interface
        return Object.entries(agents).map(([id, agentInfo]: [string, any]) => ({
          id,
          name: agentInfo?.name || id,
          description: agentInfo?.description
        }))
      } catch (error) {
        console.error('Failed to fetch agents:', error)
        throw new Error('Failed to fetch available agents')
      }
    },
    enabled: true, // Always enabled, no auth required for listing agents
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}