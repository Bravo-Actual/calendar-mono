/**
 * Helper functions for conversation management logic
 */

import type { ChatConversation } from '@/hooks/use-chat-conversations';

/**
 * Parse conversation metadata safely
 */
export function parseConversationMetadata(conversation: ChatConversation): Record<string, any> {
  try {
    const metadata = typeof conversation.metadata === 'string'
      ? JSON.parse(conversation.metadata)
      : conversation.metadata;
    return metadata || {};
  } catch {
    return {};
  }
}

/**
 * Check if a conversation belongs to a specific persona
 */
export function conversationBelongsToPersona(
  conversation: ChatConversation,
  personaId: string
): boolean {
  // All conversations belong to a specific persona based on metadata
  const metadata = parseConversationMetadata(conversation);
  return metadata.personaId === personaId;
}

/**
 * Get all conversations for a specific persona (excluding "new" placeholder)
 */
export function getPersonaConversations(
  conversations: ChatConversation[],
  personaId: string
): ChatConversation[] {
  return conversations.filter(conv => {
    // Filter only real conversations
    return conversationBelongsToPersona(conv, personaId);
  });
}

/**
 * Get the "new conversation" placeholder
 */
export function getNewConversationPlaceholder(
  conversations: ChatConversation[]
): ChatConversation | null {
  // No "new conversation" placeholders in data layer - handled by UI
  return null;
}

/**
 * Find the best real conversation to select for a persona
 * Returns most recent existing conversation, or null if none exist
 * Does NOT fall back to "new" - that should be handled separately in UI
 */
export function getBestConversationForPersona(
  conversations: ChatConversation[],
  personaId: string
): string | null {
  // Try to find the most recent conversation for this persona
  const personaConversations = getPersonaConversations(conversations, personaId);
  if (personaConversations.length > 0) {
    return personaConversations[0].id; // Assumes conversations are already sorted by recency
  }

  // No real conversations exist
  return null;
}

/**
 * Check if we should auto-navigate to a different conversation
 * Returns the conversation ID to navigate to, or null if no navigation needed
 */
export function shouldAutoNavigate(
  currentConversationId: string | null,
  conversations: ChatConversation[],
  personaId: string
): string | null {
  // No auto-navigation if no persona selected
  if (!personaId) return null;

  // If no conversation selected, select best for persona
  if (!currentConversationId) {
    return getBestConversationForPersona(conversations, personaId);
  }

  // Check if current conversation still exists
  const currentConversation = conversations.find(conv => conv.id === currentConversationId);
  if (!currentConversation) {
    // Current conversation was deleted, find replacement
    return getBestConversationForPersona(conversations, personaId);
  }

  // Check if current conversation belongs to current persona
  if (!conversationBelongsToPersona(currentConversation, personaId)) {
    // Switching personas, select best for new persona
    return getBestConversationForPersona(conversations, personaId);
  }

  // No navigation needed - keep current selection
  return null;
}