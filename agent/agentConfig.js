export const config = {
  openRouterKey: "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", // 🔑 your OpenRouter key here
  model: "gpt-4o-mini",
  temperature: 0.3,
  topK: 4,
  docsDir: "./agent/docs",
  basePrompt: `
You are a helpful AI assistant. Use the following context from the documents to answer questions clearly and accurately.
If the answer is not in the context, say "I don’t know based on the document."
  `,
};
