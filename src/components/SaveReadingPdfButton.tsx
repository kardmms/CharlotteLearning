"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export function SaveReadingPdfButton({ text }: { text: string }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setError("");
    setSaving(true);
    try {
      const { createReadingPdf } = await import("@/lib/reading-pdf");
      const bytes = await createReadingPdf(text);
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(text.trim().split(/\r?\n/, 1)[0] || "charlotte-reading").replace(/[^a-z0-9 -]/gi, "").trim().replace(/\s+/g, "-").slice(0, 70) || "charlotte-reading"}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setError("The PDF could not be created. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return <span className="reading-pdf-control"><button className="ghost-button" type="button" onClick={save} disabled={saving}><Download size={17} /> {saving ? "Creating PDF…" : "Download PDF"}</button>{error && <small role="alert">{error}</small>}</span>;
}
