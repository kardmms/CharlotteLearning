"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function currentFullscreenElement() {
  const fullscreenDocument = document as FullscreenDocument;
  return document.fullscreenElement || fullscreenDocument.webkitFullscreenElement || null;
}

export function VocabDashFullscreenButton({ targetId }: { targetId: string }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    const fullscreenDocument = document as FullscreenDocument;
    setIsSupported(Boolean(document.fullscreenEnabled || fullscreenDocument.webkitFullscreenEnabled));

    function syncFullscreenState() {
      setIsFullscreen(Boolean(currentFullscreenElement()));
    }

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
    };
  }, []);

  async function toggleFullscreen() {
    const fullscreenDocument = document as FullscreenDocument;
    if (currentFullscreenElement()) {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else {
        await fullscreenDocument.webkitExitFullscreen?.();
      }
      return;
    }

    const target = document.getElementById(targetId) as FullscreenElement | null;
    if (!target) return;
    if (target.requestFullscreen) {
      await target.requestFullscreen();
    } else {
      await target.webkitRequestFullscreen?.();
    }
  }

  if (!isSupported) return null;

  return (
    <button
      className="vocab-dash-fullscreen-button"
      type="button"
      onClick={() => void toggleFullscreen()}
      aria-pressed={isFullscreen}
    >
      {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      {isFullscreen ? "Exit full screen" : "Full screen"}
    </button>
  );
}
