"use client";

import { useEffect } from "react";

export function ClearApprovedReadingDraft({ classroomId, approvedText }: { classroomId: string; approvedText: string }) {
  useEffect(() => {
    const key = `charlotte-reading-draft:${classroomId}`;
    try {
      const saved = sessionStorage.getItem(key);
      if (saved && JSON.parse(saved).reading?.trim() === approvedText) sessionStorage.removeItem(key);
    } catch { /* Browser storage may be unavailable. */ }
  }, [classroomId, approvedText]);
  return null;
}
