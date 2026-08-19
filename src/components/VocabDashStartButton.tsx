"use client";

import { Play } from "lucide-react";
import { useFormStatus } from "react-dom";

export function VocabDashStartButton({ participantCount }: { participantCount: number }) {
  const { pending } = useFormStatus();
  const disabled = pending || participantCount < 2;

  return (
    <button
      className="button vocab-dash-start-button"
      type="submit"
      disabled={disabled}
      onClick={() => window.dispatchEvent(new Event("vocabdash:start"))}
      title={participantCount < 2 ? "At least 2 students must join" : "Start Vocab Dash"}
    >
      <Play size={18} />
      {pending ? "Game Starting..." : participantCount < 2 ? "Waiting for 2 students" : "Start"}
    </button>
  );
}
