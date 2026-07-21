import Script from "next/script";
import { turnstileSiteKey } from "@/lib/bot-protection";

export function TurnstileField({ action }: { action: string }) {
  const siteKey = turnstileSiteKey();
  if (!siteKey) return null;

  return (
    <div className="turnstile-field">
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer strategy="afterInteractive" />
      <div
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-action={action}
        data-size="invisible"
      />
    </div>
  );
}
