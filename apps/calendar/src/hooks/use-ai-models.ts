import { useEffect, useState } from 'react'

export interface AIModel {
  id: string
  name: string
  contextLength?: number
  provider?: string
  supportsTools?: boolean
  supportsTemperature?: boolean
  pricing?: {
    prompt?: number
    completion?: number
  }
}

export type ModelProvider = 'all' | 'openai' | 'anthropic' | 'x-ai' | 'google'

export function useAIModels() {
  const [allModels, setAllModels] = useState<AIModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchModels() {
      try {
        setLoading(true)
        setError(null)

        // Fetch from OpenRouter API directly
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || 'dummy-key'}`,
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`)
        }

        const { data: rawModels } = await response.json()

        // Transform OpenRouter models to our format and filter for tool + temperature support
        const transformedModels: AIModel[] = rawModels
          .filter((model: any) => {
            // Filter for models that support tools and temperature
            const supportsTools = model.architecture?.modality?.includes('text->text') &&
                                 (model.id.includes('gpt-4') ||
                                  model.id.includes('gpt-3.5') ||
                                  model.id.includes('claude') ||
                                  model.id.includes('grok') ||
                                  model.id.includes('gemini'))

            const supportsTemperature = true // Most models support temperature

            return supportsTools && supportsTemperature
          })
          .map((model: any) => ({
            id: model.id,
            name: model.name || model.id,
            contextLength: model.context_length,
            provider: getProviderFromId(model.id),
            supportsTools: true,
            supportsTemperature: true,
            pricing: model.pricing ? {
              prompt: parseFloat(model.pricing.prompt),
              completion: parseFloat(model.pricing.completion)
            } : undefined
          }))
          .sort((a, b) => {
            // Sort by provider then by name
            if (a.provider !== b.provider) {
              const providerOrder = ['x-ai', 'openai', 'anthropic', 'google']
              return providerOrder.indexOf(a.provider || '') - providerOrder.indexOf(b.provider || '')
            }
            return a.name.localeCompare(b.name)
          })

        setAllModels(transformedModels)
      } catch (err) {
        console.error('Error fetching AI models:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch models')

        // Fallback to curated models on error
        const fallbackModels: AIModel[] = [
          {
            id: 'x-ai/grok-3',
            name: 'Grok 3',
            contextLength: 128000,
            provider: 'x-ai',
            supportsTools: true,
            supportsTemperature: true
          },
          {
            id: 'x-ai/grok-3-mini',
            name: 'Grok 3 Mini',
            contextLength: 128000,
            provider: 'x-ai',
            supportsTools: true,
            supportsTemperature: true
          },
          {
            id: 'openai/gpt-4o',
            name: 'GPT-4o',
            contextLength: 128000,
            provider: 'openai',
            supportsTools: true,
            supportsTemperature: true
          },
          {
            id: 'openai/gpt-4o-mini',
            name: 'GPT-4o Mini',
            contextLength: 128000,
            provider: 'openai',
            supportsTools: true,
            supportsTemperature: true
          },
          {
            id: 'anthropic/claude-3.5-sonnet',
            name: 'Claude 3.5 Sonnet',
            contextLength: 200000,
            provider: 'anthropic',
            supportsTools: true,
            supportsTemperature: true
          },
          {
            id: 'google/gemini-pro-1.5',
            name: 'Gemini Pro 1.5',
            contextLength: 1000000,
            provider: 'google',
            supportsTools: true,
            supportsTemperature: true
          },
        ]
        setAllModels(fallbackModels)
      } finally {
        setLoading(false)
      }
    }

    fetchModels()
  }, [])

  return {
    models: allModels,
    loading,
    error,
    // Helper function to filter models by provider
    getModelsByProvider: (provider: ModelProvider) => {
      if (provider === 'all') return allModels
      return allModels.filter(model => model.provider === provider)
    }
  }
}

function getProviderFromId(modelId: string): string {
  if (modelId.startsWith('openai/') || modelId.includes('gpt')) return 'openai'
  if (modelId.startsWith('anthropic/') || modelId.includes('claude')) return 'anthropic'
  if (modelId.startsWith('x-ai/') || modelId.includes('grok')) return 'x-ai'
  if (modelId.startsWith('google/') || modelId.includes('gemini')) return 'google'
  if (modelId.includes('meta') || modelId.includes('llama')) return 'meta'
  return 'other'
}