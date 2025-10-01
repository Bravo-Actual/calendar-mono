'use client';

import { Edit, PersonStanding, Trash2, Video } from 'lucide-react';
import type React from 'react';
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { ClientCategory } from '@/lib/data-v2';
import type { ShowTimeAs } from '@/types';

export interface EventContextMenuProps {
  children: React.ReactNode;
  selectedEventCount: number;
  selectedIsOnlineMeeting?: boolean;
  selectedIsInPerson?: boolean;
  userCategories?: ClientCategory[];
  onUpdateShowTimeAs: (showTimeAs: ShowTimeAs) => void;
  onUpdateCategory: (categoryId: string) => void;
  onUpdateIsOnlineMeeting: (isOnlineMeeting: boolean) => void;
  onUpdateIsInPerson: (isInPerson: boolean) => void;
  onDeleteSelected: () => void;
  onRenameSelected: () => void;
}

export function EventContextMenu({
  children,
  selectedEventCount,
  selectedIsOnlineMeeting,
  selectedIsInPerson,
  userCategories = [],
  onUpdateShowTimeAs,
  onUpdateCategory,
  onUpdateIsOnlineMeeting,
  onUpdateIsInPerson,
  onDeleteSelected,
  onRenameSelected,
}: EventContextMenuProps) {
  const eventText = selectedEventCount === 1 ? 'event' : 'events';

  const handleOpenChange = (_open: boolean) => {
    // Don't auto-select events when context menu opens - rely on right-click selection preservation
  };

  return (
    <ContextMenu onOpenChange={handleOpenChange}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent
        className="w-64"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        onMouseEnter={(e) => e.stopPropagation()}
        onMouseLeave={(e) => e.stopPropagation()}
        onMouseOver={(e) => e.stopPropagation()}
        onMouseOut={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
      >
        {selectedEventCount > 0 ? (
          <>
            <ContextMenuLabel>
              {selectedEventCount} {eventText} selected
            </ContextMenuLabel>
            <ContextMenuSeparator />
          </>
        ) : (
          <>
            <ContextMenuLabel>Event Options</ContextMenuLabel>
            <ContextMenuSeparator />
          </>
        )}

        {/* Show Time As */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>Show Time As</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => onUpdateShowTimeAs('busy')}>Busy</ContextMenuItem>
            <ContextMenuItem onClick={() => onUpdateShowTimeAs('tentative')}>
              Tentative
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onUpdateShowTimeAs('free')}>Free</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* Category */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>Category</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {userCategories.length > 0 ? (
              userCategories.map((category) => (
                <ContextMenuItem
                  key={category.id}
                  onClick={() => {
                    onUpdateCategory(category.id);
                  }}
                >
                  <div
                    className={`w-3 h-3 rounded ${
                      category.color === 'neutral'
                        ? 'bg-neutral-500'
                        : category.color === 'slate'
                          ? 'bg-slate-500'
                          : category.color === 'orange'
                            ? 'bg-orange-500'
                            : category.color === 'yellow'
                              ? 'bg-yellow-500'
                              : category.color === 'green'
                                ? 'bg-green-500'
                                : category.color === 'blue'
                                  ? 'bg-blue-500'
                                  : category.color === 'indigo'
                                    ? 'bg-indigo-500'
                                    : category.color === 'violet'
                                      ? 'bg-violet-500'
                                      : category.color === 'fuchsia'
                                        ? 'bg-fuchsia-500'
                                        : category.color === 'rose'
                                          ? 'bg-rose-500'
                                          : 'bg-neutral-500'
                    }`}
                  ></div>
                  {category.name}
                </ContextMenuItem>
              ))
            ) : (
              <ContextMenuItem disabled onClick={(e) => e.stopPropagation()}>
                No categories available
              </ContextMenuItem>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* Meeting Type */}
        <ContextMenuSub>
          <ContextMenuSubTrigger
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            Meeting Type
          </ContextMenuSubTrigger>
          <ContextMenuSubContent
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <ContextMenuCheckboxItem
              checked={selectedIsOnlineMeeting || false}
              onCheckedChange={(checked) => {
                setTimeout(() => onUpdateIsOnlineMeeting(checked), 10);
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Video />
              Online Meeting
            </ContextMenuCheckboxItem>
            <ContextMenuCheckboxItem
              checked={selectedIsInPerson || false}
              onCheckedChange={(checked) => {
                setTimeout(() => onUpdateIsInPerson(checked), 10);
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <PersonStanding />
              In Person
            </ContextMenuCheckboxItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator onClick={(e) => e.stopPropagation()} />

        {/* Rename */}
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onRenameSelected();
          }}
        >
          <Edit />
          Rename {eventText}
        </ContextMenuItem>

        <ContextMenuSeparator onClick={(e) => e.stopPropagation()} />

        {/* Delete - using variant="destructive" for proper styling */}
        <ContextMenuItem
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteSelected();
          }}
        >
          <Trash2 />
          Delete {eventText}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
