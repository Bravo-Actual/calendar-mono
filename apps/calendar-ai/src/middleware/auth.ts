import { createClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";
import { env } from "../env.js";

export async function supabaseAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  (req as any).user = data.user;
  (req as any).supabase = supabase;
  next();
}
