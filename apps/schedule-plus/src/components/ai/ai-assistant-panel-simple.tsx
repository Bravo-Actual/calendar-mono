import { useState } from 'react'
import { BotAdd24Regular } from '@fluentui/react-icons'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/store/app'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function AIAssistantPanelSimple() {
  const { user } = useAuth()
  const [input, setInput] = useState('')

  return (
    <div className="w-full h-full flex flex-col bg-background border-l border-border">
      {/* Header */}
      <div className="h-16 shrink-0 px-4 border-b border-border flex items-center">
        <div className="flex items-center gap-3 flex-1">
          <Avatar className="w-10 h-10">
            <AvatarFallback>
              <BotAdd24Regular className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-medium text-base">
              AI Assistant
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 min-h-0 p-4">
        <div className="text-center space-y-4">
          <div className="text-4xl">🤖</div>
          <h3 className="text-lg font-semibold">AI Assistant Ready</h3>
          <p className="text-muted-foreground">
            The AI assistant panel is now working! You can expand this to include full chat functionality.
          </p>
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4 bg-muted/20">
        <div className="flex gap-2">
          <Textarea
            placeholder="Ask me anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-muted/60 rounded-xl px-4 py-3 border border-border/50 resize-none min-h-[2.75rem] max-h-32"
            rows={1}
          />
          <Button
            disabled={!input?.trim()}
            size="icon"
            className="bg-primary hover:bg-primary/80 text-primary-foreground border-0 rounded-lg w-11 h-11 shrink-0"
            onClick={() => {
              console.log('Sending:', input)
              setInput('')
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  )
}