import { useState } from 'react'
import { Plus, MessageSquare, ChevronsUpDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/app'
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
  selectedConversation?: ChatConversation | null
  onSelectConversation: (conversation: ChatConversation | null) => void
  onCreateConversation: () => void
}

function getMessageSnippet(content: any): string {
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
        const textPart = parsed.parts.find((p: any) => p.type === 'text')
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
    const textPart = content.parts.find((p: any) => p.type === 'text')
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
  console.log('🔍 [Date Debug] conversation object:', conversation);
  console.log('🔍 [Date Debug] dateStr:', dateStr);

  if (dateStr) {
    try {
      const date = new Date(dateStr);
      console.log('🔍 [Date Debug] parsed date:', date);
      const formattedDate = date.toLocaleDateString();
      console.log('🔍 [Date Debug] formatted date:', formattedDate);
      return `Conversation ${formattedDate}`;
    } catch (error) {
      console.log('🔍 [Date Debug] date parsing error:', error);
    }
  }

  return 'New conversation'
}

export function ConversationSelector({
  selectedConversation,
  onSelectConversation,
  onCreateConversation
}: ConversationSelectorProps) {
  const [open, setOpen] = useState(false)
  const { aiSelectedPersonaId } = useAppStore()
  const { conversations, isLoading, createConversation, isCreating } = useChatConversations(aiSelectedPersonaId)

  const handleCreateNew = async () => {
    setOpen(false)
    try {
      const newConversation = await createConversation({
        personaId: aiSelectedPersonaId || undefined
      })
      onSelectConversation(newConversation)
      onCreateConversation()
    } catch (error) {
      console.error('Failed to create conversation:', error)
    }
  }

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full h-8 justify-between text-xs"
          >
            <div className="flex items-center gap-2 truncate">
              <MessageSquare className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">
                {selectedConversation
                  ? getDisplayText(selectedConversation)
                  : "Select conversation..."
                }
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0">
          <Command value={selectedConversation?.id || ''}>
            <CommandInput placeholder="Search conversations..." className="h-9" />
            <CommandList>
              <CommandEmpty>
                <div className="flex flex-col items-center py-6">
                  <MessageSquare className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No conversations found.</p>
                </div>
              </CommandEmpty>

              <CommandGroup>
                {/* Create New Conversation Option */}
                <CommandItem
                  value="create-new-conversation"
                  onSelect={handleCreateNew}
                  className="flex items-center py-3 cursor-pointer"
                  disabled={isCreating}
                >
                  <Plus className="mr-3 h-4 w-4 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium">
                      {isCreating ? 'Creating...' : 'New conversation'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Start a fresh conversation
                    </div>
                  </div>
                </CommandItem>

                {/* Existing Conversations */}
                {conversations.map((conversation) => {
                  const displayText = getDisplayText(conversation)
                  const isSelected = selectedConversation?.id === conversation.id

                  return (
                    <CommandItem
                      key={conversation.id}
                      value={conversation.id}
                      onSelect={(value) => {
                        console.log('Command onSelect triggered - value:', value)
                        console.log('Selecting conversation:', conversation)
                        onSelectConversation(conversation)
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
                          {conversation.title || (
                            <span className="text-muted-foreground italic">
                              Untitled conversation
                            </span>
                          )}
                        </div>
                        {conversation.latest_message && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {getMessageSnippet(conversation.latest_message.content)}
                          </div>
                        )}
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
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}