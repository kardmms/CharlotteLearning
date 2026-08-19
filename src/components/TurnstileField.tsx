import { turnstileSiteKey } from "@/lib/bot-protection";
import { TurnstileWidget } from "@/components/TurnstileWidget";

export function TurnstileField({ action }: { action: string }) {
  const siteKey = turnstileSiteKey();
  if (!siteKey) return null;

  return <TurnstileWidget action={action} siteKey={siteKey} />;
}
