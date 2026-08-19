"use client";

import { useEffect } from "react";

export function VocabDashLobbyGuard({ roomId }: { roomId: string }) {
  useEffect(() => {
    let startingGame = false;
    const allowStartNavigation = () => { startingGame = true; };
    const rotateRoom = () => {
      if (startingGame) return;
      void fetch(`/api/teacher/games/vocab-dash/rooms/${roomId}/rotate`, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
    };
    window.addEventListener("vocabdash:start", allowStartNavigation);
    window.addEventListener("pagehide", rotateRoom);
    return () => {
      window.removeEventListener("vocabdash:start", allowStartNavigation);
      window.removeEventListener("pagehide", rotateRoom);
    };
  }, [roomId]);

  return null;
}
