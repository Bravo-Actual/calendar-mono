import { z } from "zod";

const envSchema = z.object({
  HOST: z.string().default("localhost"),
  PORT: z.string().default("3030"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  OPENROUTER_API_KEY: z.string(),
});

export const env = envSchema.parse(process.env);
