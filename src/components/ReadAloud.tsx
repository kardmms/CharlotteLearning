'use client';
import { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { useAccessibility } from './StudentAccessibility';

export function ReadAloud({ text, questionId, choices = [], heading = true, auto = true }: { text: string; questionId: string; choices?: string[]; heading?: boolean; auto?: boolean }) {
  const { preferences } = useAccessibility();
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'reading' | 'paused'>('idle');
  const [message, setMessage] = useState('');
  const [readingText, setReadingText] = useState('');
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const mounted = useRef(true);
  const audio = useRef<HTMLAudioElement | null>(null);
  const pending = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const clips = useRef(new Map<string, string>());
  const speechRate = useRef(preferences.speechRate);
  speechRate.current = preferences.speechRate;
  function disposePlayback() {
    generation.current += 1;
    pending.current?.abort();
    pending.current = null;
    if (audio.current) {
      audio.current.onended = null;
      audio.current.onerror = null;
      audio.current.pause();
      audio.current.removeAttribute('src');
      audio.current.load();
      audio.current = null;
    }
    if (utterance.current) {
      utterance.current.onend = null;
      utterance.current.onerror = null;
      utterance.current.onstart = null;
      window.speechSynthesis.cancel();
      utterance.current = null;
    }
  }
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousQuestion = useRef(questionId);
  useEffect(() => { if (previousQuestion.current !== questionId) headingRef.current?.focus(); previousQuestion.current = questionId; }, [questionId]);
  function stop() {
    disposePlayback();
    setState('idle'); setReadingText('');
  }
  function speakBrowser(value: string) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(value);
    speech.lang = document.documentElement.lang || 'en';
    speech.rate = preferences.speechRate;
    utterance.current = speech;
    speech.onstart = () => { if (mounted.current) { setState('reading'); setReadingText(value); } };
    speech.onend = () => { if (mounted.current) { setState('idle'); setReadingText(''); utterance.current = null; } };
    speech.onerror = event => { if (mounted.current) { setState('idle'); setReadingText(''); if (event.error !== 'canceled' && event.error !== 'interrupted') setMessage('Read aloud could not start. Try the Read aloud button or your device’s screen reader.'); } };
    window.speechSynthesis.speak(speech);
  }
  async function speak(value = text) {
    window.dispatchEvent(new Event('charlotte-stop-speech'));
    const current = generation.current;
    const controller = new AbortController();
    pending.current = controller;
    setState('loading');
    setMessage('');
    setReadingText('');
    const player = new Audio();
    player.dataset.essentialAudio = 'true';
    audio.current = player;
    const isCurrent = () => mounted.current && current === generation.current;
    try {
      let url = clips.current.get(value);
      if (!url) {
        const response = await fetch('/api/student/speech', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: value }), signal: controller.signal,
        });
        if (!response.ok) throw new Error('Speech unavailable');
        const blob = await response.blob();
        if (!isCurrent()) return;
        url = URL.createObjectURL(blob);
        if (clips.current.size >= 4) {
          const oldest = clips.current.keys().next().value!;
          URL.revokeObjectURL(clips.current.get(oldest)!);
          clips.current.delete(oldest);
        }
        clips.current.set(value, url);
      }
      if (!isCurrent()) return;
      player.src = url;
      player.playbackRate = speechRate.current;
      player.preservesPitch = true;
      player.onended = () => { if (isCurrent()) { setState('idle'); setReadingText(''); } };
      player.onerror = () => {
        if (isCurrent()) { setState('idle'); setReadingText(''); setMessage('Audio could not play. Try Read aloud again.'); }
      };
      await player.play();
      if (isCurrent()) { setState('reading'); setReadingText(value); }
    } catch (error) {
      if (!isCurrent() || controller.signal.aborted) return;
      player.pause();
      audio.current = null;
      setState('idle');
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setMessage('Select Read aloud to start the voice.');
      } else if ('speechSynthesis' in window) {
        speakBrowser(value);
        setMessage('Using your device’s voice while the natural voice is unavailable.');
      } else {
        setMessage('Read aloud is temporarily unavailable. Please try again.');
      }
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }
  function togglePause() {
    if (audio.current) {
      if (state === 'paused') {
        const player = audio.current;
        const current = generation.current;
        void player.play().then(() => {
          if (mounted.current && generation.current === current) setState('reading');
        }).catch(() => {
          if (mounted.current && generation.current === current) setMessage('Select Resume to continue reading.');
        });
      } else { audio.current.pause(); setState('paused'); }
    } else if (utterance.current) {
      if (state === 'paused') { window.speechSynthesis.resume(); setState('reading'); }
      else { window.speechSynthesis.pause(); setState('paused'); }
    }
  }
  useEffect(() => {
    if (audio.current) audio.current.playbackRate = preferences.speechRate;
  }, [preferences.speechRate]);
  useEffect(() => {
    mounted.current = true;
    setSupported(typeof Audio !== 'undefined');
    const cancel = () => stop();
    window.addEventListener('charlotte-stop-speech', cancel);
    return () => { mounted.current = false; window.removeEventListener('charlotte-stop-speech', cancel); disposePlayback(); for (const url of clips.current.values()) URL.revokeObjectURL(url); clips.current.clear(); };
  }, []);
  useEffect(() => {
    stop();
    if (auto && preferences.autoRead) void speak();
    return () => { disposePlayback(); for (const url of clips.current.values()) URL.revokeObjectURL(url); clips.current.clear(); };
    // A new question or auto-read setting starts fresh, never on an answer selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId, text, preferences.autoRead, auto]);
  return <div className={`read-aloud ${readingText === text && preferences.highlightSpeech ? 'speech-highlight' : ''}`}>
    {heading && <h2 ref={headingRef} tabIndex={-1}>{text}</h2>}
    <div className="read-aloud-controls" aria-label="Read aloud controls">
      <button type="button" className="ghost-button" data-no-loading="true" disabled={!supported} onClick={() => speak()}><Volume2 size={18} />{state === 'idle' ? 'Read aloud' : 'Replay'}</button>
      {(state === 'reading' || state === 'paused') && <button type="button" className="ghost-button" data-no-loading="true" onClick={togglePause}>{state === 'paused' ? 'Resume' : 'Pause'}</button>}
      {state !== 'idle' && <button type="button" className="ghost-button" data-no-loading="true" onClick={stop}>Stop</button>}
      {choices.length > 0 && <details><summary>Read answer choices</summary>{choices.map((choice, index) => <button className={`ghost-button ${readingText === choice && preferences.highlightSpeech ? 'speech-highlight' : ''}`} type="button" data-no-loading="true" key={`${index}-${choice}`} onClick={() => speak(choice)} disabled={!supported}>Read {String.fromCharCode(65 + index)}: {choice}</button>)}</details>}
    </div>
    <span className="speech-status" role="status">{!supported ? 'Read aloud is unavailable in this browser. You can use your device’s screen reader.' : message || (state === 'loading' ? 'Preparing natural voice…' : state === 'reading' ? 'Reading aloud' : state === 'paused' ? 'Reading paused' : '')}</span>
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
