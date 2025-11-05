import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import { createRequire } from "module";
import { Document } from "langchain/document";
import { config } from "./agent/agentConfig.js";

const require = createRequire(import.meta.url);
const pdfParse = require(path.resolve("node_modules/pdf-parse/lib/pdf-parse.js"));

// phrases to suppress if model emits them at the start (kept for reference)
const leadingPhrases = [
  "I don’t know based on the provided documents.",
  "I don't know based on the provided documents."
];

// ✅ Simple vector store
class SimpleVectorStore {
  constructor() {
    this.vectors = [];
    this.documents = [];
  }

  async addVectors(vectors, documents) {
    this.vectors.push(...vectors);
    this.documents.push(...documents);
  }

  static cosineSimilarity(a, b) {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (normA * normB);
  }

  // Return sorted array [{ doc, score }, ...] (highest score first)
  async getScoresForQuery(query) {
    const qEmbedding = await fetchEmbedding(query);
    const scores = this.vectors.map((vec, i) => ({
      doc: this.documents[i],
      score: SimpleVectorStore.cosineSimilarity(vec, qEmbedding),
    }));
    scores.sort((a, b) => b.score - a.score);
    return scores;
  }

  async asRetriever(topK = 5, minScore = 0.5) {
    return {
      getRelevantDocuments: async (query) => {
        const scores = await this.getScoresForQuery(query);

        const topScore = scores[0]?.score || 0;
        const threshold =
          topScore > 0.9 ? 0.75 : topScore > 0.8 ? 0.7 : minScore;

        const filtered = scores.filter((s) => s.score >= threshold).slice(0, topK);
        const topMatches = scores.slice(0, topK);

        const chosen = filtered.length > 0 ? filtered : topMatches;
        const topDocs = chosen.map((s) => s.doc);

        console.log(
          `🧮 Retrieved ${topDocs.length} docs (used ${
            filtered.length > 0 ? "filtered" : "fallback topK"
          }). topScore=${topScore.toFixed(4)}, threshold=${threshold.toFixed(4)}`
        );

        return topDocs;
      },
    };
  }
}

// ✅ Fetch embeddings using OpenRouter
async function fetchEmbedding(text) {
  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openRouterKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  const data = await response.json();
  if (!data.data || !data.data[0]) {
    console.error("Embedding API error:", data);
    throw new Error("Failed to get embedding");
  }
  return data.data[0].embedding;
}

// 🧠 Load and process docs
export async function loadDocs() {
  const docsDir = path.resolve(config.docsDir);
  console.log("📂 Loading documents from:", docsDir);

  if (!fs.existsSync(docsDir)) {
    console.error("❌ Docs directory not found!");
    return new SimpleVectorStore();
  }

  const files = fs.readdirSync(docsDir);
  console.log("📄 Files found:", files);

  let allText = "";
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const filePath = path.join(docsDir, file);
    const data = fs.readFileSync(filePath);

    if (ext === ".pdf") {
      const pdfData = await pdfParse(data);
      allText += pdfData.text;
    } else if (ext === ".docx") {
      const result = await mammoth.extractRawText({ buffer: data });
      allText += result.value;
    } else if (ext === ".txt") {
      allText += data.toString();
    }
  }

  const chunks = allText.match(/[\s\S]{1,1000}/g) || [];
  const documents = chunks.map((t) => new Document({ pageContent: t }));

  console.log(`✅ Loaded ${documents.length} chunks from ${files.length} files.`);
  console.log("🧠 Example doc snippet:", documents[0]?.pageContent?.slice(0, 200));

  const embeddings = [];
  for (const doc of documents) {
    const embedding = await fetchEmbedding(doc.pageContent);
    embeddings.push(embedding);
  }

  const vectorStore = new SimpleVectorStore();
  await vectorStore.addVectors(embeddings, documents);

  console.log("✅ Docs embedded and ready!");
  return vectorStore;
}

