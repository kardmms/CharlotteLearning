import { notFound } from "next/navigation";
import { ClosePreviewButton } from "@/components/ClosePreviewButton";
import { StudentStation } from "@/components/StudentStation";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { studentBandClass } from "@/lib/grade";
import { excerptForIndex } from "@/lib/text-context";

export const dynamic = "force-dynamic";

function parseChoices(choicesJson?: string | null) {
  if (!choicesJson) return [];
  try {
    return JSON.parse(choicesJson) as string[];
  } catch {
    return [];
  }
}

export default async function TeacherPreviewPage({
  params
}: {
  params: Promise<{ classroomId: string; materialId: string }>;
}) {
  const teacher = await requireTeacher();
  const { classroomId, materialId } = await params;
  const material = await prisma.material.findFirst({
    where: { id: materialId, classroomId, teacherId: teacher.id },
    include: {
      classroom: true,
      questions: { orderBy: { sortOrder: "asc" } }
    }
  });
  if (!material) notFound();

  const reviewHref = `/teacher/classes/${classroomId}/materials/${materialId}/review`;
  const sourceText = material.sourceText || material.sourcePreview || "";

  return (
    <div className={`student-shell teacher-preview-shell ${studentBandClass(material.classroom.gradeLevel)}`}>
      <header className="topbar preview-topbar">
        <div className="brand">
          <img className="brand-logo" src="/images/charlotte-ai-logo.png" alt="" />
          <div>
            <strong>Teacher preview</strong>
            <span>Try anything — progress, timing, and focus are not recorded.</span>
          </div>
        </div>
        <ClosePreviewButton fallbackHref={reviewHref} />
      </header>
      <main className="page narrow-page preview-page">
        <StudentStation
          preview
          material={{
            id: material.id,
            title: material.title,
            estimatedMinutes: material.estimatedMinutes,
            activityKind: material.activityKind,
            dueAt: material.dueAt?.toISOString() || null
          }}
          session={{
            id: `preview-${material.id}`,
            signInAt: new Date().toISOString(),
            pointsEarned: 0,
            focusViolationCount: 0
          }}
          questions={material.questions.map((question, index) => {
            const fallbackExcerpt = !question.contextExcerpt && sourceText ? excerptForIndex(sourceText, index) : null;
            return {
              id: question.id,
              type: question.type,
              prompt: question.prompt,
              choices: parseChoices(question.choicesJson),
              correctAnswer: question.correctAnswer,
              skillTag: question.skillTag,
              standardCode: question.standardCode,
              contextExcerpt: question.contextExcerpt || fallbackExcerpt?.excerpt || null,
              sourcePage: question.sourcePage || fallbackExcerpt?.sourcePage || null,
              timeLimitSeconds: question.timeLimitSeconds,
              existingAnswer: "",
              existingIsCorrect: null,
              existingAttemptCount: 0,
              existingPointsEarned: 0,
              existingRevealed: false
            };
          })}
        />
      </main>
    </div>
  );
}
