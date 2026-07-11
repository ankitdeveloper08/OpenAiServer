import XLSX from "xlsx";
import fs from "fs";
import path from "path";

export async function generateExcel(content, fileName) {
  const workbook = XLSX.utils.book_new();

  const rows = [];
  let insideTable = false;

  content.split("\n").forEach((line) => {
    line = line.trim();

    // Blank row
    if (!line) {
      rows.push([]);
      insideTable = false;
      return;
    }

    // Heading (# or ##)
    if (line.startsWith("#")) {
      if (insideTable) {
        rows.push([]);
      }

      rows.push([line]);
      insideTable = false;
      return;
    }

    // Markdown Table
    if (line.includes("|")) {
      const cols = line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);

      // Ignore |---|---|
      if (cols.every((c) => /^:?-+:?$/.test(c))) {
        return;
      }

      rows.push(cols);
      insideTable = true;
      return;
    }

    // Normal text
    if (insideTable) {
      rows.push([]);
      insideTable = false;
    }

    rows.push([line]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(rows);

  // Better column widths
  sheet["!cols"] = [];
  rows.forEach((row) => {
    row.forEach((cell, i) => {
      const len = String(cell || "").length + 4;

      if (!sheet["!cols"][i] || sheet["!cols"][i].wch < len) {
        sheet["!cols"][i] = {
          wch: Math.min(Math.max(len, 15), 40),
        };
      }
    });
  });

  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");

  const folder = path.join(process.cwd(), "generated-files");

  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  const filePath = path.join(folder, `${fileName}.xlsx`);

  XLSX.writeFile(workbook, filePath);

  // Read worksheet back for preview
  const preview = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: true,
    defval: "",
  });

  return {
    type: "excel",
    fileName: `${fileName}.xlsx`,
    fileUrl: `/generated-files/${fileName}.xlsx`,
    preview,
  };
}
