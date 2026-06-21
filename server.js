import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import OpenAI from "openai";
import { Readable } from "stream";
import { config } from "./agent/agentConfig.js";
import { loadDocs, askDocsStream } from "./index.js";
import authRoutes from "./routes/authRoutes.js";
import { authenticate } from "./middleware/auth.js";
import chatRoutes from "./routes/chatRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";


dotenv.config();

const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
    ],
    credentials: true,
  })
);

app.use(express.json());
// Increase body-parser limits to avoid PayloadTooLargeError for large requests
app.use(express.json({ limit: "5mb" })); // adjust as needed: "1mb", "5mb", "10mb"
app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use(express.urlencoded({ limit: "5mb", extended: true }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const PORT = process.env.PORT || 5000;

let vectorStore;

// ✅ Load documents on startup
(async () => {
  try {
    console.log("📚 Loading docs...");
    vectorStore = await loadDocs();
    console.log("✅ Docs loaded successfully.");
  } catch (err) {
    console.error("❌ Failed to load docs on startup:", err);
  }
})();

// ===========================================================
// 🔹 1️⃣ General Chat (OpenRouter) — Streaming
// ===========================================================
app.post(
   "/v1/chat/completions",
  authenticate,
  async (req, res) => {
  const { model, messages } = req.body;
  console.log("📩 Incoming general chat stream request:", { model });

  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openRouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || config.defaultModel,
        messages,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const text = await response.text();
      console.error("❌ OpenRouter error:", text);
      res.write(`data: ${JSON.stringify({ error: { message: text } })}\n\n`);
      res.end();
      return;
    }

    const readable =
      typeof response.body.getReader === "function"
        ? Readable.fromWeb(response.body)
        : response.body;

    readable.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line);

      for (const line of lines) {
        if (line.startsWith("data:")) {
          res.write(`${line}\n\n`);
        }
      }
    });

    readable.on("end", () => {
      res.write("data: [DONE]\n\n");
      res.end();
    });

    readable.on("error", (err) => {
      console.error("❌ Stream error:", err.message);
      if (!res.headersSent) {
        res.write(
          `data: ${JSON.stringify({ error: { message: err.message } })}\n\n`
        );
        res.end();
      }
    });
  } catch (err) {
    console.error("❌ Exception:", err.message);
    if (!res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: { message: err.message } })}\n\n`);
      res.end();
    }
  }
});

// ===========================================================
// 🔹 2️⃣ Document Q&A — Use askDocsStream (Docs-first)
// ===========================================================
app.post(
  "/ask-docs",
  authenticate,
  async (req, res) => {
  const { question } = req.body;
  if (!question) {
    res.status(400).json({ error: "Missing question" });
    return;
  }

  try {
    // Ensure vector store is loaded
    if (!vectorStore) {
      console.log("📚 Vector store not ready — loading now...");
      vectorStore = await loadDocs();
      console.log("✅ Vector store loaded.");
    }

    // Delegate to askDocsStream which handles SSE headers and streaming response
    await askDocsStream(question, vectorStore, res);
    // askDocsStream is responsible for ending the response
  } catch (err) {
    console.error("❌ /ask-docs error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      try {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      } catch (e) {
        // swallow
      }
    }
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
