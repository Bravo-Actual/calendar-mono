"use client";

import React, { useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "./ui/command";
import { useCommandPaletteStore, type CommandResult } from "../store/app";
import { useAppStore } from "../store/app";
import {
  Search,
  Calendar,
  Clock,
  Settings,
  Sparkles,
  Plus,
  ArrowRight,
  Command,
  Loader2
} from "lucide-react";
import { cn } from "../lib/utils";

const getCommandIcon = (type: CommandResult['type']) => {
  switch (type) {
    case 'search': return Search;
    case 'command': return Command;
    case 'ai': return Sparkles;
    case 'action': return ArrowRight;
    default: return Search;
  }
};

const defaultCommands: CommandResult[] = [
  {
    id: 'create-event',
    title: 'Create New Event',
    description: 'Add a new event to your calendar',
    type: 'action',
    shortcut: 'Ctrl+N'
  },
  {
    id: 'toggle-view',
    title: 'Toggle Calendar View',
    description: 'Switch between 5-day and 7-day view',
    type: 'action',
    shortcut: 'V'
  },
  {
    id: 'go-today',
    title: 'Go to Today',
    description: 'Navigate to current date',
    type: 'action',
    shortcut: 'T'
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Open calendar settings',
    type: 'action'
  }
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
    setLoading,
    setResults,
    executeCommand,
  } = useCommandPaletteStore();

  const { setDays, days } = useAppStore();

  const [allCommands, setAllCommands] = useState<CommandResult[]>(defaultCommands);

  // Filter and search commands based on query
  const filterCommands = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      return defaultCommands;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allCommands.filter(cmd =>
      cmd.title.toLowerCase().includes(query) ||
      cmd.description?.toLowerCase().includes(query)
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
          type: 'command' as const
        }
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
            type: 'ai' as const
          },
          ...filtered
        ];
      }
    }

    return filtered;
  }, [allCommands]);

  // Handle command execution
  const handleExecuteCommand = useCallback((command: CommandResult) => {
    switch (command.id) {
      case 'create-event':
        // TODO: Implement create event functionality
        console.log('Create event');
        break;
      case 'toggle-view':
        setDays(days === 5 ? 7 : 5);
        break;
      case 'go-today':
        // TODO: Implement go to today
        console.log('Go to today');
        break;
      case 'settings':
        // TODO: Open settings
        console.log('Open settings');
        break;
      default:
        if (command.type === 'ai') {
          // TODO: Implement AI query
          console.log('AI Query:', command.title);
        } else if (command.type === 'command') {
          // TODO: Execute custom command
          console.log('Custom command:', command.title);
        }
        break;
    }
    executeCommand(command);
  }, [setDays, days, executeCommand]);

  // Update results when query changes
  useEffect(() => {
    const filtered = filterCommands(query);
    setResults(filtered);
  }, [query, filterCommands, setResults]);

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

  return (
    <AnimatePresence>
      {isOpen && (
        <CommandDialog
          open={isOpen}
          onOpenChange={closePalette}
          title="Command Palette"
          description="Search for commands, create events, or ask AI"
          showCloseButton={false}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
              mass: 0.8
            }}
            className="w-full"
          >
            <CommandInput
              placeholder="Type a command, search, or try '?' for AI..."
              value={query}
              onValueChange={setQuery}
              className="h-12"
            />
            <CommandList className="max-h-[400px]">
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
                          "cursor-pointer",
                          isSelected && "bg-accent text-accent-foreground"
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
                        {command.shortcut && (
                          <CommandShortcut>{command.shortcut}</CommandShortcut>
                        )}
                        {command.type === 'ai' && (
                          <Sparkles className="h-3 w-3 text-blue-500" />
                        )}
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
          </motion.div>
        </CommandDialog>
      )}
    </AnimatePresence>
  );
}