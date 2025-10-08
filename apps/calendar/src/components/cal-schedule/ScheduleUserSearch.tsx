'use client';

import { useState, useEffect } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/avatar-utils';
import { useUserProfileSearch } from '@/lib/data-v2/domains/user-profiles';
import { Search } from 'lucide-react';

interface ScheduleUserSearchProps {
  onSelectUser: (userId: string) => void;
  excludeUserIds?: string[]; // Users already added
}

export function ScheduleUserSearch({ onSelectUser, excludeUserIds = [] }: ScheduleUserSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Search for users
  const searchResults = useUserProfileSearch(searchQuery) || [];

  // Filter out already added users
  const filteredResults = searchResults.filter((result) => !excludeUserIds.includes(result.user_id));

  // Close dropdown when no search query
  useEffect(() => {
    if (!searchQuery) {
      setIsOpen(false);
    } else {
      setIsOpen(true);
    }
  }, [searchQuery]);

  const handleSelectUser = (userId: string) => {
    onSelectUser(userId);
    setSearchQuery('');
    setIsOpen(false);
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
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Add person..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          className="h-8 text-xs pl-7"
        />
      </div>

      {isOpen && filteredResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50">
          <Command className="rounded-lg border shadow-md bg-popover">
            <CommandList>
              {filteredResults.length === 0 ? (
                <CommandEmpty>No people found.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filteredResults.map((result) => {
                    const avatarUrl = getAvatarUrl(result.avatar_url || undefined);
                    const initials = getInitials(result.display_name || undefined, result.email);

                    return (
                      <CommandItem
                        key={result.user_id}
                        onSelect={() => handleSelectUser(result.user_id)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Avatar className="size-6">
                          <AvatarImage src={avatarUrl || undefined} />
                          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm">{result.display_name || result.email}</span>
                          {result.display_name && (
                            <span className="text-xs text-muted-foreground">{result.email}</span>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
