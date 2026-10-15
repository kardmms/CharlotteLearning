import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSpeech, parseSpeechText } from '../src/lib/speech-provider.ts';

test('rejects malformed, empty and oversized speech without truncating passages', () => {
  for (const value of [null, [], {}, { text: 42 }, { text: '  ' }, { text: 'a'.repeat(10001) }]) {
    assert.equal(parseSpeechText(value), null);
  }
  assert.equal(parseSpeechText({ text: '  Read the whole passage.  ' }), 'Read the whole passage.');
  assert.equal(parseSpeechText({ text: 'a'.repeat(10000) })?.length, 10000);
});

test('speech request uses fixed provider, server credentials, narration settings and cancellation', async () => {
  const controller = new AbortController();
  let called = false;
  const fetcher: typeof fetch = async (input, init) => {
    called = true;
    assert.equal(String(input), 'https://api.elevenlabs.io/v1/text-to-speech/voice%2Fid?output_format=mp3_44100_128');
    assert.equal((init?.headers as Record<string, string>)['xi-api-key'], 'test-key');
    assert.equal(init?.signal, controller.signal);
    assert.equal(init?.redirect, 'error');
    assert.equal(init?.cache, 'no-store');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.text, 'A complete sentence.');
    assert.equal(body.model_id, 'eleven_multilingual_v2');
    assert.equal(body.voice_settings.stability, 0.45);
    return new Response('audio', { headers: { 'Content-Type': 'audio/mpeg' } });
  };
  const result = await generateSpeech('A complete sentence.', {
    apiKey: 'test-key', voiceId: 'voice/id', modelId: 'eleven_multilingual_v2',
  }, fetcher, controller.signal);
  assert.ok(called);
  assert.equal(await result.text(), 'audio');
});
