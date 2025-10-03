import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import { env } from "./env.js";
import type { Persona } from "./storage/supabase.js";

// Default model configuration
const DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Create a dynamic agent graph based on persona configuration
 * @param persona Optional persona configuration for model settings
 * @param tools Tools to provide to the agent (should include calendar and memory tools)
 */
export function createAgentGraph(
  persona: Persona | undefined,
  tools: DynamicStructuredTool[]
): ReturnType<typeof createReactAgent> {
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
