import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit-table";

export async function generatePDF(content, fileName) {
  return new Promise(async (resolve, reject) => {
    try {
      const outputDir = path.join(process.cwd(), "generated-files");

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const filePath = path.join(outputDir, `${fileName}.pdf`);

      const doc = new PDFDocument({
        margin: 30,
        size: "A4",
        layout: "landscape", // Better for wide tables
      });

      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      const lines = content.split("\n").filter((x) => x.trim());

      let title = "";
      const rows = [];

      for (const line of lines) {
        if (line.startsWith("#")) {
          title = line.replace(/^#+/, "").trim();
          continue;
        }

        if (line.includes("|")) {
          const cols = line
            .split("|")
            .map((x) => x.trim())
            .filter(Boolean);

          if (cols.every((c) => /^:?-+:?$/.test(c))) continue;

          rows.push(cols);
        }
      }

      doc
        .fontSize(22)
        .font("Helvetica-Bold")
        .text(title || fileName, {
          align: "center",
        });

      doc.moveDown();

      if (rows.length > 1) {
        const headers = rows[0];
        const body = rows.slice(1);

        const pageWidth =
          doc.page.width - doc.page.margins.left - doc.page.margins.right;

        const colWidth = pageWidth / headers.length;

        let y = doc.y;

        // Header
        doc.font("Helvetica-Bold").fontSize(9);

        headers.forEach((text, i) => {
          doc.rect(i * colWidth + 30, y, colWidth, 25).stroke();
          doc.text(text, i * colWidth + 35, y + 7, {
            width: colWidth - 10,
            align: "center",
          });
        });

        y += 25;

        doc.font("Helvetica").fontSize(8);

        body.forEach((row) => {
          let rowHeight = 30;

          row.forEach((cell) => {
            const h = doc.heightOfString(cell || "", {
              width: colWidth - 10,
            });

            rowHeight = Math.max(rowHeight, h + 12);
          });

          // Page break
          if (y + rowHeight > doc.page.height - 40) {
            doc.addPage();
            y = 40;
          }

          row.forEach((cell, i) => {
            doc.rect(i * colWidth + 30, y, colWidth, rowHeight).stroke();

            doc.text(cell || "", i * colWidth + 35, y + 5, {
              width: colWidth - 10,
            });
          });

          y += rowHeight;
        });
      } else {
        doc.fontSize(12).text(content);
      }

      doc.end();

      stream.on("finish", () => {
        resolve(`/generated-files/${fileName}.pdf`);
      });

      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}
