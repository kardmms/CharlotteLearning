"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function InteractionFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
    document.querySelectorAll(".click-loading").forEach((element) => {
      element.classList.remove("click-loading");
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    let timer: number | undefined;

    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const clickable = target?.closest<HTMLElement>("a, button");
      if (!clickable || clickable.hasAttribute("disabled")) return;
      if (clickable.dataset.noLoading === "true") return;
      if (clickable instanceof HTMLAnchorElement) {
        const href = clickable.getAttribute("href") || "";
        if (href.startsWith("#") || clickable.hasAttribute("download")) return;
      }

      clickable.classList.add("click-loading");
      setLoading(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        clickable.classList.remove("click-loading");
        setLoading(false);
      }, 1400);
    }

    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
      window.clearTimeout(timer);
    };
  }, []);

  return <div className={`route-loading-bar ${loading ? "active" : ""}`} aria-hidden="true" />;
}
