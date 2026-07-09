"use client";

import { X } from "lucide-react";

export function ClosePreviewButton({ fallbackHref }: { fallbackHref: string }) {
  return (
    <button
      className="ghost-button preview-close-button"
      type="button"
      onClick={() => {
        window.close();
        window.setTimeout(() => {
          window.location.href = fallbackHref;
        }, 120);
      }}
    >
      <X size={18} />
      Close preview
    </button>
  );
}
