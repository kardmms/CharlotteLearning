"use client";

import { Play } from "lucide-react";
import { useFormStatus } from "react-dom";

export function VocabDashStartButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button vocab-dash-start-button" type="submit" disabled={pending}>
      <Play size={18} />
      {pending ? "Game Starting..." : "Start"}
    </button>
  );
}
