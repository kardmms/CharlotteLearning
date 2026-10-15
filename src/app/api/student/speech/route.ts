import { NextResponse } from 'next/server';
import { getStudentSession } from '@/lib/auth';
import { restrictedFetch } from '@/lib/outbound';
import { enforceRateLimit, RateLimitError } from '@/lib/rate-limit';
import { assertSameOrigin, isSameOriginError } from '@/lib/security';
import { generateSpeech, parseSpeechText } from '@/lib/speech-provider';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const student = await getStudentSession();
    if (!student?.studentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Natural voice is not configured' }, { status: 503 });
    await enforceRateLimit({ scope: 'student-speech', limit: 120, windowSeconds: 3600, identifier: student.studentId });
    // Bound the streamed body too: Content-Length is optional and cannot be trusted.
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    let body = '';
    let bytes = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 64_000) {
          await reader.cancel();
          return NextResponse.json({ error: 'Text is too long' }, { status: 413 });
        }
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
    } finally { reader.releaseLock(); }
    let parsed: unknown;
    try { parsed = JSON.parse(body); }
    catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
    const text = parseSpeechText(parsed);
    if (!text) return NextResponse.json({ error: 'Provide between 1 and 10,000 characters' }, { status: 400 });
    const response = await generateSpeech(text, {
      apiKey,
      voiceId: process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb',
      modelId: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
    }, restrictedFetch, AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]));
    if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/')) {
      await response.body?.cancel();
      return NextResponse.json({ error: 'Natural voice is temporarily unavailable' }, { status: 502 });
    }
    return new Response(response.body, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (error) {
    if (isSameOriginError(error)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, {
      status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) },
    });
    return NextResponse.json({ error: 'Natural voice is temporarily unavailable' }, { status: 503 });
  }
}
