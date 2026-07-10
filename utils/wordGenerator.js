import fs from "fs";
import path from "path";
import { Document, Packer, Paragraph } from "docx";

export async function generateWord(content, fileName) {
  const outputDir = path.join(process.cwd(), "generated-files");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: fileName,
            heading: "Heading1",
          }),
          new Paragraph(content),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

  const filePath = path.join(outputDir, `${fileName}.docx`);

  fs.writeFileSync(filePath, buffer);

  return `/generated-files/${fileName}.docx`;
}
