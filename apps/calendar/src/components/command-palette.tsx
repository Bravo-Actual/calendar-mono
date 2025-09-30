'use client';

import { ArrowRight, Command, Loader2, Search, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { type CommandResult, useAppStore, useCommandPaletteStore } from '../store/app';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from './ui/command';

const getCommandIcon = (type: CommandResult['type']) => {
  switch (type) {
    case 'search':
      return Search;
    case 'command':
      return Command;
    case 'ai':
      return Sparkles;
    case 'action':
      return ArrowRight;
    default:
      return Search;
  }
};

const defaultCommands: CommandResult[] = [
  {
    id: 'create-event',
    title: 'Create New Event',
    description: 'Add a new event to your calendar',
    type: 'action',
    shortcut: 'Ctrl+N',
  },
  {
    id: 'go-today',
    title: 'Go to Today',
    description: 'Navigate to current date',
    type: 'action',
    shortcut: 'T',
  },
  {
    id: 'next-period',
    title: 'Next',
    description: 'Go to next period',
    type: 'action',
    shortcut: 'Right',
  },
  {
    id: 'prev-period',
    title: 'Previous',
    description: 'Go to previous period',
    type: 'action',
    shortcut: 'Left',
  },
  {
    id: 'view-day',
    title: 'Day View',
    description: 'Switch to single day view',
    type: 'action',
    shortcut: 'D',
  },
  {
    id: 'view-week',
    title: 'Week View',
    description: 'Switch to 7-day week view',
    type: 'action',
    shortcut: 'W',
  },
  {
    id: 'view-workweek',
    title: 'Work Week',
    description: 'Switch to 5-day work week view',
    type: 'action',
    shortcut: 'Ctrl+W',
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Open calendar settings',
    type: 'action',
  },
];

export function CommandPalette() {
  const {
    isOpen,
    query,
    isLoading,
    results,
    selectedIndex,
    closePalette,
    setQuery,
    setLoading: _setLoading,
    setResults,
    executeCommand,
  } = useCommandPaletteStore();

  const {
    goToToday,
    nextPeriod,
    prevPeriod,
    setDateRangeView,
    setSettingsModalOpen
  } = useAppStore();

  const [allCommands, _setAllCommands] = useState<CommandResult[]>(defaultCommands);

  // Filter and search commands based on query
  const filterCommands = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) {
        return defaultCommands;
      }

      const query = searchQuery.toLowerCase();
      const filtered = allCommands.filter(
        (cmd) =>
          cmd.title.toLowerCase().includes(query) || cmd.description?.toLowerCase().includes(query)
      );

      // If query starts with '/', show command-specific results
      if (query.startsWith('/')) {
        const commandQuery = query.slice(1);
        return [
          ...filtered,
          {
            id: `cmd-${commandQuery}`,
            title: `Run Command: ${commandQuery}`,
            description: 'Execute a calendar command',
            type: 'command' as const,
          },
        ];
      }

      // If query starts with 'ai:' or '?', show AI query option
      if (query.startsWith('ai:') || query.startsWith('?')) {
        const aiQuery = query.startsWith('ai:') ? query.slice(3) : query.slice(1);
        if (aiQuery.trim()) {
          return [
            {
              id: `ai-${aiQuery}`,
              title: `Ask AI: ${aiQuery}`,
              description: 'Query the AI assistant',
              type: 'ai' as const,
            },
            ...filtered,
          ];
        }
      }

      return filtered;
    },
    [allCommands]
  );

  // Handle command execution
  const handleExecuteCommand = useCallback(
    (command: CommandResult) => {
      switch (command.id) {
        case 'create-event':
          // TODO: Implement create event functionality
          break;
        case 'go-today':
          goToToday();
          break;
        case 'next-period':
          nextPeriod();
          break;
        case 'prev-period':
          prevPeriod();
          break;
        case 'view-day':
          setDateRangeView('day', new Date());
          break;
        case 'view-week':
          setDateRangeView('week', new Date());
          break;
        case 'view-workweek':
          setDateRangeView('workweek', new Date());
          break;
        case 'settings':
          setSettingsModalOpen(true);
          break;
        default:
          if (command.type === 'ai') {
            // TODO: Implement AI query
          } else if (command.type === 'command') {
            // TODO: Execute custom command
          }
          break;
      }
      executeCommand(command);
    },
    [goToToday, nextPeriod, prevPeriod, setDateRangeView, setSettingsModalOpen, executeCommand]
  );

  // Update results when query changes or palette opens
  useEffect(() => {
    const filtered = filterCommands(query);
    setResults(filtered);
  }, [query, filterCommands, setResults]);

  // Initialize results when palette opens
  useEffect(() => {
    if (isOpen && results.length === 0) {
      setResults(defaultCommands);
    }
  }, [isOpen, results.length, setResults]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only listen when palette is closed for the open shortcut
      if (!isOpen && e.ctrlKey && e.key === '/') {
        e.preventDefault();
        useCommandPaletteStore.getState().openPalette();
        return;
      }

      // Only handle these when palette is open
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closePalette();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedCommand = results[selectedIndex];
        if (selectedCommand) {
          handleExecuteCommand(selectedCommand);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closePalette, results, selectedIndex, handleExecuteCommand]);

  return isOpen ? (
    <CommandDialog
      open={isOpen}
      onOpenChange={closePalette}
      title="Command Palette"
      description="Search for commands, create events, or ask AI"
      showCloseButton={false}
    >
      <div className="w-full">
        <CommandInput
          placeholder="Type a command, search, or try '?' for AI..."
          value={query}
          onValueChange={setQuery}
          className="h-12"
        />
        <CommandList className="h-[400px] overflow-y-auto">
          <CommandEmpty>
            {isLoading ? (
              <div className="flex items-center gap-2 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Searching...</span>
              </div>
            ) : (
              'No results found.'
            )}
          </CommandEmpty>

          {results.length > 0 && (
            <CommandGroup heading="Commands">
              {results.map((command, index) => {
                const Icon = getCommandIcon(command.type);
                const isSelected = index === selectedIndex;

                return (
                  <CommandItem
                    key={command.id}
                    value={command.id}
                    onSelect={() => handleExecuteCommand(command)}
                    className={cn(
                      'cursor-pointer',
                      isSelected && 'bg-accent text-accent-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <div className="flex-1">
                      <div className="font-medium">{command.title}</div>
                      {command.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {command.description}
                        </div>
                      )}
                    </div>
                    {command.shortcut && <CommandShortcut>{command.shortcut}</CommandShortcut>}
                    {command.type === 'ai' && <Sparkles className="h-3 w-3 text-blue-500" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {query && !results.length && !isLoading && (
            <CommandGroup heading="Suggestions">
              <CommandItem className="text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                <span>Try &apos;?&apos; or &apos;ai:&apos; prefix to ask AI</span>
              </CommandItem>
              <CommandItem className="text-muted-foreground">
                <Command className="h-4 w-4" />
                <span>Try &apos;/&apos; prefix for commands</span>
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </div>
    </CommandDialog>
  ) : null;
}
