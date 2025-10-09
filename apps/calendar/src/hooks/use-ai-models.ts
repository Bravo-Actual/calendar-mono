import { useEffect, useState } from 'react';

export interface AIModel {
  id: string;
  name: string;
  contextLength?: number;
  provider?: string;
  supportsTools?: boolean;
  supportsTemperature?: boolean;
  pricing?: {
    prompt?: number;
    completion?: number;
  };
}

export type ModelProvider = 'all' | 'openai' | 'anthropic' | 'x-ai' | 'google';

interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  architecture?: {
    modality?: string[];
  };
  pricing?: {
    prompt: string;
    completion: string;
  };
  supported_parameters?: string[];
}

export function useAIModels() {
  const [allModels, setAllModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchModels() {
      try {
        setLoading(true);
        setError(null);

        // Fetch from OpenRouter API with timeout and better error handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        let response;
        try {
          response = await fetch('https://openrouter.ai/api/v1/models', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || 'dummy-key'}`,
            },
            signal: controller.signal,
          });
        } catch (_fetchError) {
          clearTimeout(timeoutId);
          throw new Error('Network connection failed');
        }

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const responseData = await response.json();

        if (!responseData || !responseData.data) {
          throw new Error('Invalid API response format');
        }

        const { data: rawModels } = responseData;

        // Transform OpenRouter models to our format
        const transformedModels: AIModel[] = rawModels
          .map((model: OpenRouterModel) => {
            const supportedParams = model.supported_parameters || [];

            return {
              id: model.id,
              name: model.name || model.id,
              contextLength: model.context_length,
              provider: getProviderFromId(model.id),
              // Check if model supports tools/function calling
              supportsTools:
                supportedParams.includes('tools') || supportedParams.includes('tool_choice'),
              // Check if model supports temperature parameter
              supportsTemperature: supportedParams.includes('temperature'),
              pricing: model.pricing
                ? {
                    prompt: parseFloat(model.pricing.prompt),
                    completion: parseFloat(model.pricing.completion),
                  }
                : undefined,
            };
          })
          // Filter out models that don't support tools - required for our calendar assistant
          .filter((model: AIModel) => model.supportsTools)
          .sort((a: AIModel, b: AIModel) => {
            // Sort by provider then by name
            if (a.provider !== b.provider) {
              const providerOrder = ['x-ai', 'openai', 'anthropic', 'google'];
              return (
                providerOrder.indexOf(a.provider || '') - providerOrder.indexOf(b.provider || '')
              );
            }
            return a.name.localeCompare(b.name);
          });

        setAllModels(transformedModels);
      } catch (err) {
        console.error('Error fetching AI models:', err);

        // Provide specific error messages based on error type
        let errorMessage = 'Failed to fetch models';

        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            errorMessage = 'Request timed out - using fallback models';
          } else if (
            err.message.includes('Failed to fetch') ||
            err.message.includes('NetworkError')
          ) {
            errorMessage = 'Network error - check your internet connection. Using fallback models.';
          } else if (err.message.includes('API returned')) {
            errorMessage = `OpenRouter API error: ${err.message}. Using fallback models.`;
          } else {
            errorMessage = `Error: ${err.message}. Using fallback models.`;
          }
        }

        setError(errorMessage);

        // Fallback to curated models on error
        const fallbackModels: AIModel[] = [
          {
            id: 'x-ai/grok-3',
            name: 'Grok 3',
            contextLength: 128000,
            provider: 'x-ai',
            supportsTools: true,
            supportsTemperature: true,
          },
          {
            id: 'x-ai/grok-3-mini',
            name: 'Grok 3 Mini',
            contextLength: 128000,
            provider: 'x-ai',
            supportsTools: true,
            supportsTemperature: true,
          },
          {
            id: 'openai/gpt-4o',
            name: 'GPT-4o',
            contextLength: 128000,
            provider: 'openai',
            supportsTools: true,
            supportsTemperature: true,
          },
          {
            id: 'openai/gpt-4o-mini',
            name: 'GPT-4o Mini',
            contextLength: 128000,
            provider: 'openai',
            supportsTools: true,
            supportsTemperature: true,
          },
          {
            id: 'anthropic/claude-3.5-sonnet',
            name: 'Claude 3.5 Sonnet',
            contextLength: 200000,
            provider: 'anthropic',
            supportsTools: true,
            supportsTemperature: true,
          },
          {
            id: 'google/gemini-pro-1.5',
            name: 'Gemini Pro 1.5',
            contextLength: 1000000,
            provider: 'google',
            supportsTools: true,
            supportsTemperature: true,
          },
        ];
        setAllModels(fallbackModels);
      } finally {
        setLoading(false);
      }
    }

    fetchModels();
  }, []);

  return {
    models: allModels,
    loading,
    error,
    // Helper function to filter models by provider
    getModelsByProvider: (provider: ModelProvider) => {
      if (provider === 'all') return allModels;
      return allModels.filter((model) => model.provider === provider);
    },
  };
}

function getProviderFromId(modelId: string): string {
  if (modelId.startsWith('openai/') || modelId.includes('gpt')) return 'openai';
  if (modelId.startsWith('anthropic/') || modelId.includes('claude')) return 'anthropic';
  if (modelId.startsWith('x-ai/') || modelId.includes('grok')) return 'x-ai';
  if (modelId.startsWith('google/') || modelId.includes('gemini')) return 'google';
  if (modelId.includes('meta') || modelId.includes('llama')) return 'meta';
  return 'other';
}
