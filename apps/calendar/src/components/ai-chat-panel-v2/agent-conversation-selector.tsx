import { AnimatePresence, motion } from 'framer-motion';
import { Bot20Regular, Checkmark20Regular, ChevronUpDown20Regular, Comment20Regular, Add20Regular, Delete20Regular } from '@fluentui/react-icons';
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
      // Silently handle error - deletion may have succeeded
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
            className="flex-1 h-10 p-2 justify-between text-left min-w-0 gap-3 overflow-hidden"
          >
            {/* Agent avatar */}
            <div className="w-8 h-8 flex-shrink-0 relative">
              <AnimatePresence initial={false}>
                <motion.div
                  key={selectedPersonaId || 'no-persona'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute inset-0"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={getAvatarUrl(selectedPersona?.avatar_url) || undefined} />
                    <AvatarFallback>
                      <Bot20Regular className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex flex-col min-w-0 flex-1 relative h-8">
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
                  <div className="text-xs text-muted-foreground truncate">{threadDisplayText}</div>
                </motion.div>
              </AnimatePresence>
            </div>
            <ChevronUpDown20Regular className="ml-2 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 shadow-xl" align="end">
          <Command filter={filterItems}>
            <CommandInput
              placeholder="Search agents and conversations..."
              className="h-9"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-[500px]">
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
                    <Checkmark20Regular
                      className={cn(
                        'mr-2 h-4 w-4 flex-shrink-0',
                        selectedPersonaId === persona.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <Avatar className="w-6 h-6 mr-2">
                      <AvatarImage src={getAvatarUrl(persona.avatar_url) || undefined} />
                      <AvatarFallback>
                        <Bot20Regular className="size-3" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{persona.name}</div>
                    </div>
                  </CommandItem>
                ))}
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
                      <Checkmark20Regular
                        className={cn(
                          'mr-2 h-4 w-4 flex-shrink-0',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="w-6 h-6 mr-2 flex items-center justify-center flex-shrink-0">
                        <Comment20Regular className="size-5" />
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
                        <Delete20Regular className="size-3" />
                      </Button>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>

          {/* New Conversation - Fixed at bottom */}
          <div className="border-t">
            <Button
              variant="ghost"
              onClick={handleStartNewThread}
              className="w-full justify-start h-auto py-3 px-4 rounded-none hover:bg-accent"
            >
              <div className="w-6 h-6 mr-2 flex items-center justify-center flex-shrink-0">
                <Add20Regular className="size-5" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="font-medium">New conversation</div>
                <div className="text-xs text-muted-foreground">Start a fresh chat</div>
              </div>
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
