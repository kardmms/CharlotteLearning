'use client';
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { accessibilityDefaults, normalizeAccessibility, type AccessibilityPreferences } from '@/lib/accessibility';
import { saveAccessibility } from '@/app/student/settings/actions';

const Context = createContext({ preferences: accessibilityDefaults, update: (_: AccessibilityPreferences) => {}, status: '', available: false });
export const useAccessibility = () => useContext(Context);

export function StudentAccessibility({ accountId, initial, secondary = false, children }: { accountId: string; initial: unknown; secondary?: boolean; children: ReactNode }) {
  const [preferences, setPreferences] = useState(() => normalizeAccessibility(initial));
  const [status, setStatus] = useState('');
  const pending = useRef<AccessibilityPreferences | null>(null);
  const saving = useRef(false);
  async function flush() {
    if (saving.current) return;
    saving.current = true;
    while (pending.current) {
      const next = pending.current;
      pending.current = null;
      try { await saveAccessibility(next); if (!pending.current) setStatus('Settings saved to your account.'); }
      catch { setStatus('Could not save to your account. Your changes apply here; change a setting to retry.'); }
    }
    saving.current = false;
  }
  function update(next: AccessibilityPreferences) {
    setPreferences(next);
    setStatus('Saving settings…');
    pending.current = next;
    void flush();
  }
  useEffect(() => {
    // New windows and tabs pick up saved account preferences when reloaded.
    return () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); };
  }, [accountId]);
  useEffect(() => {
    if (!preferences.muteSounds) return;
    const media = new Map<HTMLMediaElement, boolean>();
    const mute = (element: HTMLMediaElement) => { if (element.dataset.essentialAudio === 'true') return; if (!media.has(element)) media.set(element, element.muted); element.muted = true; };
    document.querySelectorAll<HTMLMediaElement>('audio,video').forEach(mute);
    const onPlay = (event: Event) => { if (event.target instanceof HTMLMediaElement) mute(event.target); };
    document.addEventListener('play', onPlay, true);
    return () => { document.removeEventListener('play', onPlay, true); media.forEach((muted, element) => { element.muted = muted; }); };
  }, [preferences.muteSounds]);
  const classes = Object.entries(preferences).filter(([, value]) => value === true).map(([key]) => `a11y-${key}`).join(' ');
  return <Context.Provider value={{ preferences, update, status, available: true }}>
    <div className={`student-accessibility ${secondary ? 'student-secondary' : ''} ${classes} ${preferences.textSize !== 100 ? 'a11y-textScaled' : ''}`} style={{ '--student-text-scale': preferences.textSize / 100 } as CSSProperties}>
      <a className="skip-link" href="#student-content">Skip to content</a>
      <div id="student-content" tabIndex={-1}>{children}</div>
    </div>
  </Context.Provider>;
}

const groups: { title: string; fields: [keyof AccessibilityPreferences, string][] }[] = [
  { title: 'Reading & language', fields: [['autoRead', 'Automatically read questions'], ['lineSpacing', 'Increase line spacing'], ['letterSpacing', 'Increase letter spacing'], ['readingFont', 'Use a reading-friendly font'], ['highlightSpeech', 'Highlight text being read'], ['compactReading', 'Show reading passages in smaller sections']] },
  { title: 'Focus & attention', fields: [['focusMode', 'Focus Mode — hide extra question decorations'], ['reducedDistractions', 'Reduce distractions and decorative rewards'], ['reducedMotion', 'Reduce motion and nonessential animations'], ['stepInstructions', 'Show instructions one step at a time'], ['highlightTask', 'Highlight the current question'], ['readingGuide', 'Show a movable reading guide']] },
  { title: 'Visual accessibility', fields: [['highContrast', 'High contrast'], ['colorSafe', 'Use a color-blind-friendly palette']] },
  { title: 'Interaction & motor', fields: [['largeControls', 'Larger buttons and touch targets']] },
  { title: 'Audio', fields: [['muteSounds', 'Mute nonessential sounds']] },
];
export function AccessibilitySettings() {
  const { preferences, update, status } = useAccessibility();
  return <section className="accessibility-settings" aria-label="Accessibility settings">
    <p>Combine the options that help you. Changes apply immediately and save to your account.</p>
    <label>Text size <select aria-label="Text size" value={preferences.textSize} onChange={event => update({ ...preferences, textSize: Number(event.target.value) })}>{[100,125,150,200].map(size => <option key={size} value={size}>{size}%</option>)}</select></label>
    <label>Read-aloud speed <select aria-label="Read-aloud speed" value={preferences.speechRate} onChange={event => update({ ...preferences, speechRate: Number(event.target.value) })}>{[0.5,0.75,1,1.25,1.5,2].map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select></label>
    {groups.map(group => <details key={group.title}><summary>{group.title}</summary>
      {group.fields.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(preferences[key])} onChange={event => update({ ...preferences, [key]: event.target.checked })} />{label}</label>)}
      {group.title === 'Interaction & motor' && <p>Use Tab and Shift+Tab to move, and Enter or Space to activate buttons. Focus outlines are always visible.</p>}
      {group.title === 'Audio' && <p>Every question has Read aloud controls. Important feedback is also shown as text. Your browser may require a first click before auto-read works.</p>}
    </details>)}
    <button className="ghost-button" type="button" data-no-loading="true" onClick={() => update({ ...accessibilityDefaults })}>Reset accessibility settings</button>
    <p role="status">{status}</p>
  </section>;
}
export function AccessibilityMenu() {
  const { available } = useAccessibility();
  if (!available) return null;
  return <details className="accessibility-menu"><summary>Accessibility</summary><AccessibilitySettings /></details>;
}
