import { NextResponse } from "next/server";
import { clearTeacherSession, getTeacherSession } from "@/lib/auth";
import { deleteShowcaseWorkspace } from "@/lib/showcase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getTeacherSession();
  if (session?.showcase) {
    await deleteShowcaseWorkspace(session.sub).catch(() => undefined);
  }
  await clearTeacherSession();
  return NextResponse.redirect(new URL("/showcase?expired=1", request.url));
}
