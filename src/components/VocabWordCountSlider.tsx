"use client";

import { useState } from "react";

export function VocabWordCountSlider({
  defaultValue = 15,
  min = 10,
  max = 30
}: {
  defaultValue?: number;
  min?: number;
  max?: number;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <label className="vocab-word-count-slider">
      <span>
        <strong>Number of vocab words</strong>
        <output>{value}</output>
      </span>
      <input
        name="wordCount"
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
      />
      <small>{min} minimum - {max} maximum</small>
    </label>
  );
}
