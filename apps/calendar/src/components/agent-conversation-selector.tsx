import { Bot, Check, ChevronsUpDown, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getAvatarUrl } from '@/lib/avatar-utils';
import { getFriendlyTime, getMessageSnippet } from '@/lib/time-helpers';
import { cn } from '@/lib/utils';
import { type ChatConversation, useChatConversations } from '@/hooks/use-chat-conversations';

interface AgentConversationSelectorProps {
  // Agent props
  personas: any[];
  selectedPersonaId: string | null;
  onSelectPersona: (id: string) => void;

  // Conversation props
  conversations: ChatConversation[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

function getDisplayText(conversation: ChatConversation): string {
  if (conversation.title) {
    return conversation.title;
  }
  if (conversation.latest_message?.content) {
    return getMessageSnippet(conversation.latest_message.content);
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
  return 'New conversation';
}

export function AgentConversationSelector({
  personas,
  selectedPersonaId,
  onSelectPersona,
  conversations,
  selectedConversationId,
  onSelectConversation,
  onNewConversation,
}: AgentConversationSelectorProps) {
  const [open, setOpen] = useState(false);
  const { deleteConversation, isDeleting } = useChatConversations();

  const selectedPersona = selectedPersonaId
    ? personas.find((p) => p.id === selectedPersonaId)
    : null;

  const selectedConversation = selectedConversationId
    ? conversations.find((conv) => conv.id === selectedConversationId)
    : null;

  const handleDeleteConversation = async (conversationId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);

    try {
      await deleteConversation(conversationId);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleSelectPersona = (personaId: string) => {
    onSelectPersona(personaId);
    setOpen(false);
  };

  const handleSelectConversation = (conversationId: string) => {
    onSelectConversation(conversationId);
    setOpen(false);
  };

  const handleStartNewConversation = () => {
    onNewConversation();
    setOpen(false);
  };

  // Build the dropdown list for conversations
  const dropdownItems = [];

  // Add "New conversation" item if we're in new conversation mode
  if (selectedConversationId === null) {
    dropdownItems.push({
      id: '__NEW__',
      title: 'New conversation',
      isTemporary: true,
      createdAt: new Date().toISOString(),
      latest_message: null,
    });
  }

  // Add existing conversations
  dropdownItems.push(...conversations);

  // Display text for the trigger button
  const agentDisplayText = selectedPersona?.name || 'Select Agent';
  const conversationDisplayText = selectedConversationId === null
    ? 'New conversation'
    : selectedConversation
      ? getDisplayText(selectedConversation)
      : 'New conversation';

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      {/* Agent avatar */}
      <Avatar className="w-10 h-10 flex-shrink-0">
        <AvatarImage src={getAvatarUrl(selectedPersona?.avatar_url) || undefined} />
        <AvatarFallback>
          <Bot className="w-5 h-5" />
        </AvatarFallback>
      </Avatar>

      {/* Combined selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            aria-expanded={open}
            className="flex-1 h-auto p-2 justify-between text-left min-w-0"
          >
            <div className="flex flex-col min-w-0 flex-1">
              <div className="font-medium text-sm truncate">{agentDisplayText}</div>
              <div className="text-xs text-muted-foreground truncate">{conversationDisplayText}</div>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search agents and conversations..." className="h-9" />
            <CommandList>
              {/* Agents Section */}
              <CommandGroup heading="Agents">
                {personas.map((persona) => (
                  <CommandItem
                    key={persona.id}
                    value={persona.name}
                    onSelect={() => handleSelectPersona(persona.id)}
                    className="flex items-center py-2 cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 flex-shrink-0',
                        selectedPersonaId === persona.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <Avatar className="w-6 h-6 mr-2">
                      <AvatarImage src={getAvatarUrl(persona.avatar_url) || undefined} />
                      <AvatarFallback>
                        <Bot className="w-3 h-3" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{persona.name}</div>
                      {persona.is_default && (
                        <div className="text-xs text-muted-foreground">(Default)</div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandSeparator />

              {/* Conversations Section */}
              <CommandGroup heading="Conversations">
                {/* New conversation option */}
                <CommandItem
                  value="new-conversation"
                  onSelect={handleStartNewConversation}
                  className="flex items-center py-2 cursor-pointer"
                >
                  <Plus className="mr-2 h-4 w-4 flex-shrink-0" />
                  <MessageSquare className="w-4 h-4 mr-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">New conversation</div>
                    <div className="text-xs text-muted-foreground">Start a fresh chat</div>
                  </div>
                </CommandItem>

                {/* Existing conversations */}
                {dropdownItems.map((item) => {
                  const isSelected = selectedConversationId === item.id;
                  const isTemporary = (item as any).isTemporary;

                  return (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => handleSelectConversation(item.id)}
                      className="flex items-center py-2 cursor-pointer"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 flex-shrink-0',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <MessageSquare className="w-4 h-4 mr-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {isTemporary
                            ? 'New conversation'
                            : getDisplayText(item as ChatConversation)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isTemporary
                            ? 'Start typing to begin...'
                            : item.latest_message?.createdAt
                              ? getFriendlyTime(item.latest_message.createdAt)
                              : 'No messages'}
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
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}