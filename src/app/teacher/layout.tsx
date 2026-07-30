import type { ReactNode } from "react";
import { ShowcaseGuide } from "@/components/ShowcaseGuide";
import { ShowcaseSimulationPulse } from "@/components/ShowcaseSimulationPulse";
import { getTeacherSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const session = await getTeacherSession();
  const showcaseWorkspace = session?.showcase
    ? await prisma.classroom.findFirst({
      where: { teacherId: session.sub, archivedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        materials: {
          where: { isAdaptiveHome: false, activityKind: "IN_CLASS" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true }
        }
      }
    })
    : null;
  return (
    <>
      {session?.showcase ? (
        <>
          <ShowcaseGuide
            classroomId={showcaseWorkspace?.id}
            materialId={showcaseWorkspace?.materials[0]?.id}
          />
          <ShowcaseSimulationPulse />
        </>
      ) : null}
      {children}
    </>
  );
}
