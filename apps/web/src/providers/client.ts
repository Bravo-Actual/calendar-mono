import { Client } from "@langchain/langgraph-sdk";

export function createClient(apiUrl: string, apiKey?: string, userJwt?: string) {
  return new Client({
    apiKey,
    apiUrl,
    ...(userJwt && {
      defaultHeaders: {
        authorization: `Bearer ${userJwt}`,
      },
    }),
  });
}
