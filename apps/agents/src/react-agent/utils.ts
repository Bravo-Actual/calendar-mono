import { initChatModel } from "langchain/chat_models/universal";
import { ChatOpenAI } from "@langchain/openai";

/**
 * Load a chat model from a fully specified name.
 * Supports OpenRouter via openrouter/ prefix
 * @param fullySpecifiedName - String in the format 'provider/model' or 'provider/account/provider/model'.
 * @returns A Promise that resolves to a BaseChatModel instance.
 */
export async function loadChatModel(
  fullySpecifiedName: string,
): Promise<ReturnType<typeof initChatModel>> {
  // Handle OpenRouter models
  if (fullySpecifiedName.startsWith("openrouter/")) {
    const modelName = fullySpecifiedName.slice("openrouter/".length);
    return new ChatOpenAI({
      modelName,
      openAIApiKey: process.env.OPENROUTER_API_KEY,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": "https://calendar.app",
          "X-Title": "Calendar AI",
        },
      },
    }) as any;
  }

  // Default LangChain universal model loading
  const index = fullySpecifiedName.indexOf("/");
  if (index === -1) {
    // If there's no "/", assume it's just the model
    return await initChatModel(fullySpecifiedName);
  } else {
    const provider = fullySpecifiedName.slice(0, index);
    const model = fullySpecifiedName.slice(index + 1);
    return await initChatModel(model, { modelProvider: provider });
  }
}
