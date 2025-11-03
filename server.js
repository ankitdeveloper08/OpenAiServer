import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import { Readable } from "stream";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 5000;

const OPENROUTER_API_KEY = "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";

const DEFAULT_MODEL = "meta-llama/llama-3-8b-instruct";

app.post("/v1/chat/completions", async (req, res) => {
  const { model, messages } = req.body;
  console.log("📩 Incoming stream request:", { model, messages });

  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const text = await response.text();
      console.error("❌ OpenRouter returned error:", text);
      res.write(`data: ${JSON.stringify({ error: { message: text } })}\n\n`);
      res.end();
      return;
    }

    // ✅ Convert the Web stream to Node stream
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

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
