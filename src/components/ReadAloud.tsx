'use client';
import { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { useAccessibility } from './StudentAccessibility';

export function ReadAloud({ text, questionId, choices = [], heading = true, auto = true }: { text: string; questionId: string; choices?: string[]; heading?: boolean; auto?: boolean }) {
  const { preferences } = useAccessibility();
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<'idle' | 'reading' | 'paused'>('idle');
  const [message, setMessage] = useState('');
  const [readingText, setReadingText] = useState('');
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const mounted = useRef(true);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousQuestion = useRef(questionId);
  useEffect(() => { if (previousQuestion.current !== questionId) headingRef.current?.focus(); previousQuestion.current = questionId; }, [questionId]);
  function stop() {
    if (utterance.current) { utterance.current.onend = null; utterance.current.onerror = null; window.speechSynthesis.cancel(); utterance.current = null; }
    setState('idle'); setReadingText('');
  }
  function speak(value = text) {
    if (!('speechSynthesis' in window)) return;
    window.dispatchEvent(new Event('charlotte-stop-speech'));
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(value);
    speech.lang = document.documentElement.lang || 'en';
    speech.rate = preferences.speechRate;
    utterance.current = speech;
    speech.onstart = () => { if (mounted.current) { setState('reading'); setReadingText(value); setMessage(''); } };
    speech.onend = () => { if (mounted.current) { setState('idle'); setReadingText(''); utterance.current = null; } };
    speech.onerror = event => { if (mounted.current) { setState('idle'); setReadingText(''); if (event.error !== 'canceled' && event.error !== 'interrupted') setMessage('Read aloud could not start. Try the Read aloud button or your device’s screen reader.'); } };
    window.speechSynthesis.speak(speech);
  }
  useEffect(() => {
    mounted.current = true;
    setSupported('speechSynthesis' in window);
    const cancel = () => stop();
    window.addEventListener('charlotte-stop-speech', cancel);
    return () => { mounted.current = false; window.removeEventListener('charlotte-stop-speech', cancel); if (utterance.current) { utterance.current.onend = null; utterance.current.onerror = null; window.speechSynthesis.cancel(); utterance.current = null; } };
  }, []);
  useEffect(() => {
    stop();
    if (auto && preferences.autoRead && 'speechSynthesis' in window) speak();
    return () => { if (utterance.current) { utterance.current.onend = null; utterance.current.onerror = null; window.speechSynthesis.cancel(); utterance.current = null; } };
    // A new question or auto-read setting starts fresh, never on an answer selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId, text, preferences.autoRead, auto]);
  return <div className={`read-aloud ${readingText === text && preferences.highlightSpeech ? 'speech-highlight' : ''}`}>
    {heading && <h2 ref={headingRef} tabIndex={-1}>{text}</h2>}
    <div className="read-aloud-controls" aria-label="Read aloud controls">
      <button type="button" className="ghost-button" data-no-loading="true" disabled={!supported} onClick={() => speak()}><Volume2 size={18} />{state === 'idle' ? 'Read aloud' : 'Replay'}</button>
      {state !== 'idle' && <>
        <button type="button" className="ghost-button" data-no-loading="true" onClick={() => { if (state === 'paused') { window.speechSynthesis.resume(); setState('reading'); } else { window.speechSynthesis.pause(); setState('paused'); } }}>{state === 'paused' ? 'Resume' : 'Pause'}</button>
        <button type="button" className="ghost-button" data-no-loading="true" onClick={stop}>Stop</button>
      </>}
      {choices.length > 0 && <details><summary>Read answer choices</summary>{choices.map((choice, index) => <button className={`ghost-button ${readingText === choice && preferences.highlightSpeech ? 'speech-highlight' : ''}`} type="button" data-no-loading="true" key={`${index}-${choice}`} onClick={() => speak(choice)} disabled={!supported}>Read {String.fromCharCode(65 + index)}: {choice}</button>)}</details>}
    </div>
    <span className="speech-status" role="status">{!supported ? 'Read aloud is unavailable in this browser. You can use your device’s screen reader.' : message || (state === 'reading' ? 'Reading aloud' : state === 'paused' ? 'Reading paused' : '')}</span>
  </div>;
}

export function AccessiblePassage({ text }: { text: string }) {
  const { preferences } = useAccessibility();
  const parts = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [text];
  const [part, setPart] = useState(0);
  const [guide, setGuide] = useState(0);
  useEffect(() => { setPart(0); setGuide(0); }, [text]);
  const index = Math.min(part, parts.length - 1);
  return <div className="accessible-passage">
    {preferences.readingGuide && <label>Reading guide position <input aria-label="Reading guide position" type="range" min="0" max="95" value={guide} onChange={event => setGuide(Number(event.target.value))} /></label>}
    <div className="passage-text"><p>{preferences.compactReading ? parts[index] : text}</p>{preferences.readingGuide && <div className="reading-guide" aria-hidden="true" style={{ top: `${guide}%` }} />}</div>
    {preferences.compactReading && <div className="read-aloud-controls"><button type="button" className="ghost-button" data-no-loading="true" disabled={index === 0} onClick={() => setPart(index - 1)}>Previous section</button><span role="status">Section {index + 1} of {parts.length}</span><button type="button" className="ghost-button" data-no-loading="true" disabled={index === parts.length - 1} onClick={() => setPart(index + 1)}>Next section</button></div>}
    <ReadAloud text={preferences.compactReading ? parts[index] : text} questionId={`passage-${index}`} heading={false} auto={false} />
  </div>;
}

export function AccessibleInstructions({ steps }: { steps: string[] }) {
  const { preferences } = useAccessibility();
  const [index, setIndex] = useState(0);
  return preferences.stepInstructions ? <div className="instruction-steps"><p role="status">Step {index + 1} of {steps.length}: {steps[index]}</p><button type="button" className="ghost-button" data-no-loading="true" onClick={() => setIndex((index + 1) % steps.length)}>{index === steps.length - 1 ? 'Review steps' : 'Next instruction'}</button></div> : <p className="instruction-steps">{steps.join(' ')}</p>;
}
