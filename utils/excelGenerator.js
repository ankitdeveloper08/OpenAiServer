import XLSX from "xlsx";
import fs from "fs";
import path from "path";

export async function generateExcel(content, fileName) {
  const workbook = XLSX.utils.book_new();

  // Convert markdown/text into rows
  const rows = [];

  content.split("\n").forEach((line) => {
    line = line.trim();

    if (!line) return;

    // Markdown table
    if (line.includes("|")) {
      const cols = line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);

      // Skip separator row
      if (cols.every((c) => /^:?-+:?$/.test(c))) {
        return;
      }

      rows.push(cols);
    } else {
      rows.push([line]);
    }
  });
  const sheet = XLSX.utils.aoa_to_sheet(rows);

  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");

  const folder = path.join(process.cwd(), "generated-files");

  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  const filePath = path.join(folder, `${fileName}.xlsx`);

  XLSX.writeFile(workbook, filePath);

  return {
    fileUrl: `/generated-files/${fileName}.xlsx`,
    preview: rows,
  };
}
