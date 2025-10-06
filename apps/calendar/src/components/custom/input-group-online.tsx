'use client';

import { MessageSquare, Video, X } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export interface InputGroupOnlineProps {
  isOnline: boolean;
  joinLink?: string | null;
  chatLink?: string | null;
  onOnlineChange: (isOnline: boolean) => void;
  onJoinLinkChange: (link: string) => void;
  onChatLinkChange: (link: string) => void;
}

export function InputGroupOnline({
  isOnline,
  joinLink,
  chatLink,
  onOnlineChange,
  onJoinLinkChange,
  onChatLinkChange,
}: InputGroupOnlineProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  // Local state for editing (uncommitted changes)
  const [localIsOnline, setLocalIsOnline] = React.useState(isOnline);
  const [localJoinLink, setLocalJoinLink] = React.useState(joinLink || '');
  const [localChatLink, setLocalChatLink] = React.useState(chatLink || '');

  // Reset local state when popover opens
  React.useEffect(() => {
    if (open) {
      setLocalIsOnline(isOnline);
      setLocalJoinLink(joinLink || '');
      setLocalChatLink(chatLink || '');
    }
  }, [open, isOnline, joinLink, chatLink]);

  React.useEffect(() => {
    if (!triggerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(triggerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const handleJoinClick = () => {
    if (joinLink) {
      window.open(joinLink, '_blank', 'noopener,noreferrer');
    }
  };

  const handleChatClick = () => {
    if (chatLink) {
      window.open(chatLink, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const handleDone = () => {
    // Commit changes to parent
    onOnlineChange(localIsOnline);
    onJoinLinkChange(localJoinLink);
    onChatLinkChange(localChatLink);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <InputGroup ref={triggerRef} className="h-9 items-center cursor-pointer">
          <InputGroupAddon align="inline-start">
            <span className="text-muted-foreground [&>svg]:size-4">
              <Video />
            </span>
            <Label className="text-sm text-muted-foreground cursor-pointer">Online:</Label>
          </InputGroupAddon>
          <div className="flex flex-1 items-center justify-between px-2 cursor-pointer min-w-0 gap-2">
            <span className={cn('text-sm', !isOnline && 'text-muted-foreground')}>
              {isOnline ? 'Yes' : 'No'}
            </span>
            {isOnline && (
              <div
                className="flex items-center gap-1 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {joinLink && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-6 px-2 gap-1"
                    onClick={handleJoinClick}
                  >
                    <Video className="h-3 w-3" />
                    <span className="text-xs">Join</span>
                  </Button>
                )}
                {chatLink && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-6 px-2 gap-1"
                    onClick={handleChatClick}
                  >
                    <MessageSquare className="h-3 w-3" />
                    <span className="text-xs">Chat</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </InputGroup>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="p-4"
        style={{ width: width > 0 ? `${width}px` : 'auto' }}
        sideOffset={4}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="online-toggle" className="text-sm font-medium">
              Online Meeting
            </Label>
            <Switch id="online-toggle" checked={localIsOnline} onCheckedChange={setLocalIsOnline} />
          </div>

          {localIsOnline && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="join-link" className="text-sm">
                    Join Link
                  </Label>
                  <div className="relative">
                    <Input
                      id="join-link"
                      type="url"
                      placeholder="https://meet.example.com/abc-123"
                      value={localJoinLink}
                      onChange={(e) => setLocalJoinLink(e.target.value)}
                      className="pr-8"
                    />
                    {localJoinLink && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocalJoinLink('')}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="chat-link" className="text-sm">
                    Chat Link
                  </Label>
                  <div className="relative">
                    <Input
                      id="chat-link"
                      type="url"
                      placeholder="https://chat.example.com/room/123"
                      value={localChatLink}
                      onChange={(e) => setLocalChatLink(e.target.value)}
                      className="pr-8"
                    />
                    {localChatLink && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocalChatLink('')}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="default" size="sm" onClick={handleDone}>
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
