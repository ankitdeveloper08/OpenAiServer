import dotenv from "dotenv";
dotenv.config();

export const config = {
  openRouterKey: process.env.OPENAI_API_KEY, // 🔑 your OpenRouter key here
  model: "gpt-4o-mini",
  temperature: 0.3,
  topK: 4,
  docsDir: "./agent/docs",
  basePrompt: `
You are a helpful AI assistant. Use the following context from the documents to answer questions clearly and accurately.
If the answer is not in the context, say "I don’t know based on the document."
  `,
};
