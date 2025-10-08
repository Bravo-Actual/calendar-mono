import { Bot, Check, ChevronsUpDown, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import { useAuth } from '@/contexts/AuthContext';
import { getAvatarUrl } from '@/lib/avatar-utils';
import { type ClientThread, deleteAIThread, useAIPersonas, useAIThreads } from '@/lib/data-v2';
import { getFriendlyTime } from '@/lib/time-helpers';
import { cn } from '@/lib/utils';

interface AgentConversationSelectorProps {
  // Agent props
  selectedPersonaId: string | null;
  onSelectPersona: (id: string) => void;

  // Thread props
  selectedThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
}

function getDisplayText(thread: ClientThread): string {
  if (thread.title) {
    return thread.title;
  }
  const formattedDate = thread.created_at.toLocaleDateString();
  return `Conversation ${formattedDate}`;
}

export function AgentConversationSelector({
  selectedPersonaId,
  onSelectPersona,
  selectedThreadId,
  onSelectThread,
  onNewThread,
}: AgentConversationSelectorProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const personas = useAIPersonas(user?.id) || [];
  const threads = useAIThreads(user?.id, selectedPersonaId || undefined) || [];

  // Filter function that matches from start of words
  const filterItems = (value: string, search: string) => {
    if (!search) return 1;
    const normalizedValue = value.toLowerCase();
    const normalizedSearch = search.toLowerCase();

    // Split into words and check if any word starts with search
    const words = normalizedValue.split(/\s+/);
    return words.some((word) => word.startsWith(normalizedSearch)) ? 1 : 0;
  };

  const selectedPersona = selectedPersonaId
    ? personas.find((p) => p.id === selectedPersonaId)
    : null;

  const selectedThread = selectedThreadId
    ? threads.find((t) => t.thread_id === selectedThreadId)
    : null;

  const handleDeleteThread = async (threadId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);

    if (!user?.id) return;

    try {
      setIsDeleting(true);
      await deleteAIThread(user.id, threadId);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectPersona = (personaId: string) => {
    onSelectPersona(personaId);
    setOpen(false);
  };

  const handleSelectThread = (conversationId: string) => {
    onSelectThread(conversationId);
    setOpen(false);
  };

  const handleStartNewThread = () => {
    onNewThread();
    setOpen(false);
  };

  // Display text for the trigger button
  const agentDisplayText = selectedPersona?.name || 'Select Agent';
  const threadDisplayText =
    selectedThreadId === null
      ? 'New conversation'
      : selectedThread
        ? getDisplayText(selectedThread)
        : 'New conversation';

  return (
    <div className="flex items-center flex-1 min-w-0">
      {/* Combined selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            aria-expanded={open}
            className="flex-1 h-12 p-2 justify-between text-left min-w-0 gap-3 overflow-hidden"
          >
            {/* Agent avatar */}
            <div className="w-10 h-10 flex-shrink-0 relative">
              <AnimatePresence initial={false}>
                <motion.div
                  key={selectedPersonaId || 'no-persona'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute inset-0"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={getAvatarUrl(selectedPersona?.avatar_url) || undefined} />
                    <AvatarFallback>
                      <Bot className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex flex-col min-w-0 flex-1 relative h-10">
              <AnimatePresence initial={false}>
                <motion.div
                  key={`${selectedPersonaId}-${selectedThreadId}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute inset-0 flex flex-col justify-center"
                >
                  <div className="font-medium text-sm truncate">{agentDisplayText}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {threadDisplayText}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="end">
          <Command filter={filterItems}>
            <CommandInput
              placeholder="Search agents and conversations..."
              className="h-9"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-[600px]">
              {/* Agents Section */}
              <CommandGroup heading="Agents" className="[&_[cmdk-item]]:mb-[2px]">
                {personas.map((persona) => (
                  <CommandItem
                    key={persona.id}
                    value={persona.name}
                    onSelect={() => handleSelectPersona(persona.id)}
                    className={cn(
                      'flex items-center py-2 cursor-pointer',
                      selectedPersonaId === persona.id && 'bg-accent'
                    )}
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

              {/* New Conversation Section */}
              <CommandGroup className="[&_[cmdk-item]]:mb-[2px]">
                <CommandItem
                  value="new-conversation"
                  onSelect={handleStartNewThread}
                  className="flex items-center py-2 cursor-pointer"
                >
                  <Check className="mr-2 h-4 w-4 flex-shrink-0 opacity-0" />
                  <div className="w-6 h-6 mr-2 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">New conversation</div>
                    <div className="text-xs text-muted-foreground">Start a fresh chat</div>
                  </div>
                </CommandItem>
              </CommandGroup>

              <CommandSeparator />

              {/* Existing Conversations Section */}
              <CommandGroup heading="Conversations" className="[&_[cmdk-item]]:mb-[2px]">
                {threads.map((thread) => {
                  const isSelected = selectedThreadId === thread.thread_id;
                  const displayText = getDisplayText(thread);

                  return (
                    <CommandItem
                      key={thread.thread_id}
                      value={displayText}
                      onSelect={() => handleSelectThread(thread.thread_id)}
                      className={cn(
                        'flex items-center py-2 cursor-pointer',
                        isSelected && 'bg-accent'
                      )}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 flex-shrink-0',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="w-6 h-6 mr-2 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{displayText}</div>
                        <div className="text-xs text-muted-foreground">
                          {getFriendlyTime(thread.updated_at)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 h-6 w-6 p-0 opacity-60 hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) => handleDeleteThread(thread.thread_id, e)}
                        disabled={isDeleting}
                        title="Delete conversation"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
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
