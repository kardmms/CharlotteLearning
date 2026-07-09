"use client";

import { useState } from "react";
import { gradeIndex, gradeOptions } from "@/lib/grade";

export function GradeSlider({
  name = "gradeLevel",
  defaultValue = "3",
  label = "Grade level"
}: {
  name?: string;
  defaultValue?: string;
  label?: string;
}) {
  const [index, setIndex] = useState(gradeIndex(defaultValue));
  const selected = gradeOptions[index] || gradeOptions[3];

  return (
    <label>
      {label}
      <input type="hidden" name={name} value={selected.value} />
      <div className="slider-readout">{selected.label}</div>
      <input
        aria-label={label}
        className="grade-slider"
        max={12}
        min={0}
        onChange={(event) => setIndex(Number(event.target.value))}
        step={1}
        type="range"
        value={index}
      />
      <div className="slider-scale" aria-hidden="true">
        <span>K</span>
        <span>12</span>
      </div>
    </label>
  );
}
