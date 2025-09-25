import { useState, useEffect } from 'react'
import { MessageSquare, ChevronsUpDown, Check, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useConversationSelection, usePersonaSelection } from '@/store/chat'
import { useChatConversations, type ChatConversation } from '@/hooks/use-chat-conversations'
import { getFriendlyTime, getMessageSnippet } from '@/lib/time-helpers'
import {
  Command,
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
  isInNewConversationMode?: boolean
  newConversationId?: string | null
}

function getDisplayText(conversation: ChatConversation): string {
  if (conversation.title) {
    return conversation.title
  }
  if (conversation.latest_message?.content) {
    return getMessageSnippet(conversation.latest_message.content)
  }
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
  onCreateConversation,
  isInNewConversationMode = false,
  newConversationId = null
}: ConversationSelectorProps) {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const { selectedPersonaId } = usePersonaSelection()
  const {
    selectedConversationId,
    setSelectedConversationId,
    clearNewConversation
  } = useConversationSelection()

  const startNewConversation = () => {
    clearNewConversation() // This will clear conversation ID and reset isNewConversation flag
  }
  const { conversations, isLoading, deleteConversation, isDeleting } = useChatConversations()

  // Find the currently selected conversation
  const selectedConversation = selectedConversationId
    ? conversations.find(conv => conv.id === selectedConversationId)
    : null

  const handleDeleteConversation = async (conversationId: string, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setOpen(false)

    try {
      await deleteConversation(conversationId)
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId)
    setOpen(false)
  }

  const handleStartNewConversation = () => {
    startNewConversation()
    setOpen(false)
  }

  // Auto-start new conversation when no conversations exist - but only once
  useEffect(() => {
    if (conversations.length === 0 && !selectedConversationId && selectedPersonaId) {
      console.log('Auto-starting new conversation (no existing conversations)')
      startNewConversation()
    }
  }, [conversations.length, selectedConversationId, selectedPersonaId])

  // Build the dropdown list: temp "New conversation" + existing conversations
  const dropdownItems = []

  // Add the REAL new conversation item with the REAL generated ID
  if (isInNewConversationMode && newConversationId) {
    dropdownItems.push({
      id: newConversationId, // This is the REAL ID that will be sent to Mastra
      title: 'New conversation',
      isTemporary: true,
      createdAt: new Date().toISOString(),
      latest_message: null
    })
  }

  // Add existing conversations
  dropdownItems.push(...conversations)

  // Display text for the trigger button - always show real state
  const displayText = isInNewConversationMode
    ? 'New conversation'
    : selectedConversation
      ? getDisplayText(selectedConversation)
      : 'New conversation'  // Always fallback to new conversation

  return (
    <div className="w-full flex items-center gap-2">
      {/* Always show dropdown */}
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
              <span className="truncate min-w-0">{displayText}</span>
            </div>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0">
          <Command>
            <CommandInput placeholder="Search conversations..." className="h-9" />
            <CommandList>
              <CommandGroup>
                {dropdownItems.map((item) => {
                  const isSelected = selectedConversationId === item.id
                  const isTemporary = (item as any).isTemporary

                  return (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => handleSelectConversation(item.id)}
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
                          {isTemporary ? 'New conversation' : getDisplayText(item as ChatConversation)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {isTemporary
                            ? 'Start typing to begin...'
                            : (item.latest_message?.createdAt
                              ? getFriendlyTime(item.latest_message.createdAt)
                              : 'No messages')}
                        </div>
                      </div>
                      {!isTemporary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 h-6 w-6 p-0 opacity-60 hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={(e) => handleDeleteConversation(item.id, e)}
                          disabled={isDeleting}
                          title="Delete conversation"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Always show + button */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0 flex-shrink-0"
        onClick={handleStartNewConversation}
        title="New conversation"
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  )
}