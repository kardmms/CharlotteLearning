import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { extendDailyHomePractice } from "@/lib/home-learning";
import { clearExpiredRateLimits, enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 30;

function parseChoices(value?: string | null) {
  if (!value) return [];
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [];
  }
}

function shuffledChoices(choices: string[], seed: string) {
  const output = [...choices];
  let state = [...seed].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
  for (let index = output.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const target = state % (index + 1);
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    assertSameOrigin(request);
    const student = await getStudentSession();
    if (!student?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { sessionId } = await params;
    await enforceRateLimit({
      scope: "student-extend-practice",
      limit: 12,
      windowSeconds: 60 * 60,
      identifier: `${student.studentId}:${sessionId}`
    });
    await clearExpiredRateLimits();
    const questions = await extendDailyHomePractice(sessionId, student.studentId);
    return NextResponse.json({
      questions: questions.map((question) => ({
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        choices: shuffledChoices(parseChoices(question.choicesJson), `${sessionId}:${question.id}`),
        skillTag: question.skillTag,
        standardCode: question.standardCode,
        explanation: question.explanation,
        contextExcerpt: question.contextExcerpt,
        sourcePage: question.sourcePage,
        timeLimitSeconds: question.timeLimitSeconds,
        existingAnswer: "",
        existingIsCorrect: null,
        existingAttemptCount: 0,
        existingPointsEarned: 0,
        existingRevealed: false
      }))
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    return NextResponse.json({ error: "Could not prepare more questions" }, { status: 500 });
  }
}
