// Generates a non-student sample to verify credentials, voice access, and MP3 output.
// Run: node --experimental-strip-types scripts/verify-natural-voice.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { generateSpeech } from '../src/lib/speech-provider.ts';

try { process.loadEnvFile('.env.local'); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error('Set ELEVENLABS_API_KEY in .env.local before running the live voice check.');
  process.exitCode = 1;
} else {
  try {
    const response = await generateSpeech(
      'Welcome to Charlotte. Let’s read together. Take your time, listen closely, and choose the answer that best explains the passage.',
      {
        apiKey,
        voiceId: process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb',
        modelId: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
      },
      fetch,
      AbortSignal.timeout(30_000),
    );
    if (!response.ok) {
      // Do not print provider bodies, headers, or secrets.
      await response.body?.cancel();
      throw new Error(`ElevenLabs returned HTTP ${response.status}. Check the key, voice access, and account credits.`);
    }
    if (!response.headers.get('content-type')?.startsWith('audio/')) {
      await response.body?.cancel();
      throw new Error('ElevenLabs did not return audio.');
    }
    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length < 128) throw new Error('ElevenLabs returned an empty or incomplete audio sample.');
    await mkdir('outputs/natural-voice', { recursive: true });
    await writeFile('outputs/natural-voice/charlotte-sample.mp3', audio);
    console.log(`Live ElevenLabs generation passed (${audio.length} bytes). Sample: outputs/natural-voice/charlotte-sample.mp3`);
    const allowed = process.env.ALLOWED_OUTBOUND_HOSTS;
    if (allowed && !allowed.split(',').some(host => host.trim().toLowerCase() === 'api.elevenlabs.io')) {
      console.error('Charlotte also needs api.elevenlabs.io added to ALLOWED_OUTBOUND_HOSTS.');
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Live voice verification failed.');
    process.exitCode = 1;
  }
}
