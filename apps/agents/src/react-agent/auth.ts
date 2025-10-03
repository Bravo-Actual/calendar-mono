import { Auth, HTTPException } from "@langchain/langgraph-sdk/auth";

export const auth = new Auth()
  .authenticate(async (request: Request) => {
    const authorization = request.headers.get("authorization");
    const token = authorization?.split(" ").at(-1);

    if (!token) {
      throw new HTTPException(401, { message: "Missing authorization token" });
    }

    // Return the JWT as the user identity
    // The JWT will be available in tools via config.configurable
    return {
      identity: token,
      jwt: token,
      is_authenticated: true,
    };
  })
  .on("*", ({ user }) => {
    // No resource filtering needed
    return {};
  });
