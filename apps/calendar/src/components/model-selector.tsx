'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useAIModels, type ModelProvider } from '@/hooks/use-ai-models'

interface ModelSelectorProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function ModelSelector({ value, onValueChange, placeholder = "Select an AI model...", className }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider>('all')

  const { models, getModelsByProvider } = useAIModels()
  const selectedModel = models.find(m => m.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
        >
          {selectedModel ? (
            <div className="flex items-center gap-2 truncate">
              <span className="truncate">{selectedModel.name}</span>
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {selectedModel.provider}
              </span>
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Search models by name..." className="h-9" />

          {/* Provider Filter Buttons */}
          <div className="flex flex-wrap gap-1 p-2 border-b">
            {[
              { id: 'all', label: 'All' },
              { id: 'x-ai', label: 'Grok' },
              { id: 'openai', label: 'OpenAI' },
              { id: 'anthropic', label: 'Anthropic' },
              { id: 'google', label: 'Gemini' },
            ].map((provider) => (
              <Button
                key={provider.id}
                variant={selectedProvider === provider.id ? "default" : "outline"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setSelectedProvider(provider.id as ModelProvider)}
              >
                {provider.label}
              </Button>
            ))}
          </div>

          <CommandList className="max-h-[300px]">
            <CommandEmpty>No models found.</CommandEmpty>

            {/* Filtered Models */}
            <CommandGroup>
              {getModelsByProvider(selectedProvider).map((model) => (
                <CommandItem
                  key={model.id}
                  value={`${model.name} ${model.id} ${model.provider}`}
                  onSelect={() => {
                    onValueChange(model.id)
                    setOpen(false)
                  }}
                  className="flex items-center py-3"
                >
                  <Check
                    className={cn(
                      "mr-3 h-4 w-4 flex-shrink-0",
                      value === model.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{model.name}</span>
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {model.provider}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {model.id}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {model.contextLength && (
                        <span>{Math.floor(model.contextLength / 1000)}k context</span>
                      )}
                      {model.supportsTools && (
                        <span className="text-green-600">✓ Tools</span>
                      )}
                      {model.supportsTemperature && (
                        <span className="text-blue-600">✓ Temperature</span>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}