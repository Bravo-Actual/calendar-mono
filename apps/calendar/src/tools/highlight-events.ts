import { createTool } from '@mastra/client-js';
import { z } from 'zod';
import { useAppStore } from '@/store/app';

export const highlightEventsTool = createTool({
  id: 'highlightEvents',
  description: 'Highlight specific events on the calendar to draw user attention. This creates yellow AI highlights separate from user selections.',
  inputSchema: z.object({
    eventIds: z.array(z.string()).describe('Array of event IDs to highlight with yellow AI highlight'),
    action: z.enum(['add', 'replace', 'clear']).default('replace').describe('How to apply AI highlights: add to existing, replace all, or clear all'),
    description: z.string().optional().describe('Context for why these events are highlighted')
  }),
  execute: async ({ context }) => {
    const {
      setAiHighlightedEvents,
      addAiHighlightedEvent,
      clearAiHighlightedEvents
    } = useAppStore.getState();

    switch (context.action) {
      case 'add':
        context.eventIds.forEach(addAiHighlightedEvent);
        break;
      case 'replace':
        setAiHighlightedEvents(context.eventIds);
        break;
      case 'clear':
        clearAiHighlightedEvents();
        break;
    }

    const message = context.action === 'clear'
      ? 'Cleared all AI event highlights'
      : `AI highlighted ${context.eventIds.length} event${context.eventIds.length === 1 ? '' : 's'}${context.description ? `: ${context.description}` : ''}`;

    return {
      success: true,
      highlightedCount: context.action === 'clear' ? 0 : context.eventIds.length,
      message,
      type: 'ai-highlight'
    };
  }
});