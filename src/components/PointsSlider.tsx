"use client";

import { useState } from "react";

export function PointsSlider({ maxPoints }: { maxPoints: number }) {
  const [points, setPoints] = useState(maxPoints);
  return (
    <div className="points-slider">
      <div><strong>Points</strong><output>{points} / {maxPoints}</output></div>
      <input
        type="range"
        name="points"
        min="0"
        max={maxPoints}
        step="1"
        value={points}
        onChange={(event) => setPoints(Number(event.target.value))}
      />
      <div className="points-slider-labels"><span>0</span><span>Full credit</span></div>
    </div>
  );
}
