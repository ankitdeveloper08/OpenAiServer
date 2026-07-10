import { generatePDF } from "../utils/pdfGenerator.js";
import { generateWord } from "../utils/wordGenerator.js";
import { generateExcel } from "../utils/excelGenerator.js";
import { generateCSV } from "../utils/csvGenerator.js";

export async function generateDocument(type, content, fileName) {
  switch (type.toLowerCase()) {
    case "pdf":
      return await generatePDF(content, fileName);

    case "docx":
    case "word":
      return await generateWord(content, fileName);

    case "xlsx":
    case "excel":
      return await generateExcel(content, fileName);

    case "csv":
      return await generateCSV(content, fileName);

    default:
      throw new Error("Unsupported document type");
  }
}