// Improved strip: removes common variants and partial starts of the fallback phrase
function stripLeadingPhrases(text) {
  if (!text) return text;
  let t = text;

  // Remove leading whitespace first
  t = t.replace(/^\s+/, "");

  // 1) Remove common full phrases and variants (I don't / I don’t / I do not / don't / do not)
  t = t.replace(/^(?:I\s*(?:don'?t|don\u2019t|do\s+not|do not|do|dont|i\s+don))\b[\s,.:;!()-]*/i, "");

  // 2) Remove leading "know based on..." regardless of whether "I don't" arrived
  t = t.replace(/^(?:know(?:\s+based\s+on\s+the\s+provided\s+documents\.?)?|\bknow\b)[\s,.:;!()-]*/i, "");

  // 3) Remove contracted suffixes that might arrive split (e.g. "n't", "'t", "’t") at the start
  t = t.replace(/^(?:n'?t|['\u2019`’]t|n\u2019t)\b[\s,.:;!()-]*/i, "");

  // 4) Remove small leftover tokens like "don", "i", "i don" that can be left when stream splits
  t = t.replace(/^(?:don|i|i\s+don)\b[\s,.:;!()-]*/i, "");

  // 5) Remove any leading punctuation/apostrophes remaining
  t = t.replace(/^[\s"'`’\u2019\.\,\:\;\-\(\)]+/, "");

  return t;
}

// Heuristic: detect greetings / chitchat so they go to OpenAI
function isLikelyChitchat(question) {
  if (!question) return false;
  const s = question.trim().toLowerCase();

  // common greetings and short social messages
  const greetingRegex = /^(hi|hello|hey|iya|hallo|good (morning|afternoon|evening)|thanks|thank you|bye|goodbye|sup|yo|what's up|whats up)[\s!.,?]*$/i;
  if (greetingRegex.test(s)) return true;

  // single short token (like "hi", "hey", "ok")
  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length === 1 && tokens[0].length <= 4) return true;

  // very short non-question (no question words and length small)
  const questionWords = /\b(who|what|when|where|why|how|which|whom|whose)\b/i;
  if (s.length <= 10 && !questionWords.test(s)) return true;

  return false;
}

// 🗣️ Ask a question (with streaming + smarter batching + start-timeout)
// Behavior: compute retrieval top score first. If below MIN_SCORE_FOR_DOCS, call general OpenRouter prompt.
// Buffers initial output and starts streaming only when there's meaningful content or an elapsed start timeout.
export async function askDocsStream(question, vectorStore, res) {
  // --- NEW: chitchat detection --- //
  if (isLikelyChitchat(question)) {
    console.log("🫧 Detected chitchat/greeting — routing to OpenAI general prompt.");
    // Bypass embeddings/retrieval for greetings
    const source = "openai";
    const prompt = `
No relevant document context was found.

Please answer using general knowledge:
${question}
`;
    // stream result from OpenRouter / OpenAI as before
    await streamModelResponse(prompt, source, res);
    return;
  }
  // --- end chitchat early return --- //

  // compute scores once (only for non-chitchat)
  const scores = await vectorStore.getScoresForQuery(question);
  const topScore = scores[0]?.score || 0;
  console.log("🔎 Document scores (top first):", scores.slice(0, Math.max(config.topK || 5, 5)).map(s => s.score.toFixed(4)));
  console.log(`🧮 topScore=${topScore.toFixed(4)}`);

  const MIN_SCORE_FOR_DOCS = 0.25;

  let source = "docs";
  let prompt = "";

  if (topScore < MIN_SCORE_FOR_DOCS) {
    source = "openai";
    prompt = `
No relevant document context was found.

Please answer using general knowledge:
${question}
`;
    console.log("🧭 Low retrieval confidence — using OpenAI general prompt (no docs-only instruction).");
  } else {
    const topK = config.topK || 5;
    const threshold = topScore > 0.9 ? 0.75 : topScore > 0.8 ? 0.7 : 0.2;
    const filtered = scores.filter((s) => s.score >= threshold).slice(0, topK);
    const chosen = filtered.length > 0 ? filtered : scores.slice(0, topK);
    const relevantDocs = chosen.map((s) => s.doc);
    const context = relevantDocs.map((d) => d.pageContent).join("\n\n");

    source = "docs";
    prompt = `
You are a helpful assistant. Answer the question below strictly based on the given document context.

Document Context:
${context}

Question: ${question}

If the answer is not clearly stated, respond exactly with:
"I don’t know based on the provided documents."
`;
    console.log(`🧭 Using docs. Retrieved ${relevantDocs.length} docs. threshold=${threshold.toFixed(4)}`);
  }

  // use shared streaming helper
  await streamModelResponse(prompt, source, res);
}

// Shared streaming helper to avoid duplication
export async function streamModelResponse(prompt, source, res) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openRouterKey}`,
    },
    body: JSON.stringify({
      model: config.model || "gpt-4o-mini",
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    if (!res.writableEnded) {
      try {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
      } catch {}
      try { res.write(`data: Error: ${response.statusText}\n\n`); } catch {}
      try { res.end(); } catch {}
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  // Streaming control params
  const STREAM_START_THRESHOLD = 128;
  const START_TIMEOUT_MS = 1000;
  const MIN_SEND_DELTA = 8;
  const FLUSH_INTERVAL_MS = 120;

  // Shared streaming state
  let buffer = "";
  let lastSentLen = 0;
  let startedStreaming = false;
  let flushTimer = null;
  let startTimer = null;
  let headersSent = false;
  let ended = false;
  let statusPingSent = false;
  let clientClosed = false;

  // handle client disconnects and errors
  const onClientClose = () => {
    clientClosed = true;
    ended = true;
    try {
      reader.cancel().catch(() => {});
    } catch {}
  };
  res.on("close", onClientClose);
  res.on("error", (err) => {
    // avoid unhandled 'error' on res
    console.warn("Response stream error:", err?.message || err);
    onClientClose();
  });

  function ensureHeaders() {
    if (headersSent || res.writableEnded || clientClosed) return;
    try {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      headersSent = true;
    } catch (e) {
      console.warn("ensureHeaders failed:", e?.message || e);
    }
  }

  function safeWrite(data) {
    if (ended || res.writableEnded || clientClosed) return false;
    try {
      res.write(data);
      return true;
    } catch (e) {
      console.warn("safeWrite failed:", e?.message || e);
      return false;
    }
  }

  function sendChunk(chunk) {
    if (!chunk || ended || res.writableEnded || clientClosed) return;
    ensureHeaders();
    // SSE comment ping so client doesn't render it
    if (!statusPingSent) {
      safeWrite(`: processing\n\n`);
      statusPingSent = true;
    }
    safeWrite(`data: ${JSON.stringify({ source, content: chunk })}\n\n`);
  }

  function startPeriodicFlush() {
    if (!flushTimer) {
      flushTimer = setInterval(() => flushIfNeeded(true), FLUSH_INTERVAL_MS);
    }
  }

  function clearTimers() {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    if (startTimer) {
      clearTimeout(startTimer);
      startTimer = null;
    }
  }

  function flushIfNeeded(force = false) {
    if (ended || res.writableEnded || clientClosed) return;
    if (!startedStreaming) {
      const stripped = stripLeadingPhrases(buffer);
      if (stripped.trim().length >= STREAM_START_THRESHOLD || (force && stripped.trim().length > 0)) {
        startedStreaming = true;
        buffer = stripped;
        const toSend = buffer.slice(lastSentLen).trim();
        if (toSend) {
          sendChunk(toSend);
          lastSentLen = buffer.length;
        }
        startPeriodicFlush();
      } else {
        return;
      }
    } else {
      const newLen = buffer.length;
      const delta = newLen - lastSentLen;
      if (delta >= MIN_SEND_DELTA || force) {
        let chunk = buffer.slice(lastSentLen);
        chunk = stripLeadingPhrases(chunk);
        chunk = chunk.trim();
        if (chunk) sendChunk(chunk);
        lastSentLen = buffer.length;
      }
    }
  }

  try {
    // If source is openai (general), stream immediately without the initial buffering delay.
    if (source === "openai") {
      ensureHeaders();
      if (!statusPingSent) {
        safeWrite(`: processing\n\n`);
        statusPingSent = true;
      }
      try {
        while (!clientClosed) {
          const { done: rDone, value } = await reader.read();
          if (rDone) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((line) => line.trim().startsWith("data: "));
          for (const line of lines) {
            if (clientClosed) break;
            const dataStr = line.replace("data: ", "").trim();
            if (dataStr === "[DONE]") {
              // finish
              break;
            }
            try {
              const json = JSON.parse(dataStr);
              const content = json.choices?.[0]?.delta?.content;
              if (content && !clientClosed && !res.writableEnded) {
                safeWrite(`data: ${JSON.stringify({ source, content })}\n\n`);
              }
            } catch {
              // ignore incomplete JSON
            }
          }
        }
      } finally {
        clearTimers();
        if (!ended && !res.writableEnded && !clientClosed) {
          try { safeWrite("data: [DONE]\n\n"); } catch {}
          try { res.end(); } catch {}
        }
        ended = true;
        res.removeListener("close", onClientClose);
        return;
      }
    }

    // For docs-based responses keep buffered
    startTimer = setTimeout(() => {
      if (!startedStreaming && !clientClosed) {
        flushIfNeeded(true);
      }
    }, START_TIMEOUT_MS);

    while (!clientClosed) {
      const { done: rDone, value } = await reader.read();
      if (rDone) {
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((line) => line.trim().startsWith("data: "));
      for (const line of lines) {
        if (clientClosed) break;
        const dataStr = line.replace("data: ", "").trim();
        if (dataStr === "[DONE]") {
          break;
        }
        try {
          const json = JSON.parse(dataStr);
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            buffer += content;
            if (!startedStreaming) {
              buffer = stripLeadingPhrases(buffer);
            }
            flushIfNeeded();
          }
        } catch {
          // ignore incomplete JSON
        }
      }
    }
  } catch (err) {
    console.error("❌ Stream read error:", err);
  } finally {
    clearTimers();
    flushIfNeeded(true);

    if (!startedStreaming && source === "docs" && !clientClosed) {
      ensureHeaders();
      sendChunk("I don’t know based on the provided documents.");
    }

    if (!ended && !res.writableEnded && !clientClosed) {
      try { safeWrite("data: [DONE]\n\n"); } catch {}
      try { res.end(); } catch {}
    }
    ended = true;
    res.removeListener("close", onClientClose);
  }
}
