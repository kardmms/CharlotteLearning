import Link from "next/link";
import { CheckCircle2, Eye, Save, Settings2, Sheet } from "lucide-react";
import { publishMaterial, saveMaterialDraft, unpublishMaterial } from "@/app/teacher/actions";
import { TeacherTopbar } from "@/components/AppTopbar";
import { DeleteMaterialButton } from "@/components/DeleteMaterialButton";
import { IndividualResponsePicker } from "@/components/IndividualResponsePicker";
import { Message } from "@/components/Message";
import { QuestionReviewFields } from "@/components/QuestionReviewFields";
import { QuestionResponseChart } from "@/components/QuestionResponseChart";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function dateTimeInput(date?: Date | null) {
  if (!date) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function parseChoices(choicesJson?: string | null) {
  if (!choicesJson) return [];
  try { return JSON.parse(choicesJson) as string[]; } catch { return []; }
}

export default async function ReviewMaterialPage({ params, searchParams }: {
  params: Promise<{ classroomId: string; materialId: string }>;
  searchParams: Promise<{ error?: string; saved?: string; tab?: string }>;
}) {
  const teacher = await requireTeacher();
  const { classroomId, materialId } = await params;
  const query = await searchParams;
  const tab = query.tab === "responses" || query.tab === "settings" ? query.tab : "questions";
  const material = await prisma.material.findFirst({
    where: { id: materialId, classroomId, teacherId: teacher.id },
    include: {
      classroom: true,
      sessions: {
        where: { status: { in: ["COMPLETED", "PARTIAL"] } },
        orderBy: { completedAt: "desc" },
        include: { student: true, answers: true }
      },
      questions: {
        orderBy: { sortOrder: "asc" },
        include: {
          answers: {
            where: { session: { status: { in: ["COMPLETED", "PARTIAL"] } } }
          }
        }
      }
    }
  });
  if (!material) notFound();

  const finalizedSessions = material.sessions;
  let gradedResponseCount = 0;
  let correctResponseCount = 0;
  let pending = 0;
  for (const session of finalizedSessions) {
    for (const question of material.questions) {
      const answer = session.answers.find((item) => item.questionId === question.id);
      if (!answer || answer.isCorrect === false) {
        gradedResponseCount += 1;
      } else if (answer.isCorrect === true) {
        gradedResponseCount += 1;
        correctResponseCount += 1;
      } else {
        pending += 1;
      }
    }
  }
  const classAverage = gradedResponseCount
    ? Math.round((correctResponseCount / gradedResponseCount) * 100)
    : 0;
  const completed = material.sessions.filter((session) => session.completedCharlotte).length;
  const completion = material.classroom
    ? Math.round((completed / Math.max(1, await prisma.student.count({ where: { classroomId, active: true } }))) * 100)
    : 0;
  const responseOptions = [...finalizedSessions]
    .sort((a, b) => a.student.displayName.localeCompare(b.student.displayName))
    .map((session) => ({
      sessionId: session.id,
      studentName: session.student.displayName,
      status: session.status as "COMPLETED" | "PARTIAL"
    }));

  return (
    <>
      <TeacherTopbar name={teacher.name} classroomId={classroomId} />
      <main className="form-workspace">
        <header className="form-workspace-header">
          <div>
            <Link className="back-link" href={`/teacher/classes/${classroomId}/materials`}>Assignments</Link>
            <h1>{material.title}</h1>
            <span className={`status-pill ${material.status === "PUBLISHED" ? "status-green" : "status-yellow"}`}>
              {material.status.toLowerCase()}
            </span>
          </div>
          <div className="form-workspace-actions">
            <Link
              className="icon-button"
              href={`/teacher/classes/${classroomId}/materials/${material.id}/preview`}
              target="_blank"
              rel="noopener"
              title="Preview as a student"
              aria-label="Preview as a student"
            ><Eye size={19} /></Link>
            <DeleteMaterialButton classroomId={classroomId} materialId={materialId} />
            {material.status === "DRAFT" ? (
              <form action={publishMaterial}>
                <input type="hidden" name="classroomId" value={classroomId} />
                <input type="hidden" name="materialId" value={materialId} />
                <button className="button" type="submit"><CheckCircle2 size={18} /> Publish</button>
              </form>
            ) : (
              <form action={unpublishMaterial}>
                <input type="hidden" name="classroomId" value={classroomId} />
                <input type="hidden" name="materialId" value={materialId} />
                <button className="ghost-button" type="submit">Unpublish</button>
              </form>
            )}
          </div>
        </header>

        <nav className="form-tabs" aria-label="Assignment sections">
          <Link className={tab === "questions" ? "active" : ""} href="?tab=questions">Questions</Link>
          <Link className={tab === "responses" ? "active" : ""} href="?tab=responses">Responses <span>{finalizedSessions.length}</span></Link>
          <Link className={tab === "settings" ? "active" : ""} href="?tab=settings">Settings</Link>
        </nav>

        <div className="form-workspace-body">
          <Message error={query.error} success={query.saved ? "Changes saved." : undefined} />

          {tab === "questions" && (
            <form action={saveMaterialDraft} className="form-question-stack">
              <input type="hidden" name="classroomId" value={classroomId} />
              <input type="hidden" name="materialId" value={materialId} />
              <input type="hidden" name="returnTab" value="questions" />
              <section className="form-title-card"><h2>{material.title}</h2><p>{material.questions.length} questions · {material.estimatedMinutes} minutes</p></section>
              {material.questions.map((question, index) => <QuestionReviewFields question={question} index={index} key={question.id} />)}
              <div className="sticky-save-row"><button className="button" type="submit"><Save size={18} /> Save questions</button></div>
            </form>
          )}

          {tab === "responses" && (
            <div className="responses-dashboard">
              <section className="response-summary-grid">
                <div><span>Completion</span><strong>{completion}%</strong><small>{completed} students finished</small></div>
                <div><span>Class average</span><strong>{classAverage}%</strong><small>Completed submissions only</small></div>
                <div><span>Needs grading</span><strong>{pending}</strong><small>Free responses pending</small></div>
              </section>
              <section className="form-response-card response-questions-section">
                <div className="panel-header">
                  <div><h2>Response summary</h2><p>See which answers students selected for each question.</p></div>
                  <div className="response-header-actions">
                    <IndividualResponsePicker
                      classroomId={classroomId}
                      materialId={materialId}
                      responses={responseOptions}
                    />
                    <a className="sheets-button" href={`/api/teacher/classes/${classroomId}/materials/${materialId}/responses`}>
                      <Sheet size={18} /> Export as .csv file
                    </a>
                  </div>
                </div>
                <div className="response-question-list">
                  {material.questions.map((question, index) => {
                    const choices = parseChoices(question.choicesJson);
                    const noResponseCount = finalizedSessions.filter((session) => {
                      const answer = session.answers.find((item) => item.questionId === question.id);
                      return !answer || answer.answerText === "No response";
                    }).length;
                    const chartChoices = noResponseCount ? [...choices, "No response"] : choices;
                    const chartCounts = [
                      ...choices.map((choice) => question.answers.filter((answer) => answer.answerText === choice).length),
                      ...(noResponseCount ? [noResponseCount] : [])
                    ];
                    const writtenResponseCount = question.answers.filter(
                      (answer) => answer.answerText !== "No response"
                    ).length;
                    const responseUrl = `/teacher/classes/${classroomId}/materials/${materialId}/questions/${question.id}/responses`;
                    return <article className="response-question-card" key={question.id}>
                      <div className="response-question-heading"><span>Question {index + 1}</span><h3>{question.prompt}</h3></div>
                      {choices.length ? (
                        <QuestionResponseChart choices={chartChoices} counts={chartCounts} />
                      ) : (
                        <div className="free-response-summary"><p>{writtenResponseCount} written responses{noResponseCount ? ` · ${noResponseCount} unanswered` : ""}</p><Link className="ghost-button" href={responseUrl}>View individual responses</Link></div>
                      )}
                    </article>;
                  })}
                </div>
              </section>
            </div>
          )}

          {tab === "settings" && (
            <form action={saveMaterialDraft} className="form-settings-card">
              <input type="hidden" name="classroomId" value={classroomId} />
              <input type="hidden" name="materialId" value={materialId} />
              <input type="hidden" name="returnTab" value="settings" />
              <div className="settings-title"><Settings2 /><div><h2>Assignment settings</h2><p>Schedule, timing, and student experience</p></div></div>
              <label>Assignment title<input name="title" defaultValue={material.title} required /></label>
              <label>Time target<select name="estimatedMinutes" defaultValue={material.estimatedMinutes}>{[10,15,20,25,30].map(value => <option value={value} key={value}>{value} minutes</option>)}</select></label>
              <div className="grid two"><label>Available at<input name="availableAt" type="datetime-local" defaultValue={dateTimeInput(material.availableAt)} /></label><label>Due date<input name="dueAt" type="datetime-local" defaultValue={dateTimeInput(material.dueAt)} /></label></div>
              <label>Reading limit for at-home practice<input name="readingScope" defaultValue={material.atHomeScope || ""} placeholder="Example: Through chapter 2 or pages 1–5" /><span className="help-text">Charlotte will stay within this assigned chapter or page range.</span></label>
              <div className="settings-submit"><button className="button" type="submit"><Save size={18} /> Save settings</button></div>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
