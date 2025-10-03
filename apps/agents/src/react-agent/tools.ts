/**
 * This file defines the tools available to the ReAct agent.
 * Tools are functions that the agent can use to interact with external systems or perform specific tasks.
 */
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { createCalendarEventsTool } from "./calendar-tools.js";

/**
 * Tavily search tool configuration
 * This tool allows the agent to perform web searches using the Tavily API.
 */
const searchTavily = new TavilySearchResults({
  maxResults: 3,
});

/**
 * Create tools
 * JWT is extracted from RunnableConfig at tool call time
 */
export function createTools() {
  return [
    searchTavily,
    createCalendarEventsTool(),
  ];
}
