import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

export async function generatePDF(content, fileName) {
  return new Promise((resolve, reject) => {
    const outputDir = path.join(process.cwd(), "generated-files");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filePath = path.join(outputDir, `${fileName}.pdf`);

    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
    });

    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    doc.fontSize(20).text(fileName, {
      align: "center",
    });

    doc.moveDown();

    doc.fontSize(12).text(content);

    doc.end();

    stream.on("finish", () => {
      resolve(`/generated-files/${fileName}.pdf`);
    });

    stream.on("error", reject);
  });
}
