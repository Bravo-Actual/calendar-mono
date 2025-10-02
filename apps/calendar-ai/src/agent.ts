import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { CompiledStateGraph } from "@langchain/langgraph";
import { tools } from "./utils/tools.js";
import { env } from "./env.js";
import type { Persona } from "./storage/supabase.js";

// Default model configuration
const DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Create a dynamic agent graph based on persona configuration
 */
export function createAgentGraph(persona?: Persona): CompiledStateGraph<any, any, any> {
  const refererUrl = `http://${env.HOST}:${env.PORT}`;

  const model = new ChatOpenAI({
    model: persona?.model_id || DEFAULT_MODEL,
    apiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": refererUrl,
        "X-Title": "Calendar AI",
      },
    },
    streaming: true,
    temperature: persona?.temperature ?? DEFAULT_TEMPERATURE,
    topP: persona?.top_p ?? undefined,
  });

  return createReactAgent({ llm: model, tools });
}

// Default graph for backward compatibility
export const graph = createAgentGraph();
