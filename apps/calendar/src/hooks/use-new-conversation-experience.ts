/**
 * New Conversation Experience Hook
 *
 * Implements the new conversation experience from the spec:
 * - Shows greeting message on load
 * - No message history retrieval
 * - Transitions to normal mode after first message
 */

import { useConversationSelection } from '@/store/chat';

interface UseNewConversationExperienceProps {
  selectedPersonaId: string | null;
  personas: Array<{ id: string; greeting?: string | null }>;
}

export function useNewConversationExperience({
  selectedPersonaId,
  personas,
}: UseNewConversationExperienceProps) {
  const {
    selectedConversationId,
    setSelectedConversationId,
    draftConversationId,
    setDraftConversationId,
  } = useConversationSelection();

  // Get the current persona
  const selectedPersona = selectedPersonaId
    ? personas.find((p) => p.id === selectedPersonaId)
    : null;

  // Determine if this is a new conversation (no existing conversation selected)
  const isNewConversation = !selectedConversationId;

  // Get greeting message for new conversations
  const getGreetingMessage = () => {
    if (!isNewConversation || !selectedPersona) return null;

    // Return persona greeting or default
    return selectedPersona.greeting || 'Hello! How can I help you today?';
  };

  // Handle transition from new conversation to normal mode
  const handleFirstMessageSent = () => {
    if (isNewConversation && draftConversationId) {
      // Set the draft conversation as the selected conversation
      setSelectedConversationId(draftConversationId);
      setDraftConversationId(null);
    }
  };

  return {
    isNewConversation,
    greetingMessage: getGreetingMessage(),
    handleFirstMessageSent,
  };
}
