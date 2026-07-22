"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Copy, KeyRound } from "lucide-react";
import { clearClassRecoveryKeyFlash } from "@/app/teacher/actions";

export function RecoveryKeyPopup({
  classroomName,
  recoveryKey
}: {
  classroomName: string;
  recoveryKey: string;
}) {
  const [open, setOpen] = useState(Boolean(recoveryKey));
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!recoveryKey) return;
    startTransition(() => {
      void clearClassRecoveryKeyFlash().catch(() => {});
    });
  }, [recoveryKey, startTransition]);

  if (!open) return null;

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="recovery-popup-backdrop" role="presentation">
      <section
        className="recovery-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-popup-title"
      >
        <div className="recovery-popup-icon">
          <KeyRound size={30} />
        </div>
        <div>
          <div className="eyebrow">Save this once</div>
          <h2 id="recovery-popup-title">Classroom recovery key</h2>
          <p>
            This is the recovery key for <strong>{classroomName}</strong>. Save it somewhere secure.
            Charlotte will not show this key again after this popup.
          </p>
        </div>
        <code>{recoveryKey}</code>
        <div className="recovery-popup-actions">
          <button className="ghost-button" type="button" onClick={copyKey}>
            {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
            {copied ? "Copied" : "Copy key"}
          </button>
          <button className="button" type="button" onClick={() => setOpen(false)}>
            I saved this key
          </button>
        </div>
      </section>
    </div>
  );
}
