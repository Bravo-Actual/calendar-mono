import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { chatRouter } from "./routes/chat.js";
import { threadsRouter } from "./routes/threads.js";
import fs from "fs";
import path from "path";

// Global error handlers to catch crashes
process.on('unhandledRejection', (reason, promise) => {
  const error = `Unhandled Rejection at: ${promise}, reason: ${reason}`;
  console.error('🔥 UNHANDLED REJECTION:', error);
  fs.appendFileSync(path.join(process.cwd(), 'error.log'), `${new Date().toISOString()} - ${error}\n`);
});

process.on('uncaughtException', (error) => {
  const errorMsg = `Uncaught Exception: ${error.message}\nStack: ${error.stack}`;
  console.error('🔥 UNCAUGHT EXCEPTION:', errorMsg);
  fs.appendFileSync(path.join(process.cwd(), 'error.log'), `${new Date().toISOString()} - ${errorMsg}\n`);
  process.exit(1);
});

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
