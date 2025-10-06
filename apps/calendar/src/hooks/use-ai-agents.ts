import { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export interface AIAgentTool {
  id: string;
  description?: string;
  inputSchema?: any;
}

export interface AIAgent {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  tools?: Record<string, AIAgentTool>;
  provider?: string;
  modelId?: string;
}

interface MastraAgentInfo {
  name?: string;
  description?: string;
  instructions?: string;
  tools?: Record<string, any>;
  provider?: string;
  modelId?: string;
}

/**
 * Hook to fetch available AI agents from Mastra API using the official client SDK
 */
export function useAIAgents() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['ai-agents'],
    queryFn: async (): Promise<AIAgent[]> => {
      // Don't make network calls without auth token
      if (!session?.access_token) {
        console.warn('useAIAgents called without auth token - returning empty array');
        return [];
      }

      const client = new MastraClient({
        baseUrl: process.env.NEXT_PUBLIC_AGENT_URL!,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
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
          instructions: agentInfo?.instructions,
          tools: agentInfo?.tools,
          provider: agentInfo?.provider,
          modelId: agentInfo?.modelId,
        }));
      } catch (error) {
        console.error('Failed to fetch agents:', error);
        throw new Error('Failed to fetch available agents');
      }
    },
    enabled: !!session, // Only enabled when user is authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
