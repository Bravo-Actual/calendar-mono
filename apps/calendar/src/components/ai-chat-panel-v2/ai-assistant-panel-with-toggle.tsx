'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AIAssistantPanel } from '../ai-chat-panel/ai-assistant-panel';
import { AIAssistantPanelV2 } from './ai-assistant-panel-v2';

export function AIAssistantPanelWithToggle() {
  const [useV2, setUseV2] = useState(false);

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Version Toggle - Floating in top right */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-background/95 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 shadow-sm">
        <span className="text-xs font-medium text-muted-foreground">V1</span>
        <Switch checked={useV2} onCheckedChange={setUseV2} />
        <span className="text-xs font-medium text-muted-foreground">V2</span>
        <Badge variant={useV2 ? 'default' : 'secondary'} className="ml-1 text-[10px] px-1.5 py-0">
          {useV2 ? 'AI Elements' : 'Custom'}
        </Badge>
      </div>

      {/* Render selected version */}
      {useV2 ? <AIAssistantPanelV2 /> : <AIAssistantPanel />}
    </div>
  );
}
