# Conversation System Implementation Plan

Based on the provided spec, this document outlines the complete implementation plan to fix the current broken conversation system.

## Current Problems to Fix

1. **State Management**: Chat store has wrong shape and logic
2. **Persona Selection**: Missing proper fallback hierarchy
3. **Conversation Selection**: Missing proper fallback logic and new conversation handling
4. **UI Components**: Conversation selector doesn't match spec
5. **API Integration**: Wrong guards and fetching logic in AI panel

## State Shape (Fix chat store)

```typescript
interface ChatStore {
  // Core state - matches spec exactly
  selectedPersonaId: string | null     // AI persona ID or NULL
  selectedConversationId: string | null // Thread/convo ID or NULL

  // UI state for new conversation experience
  isNewConversation: boolean           // True when showing new convo experience

  // Actions
  setSelectedPersonaId: (id: string | null) => void
  setSelectedConversationId: (id: string | null) => void
  setIsNewConversation: (isNew: boolean) => void
  startNewConversation: () => void
  clearNewConversation: () => void
}
```

## Persona Selection Logic

### On App Load Fallback Hierarchy:
1. Persisted selection from localStorage
2. User default persona (from database)
3. First available persona

### Behavior:
- Store `selectedPersonaId` in persistence
- When persona changes: Auto-select most recent conversation for that persona
- If no conversations exist for persona: Auto-start new conversation experience

## Conversation Selection Logic

### On App Load Fallback Hierarchy:
1. Persisted selection from localStorage
2. Most recent conversation for current persona
3. New conversation experience

### Behavior:
- Store `selectedConversationId` in persistence
- When conversation is deleted: Clear selection and fall back to most recent
- When persona changes: Auto-select most recent conversation for new persona

## New Conversation Experience

### Flow:
1. **Generate ID**: Use utility helper `conversation-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
2. **State**: Set `isNewConversation: true` and `selectedConversationId: generatedId`
3. **Display**: Show persona greeting message
4. **Header**: Show "New conversation" title with X button (if other conversations exist)
5. **No API calls**: Don't fetch messages for new conversations
6. **On first message**: Mastra creates thread with provided ID
7. **Transition**: Switch to normal mode once title/ID received from Mastra

### Important:
- New conversation IDs are REAL IDs that become Mastra thread IDs
- Never use fake "new-conversation-" prefixes
- Guard against API calls for new conversations using `isNewConversation` flag

## UI Component Updates

### Conversation Selector (`conversation-selector.tsx`)

#### Display Logic:
- **When conversations exist**: Show dropdown with current selection
- **When no conversations exist**: Show "New conversation" title only (no dropdown)
- **When in new conversation mode**: Show "New conversation" with X button to cancel

#### Actions:
- Select existing conversation: Set conversation ID and clear new conversation flag
- Start new conversation: Generate ID, set new conversation flag
- Cancel new conversation: Clear new conversation flag, select most recent conversation

### AI Assistant Panel (`ai-assistant-panel.tsx`)

#### Message Fetching:
- Only fetch for existing conversations: `selectedConversationId && !isNewConversation`
- Never fetch for new conversations (they don't exist in database yet)

#### Display Logic:
- **New conversations**: Show persona greeting message
- **Existing conversations**: Show fetched message history
- **Auto-selection**: Remove all auto-selection logic (conversation selector handles this)

#### Integration:
- Pure consumer of chat store state
- No state manipulation, only reads from store
- Let conversation selector be single source of truth

## Implementation Steps

### Step 1: Fix Chat Store (`src/store/chat.ts`)
- [ ] Update interface to match spec
- [ ] Add proper persistence for selectedPersonaId and selectedConversationId
- [ ] Add isNewConversation state management
- [ ] Add startNewConversation() and clearNewConversation() actions
- [ ] Remove wasStartedAsNew logic (replaced with isNewConversation)

### Step 2: Add Persona Selection Logic
- [ ] Create persona selection hook with fallback hierarchy
- [ ] Implement persona change handling that auto-selects conversations
- [ ] Add persona persistence and loading logic

### Step 3: Add Conversation Selection Logic
- [ ] Create conversation selection logic with fallback hierarchy
- [ ] Implement conversation change handling
- [ ] Add conversation persistence and loading logic
- [ ] Handle deleted conversation scenarios

### Step 4: Implement New Conversation Experience
- [ ] Add new conversation ID generation utility
- [ ] Implement greeting message display for new conversations
- [ ] Add transition logic when Mastra creates thread
- [ ] Add cancel new conversation functionality

### Step 5: Update Conversation Selector UI
- [ ] Implement display logic per spec (dropdown vs title only)
- [ ] Add "New conversation" header with X button
- [ ] Remove old fake conversation display logic
- [ ] Implement proper conversation selection actions

### Step 6: Fix AI Assistant Panel Integration
- [ ] Remove auto-selection logic (make it pure consumer)
- [ ] Fix message fetching guards to use isNewConversation
- [ ] Add greeting display for new conversations
- [ ] Clean up old conversation derivation logic

### Step 7: Clean Up Old Code
- [ ] Remove wasStartedAsNew logic throughout codebase
- [ ] Remove fake conversation ID generation/handling
- [ ] Remove old auto-selection logic from AI panel
- [ ] Clean up unused imports and functions

### Step 8: Test Complete Flow
- [ ] Test persona selection fallback hierarchy
- [ ] Test conversation selection fallback hierarchy
- [ ] Test new conversation creation and transition
- [ ] Test conversation switching and deletion
- [ ] Test persistence across page reloads

## Files to Update

1. `src/store/chat.ts` - Core state management
2. `src/components/conversation-selector.tsx` - UI component
3. `src/components/ai-assistant-panel.tsx` - Integration and display
4. `src/hooks/use-chat-conversations.ts` - Data fetching
5. `src/hooks/use-conversation-messages.ts` - Message fetching
6. `src/lib/conversation-helpers.ts` - Utility functions

## Success Criteria

✅ No 400 Bad Request errors for fake conversation IDs
✅ Proper persona selection with fallback hierarchy
✅ Proper conversation selection with fallback hierarchy
✅ New conversation experience works correctly
✅ Conversation selector UI matches spec exactly
✅ State persists correctly across page reloads
✅ All transitions work smoothly without errors