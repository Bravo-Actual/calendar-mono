'use client';

import { useMemo } from 'react';
import { MessageRenderer } from './message-renderer';

interface MessagesProcessorProps {
  conversationMessages: any[];
  messages: any[];
  selectedPersona: any;
  profile: any;
  user: any;
}

export function useProcessedMessages({
  conversationMessages,
  messages,
  selectedPersona,
  profile,
  user
}: MessagesProcessorProps) {
  return useMemo(() => {
    // Process stored messages to extract createdAt from metadata
    const processedStoredMessages = conversationMessages.map((msg: any) => ({
      ...msg,
      createdAt: msg.metadata?.createdAt || msg.createdAt
    }));

    // Process live messages to add current timestamp if missing
    const processedLiveMessages = messages
      .filter(msg => !conversationMessages.some(cm => cm.id === msg.id))
      .map((msg: any) => ({
        ...msg,
        createdAt: msg.createdAt || new Date().toISOString()
      }));

    const combinedMessages = [...processedStoredMessages, ...processedLiveMessages];

    // Sort messages chronologically (oldest first)
    const sortedMessages = combinedMessages.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return aTime - bTime;
    });

    return sortedMessages.map((message, messageIndex) => (
      <MessageRenderer
        key={`${message.id}-${messageIndex}`}
        message={message}
        messageIndex={messageIndex}
        selectedPersona={selectedPersona}
        profile={profile}
        user={user}
      />
    ));
  }, [
    conversationMessages,
    messages,
    selectedPersona,
    profile,
    user
  ]);
}