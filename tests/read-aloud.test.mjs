import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Run the actual component with deterministic hooks/audio; no provider credits or database needed.
const compiled = ts.transpileModule(readFileSync('src/components/ReadAloud.tsx', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function harness(fetcher) {
  let cursor = 0;
  const slots = [], effects = [], players = [], revoked = [];
  const preferences = { speechRate: 1, autoRead: false, highlightSpeech: true };
  const hooks = {
    useState(initial) { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, value => { slots[i].value = value; }]; },
    useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((v, n) => v !== slots[i].deps[n])) {
        effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
      }
    },
  };
  class Audio {
    dataset = {}; playbackRate = 1; paused = true;
    constructor() { players.push(this); }
    async play() { this.paused = false; }
    pause() { this.paused = true; }
    removeAttribute() {} load() {}
  }
  const window = new EventTarget();
  const spoken = [];
  window.speechSynthesis = { cancel() {}, speak(value) { spoken.push(value.text); value.onstart?.(); }, pause() {}, resume() {} };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (name === 'lucide-react') return { Volume2: 'icon' };
      if (name === './StudentAccessibility') return { useAccessibility: () => ({ preferences }) };
      throw new Error(name);
    },
    window, document: { documentElement: { lang: 'en' } }, Audio, AbortController, Event, DOMException,
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    fetch: fetcher, URL: { createObjectURL: () => `blob:${Math.random()}`, revokeObjectURL: url => revoked.push(url) },
  });
  let props = { text: 'First question.', questionId: '1' };
  function render(changes = {}) {
    props = { ...props, ...changes }; cursor = 0;
    const tree = exports.ReadAloud(props);
    effects.splice(0).forEach(fn => fn());
    return tree;
  }
  function button(label) {
    const visit = node => {
      if (!node) return;
      if (Array.isArray(node)) return node.map(visit).find(Boolean);
      if (node.type === 'button' && JSON.stringify(node.props.children).includes(label)) return node;
      return visit(node.props?.children);
    };
    return visit(render());
  }
  render();
  return { render, button, players, spoken, preferences, revoked, cleanup: () => slots.forEach(s => s?.cleanup?.()) };
}
const audioResponse = () => ({ ok: true, blob: async () => new Blob(['audio']) });

test('AI playback supports pause, resume, rate changes, replay cache and cleanup', async () => {
  let calls = 0;
  const h = harness(async () => { calls++; return audioResponse(); });
  await h.button('Read aloud').props.onClick();
  assert.equal(h.players[0].paused, false);
  h.button('Pause').props.onClick();
  assert.equal(h.players[0].paused, true);
  h.button('Resume').props.onClick();
  await Promise.resolve();
  assert.equal(h.players[0].paused, false);
  h.preferences.speechRate = 0.75; h.render();
  assert.equal(h.players[0].playbackRate, 0.75);
  await h.button('Replay').props.onClick();
  assert.equal(calls, 1);
  assert.equal(h.players[0].paused, true);
  assert.equal(h.players[1].playbackRate, 0.75);
  h.cleanup();
  assert.equal(h.players[1].paused, true);
  assert.equal(h.revoked.length, 1);
});

test('stopping a pending generation prevents late playback', async () => {
  let resolve, signal;
  const h = harness((_url, init) => { signal = init.signal; return new Promise(r => { resolve = r; }); });
  const reading = h.button('Read aloud').props.onClick();
  h.button('Stop').props.onClick();
  assert.equal(signal.aborted, true);
  resolve(audioResponse()); await reading;
  assert.equal(h.players[0].paused, true);
  h.cleanup();
});

test('question changes cancel an old request and never read its stale text', async () => {
  let resolve;
  const h = harness(() => new Promise(r => { resolve = r; }));
  const reading = h.button('Read aloud').props.onClick();
  h.render({ text: 'Second question.', questionId: '2' });
  resolve(audioResponse()); await reading;
  assert.equal(h.players[0].paused, true);
  assert.deepEqual(h.spoken, []);
  h.cleanup();
});

test('provider failure falls back to device speech', async () => {
  const h = harness(async () => ({ ok: false }));
  await h.button('Read aloud').props.onClick();
  assert.deepEqual(h.spoken, ['First question.']);
  h.cleanup();
});

test('browser autoplay blocking asks for a click without switching voices', async () => {
  const h = harness(async () => audioResponse());
  const read = h.button('Read aloud').props.onClick();
  h.players[0].play = async () => { throw new DOMException('Gesture required', 'NotAllowedError'); };
  await read;
  assert.deepEqual(h.spoken, []);
  assert.ok(JSON.stringify(h.render()).includes('Select Read aloud to start the voice.'));
  h.cleanup();
});

test('overlapping requests only play the most recently requested audio', async () => {
  const pending = [];
  const h = harness(() => new Promise(resolve => pending.push(resolve)));
  const first = h.button('Read aloud').props.onClick();
  const second = h.button('Replay').props.onClick();
  pending[1](audioResponse()); await second;
  pending[0](audioResponse()); await first;
  assert.equal(h.players[0].paused, true);
  assert.equal(h.players[1].paused, false);
  h.cleanup();
});
