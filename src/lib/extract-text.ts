import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { hashText } from "@/lib/security";

const DEFAULT_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const DEFAULT_MIN_SOURCE_CHARS = 500;
const DEFAULT_MAX_SOURCE_CHARS = 60_000;

type ExtractTextOptions = {
  maxBytes?: number;
  minChars?: number;
  maxChars?: number;
  uploadLabel?: string;
};

export type ExtractedUpload = {
  sourceName: string;
  sourceHash: string;
  sourcePreview: string;
  text: string;
};

export async function extractTextFromUpload(
  file: File,
  options: ExtractTextOptions = {}
): Promise<ExtractedUpload> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  const minChars = options.minChars ?? DEFAULT_MIN_SOURCE_CHARS;
  const maxChars = options.maxChars ?? DEFAULT_MAX_SOURCE_CHARS;
  const uploadLabel = options.uploadLabel || `${Math.floor(maxBytes / (1024 * 1024))} MB`;

  if (!file || file.size === 0) {
    throw new Error("Please upload a PDF, DOCX, or TXT file.");
  }

  if (file.size > maxBytes) {
    throw new Error(`Please upload a file no larger than ${uploadLabel}.`);
  }

  const sourceName = (file.name || "uploaded-material")
    .replace(/[^\w.\- ()]/g, "")
    .slice(0, 180) || "uploaded-material";
  const extension = sourceName.split(".").pop()?.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  let text = "";

  if (extension === "pdf" || file.type === "application/pdf") {
    let pageNumber = 0;
    const parsed = await pdfParse(buffer, {
      pagerender: async (pageData: any) => {
        pageNumber += 1;
        const content = await pageData.getTextContent({
          normalizeWhitespace: false,
          disableCombineTextItems: false
        });
        let lastY: number | undefined;
        let pageText = "";
        for (const item of content.items as Array<{ str: string; transform?: number[] }>) {
          const y = item.transform?.[5];
          pageText += lastY === undefined || y === lastY ? item.str : `\n${item.str}`;
          lastY = y;
        }
        return `\n[[PAGE ${pageNumber}]]\n${pageText}\n`;
      }
    });
    text = parsed.text;
  } else if (
    extension === "docx" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const parsed = await mammoth.extractRawText({ buffer });
    text = parsed.value;
  } else if (extension === "txt" || file.type.startsWith("text/")) {
    text = buffer.toString("utf8");
  } else {
    throw new Error("Unsupported file type. Please use PDF, DOCX, or TXT.");
  }

  const cleaned = text
    .replace(/\r/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (cleaned.length < minChars) {
    throw new Error("I could not find enough readable text in that file.");
  }

  const truncated = cleaned.slice(0, maxChars);
  return {
    sourceName,
    sourceHash: hashText(buffer.toString("base64")),
    sourcePreview: truncated.slice(0, 1800),
    text: truncated
  };
}
