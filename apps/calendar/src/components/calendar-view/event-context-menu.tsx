"use client";

import React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuCheckboxItem,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuLabel,
} from "@/components/ui/context-menu";
import { Video, PersonStanding, Trash2, Edit } from "lucide-react";
import type { ClientCategory } from "@/lib/data-v2";

type ShowTimeAs = 'free' | 'tentative' | 'busy' | 'oof' | 'working_elsewhere';

export interface EventContextMenuProps {
  children: React.ReactNode;
  eventId: string;
  isSelected: boolean;
  selectedEventCount: number;
  selectedIsOnlineMeeting?: boolean;
  selectedIsInPerson?: boolean;
  userCategories?: ClientCategory[];
  onSelectEvent: (eventId: string, multi: boolean) => void;
  onUpdateShowTimeAs: (showTimeAs: ShowTimeAs) => void;
  onUpdateCategory: (categoryId: string) => void;
  onUpdateIsOnlineMeeting: (isOnlineMeeting: boolean) => void;
  onUpdateIsInPerson: (isInPerson: boolean) => void;
  onDeleteSelected: () => void;
  onRenameSelected: () => void;
}

export function EventContextMenu({
  children,
  eventId,
  isSelected,
  selectedEventCount,
  selectedIsOnlineMeeting,
  selectedIsInPerson,
  userCategories = [],
  onSelectEvent,
  onUpdateShowTimeAs,
  onUpdateCategory,
  onUpdateIsOnlineMeeting,
  onUpdateIsInPerson,
  onDeleteSelected,
  onRenameSelected,
}: EventContextMenuProps) {
  const eventText = selectedEventCount === 1 ? "event" : "events";

  const handleOpenChange = (open: boolean) => {
    if (open && !isSelected) {
      // When context menu opens and this event is not selected, select it
      onSelectEvent(eventId, false);
    }
  };

  return (
    <ContextMenu onOpenChange={handleOpenChange}>
      <ContextMenuTrigger
        asChild
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent
        className="w-64"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        {selectedEventCount > 0 ? (
          <>
            <ContextMenuLabel onClick={(e) => e.stopPropagation()}>
              {selectedEventCount} {eventText} selected
            </ContextMenuLabel>
            <ContextMenuSeparator onClick={(e) => e.stopPropagation()} />
          </>
        ) : (
          <>
            <ContextMenuLabel onClick={(e) => e.stopPropagation()}>
              Event Options
            </ContextMenuLabel>
            <ContextMenuSeparator onClick={(e) => e.stopPropagation()} />
          </>
        )}

        {/* Show Time As */}
        <ContextMenuSub>
          <ContextMenuSubTrigger
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >Show Time As</ContextMenuSubTrigger>
          <ContextMenuSubContent
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <ContextMenuItem onClick={(e) => {
              e.stopPropagation();
              onUpdateShowTimeAs("busy");
            }}>
              Busy
            </ContextMenuItem>
            <ContextMenuItem onClick={(e) => {
              e.stopPropagation();
              onUpdateShowTimeAs("tentative");
            }}>
              Tentative
            </ContextMenuItem>
            <ContextMenuItem onClick={(e) => {
              e.stopPropagation();
              onUpdateShowTimeAs("free");
            }}>
              Free
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* Category */}
        <ContextMenuSub>
          <ContextMenuSubTrigger
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >Category</ContextMenuSubTrigger>
          <ContextMenuSubContent
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            {userCategories.length > 0 ? (
              userCategories.map((category) => (
                <ContextMenuItem
                  key={category.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateCategory(category.id);
                  }}
                >
                  <div className={`w-3 h-3 rounded ${
                    category.color === 'neutral' ? 'bg-neutral-500' :
                    category.color === 'slate' ? 'bg-slate-500' :
                    category.color === 'orange' ? 'bg-orange-500' :
                    category.color === 'yellow' ? 'bg-yellow-500' :
                    category.color === 'green' ? 'bg-green-500' :
                    category.color === 'blue' ? 'bg-blue-500' :
                    category.color === 'indigo' ? 'bg-indigo-500' :
                    category.color === 'violet' ? 'bg-violet-500' :
                    category.color === 'fuchsia' ? 'bg-fuchsia-500' :
                    category.color === 'rose' ? 'bg-rose-500' :
                    'bg-neutral-500'
                  }`}></div>
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
          >Meeting Type</ContextMenuSubTrigger>
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