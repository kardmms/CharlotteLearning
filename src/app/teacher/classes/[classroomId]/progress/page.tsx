import Link from "next/link";
import { TeacherTopbar } from "@/components/AppTopbar";
import { ClassNav } from "@/components/ClassNav";
import { BubbleState, StatusBubble } from "@/components/StatusBubble";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gradeLabel } from "@/lib/grade";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function formatDate(date?: Date | null) {
  if (!date) return "Not yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function scoreLabel(session?: { pointsEarned: number; answers: Array<{ isCorrect: boolean | null }> }) {
  if (!session) return "Not started";
  const graded = session.answers.filter((answer) => answer.isCorrect !== null);
  if (graded.length === 0) return "Review";
  return `${Math.min(100, session.pointsEarned)}%`;
}

function parseChoices(choicesJson?: string | null) {
  if (!choicesJson) return [];
  try {
    return JSON.parse(choicesJson) as string[];
  } catch {
    return [];
  }
}

function isFreeResponse(question: { choicesJson?: string | null; correctAnswer?: string | null }) {
  return parseChoices(question.choicesJson).length === 0 || !question.correctAnswer;
}

function questionState(
  question: { choicesJson?: string | null; correctAnswer?: string | null },
  answer?: { isCorrect: boolean | null; attemptCount: number }
): BubbleState {
  if (!answer) return "not-started";
  if (answer.isCorrect === null) return isFreeResponse(question) ? "pending" : "attempted";
  return answer.isCorrect ? (answer.attemptCount === 1 ? "complete" : "attempted") : "attempted";
}

export default async function ProgressPage({
  params
}: {
  params: Promise<{ classroomId: string }>;
}) {
  const teacher = await requireTeacher();
  const { classroomId } = await params;
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacherId: teacher.id },
    include: {
      students: {
        where: { active: true },
        orderBy: { displayName: "asc" }
      },
      materials: {
        where: { status: "PUBLISHED", activityKind: "IN_CLASS" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          questions: { orderBy: { sortOrder: "asc" } }
        }
      }
    }
  });
  if (!classroom) notFound();
  const material = classroom.materials[0];
  const sessions = material
    ? await prisma.studentSession.findMany({
        where: {
          materialId: material.id,
          student: { classroomId: classroom.id, active: true }
        },
        orderBy: { signInAt: "desc" },
        include: { answers: true }
      })
    : [];
  const latestSessionByStudent = new Map<string, (typeof sessions)[number]>();
  const latestFinalizedSessionByStudent = new Map<string, (typeof sessions)[number]>();
  for (const session of sessions) {
    if (!latestSessionByStudent.has(session.studentId)) {
      latestSessionByStudent.set(session.studentId, session);
    }
    if (
      (session.status === "COMPLETED" || session.status === "PARTIAL") &&
      !latestFinalizedSessionByStudent.has(session.studentId)
    ) {
      latestFinalizedSessionByStudent.set(session.studentId, session);
    }
  }
  const colSpan = 7 + (material?.questions.length ?? 0);

  return (
    <>
      <TeacherTopbar name={teacher.name} classroomId={classroomId} />
      <main className="page">
        <section className="panel">
          <div className="eyebrow">Student progress</div>
          <h1>{classroom.name}</h1>
          <p>{gradeLabel(classroom.gradeLevel)}</p>
          <ClassNav classroomId={classroom.id} />
          <div className="bubble-key" style={{ marginTop: 18 }}>
            <span className="bubble-row">
              <StatusBubble state="complete" label="Complete" /> Completed
            </span>
            <span className="bubble-row">
              <StatusBubble state="attempted" label="Attempted" /> Attempted or missed
            </span>
            <span className="bubble-row">
              <StatusBubble state="pending" label="Pending" /> Free response pending
            </span>
            <span className="bubble-row">
              <StatusBubble state="not-started" label="Not looked at" /> Not looked at
            </span>
          </div>
        </section>

        <section style={{ marginTop: 18 }}>
          <p className="progress-material-name">
            Assignment: <strong>{material?.title ?? "No published assignment"}</strong>
          </p>
          <div className="table-wrap progress-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  {material?.questions.map((question, index) => (
                    <th key={question.id}>
                      <Link
                        className="question-number-link"
                        href={`/teacher/classes/${classroom.id}/materials/${material.id}/questions/${question.id}/responses`}
                      >
                        {index + 1}
                      </Link>
                    </th>
                  ))}
                  <th>Answers</th>
                  <th>Score</th>
                  <th>Signed in</th>
                  <th>Last seen / out</th>
                  <th>Focus</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {classroom.students.map((student) => {
                  const latest = latestSessionByStudent.get(student.id);
                  const latestFinalized = latestFinalizedSessionByStudent.get(student.id);
                  return (
                    <tr key={student.id}>
                      <td>{student.displayName}</td>
                      {material?.questions.map((question, index) => {
                        const answer = latest?.answers.find((item) => item.questionId === question.id);
                        const state = questionState(question, answer);
                        return (
                          <td key={question.id}>
                            <Link
                              className="question-bubble-link"
                              href={`/teacher/classes/${classroom.id}/materials/${material.id}/questions/${question.id}/responses`}
                            >
                              <StatusBubble state={state} label={`Question ${index + 1}`} />
                            </Link>
                          </td>
                        );
                      })}
                      <td>{latest?.answers.length ?? 0}</td>
                      <td>
                        <span
                          className={`score-pill ${
                            !latest
                              ? "score-muted"
                              : scoreLabel(latest) === "Review"
                                ? "score-review"
                                : Number.parseInt(scoreLabel(latest), 10) >= 80
                                  ? "score-strong"
                                  : Number.parseInt(scoreLabel(latest), 10) >= 60
                                    ? "score-mid"
                                    : "score-low"
                          }`}
                        >
                          {scoreLabel(latest)}
                        </span>
                      </td>
                      <td>{formatDate(latest?.signInAt)}</td>
                      <td>{formatDate(latest?.signedOutAt ?? latest?.lastSeenAt)}</td>
                      <td>
                        {latest?.focusViolationCount ? (
                          <span className="status-pill status-red">
                            {latest.endedByFocusLoss ? "Ended" : "Flagged"} ({latest.focusViolationCount})
                          </span>
                        ) : (
                          <span className="muted">Clear</span>
                        )}
                      </td>
                      <td>
                        {material && latestFinalized ? (
                          <Link
                            className="ghost-button"
                            href={`/teacher/classes/${classroom.id}/materials/${material.id}/responses/${latestFinalized.id}`}
                          >
                            View response
                          </Link>
                        ) : (
                          <span className="muted">No submission</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {classroom.students.length === 0 && (
                  <tr>
                    <td colSpan={colSpan}>Add students on the Students page to begin tracking progress.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
