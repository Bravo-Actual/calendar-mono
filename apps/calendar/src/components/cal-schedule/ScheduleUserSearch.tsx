'use client';

import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getAvatarUrl } from '@/lib/avatar-utils';
import { useUserProfileSearch } from '@/lib/data-v2/domains/user-profiles';

interface ScheduleUserSearchProps {
  onSelectUser: (userId: string) => void;
  excludeUserIds?: string[]; // Users already added
}

export function ScheduleUserSearch({ onSelectUser, excludeUserIds = [] }: ScheduleUserSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search for users
  const searchResults = useUserProfileSearch(searchQuery) || [];

  // Filter out already added users
  const filteredResults = searchResults.filter(
    (result) => !excludeUserIds.includes(result.user_id)
  );

  // Close dropdown when no search query
  useEffect(() => {
    if (!searchQuery) {
      setIsOpen(false);
      setSelectedIndex(0);
    } else {
      setIsOpen(true);
    }
  }, [searchQuery]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, []);

  const handleSelectUser = (userId: string) => {
    onSelectUser(userId);
    setSearchQuery('');
    setIsOpen(false);
    setSelectedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredResults.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredResults.length) % filteredResults.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredResults[selectedIndex]) {
          handleSelectUser(filteredResults[selectedIndex].user_id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return email?.charAt(0).toUpperCase() || '?';
  };

  return (
    <Popover open={isOpen && filteredResults.length > 0} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Add person..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => searchQuery && setIsOpen(true)}
            className="h-8 text-xs pl-7"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command className="border-0">
          <CommandList>
            {filteredResults.length === 0 ? (
              <CommandEmpty>No people found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredResults.map((result, index) => {
                  const avatarUrl = getAvatarUrl(result.avatar_url || undefined);
                  const initials = getInitials(result.display_name || undefined, result.email);

                  return (
                    <CommandItem
                      key={result.user_id}
                      onSelect={() => handleSelectUser(result.user_id)}
                      className={`flex items-center gap-2 cursor-pointer ${
                        index === selectedIndex ? 'bg-accent' : ''
                      }`}
                    >
                      <Avatar className="size-6">
                        <AvatarImage src={avatarUrl || undefined} />
                        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm truncate">
                          {result.display_name || result.email}
                        </span>
                        {result.display_name && (
                          <span className="text-xs text-muted-foreground truncate">
                            {result.email}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
