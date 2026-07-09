"use client";

import { useEffect, useState } from "react";
import { Star, Trophy } from "lucide-react";

export function CompletionCelebration({ points }: { points: number }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 3200);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;

  return (
    <div className="celebration-layer" aria-live="polite">
      <div className="confetti-burst" aria-hidden="true">
        {Array.from({ length: 28 }, (_, index) => <i key={index} style={{ "--i": index } as React.CSSProperties} />)}
      </div>
      <div className="celebration-card">
        <div className="celebration-trophy"><Trophy size={34} /></div>
        <strong>Activity complete!</strong>
        <span><Star size={18} /> You earned {points} points</span>
      </div>
    </div>
  );
}
