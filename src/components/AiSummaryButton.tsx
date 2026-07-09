"use client";

import { useState, useTransition } from "react";
import { FileText, Loader2 } from "lucide-react";

export function AiSummaryButton({ classroomId }: { classroomId: string }) {
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function generateSummary() {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/teacher/classes/${classroomId}/ai-summary`, {
        method: "POST"
      });
      const result = (await response.json()) as { summary?: string; error?: string };
      if (!response.ok || !result.summary) {
        setError(result.error || "Could not generate a summary yet.");
        return;
      }
      setSummary(result.summary);
    });
  }

  return (
    <div className="summary-action">
      <button className="button" type="button" onClick={generateSummary} disabled={isPending}>
        {isPending ? <Loader2 className="spin-icon" size={18} /> : <FileText size={18} />}
        AI data summary
      </button>
      {error && <div className="error">{error}</div>}
      {summary && (
        <div className="summary-card">
          <strong>Classroom summary</strong>
          <p>{summary}</p>
        </div>
      )}
    </div>
  );
}
