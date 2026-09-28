import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { createReadingPdf } from "../src/lib/reading-pdf.ts";

test("a long approved reading downloads as a complete multipage PDF", async () => {
  const reading = `Medieval Markets\n\n${Array.from({ length: 18 }, (_, index) =>
    `Paragraph ${index + 1}: The market had bakers, craft workers, and visiting farmers. ` +
    "Students could compare what they sold and explain how trade connected the town. ".repeat(4)
  ).join("\n\n")}`;
  const bytes = await createReadingPdf(reading);
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() > 1);
});
