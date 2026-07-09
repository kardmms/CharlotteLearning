import { Check, CircleDashed, Clock3, X } from "lucide-react";

export type BubbleState = "complete" | "attempted" | "not-started" | "pending";

export function StatusBubble({
  state,
  label
}: {
  state: BubbleState;
  label: string;
}) {
  const Icon =
    state === "complete" ? Check : state === "attempted" ? CircleDashed : state === "pending" ? Clock3 : X;
  const title =
    state === "complete"
      ? `${label}: completed`
      : state === "attempted"
        ? `${label}: attempted`
        : state === "pending"
          ? `${label}: pending teacher grade`
          : `${label}: not looked at`;

  return (
    <span className={`status-bubble status-bubble-${state}`} title={title} aria-label={title}>
      <Icon size={15} strokeWidth={3} />
    </span>
  );
}
