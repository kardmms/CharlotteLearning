"use client";

import { Play } from "lucide-react";

export function StartActivityButton({ materialId, focused = true }: { materialId: string; focused?: boolean }) {
  function start() {
    const url = `/student/station/${materialId}`;
    if (!focused) {
      window.location.href = url;
      return;
    }
    const focusedWindow = window.open(
      url,
      `charlotte-activity-${materialId}`,
      "popup=yes,width=1100,height=820,resizable=yes,scrollbars=yes"
    );
    if (focusedWindow) {
      focusedWindow.focus();
      window.location.href = `/student/active?materialId=${materialId}`;
    } else {
      window.location.href = url;
    }
  }

  return (
    <button className="button student-start-button" data-no-loading="true" type="button" onClick={start}>
      <Play size={19} fill="currentColor" />
      Start activity
    </button>
  );
}
