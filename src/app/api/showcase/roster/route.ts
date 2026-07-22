import { readSheet } from "read-excel-file/node";
import { NextResponse } from "next/server";
import { extractStudentRosterWithAI } from "@/lib/ai";
import { showcaseStudents } from "@/lib/showcase-data";
import { disabledShowcaseResponse, showcaseRuntimeEnabled } from "@/lib/showcase-runtime";

export const dynamic = "force-dynamic";

function parseDelimitedRows(text: string, delimiter: "," | "\t") {
  const rows: unknown[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    if (row.some((value) => value.trim())) rows.push(row.slice(0, 20));
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === "\"") {
        if (text[index + 1] === "\"") {
          cell += "\"";
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else if (char === "\"") {
      inQuotes = true;
    } else if (char === delimiter) {
      pushCell();
    } else if (char === "\n") {
      pushRow();
    } else if (char === "\r") {
      if (text[index + 1] === "\n") index += 1;
      pushRow();
    } else {
      cell += char;
    }
  }

  if (cell || row.length > 0) pushRow();
  return rows.slice(0, 500);
}

async function readRows(file: File) {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith(".csv") || file.type === "text/csv") return parseDelimitedRows(await file.text(), ",");
  if (fileName.endsWith(".tsv") || file.type === "text/tab-separated-values") return parseDelimitedRows(await file.text(), "\t");
  if (
    fileName.endsWith(".xlsx") ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return readSheet(Buffer.from(await file.arrayBuffer()));
  }
  throw new Error("Unsupported roster file type.");
}

export async function POST(request: Request) {
  if (!showcaseRuntimeEnabled()) return disabledShowcaseResponse();

  const formData = await request.formData();
  const file = formData.get("studentFile");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({
      fileName: "charlotte-showcase-roster.csv",
      rows: showcaseStudents
    });
  }

  try {
    const rows = await extractStudentRosterWithAI(await readRows(file));
    return NextResponse.json({
      fileName: file.name,
      rows: rows.length ? rows.map((row, index) => ({
        id: `student-${index + 1}`,
        displayName: row.displayName,
        email: row.email
      })) : showcaseStudents
    });
  } catch {
    return NextResponse.json({
      fileName: file.name,
      rows: showcaseStudents,
      warning: "Charlotte could not read that roster, so the showcase roster was loaded instead."
    });
  }
}
