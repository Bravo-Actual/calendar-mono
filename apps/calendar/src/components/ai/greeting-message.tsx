'use client';

import { Message, MessageAvatar, MessageContent, Suggestion } from '@/components/ai';
import { getAvatarUrl } from '@/lib/avatar-utils';
import type { ClientPersona } from '@/lib/data-v2';

const CALENDAR_SUGGESTIONS = [
  "What's on my calendar today?",
  'Help me schedule a meeting',
  'Find time for a quick sync',
  'Show me my free time this week',
  'Reschedule my 2pm meeting',
];

interface GreetingMessageProps {
  selectedPersona: ClientPersona | null;
  greetingMessage?: string | null;
  onSuggestionClick: (suggestion: string) => void;
  status: string;
}

export function GreetingMessage({
  selectedPersona,
  greetingMessage,
  onSuggestionClick,
  status,
}: GreetingMessageProps) {
  return (
    <Message from="assistant">
      <MessageAvatar
        src={getAvatarUrl(selectedPersona?.avatar_url) || undefined}
        name={selectedPersona?.name || 'AI'}
      />
      <MessageContent>
        <p>{greetingMessage || 'Hello! How can I help you today?'}</p>
        <div className="mt-4">
          <p className="text-sm text-muted-foreground mb-3">
            Try one of these prompts to get started:
          </p>
          <div className="flex flex-wrap gap-2">
            {CALENDAR_SUGGESTIONS.map((suggestion) => (
              <Suggestion
                key={suggestion}
                suggestion={suggestion}
                onClick={() => onSuggestionClick(suggestion)}
                disabled={status === 'streaming'}
                size="sm"
                className="text-xs"
              />
            ))}
          </div>
        </div>
      </MessageContent>
    </Message>
  );
}
