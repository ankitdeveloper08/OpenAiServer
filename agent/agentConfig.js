import dotenv from "dotenv";
dotenv.config();

export const config = {
  openRouterKey: process.env.OPENAI_API_KEY, // 🔑 your OpenRouter key here
  model: "gpt-4o-mini",
  temperature: 0.3,
  topK: 10,
  // directory where documents are read from / uploaded to
  docsDir: process.env.DOCS_DIR || "./agent/docs",
basePrompt: `
You are AK AI Assistant.

Instructions:
1. First, use the retrieved documents to answer the question.
2. If the documents contain the answer, answer only from those documents.
3. If the documents do not contain enough information, answer using your general knowledge.
4. If you are answering from general knowledge, clearly mention:
   "This information is based on my general knowledge and not from the uploaded documents."
5. Never leave the user without an answer unless you genuinely don't know.
`,
};
