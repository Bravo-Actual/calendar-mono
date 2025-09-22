import { useState } from 'react'
import { Plus, MessageSquare, ChevronsUpDown, Check, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useConversationSelection, usePersonaSelection } from '@/store/chat'
import { useChatConversations, type ChatConversation } from '@/hooks/use-chat-conversations'
import { getFriendlyTime, getMessageSnippet } from '@/lib/time-helpers'
import { getBestConversationForPersona } from '@/lib/conversation-helpers'
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

function getDisplayText(conversation: ChatConversation): string {
  if (conversation.title) {
    return conversation.title
  }
  if (conversation.latest_message?.content) {
    return getMessageSnippet(conversation.latest_message.content)
  }
  // Show a better default for conversations without messages
  const dateStr = conversation.createdAt;

  if (dateStr) {
    try {
      const date = new Date(dateStr);
      const formattedDate = date.toLocaleDateString();
      return `Conversation ${formattedDate}`;
    } catch {
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
  const { conversations, isLoading, deleteConversation, isDeleting, createConversation } = useChatConversations()

  // Find the selected conversation from the list
  const selectedConversation = conversations.find(conv => conv.id === selectedConversationId)


  const handleDeleteConversation = async (conversationId: string, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    // Close the dropdown immediately for better UX
    setOpen(false)

    try {
      // Remember if we're deleting the selected conversation
      const isDeletingSelected = conversationId === selectedConversationId

      // If we're deleting the selected conversation, clear selection first
      if (isDeletingSelected) {
        setSelectedConversationId(null)
        setWasStartedAsNew(false)
      }

      // Delete the conversation
      await deleteConversation(conversationId)

      // After deletion, if we had cleared the selection, we need to auto-select something
      // This will be handled by a useEffect that watches for null selection
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
            className="flex-1 h-8 justify-between text-xs min-w-0"
          >
            <div className="flex items-center gap-2 truncate min-w-0">
              <MessageSquare className="w-3 h-3 flex-shrink-0" />
              <span className="truncate min-w-0">
                {selectedConversation
                  ? selectedConversation.isNew
                    ? "New conversation"
                    : (selectedConversation.title || getMessageSnippet(selectedConversation.latest_message?.content) || `Conversation ${getFriendlyTime(selectedConversation.createdAt)}`)
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
                          {conversation.title || getMessageSnippet(conversation.latest_message?.content) || `Conversation ${getFriendlyTime(conversation.createdAt)}`}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {conversation.latest_message?.createdAt
                            ? getFriendlyTime(conversation.latest_message.createdAt)
                            : 'No messages'}
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