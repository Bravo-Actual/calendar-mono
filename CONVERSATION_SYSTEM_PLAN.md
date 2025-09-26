# Conversation System Simplification Plan

## Current Problem
The conversation system has become a clusterfuck with 15+ different flags, states, and competing logic:
- `selectedConversationId`
- `isNewConversation`
- `localNewConversationId`
- `isInNewConversationMode`
- Multiple useEffects fighting each other
- `useConversationSelectionLogic` that overrides user actions
- Auto-selection logic that interferes with manual selection

**Result**: + button doesn't work, state flickers, competing logic makes it unpredictable.

## Simplified Solution

### Core Principle
**ONE source of truth**: `selectedConversationId` in Zustand store
- `null` = new conversation mode
- `string` = existing conversation

### State Management

#### Zustand Store (chat.ts)
```typescript
interface ChatStore {
  selectedPersonaId: string | null
  selectedConversationId: string | null  // null = new conversation, string = existing

  setSelectedPersonaId: (id: string | null) => void
  setSelectedConversationId: (id: string | null) => void
}
```

#### Component State (AI Assistant Panel)
- NO local state for conversation management
- ONE computed value: `isNewConversation = selectedConversationId === null`

### User Flows

#### 1. User clicks + button
1. Set `selectedConversationId = null`
2. Component renders greeting message
3. User types message → useChat generates temp ID → sends to Mastra
4. When Mastra responds → real conversation ID comes back → set `selectedConversationId = realId`

#### 2. No conversations exist for persona
1. `selectedConversationId` stays `null` (default)
2. Component shows greeting message

#### 3. User selects existing conversation
1. Set `selectedConversationId = conversationId`
2. Component fetches and shows messages

#### 4. Browser refresh
1. Zustand persists `selectedPersonaId` and `selectedConversationId` to localStorage
2. On load, if `selectedConversationId` exists and conversation still exists in DB → show it
3. If conversation no longer exists or is `null` → show new conversation mode

### Component Logic

#### AI Assistant Panel
```typescript
function AIAssistantPanel() {
  const { selectedPersonaId, selectedConversationId, setSelectedConversationId } = useConversationSelection()

  // ONLY state computation needed
  const isNewConversation = selectedConversationId === null

  // Fetch conversations for dropdown
  const { conversations } = useChatConversations()

  // Only fetch messages if we have a conversation ID
  const { messages: storedMessages } = useConversationMessages(selectedConversationId)

  // useChat with conversation ID
  const { messages, sendMessage } = useChat({
    id: selectedConversationId || undefined
  })

  return (
    <div>
      <ConversationSelector
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={setSelectedConversationId}
        onNewConversation={() => setSelectedConversationId(null)}
      />

      {isNewConversation ? (
        <GreetingMessage />
      ) : (
        <MessageList messages={[...storedMessages, ...messages]} />
      )}
    </div>
  )
}
```

#### Conversation Selector
```typescript
function ConversationSelector({ conversations, selectedConversationId, onSelectConversation, onNewConversation }) {
  const displayText = selectedConversationId === null
    ? "New conversation"
    : conversations.find(c => c.id === selectedConversationId)?.title || "Unknown conversation"

  return (
    <div>
      <Button>{displayText}</Button>
      <Button onClick={onNewConversation}>+</Button>
      <Dropdown>
        {selectedConversationId === null && <DropdownItem>New conversation</DropdownItem>}
        {conversations.map(conv => <DropdownItem onClick={() => onSelectConversation(conv.id)}>{conv.title}</DropdownItem>)}
      </Dropdown>
    </div>
  )
}
```

### Transition Logic

#### New → Existing Conversation
1. User in new conversation mode (`selectedConversationId = null`)
2. User sends first message
3. useChat generates local ID, sends to Mastra
4. Mastra creates conversation and responds with real conversation ID
5. In useChat `onFinish`: `setSelectedConversationId(realConversationId)`
6. Component switches from greeting to message view
7. Conversation selector updates to show conversation title

#### Persona Switch
1. When persona changes, check if current `selectedConversationId` belongs to new persona
2. If yes → keep it
3. If no → set to most recent conversation for new persona, or `null` if none exist

### What Gets Removed

#### Delete These Files/Hooks
- `useConversationSelectionLogic` - auto-selection logic that interferes
- `useNewConversationExperience` - unnecessary abstraction
- Any other conversation-related hooks that aren't `useChatConversations` or `useConversationMessages`

#### Remove These State Properties
- `isNewConversation` flag
- `localNewConversationId`
- `isInNewConversationMode` computed value
- Any UI loading states for conversations

#### Simplify These Components
- Remove all useEffects that try to "manage" conversation state
- Remove auto-selection logic
- Remove competing ID generation

### Benefits
1. **ONE source of truth** - no competing states
2. **Predictable** - null = new, string = existing, that's it
3. **Simple transitions** - just change the ID
4. **No flickering** - no competing useEffects
5. **Easy debugging** - one state to check
6. **Fewer moving parts** - 2 state properties instead of 15

### Implementation Steps
1. Simplify Zustand store
2. Remove all competing hooks and useEffects
3. Rewrite AI Assistant Panel with simplified logic
4. Rewrite Conversation Selector with props instead of hooks
5. Test the two main flows: + button and existing conversation selection
6. Remove unused files and state properties

This plan eliminates the chaos and gives us a simple, predictable system that actually works.