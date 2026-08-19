import Link from "next/link";
import { ArrowLeft, FileUp, Keyboard, Sparkles } from "lucide-react";
import { createVocabDashDraft } from "@/app/teacher/actions";
import { TeacherTopbar } from "@/components/AppTopbar";
import { Message } from "@/components/Message";
import { VocabWordCountSlider } from "@/components/VocabWordCountSlider";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gradeLabel } from "@/lib/grade";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewVocabDashPage({
  searchParams
}: {
  searchParams: Promise<{ classroomId?: string; error?: string }>;
}) {
  const params = await searchParams;
  const classroomId = params.classroomId?.split("?")[0];
  const teacher = await requireTeacher();
  const fallbackClassroom = !classroomId
    ? await prisma.classroom.findFirst({
        where: { teacherId: teacher.id, schoolId: teacher.schoolId, archivedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true }
      })
    : null;
  if (!classroomId && fallbackClassroom) {
    redirect(`/teacher/games/vocab-dash/new?classroomId=${fallbackClassroom.id}`);
  }

  const classroom = classroomId
    ? await prisma.classroom.findFirst({
        where: { id: classroomId, teacherId: teacher.id, schoolId: teacher.schoolId, archivedAt: null },
        select: { id: true, name: true, gradeLevel: true }
      })
    : null;
  if (!classroom) notFound();

  return (
    <>
      <TeacherTopbar name={teacher.name} classroomId={classroom.id} />
      <main className="page vocab-dash-setup-page">
        <Link className="student-back-link" href={`/teacher/games?classroomId=${classroom.id}`}><ArrowLeft size={18} /> Back to games</Link>
        <section className="vocab-dash-setup-hero">
          <div>
            <div className="eyebrow">Vocab Dash setup</div>
            <h1>Build your word list.</h1>
            <p>
              Upload a reading or type vocabulary words for {classroom.name}. Charlotte will use {gradeLabel(classroom.gradeLevel).toLowerCase()} and generate the definitions before you review the list.
            </p>
          </div>
          <Sparkles size={34} />
        </section>

        <Message error={params.error} />

        <form className="panel vocab-dash-source-form" action={createVocabDashDraft}>
          <input type="hidden" name="classroomId" value={classroom.id} />
          <div className="vocab-class-context">
            <span>Class</span>
            <strong>{classroom.name}</strong>
            <em>{gradeLabel(classroom.gradeLevel)}</em>
          </div>

          <VocabWordCountSlider defaultValue={15} />

          <section className="vocab-source-card">
            <div className="vocab-source-icon"><FileUp size={24} /></div>
            <div>
              <h2>Upload a file</h2>
              <p>Use a PDF, DOCX, or TXT file up to 90 MB. Charlotte will pull the best vocabulary words for this class and write the definitions.</p>
            </div>
            <input name="sourceFile" type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain" />
          </section>

          <section className="vocab-source-card">
            <div className="vocab-source-icon"><Keyboard size={24} /></div>
            <div>
              <h2>Or type words</h2>
              <p>Type at least 10 vocabulary words. Charlotte will generate the definitions for you.</p>
            </div>
            <textarea
              name="manualWords"
              rows={12}
              placeholder={"photosynthesis\nhabitat\nadaptation\necosystem"}
            />
          </section>

          <div className="vocab-dash-form-actions">
            <button className="button vocab-dash-start-button" type="submit">
              <Sparkles size={18} />
              Create word list
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
