import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function createReadingPdf(text: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const margin = 54;
  const pageWidth = 612;
  const pageHeight = 792;
  const maxWidth = pageWidth - margin * 2;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  const [firstLine, ...remainingLines] = text.trim().split(/\r?\n/);
  const title = firstLine || "Charlotte reading";
  const paragraphs = remainingLines.join("\n").trim().split(/\n\s*\n/).filter(Boolean);

  function safe(value: string) {
    return [...value.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')]
      .map((character) => { try { regular.encodeText(character); return character; } catch { return "?"; } }).join("");
  }

  function drawLine(line: string, size: number, lineHeight: number, isTitle = false) {
    if (y < margin + lineHeight) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line, { x: margin, y, size, font: isTitle ? bold : regular, color: rgb(0.09, 0.14, 0.23) });
    y -= lineHeight;
  }

  function drawWrapped(value: string, size: number, lineHeight: number, isTitle = false) {
    const font = isTitle ? bold : regular;
    let line = "";
    for (const word of safe(value).split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) drawLine(line, size, lineHeight, isTitle);
        line = word;
      }
    }
    if (line) drawLine(line, size, lineHeight, isTitle);
  }

  drawWrapped(title, 18, 24, true);
  y -= 14;
  for (const paragraph of paragraphs) {
    drawWrapped(paragraph, 12, 18);
    y -= 12;
  }
  return pdf.save();
}
