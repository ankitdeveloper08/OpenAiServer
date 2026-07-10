import fetch from "node-fetch";
import { config } from "../agent/agentConfig.js";
import { detectOutputType } from "../utils/detectOutputType.js";
import { generateDocument as createDocument } from "../services/documentService.js";

function markdownToRows(markdown) {
  const rows = [];

  markdown.split("\n").forEach((line) => {
    line = line.trim();

    if (!line) return;

    // Heading
    if (line.startsWith("#")) {
      rows.push([line.replace(/^#+/, "").trim()]);
      return;
    }

    // Numbered list
    if (/^\d+\./.test(line)) {
      rows.push([line.replace(/^\d+\.\s*/, "")]);
      return;
    }

    // Bullet list
    if (line.startsWith("- ")) {
      rows.push([line.substring(2)]);
      return;
    }

    // Markdown table
    if (line.includes("|")) {
      const cols = line
        .split("|")
        .map((x) => x.trim())
        .filter(Boolean);

      // Skip separator row
      if (cols.every((c) => /^:?-+:?$/.test(c))) {
        return;
      }

      rows.push(cols);
      return;
    }

    rows.push([line]);
  });

  return rows;
}

export const generateDocument = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required.",
      });
    }

    // Detect requested document type
    const outputType = detectOutputType(prompt);

    if (outputType === "chat") {
      return res.status(400).json({
        success: false,
        message:
          "No document format detected. Please specify PDF, Word, Excel or CSV.",
      });
    }

    // Remove document keywords before sending to AI
    const aiPrompt = prompt
      .replace(/\bpdf\b/gi, "")
      .replace(/\bexcel\b/gi, "")
      .replace(/\bxlsx\b/gi, "")
      .replace(/\bcsv\b/gi, "")
      .replace(/\bword\b/gi, "")
      .replace(/\bdocx\b/gi, "")
      .replace(/\bin\s+(a|an|the)?\s*(pdf|excel|xlsx|csv|word|docx)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    // Ask AI for content only
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.openRouterKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.defaultModel || "gpt-4o-mini",
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content: `
You are a professional technical writer.

The application automatically generates PDF, Word, Excel and CSV files.

Your ONLY responsibility is generating the content.

Rules:

- Never mention PDF, Excel, Word or CSV.
- Never say "I can't".
- Never say "I'm unable".
- Never mention AI.
- Never mention limitations.
- Never mention downloading.
- Never tell the user to copy anything.
- Never tell the user to save anything.
- Never explain what you can or cannot do.

Return ONLY clean Markdown.

Use:
- # Headings
- ## Subheadings
- Bullet lists
- Numbered lists
- Markdown tables whenever suitable

Return only the requested content.
`,
            },
            {
              role: "user",
              content: aiPrompt,
            },
          ],
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(data);

      return res.status(500).json({
        success: false,
        message: "OpenRouter API Error",
        error: data,
      });
    }

    let aiContent =
      data?.choices?.[0]?.message?.content || "No content generated.";

    // Clean any remaining AI disclaimer
    aiContent = aiContent
      .replace(/^I can't.*$/gim, "")
      .replace(/^I cannot.*$/gim, "")
      .replace(/^I'm unable.*$/gim, "")
      .replace(/^As an AI.*$/gim, "")
      .replace(/^Unfortunately.*$/gim, "")
      .replace(/^Feel free.*$/gim, "")
      .replace(/^You can copy.*$/gim, "")
      .replace(/^Copy this.*$/gim, "")
      .replace(/^Save this.*$/gim, "")
      .replace(/^Please note.*$/gim, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Generate filename
    const fileName = `NV_AI_${Date.now()}`;

    // Create document
    const document = await createDocument(outputType, aiContent, fileName);

    const previewRows = markdownToRows(aiContent);

    return res.json({
      success: true,
      type: outputType,
      fileName: `${fileName}.${outputType}`,

      fileUrl: typeof document === "string" ? document : document.fileUrl,

      preview: typeof document === "string" ? aiContent : document.preview,

      content: aiContent,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
