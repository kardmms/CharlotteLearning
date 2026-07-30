"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { getTeacherSession, hashPassword, setShowcaseTeacherSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clearExpiredRateLimits, enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { createShowcaseWorkspace, deleteShowcaseWorkspace } from "@/lib/showcase";

export async function startShowcase() {
  try {
    await enforceRateLimit({ scope: "showcase-start", limit: 8, windowSeconds: 60 * 60 });
    await clearExpiredRateLimits();
  } catch (error) {
    if (error instanceof RateLimitError) {
      redirect(`/showcase?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  const currentSession = await getTeacherSession();
  if (currentSession) {
    const currentTeacher = await prisma.teacher.findUnique({
      where: { id: currentSession.sub },
      select: { id: true, isShowcase: true }
    });
    if (currentTeacher?.isShowcase) {
      await deleteShowcaseWorkspace(currentTeacher.id).catch(() => undefined);
    }
  }

  const passwordHash = await hashPassword(crypto.randomBytes(32).toString("base64url"));
  const workspace = await createShowcaseWorkspace(passwordHash);
  await setShowcaseTeacherSession(workspace.teacher);
  // Resolve the classroom from the session on the next request. If two tabs
  // start a showcase together, whichever session cookie wins also determines
  // the destination instead of leaving the other tab on a mismatched class ID.
  redirect("/teacher");
}
