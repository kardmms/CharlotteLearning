export const MAX_SPEECH_CHARACTERS = 10_000;

export function parseSpeechText(body: unknown): string | null {
  if (!body || typeof body !== 'object' || !('text' in body) || typeof body.text !== 'string') return null;
  const text = body.text.trim();
  return text && text.length <= MAX_SPEECH_CHARACTERS ? text : null;
}

export function generateSpeech(
  text: string,
  config: { apiKey: string; voiceId: string; modelId: string },
  fetcher: typeof fetch,
  signal: AbortSignal,
) {
  return fetcher(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': config.apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: config.modelId,
      voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
    }),
    signal,
    cache: 'no-store',
    redirect: 'error',
  });
}
