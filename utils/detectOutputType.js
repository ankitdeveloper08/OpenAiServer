export function detectOutputType(prompt) {
  const text = prompt.toLowerCase();

  if (
    text.includes("pdf") ||
    text.includes("save as pdf") ||
    text.includes("download pdf")
  ) {
    return "pdf";
  }

  if (
    text.includes("word") ||
    text.includes("docx") ||
    text.includes("document")
  ) {
    return "docx";
  }

  if (
    text.includes("excel") ||
    text.includes("xlsx") ||
    text.includes("spreadsheet")
  ) {
    return "xlsx";
  }

  if (text.includes("csv")) {
    return "csv";
  }

  return "chat";
}
