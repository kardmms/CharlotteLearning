import type { ReactNode } from "react";
import { ShowcaseGuide } from "@/components/ShowcaseGuide";
import { ShowcaseSimulationPulse } from "@/components/ShowcaseSimulationPulse";
import { getTeacherSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { effectiveShowcaseExpiry } from "@/lib/showcase-policy";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const session = await getTeacherSession();
  const showcaseTeacher = session?.showcase
    ? await prisma.teacher.findUnique({
      where: { id: session.sub },
      select: {
        createdAt: true,
        showcaseExpiresAt: true,
        classrooms: {
          where: { archivedAt: null },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: {
            id: true,
            materials: {
              where: { isAdaptiveHome: false, activityKind: "IN_CLASS" },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true }
            }
          }
        }
      }
    })
    : null;
  const showcaseWorkspace = showcaseTeacher?.classrooms[0];
  return (
    <>
      {session?.showcase ? (
        <>
          <ShowcaseGuide
            classroomId={showcaseWorkspace?.id}
            materialId={showcaseWorkspace?.materials[0]?.id}
          />
          <ShowcaseSimulationPulse
            expiresAt={showcaseTeacher
              ? effectiveShowcaseExpiry(
                showcaseTeacher.createdAt,
                showcaseTeacher.showcaseExpiresAt
              ).toISOString()
              : undefined}
          />
        </>
      ) : null}
      {children}
    </>
  );
}
