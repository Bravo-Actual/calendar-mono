import { useQuery } from '@tanstack/react-query';

export interface AIAgent {
  id: string;
  name: string;
  description?: string;
}

/**
 * Hook to fetch available AI agents - disabled for calendar-ai (single agent system)
 */
export function useAIAgents() {

  return useQuery({
    queryKey: ['ai-agents'],
    queryFn: async (): Promise<AIAgent[]> => {
      // Calendar-AI uses a single LangGraph agent, not multiple Mastra agents
      // Return empty array since agent selection is handled via personas
      return [];
    },
    enabled: false, // Disabled - calendar-ai doesn't expose agent listing
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
