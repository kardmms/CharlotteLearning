'use client';
import { useEffect, useRef, type ReactNode } from 'react';
/** Native modal focus containment, Escape handling, and focus restoration. */
export function StudentDialog({ className, label, onDismiss, children }: { className: string; label: string; onDismiss: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => { previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={className} aria-label={label} onCancel={event => { event.preventDefault(); onDismiss(); }}>{children}</dialog>;
}
