import { useState } from 'react'
import { Plus, MessageSquare, ChevronsUpDown, Check, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useConversationSelection, usePersonaSelection } from '@/store/chat'
import { useChatConversations, type ChatConversation } from '@/hooks/use-chat-conversations'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface ConversationSelectorProps {
  onCreateConversation?: () => void
}

function getMessageSnippet(content: unknown): string {
  if (typeof content === 'string') {
    try {
      // Try to parse as JSON first (Mastra stores as JSON string)
      const parsed = JSON.parse(content)

      // Handle Mastra message format with root-level content field
      if (parsed?.content && typeof parsed.content === 'string') {
        return parsed.content.slice(0, 60) + (parsed.content.length > 60 ? '...' : '')
      }

      // Handle parts array format
      if (parsed?.parts && Array.isArray(parsed.parts)) {
        const textPart = parsed.parts.find((p: unknown) => (p as {type?: string}).type === 'text')
        if (textPart?.text) {
          return textPart.text.slice(0, 60) + (textPart.text.length > 60 ? '...' : '')
        }
      }
    } catch {
      // If it's not JSON, treat as plain string
      return content.slice(0, 60) + (content.length > 60 ? '...' : '')
    }
  }

  // Handle already parsed object
  if (content?.content && typeof content.content === 'string') {
    return content.content.slice(0, 60) + (content.content.length > 60 ? '...' : '')
  }

  // Handle legacy/simple formats
  if (content?.text) {
    return content.text.slice(0, 60) + (content.text.length > 60 ? '...' : '')
  }

  // Handle parts array format
  if (content?.parts && Array.isArray(content.parts)) {
    const textPart = content.parts.find((p: unknown) => (p as {type?: string}).type === 'text')
    if (textPart?.text) {
      return textPart.text.slice(0, 60) + (textPart.text.length > 60 ? '...' : '')
    }
  }

  return 'New conversation'
}

function getDisplayText(conversation: ChatConversation): string {
  if (conversation.title) {
    return conversation.title
  }
  if (conversation.latest_message?.content) {
    return getMessageSnippet(conversation.latest_message.content)
  }
  // Show a better default for conversations without messages
  const dateStr = conversation.createdAt || conversation.created_at;

  if (dateStr) {
    try {
      const date = new Date(dateStr);
      const formattedDate = date.toLocaleDateString();
      return `Conversation ${formattedDate}`;
    } catch (error) {
      // Ignore date parsing errors
    }
  }

  return 'New conversation'
}

export function ConversationSelector({
  onCreateConversation
}: ConversationSelectorProps) {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const { selectedPersonaId } = usePersonaSelection()
  const { selectedConversationId, setSelectedConversationId, setWasStartedAsNew } = useConversationSelection()
  const { conversations, isLoading, deleteConversation, isDeleting, createConversation, isCreating } = useChatConversations()

  // Find the selected conversation from the list
  const selectedConversation = conversations.find(conv => conv.id === selectedConversationId)


  const handleDeleteConversation = async (conversationId: string, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    try {
      await deleteConversation(conversationId)
      // The conversation list will automatically refresh, and other components will handle state changes
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  const handleCreateNewConversation = () => {
    // Find the "new conversation" item and select it
    const newConversation = conversations.find(conv => conv.isNew)
    if (newConversation) {
      setSelectedConversationId(newConversation.id)
      setWasStartedAsNew(true)
    }
  }

  return (
    <div className="w-full flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 h-8 justify-between text-xs"
          >
            <div className="flex items-center gap-2 truncate">
              <MessageSquare className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">
                {selectedConversation
                  ? selectedConversation.isNew
                    ? "New conversation"
                    : (selectedConversation.title || getMessageSnippet(selectedConversation.latest_message?.content) || `Conversation ${new Date(selectedConversation.createdAt || selectedConversation.created_at || '').toLocaleDateString()}`)
                  : "Select conversation..."
                }
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0">
          <Command>
            <CommandInput placeholder="Search conversations..." className="h-9" />
            <CommandList>
              <CommandEmpty>
                <div className="flex flex-col items-center py-6">
                  <MessageSquare className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No conversations found.</p>
                </div>
              </CommandEmpty>

              <CommandGroup>
                {/* Show "New conversation" item only when user is currently in new conversation mode */}
                {selectedConversation?.isNew && (
                  <CommandItem
                    key="new-conversation"
                    value="new-conversation"
                    onSelect={() => {
                      // Already selected, no action needed
                      setOpen(false)
                    }}
                    className="flex items-center py-3 cursor-pointer"
                  >
                    <Check className="mr-3 h-4 w-4 flex-shrink-0 opacity-100" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        New conversation
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Start a fresh conversation
                      </div>
                    </div>
                  </CommandItem>
                )}

                {/* Show actual conversations */}
                {conversations.filter(conv => !conv.isNew).map((conversation) => {
                  const displayText = getDisplayText(conversation)
                  const isSelected = selectedConversationId === conversation.id

                  return (
                    <CommandItem
                      key={conversation.id}
                      value={conversation.id}
                      onSelect={(value) => {
                        setSelectedConversationId(conversation.id)
                        setWasStartedAsNew(false)
                        setOpen(false)
                      }}
                      className="flex items-center py-3 cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-3 h-4 w-4 flex-shrink-0",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {conversation.title || getMessageSnippet(conversation.latest_message?.content) || `Conversation ${new Date(conversation.createdAt || conversation.created_at || '').toLocaleDateString()}`}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {(() => {
                            // Show date of most recent message, not conversation creation
                            const dateStr = conversation.latest_message?.createdAt;
                            if (dateStr) {
                              try {
                                // Handle incomplete timezone by appending 'Z' if missing
                                const normalizedDateStr = dateStr.includes('Z') || dateStr.includes('+') || dateStr.includes('-')
                                  ? dateStr
                                  : dateStr + 'Z';
                                const date = new Date(normalizedDateStr);
                                return !isNaN(date.getTime()) ? date.toLocaleDateString() : '';
                              } catch {
                                return '';
                              }
                            }
                            return 'No messages';
                          })()}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 h-6 w-6 p-0 opacity-60 hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) => handleDeleteConversation(conversation.id, e)}
                        disabled={isDeleting}
                        title="Delete conversation"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* New Conversation Button */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0 flex-shrink-0"
        onClick={handleCreateNewConversation}
        title="New conversation"
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  )
}