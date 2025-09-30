import { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { requireSession } from '@/lib/auth-guards';

export interface AIAgent {
  id: string;
  name: string;
  description?: string;
}

interface MastraAgentInfo {
  name?: string;
  description?: string;
}

/**
 * Hook to fetch available AI agents from Mastra API using the official client SDK
 */
export function useAIAgents() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['ai-agents'],
    queryFn: async (): Promise<AIAgent[]> => {
      // Auth guard - this function should never be called without a valid session
      const validSession = await requireSession();

      const client = new MastraClient({
        baseUrl: process.env.NEXT_PUBLIC_AGENT_URL!,
        headers: {
          Authorization: `Bearer ${validSession.access_token}`,
        },
      });

      try {
        // Use the Mastra client to get available agents
        const agents = await client.getAgents();

        // Transform the response to match our interface
        return Object.entries(agents).map(([id, agentInfo]: [string, MastraAgentInfo]) => ({
          id,
          name: agentInfo?.name || id,
          description: agentInfo?.description,
        }));
      } catch (error) {
        // If auth error (signed out), return empty array instead of throwing
        if (error instanceof Error && error.message === 'SIGNED_OUT') {
          return [];
        }
        console.error('Failed to fetch agents:', error);
        throw new Error('Failed to fetch available agents');
      }
    },
    enabled: !!session, // Only enabled when user is authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
