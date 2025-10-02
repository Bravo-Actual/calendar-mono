import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { CompiledStateGraph } from "@langchain/langgraph";
import { tools } from "./utils/tools.js";

const model = new ChatOpenAI({
  model: "anthropic/claude-3.5-sonnet",
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://calendar-ai.local",
      "X-Title": "Calendar AI",
    },
  },
  streaming: true,
});

export const graph: CompiledStateGraph<any, any, any> = createReactAgent({ llm: model, tools });
