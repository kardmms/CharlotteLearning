import type { ReactNode } from "react";
import { ShowcaseSimulationPulse } from "@/components/ShowcaseSimulationPulse";
import { getTeacherSession } from "@/lib/auth";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const session = await getTeacherSession();
  return (
    <>
      {session?.showcase ? <ShowcaseSimulationPulse /> : null}
      {children}
    </>
  );
}
