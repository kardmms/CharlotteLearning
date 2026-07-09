"use client";

import { BarChart3, PieChart } from "lucide-react";
import { useState } from "react";

const colors = ["#2563eb", "#14b8a6", "#f59e0b", "#f472b6", "#8b5cf6", "#ef4444"];

export function QuestionResponseChart({ choices, counts }: { choices: string[]; counts: number[] }) {
  const [view, setView] = useState<"pie" | "bar">("pie");
  const total = counts.reduce((sum, count) => sum + count, 0);
  let cursor = 0;
  const gradient = choices.map((_, index) => {
    const start = cursor;
    cursor += total ? (counts[index] / total) * 100 : 0;
    return `${colors[index % colors.length]} ${start}% ${cursor}%`;
  }).join(", ");

  return (
    <div className="answer-distribution">
      <div className="chart-toggle" aria-label="Chart type">
        <button type="button" className={view === "pie" ? "active" : ""} onClick={() => setView("pie")} title="Pie chart"><PieChart size={17} /></button>
        <button type="button" className={view === "bar" ? "active" : ""} onClick={() => setView("bar")} title="Bar chart"><BarChart3 size={17} /></button>
      </div>
      {view === "pie" ? (
        <div className="pie-chart-layout">
          <div className="response-pie" style={{ background: total ? `conic-gradient(${gradient})` : "#e2e8f0" }}><span>{total}<small>responses</small></span></div>
          <div className="chart-legend">
            {choices.map((choice, index) => <div key={choice}><i style={{ background: colors[index % colors.length] }} /><span>{choice}</span><strong>{counts[index]}</strong></div>)}
          </div>
        </div>
      ) : (
        <div className="answer-bar-chart">
          {choices.map((choice, index) => {
            const percent = total ? Math.round((counts[index] / total) * 100) : 0;
            return <div key={choice}><span>{choice}</span><div className="bar"><span style={{ width: `${percent}%`, background: colors[index % colors.length] }} /></div><strong>{counts[index]}</strong></div>;
          })}
        </div>
      )}
    </div>
  );
}
