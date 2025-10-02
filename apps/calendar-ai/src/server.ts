import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { chatRouter } from "./routes/chat.js";
import { threadsRouter } from "./routes/threads.js";

const app = express();

// Enable CORS for all origins (adjust in production)
app.use(cors());

app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// API routes
app.use("/api/chat", chatRouter);
app.use("/api/threads", threadsRouter);

app.listen(parseInt(env.PORT), env.HOST, () => {
  console.log(`🚀 Calendar AI server running on http://${env.HOST}:${env.PORT}`);
  console.log(`📊 Health: http://${env.HOST}:${env.PORT}/health`);
  console.log(`💬 Chat: http://${env.HOST}:${env.PORT}/api/chat`);
  console.log(`🧵 Threads: http://${env.HOST}:${env.PORT}/api/threads`);
});
