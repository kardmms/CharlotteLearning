"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      execution: "execute";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
    }
  ) => string;
  execute: (widgetId: string) => void;
  remove?: (widgetId: string) => void;
  reset?: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function isFormSubmitter(
  submitter: HTMLElement | null,
  form: HTMLFormElement
): submitter is HTMLButtonElement | HTMLInputElement {
  return (
    (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) &&
    submitter.form === form
  );
}

export function TurnstileWidget({
  action,
  siteKey
}: {
  action: string;
  siteKey: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const pendingSubmitterRef = useRef<HTMLElement | null>(null);
  const verifiedSubmitRef = useRef(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [status, setStatus] = useState("");

  const clearToken = useCallback(() => {
    verifiedSubmitRef.current = false;
    if (tokenInputRef.current) tokenInputRef.current.value = "";
  }, []);

  const submitVerifiedForm = useCallback((token: string) => {
    const form = containerRef.current?.closest("form");
    if (!form || !tokenInputRef.current) return;

    tokenInputRef.current.value = token;
    verifiedSubmitRef.current = true;
    setStatus("");

    const submitter = pendingSubmitterRef.current;
    if (isFormSubmitter(submitter, form)) {
      form.requestSubmit(submitter);
    } else {
      form.requestSubmit();
    }
  }, []);

  const resetAfterFailure = useCallback(() => {
    clearToken();
    setStatus("Verification could not complete. Please try again.");
    const widgetId = widgetIdRef.current;
    if (widgetId) window.turnstile?.reset?.(widgetId);
  }, [clearToken]);

  useEffect(() => {
    if (!scriptReady || widgetIdRef.current || !containerRef.current || !window.turnstile) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      execution: "execute",
      callback: submitVerifiedForm,
      "error-callback": resetAfterFailure,
      "expired-callback": resetAfterFailure,
      "timeout-callback": resetAfterFailure
    });

    return () => {
      const widgetId = widgetIdRef.current;
      if (widgetId) window.turnstile?.remove?.(widgetId);
      widgetIdRef.current = null;
    };
  }, [action, resetAfterFailure, scriptReady, siteKey, submitVerifiedForm]);

  useEffect(() => {
    const form = containerRef.current?.closest("form");
    if (!form) return;

    function verifyBeforeSubmit(event: SubmitEvent) {
      if (verifiedSubmitRef.current && tokenInputRef.current?.value) return;

      event.preventDefault();
      pendingSubmitterRef.current = event.submitter instanceof HTMLElement ? event.submitter : null;
      clearToken();

      const widgetId = widgetIdRef.current;
      if (!scriptReady || !widgetId || !window.turnstile) {
        setStatus("Verification is loading. Please try again.");
        return;
      }

      setStatus("");
      try {
        window.turnstile.execute(widgetId);
      } catch {
        resetAfterFailure();
      }
    }

    form.addEventListener("submit", verifyBeforeSubmit);
    return () => form.removeEventListener("submit", verifyBeforeSubmit);
  }, [clearToken, resetAfterFailure, scriptReady]);

  return (
    <div className="turnstile-field">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        async
        defer
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => setStatus("Verification could not load. Please refresh and try again.")}
      />
      <input ref={tokenInputRef} type="hidden" name="cf-turnstile-response" />
      <div ref={containerRef} />
      {status ? (
        <p className="turnstile-status" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
