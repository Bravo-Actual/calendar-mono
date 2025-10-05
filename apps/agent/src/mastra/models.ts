import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

// Initialize providers
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cache for OpenRouter models
let cachedModels: any[] | null = null;
let modelsCacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Fetch available models from OpenRouter API
async function fetchOpenRouterModels() {
  const now = Date.now();

  // Return cached models if still valid
  if (cachedModels && now - modelsCacheTime < CACHE_DURATION) {
    return cachedModels;
  }

  try {
    console.log('Fetching models from OpenRouter API...');
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = await response.json();
    cachedModels = data.data || [];
    modelsCacheTime = now;

    console.log(`Cached ${cachedModels.length} models from OpenRouter`);
    return cachedModels;
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error);
    // Return empty array if fetch fails
    return [];
  }
}

// Static fallback models (always available)
const STATIC_MODELS = {
  // OpenAI models (direct)
  'gpt-4-turbo': () => openai('gpt-4-turbo'),
  'gpt-4o': () => openai('gpt-4o'),
  'gpt-4o-mini': () => openai('gpt-4o-mini'),
  'gpt-3.5-turbo': () => openai('gpt-3.5-turbo'),

  // Popular OpenRouter models (fallback)
  'anthropic/claude-3.5-sonnet': () => openrouter('anthropic/claude-3.5-sonnet'),
  'anthropic/claude-3-opus': () => openrouter('anthropic/claude-3-opus'),
  'x-ai/grok-3-mini': () => openrouter('x-ai/grok-3-mini'),
  'meta-llama/llama-3.1-70b-instruct': () => openrouter('meta-llama/llama-3.1-70b-instruct'),
  'google/gemini-pro-1.5': () => openrouter('google/gemini-pro-1.5'),
};

// Dynamic model map that includes both static and API models
export const MODEL_MAP: Record<string, () => any> = new Proxy(
  {},
  {
    get(_target, prop: string) {
      // First check static models
      if (STATIC_MODELS[prop]) {
        return STATIC_MODELS[prop];
      }

      // For OpenRouter models, create factory on demand
      // This works for any model ID from OpenRouter
      if (prop.includes('/')) {
        return () => openrouter(prop);
      }

      // Default to OpenRouter with the model ID
      return () => openrouter(prop);
    },
  }
);

// Get list of available models (for UI/documentation)
export async function getAvailableModels(): Promise<
  { id: string; name: string; contextLength?: number }[]
> {
  const openRouterModels = await fetchOpenRouterModels();

  // Combine static models with OpenRouter models
  const staticModelList = Object.keys(STATIC_MODELS).map((id) => ({
    id,
    name: id,
    contextLength: 128000, // Default for OpenAI models
  }));

  const apiModelList = openRouterModels.map((model: any) => ({
    id: model.id,
    name: model.name || model.id,
    contextLength: model.context_length,
  }));

  return [...staticModelList, ...apiModelList];
}

// Filter models by capability (e.g., tool support)
export async function getModelsWithTools(): Promise<string[]> {
  const models = await fetchOpenRouterModels();

  // Filter models that support function calling/tools
  // This is based on OpenRouter's model capabilities
  const toolSupportedModels = models
    .filter((m: any) => {
      // Check for function calling support in model properties
      return (
        m.supported_features?.includes('tools') ||
        m.supported_features?.includes('function_calling') ||
        // Known models with tool support
        m.id.includes('gpt-4') ||
        m.id.includes('gpt-3.5') ||
        m.id.includes('claude-3') ||
        m.id.includes('gemini') ||
        m.id.includes('mistral')
      );
    })
    .map((m: any) => m.id);

  // Add known static models with tool support
  const staticWithTools = ['gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'];

  return [...staticWithTools, ...toolSupportedModels];
}

// Get default model based on requirements
export function getDefaultModel(requiresTools = false): string {
  if (requiresTools) {
    // Default to a model known to work well with tools
    return 'x-ai/grok-3-mini';
  }
  // Default general purpose model
  return 'openai/gpt-4o-mini';
}
