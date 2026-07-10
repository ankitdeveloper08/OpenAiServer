import fs from "fs";
import path from "path";
import { createObjectCsvWriter } from "csv-writer";

export async function generateCSV(data, fileName) {
  const outputDir = path.join(process.cwd(), "generated-files");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filePath = path.join(outputDir, `${fileName}.csv`);

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      {
        id: "content",
        title: "Content",
      },
    ],
  });

  const records = [{ content: data }];

  await csvWriter.writeRecords(records);

  return `/generated-files/${fileName}.csv`;
}
