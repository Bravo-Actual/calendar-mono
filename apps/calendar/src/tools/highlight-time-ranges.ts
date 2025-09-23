import { createTool } from '@mastra/client-js';
import { z } from 'zod';
import { useAppStore } from '@/store/app';

export const highlightTimeRangesTool = createTool({
  id: 'highlightTimeRanges',
  description: 'Highlight specific time ranges on the calendar to draw user attention. This creates yellow AI time highlights separate from user selections.',
  inputSchema: z.object({
    timeRanges: z.array(z.object({
      start: z.string().describe('ISO timestamp for start of AI highlight (e.g., "2024-01-15T09:00:00.000Z")'),
      end: z.string().describe('ISO timestamp for end of AI highlight (e.g., "2024-01-15T10:00:00.000Z")'),
      description: z.string().optional().describe('Context for this specific time range highlight')
    })).describe('Array of time ranges to highlight'),
    action: z.enum(['add', 'replace', 'clear']).default('replace').describe('How to apply AI highlights: add to existing, replace all, or clear all'),
    description: z.string().optional().describe('Overall context for why these time ranges are highlighted')
  }),
  execute: async ({ context }) => {
    const {
      setAiHighlightedTimeRanges,
      addAiHighlightedTimeRange,
      clearAiHighlightedTimeRanges
    } = useAppStore.getState();

    switch (context.action) {
      case 'add':
        context.timeRanges.forEach(addAiHighlightedTimeRange);
        break;
      case 'replace':
        setAiHighlightedTimeRanges(context.timeRanges);
        break;
      case 'clear':
        clearAiHighlightedTimeRanges();
        break;
    }

    const message = context.action === 'clear'
      ? 'Cleared all AI time range highlights'
      : `AI highlighted ${context.timeRanges.length} time range${context.timeRanges.length === 1 ? '' : 's'}${context.description ? `: ${context.description}` : ''}`;

    return {
      success: true,
      highlightedRanges: context.action === 'clear' ? 0 : context.timeRanges.length,
      message,
      type: 'ai-highlight'
    };
  }
});