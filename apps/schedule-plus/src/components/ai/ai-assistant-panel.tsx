"use client"

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bot } from 'lucide-react'

export function AIAssistantPanel() {
  return (
    <div className="w-full h-full flex flex-col bg-background border-l border-border">
      {/* Header */}
      <div className="h-16 shrink-0 px-4 border-b border-border flex items-center">
        <div className="flex items-center gap-3 flex-1">
          <Avatar className="w-10 h-10">
            <AvatarFallback>
              <Bot className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-medium text-base">
              AI Assistant
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 p-4">
        <div className="text-center space-y-4">
          <div className="text-4xl">🤖</div>
          <h3 className="text-lg font-semibold">AI Assistant Panel</h3>
          <p className="text-muted-foreground">
            AI panel content temporarily removed for compilation.
          </p>
        </div>
      </div>
    </div>
  )
}