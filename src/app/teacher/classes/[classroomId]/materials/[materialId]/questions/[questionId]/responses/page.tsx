import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleDashed, Clock3, XCircle } from "lucide-react";
import { gradeStudentAnswer } from "@/app/teacher/actions";
import { TeacherTopbar } from "@/components/AppTopbar";
import { Message } from "@/components/Message";
import { PointsSlider } from "@/components/PointsSlider";
import { requireTeacher } from "@/lib/auth";
import { formatDateTime } from "@/lib/date-groups";
import { prisma } from "@/lib/db";
import { gradeLabel } from "@/lib/grade";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function parseChoices(choicesJson?: string | null) {
  if (!choicesJson) return [];
  try {
    return JSON.parse(choicesJson) as string[];
  } catch {
    return [];
  }
}

function responseStatus(answer: { isCorrect: boolean | null }) {
  if (answer.isCorrect === true) {
    return { label: "Correct", className: "status-green", Icon: CheckCircle2 };
  }
  if (answer.isCorrect === false) {
    return { label: "Needs reteach", className: "status-red", Icon: XCircle };
  }
  return { label: "Grade pending", className: "status-pending", Icon: Clock3 };
}

function questionPointValue(sortOrder: number, totalQuestions: number) {
  const base = Math.floor(100 / Math.max(1, totalQuestions));
  return base + (sortOrder < 100 % Math.max(1, totalQuestions) ? 1 : 0);
}

export default async function QuestionResponsesPage({
  params,
  searchParams
}: {
  params: Promise<{ classroomId: string; materialId: string; questionId: string }>;
  searchParams: Promise<{ error?: string; graded?: string }>;
}) {
  const teacher = await requireTeacher();
  const { classroomId, materialId, questionId } = await params;
  const query = await searchParams;
  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      materialId,
      material: { classroomId, teacherId: teacher.id }
    },
    include: {
      material: {
        include: {
          classroom: true,
          questions: { orderBy: { sortOrder: "asc" } }
        }
      },
      answers: {
        where: { session: { status: { in: ["COMPLETED", "PARTIAL"] } } },
        include: {
          session: {
            include: {
              student: true
            }
          }
        }
      }
    }
  });
  if (!question) notFound();

  const choices = parseChoices(question.choicesJson);
  const isFreeResponse = choices.length === 0 || !question.correctAnswer;
  const questionIndex = question.material.questions.findIndex((item) => item.id === question.id);
  const previousQuestion = question.material.questions[questionIndex - 1];
  const nextQuestion = question.material.questions[questionIndex + 1];
  const sortedAnswers = [...question.answers].sort((a, b) =>
    a.session.student.displayName.localeCompare(b.session.student.displayName)
  );
  const pendingAnswers = sortedAnswers.filter((answer) => answer.isCorrect === null);
  const activePendingAnswer = pendingAnswers[0];
  const gradedAnswers = sortedAnswers.filter((answer) => answer.isCorrect !== null);
  const correctAnswers = gradedAnswers.filter((answer) => answer.isCorrect).length;
  const percentCorrect = gradedAnswers.length ? Math.round((correctAnswers / gradedAnswers.length) * 100) : 0;
  const maxPoints = questionPointValue(question.sortOrder, question.material.questions.length);

  return (
    <>
      <TeacherTopbar name={teacher.name} classroomId={classroomId} />
      <main className="page">
        <section className="workspace-heading">
          <div>
            <Link className="back-link" href={`/teacher/classes/${classroomId}/materials/${materialId}/review?tab=responses`}>
              <ArrowLeft size={17} />
              Back to responses
            </Link>
            <div className="eyebrow">Question {questionIndex + 1}</div>
            <h1>{question.skillTag || question.type}</h1>
            <p>
              {question.material.title} - {gradeLabel(question.material.classroom.gradeLevel)}
            </p>
          </div>
          <div className="question-nav-actions">
            {previousQuestion && (
              <Link
                className="ghost-button"
                href={`/teacher/classes/${classroomId}/materials/${materialId}/questions/${previousQuestion.id}/responses`}
              >
                Previous
              </Link>
            )}
            {nextQuestion && (
              <Link
                className="ghost-button"
                href={`/teacher/classes/${classroomId}/materials/${materialId}/questions/${nextQuestion.id}/responses`}
              >
                Next
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </section>

        <section className="question-detail-grid" style={{ marginTop: 18 }}>
          <div className="panel question-context-panel">
            <Message error={query.error} success={query.graded ? "Grade saved. Next pending response is ready." : undefined} />
            <div className="question-prompt-block">
              <span className="status-pill status-blue">Difficulty {question.difficulty}/5</span>
              <h2>{question.prompt}</h2>
              {question.rubric && <p>{question.rubric}</p>}
            </div>

            {choices.length > 0 && (
              <div className="answer-choice-list">
                {choices.map((choice, index) => (
                  <div
                    className={`answer-choice-item ${
                      choice.trim().toLowerCase() === question.correctAnswer?.trim().toLowerCase()
                        ? "answer-choice-correct"
                        : ""
                    }`}
                    key={choice}
                  >
                    <span>{String.fromCharCode(65 + index)}</span>
                    <strong>{choice}</strong>
                  </div>
                ))}
              </div>
            )}

            {!isFreeResponse && (
              <div className="response-metrics">
                <div>
                  <strong>{sortedAnswers.length}</strong>
                  <span>Responses</span>
                </div>
                <div>
                  <strong>{correctAnswers}</strong>
                  <span>Correct</span>
                </div>
                <div>
                  <strong>{percentCorrect}%</strong>
                  <span>Accuracy</span>
                </div>
              </div>
            )}
          </div>

          {isFreeResponse && (
            <aside className="panel grading-panel">
              <div className="eyebrow">Manual grading</div>
              <h2>{pendingAnswers.length} pending</h2>
              {activePendingAnswer ? (
                <form className="grading-form" action={gradeStudentAnswer}>
                  <input type="hidden" name="classroomId" value={classroomId} />
                  <input type="hidden" name="materialId" value={materialId} />
                  <input type="hidden" name="questionId" value={question.id} />
                  <input type="hidden" name="answerId" value={activePendingAnswer.id} />
                  <div className="active-response-card">
                    <span className="muted">Student</span>
                    <strong>{activePendingAnswer.session.student.displayName}</strong>
                    <p>{activePendingAnswer.answerText}</p>
                  </div>
                  <PointsSlider maxPoints={maxPoints} />
                  <button className="button" type="submit">
                    Save and show next
                    <ArrowRight size={17} />
                  </button>
                </form>
              ) : (
                <div className="all-graded-state">
                  <CheckCircle2 size={36} />
                  <strong>All responses are graded</strong>
                  <p>New student submissions will appear here automatically.</p>
                </div>
              )}
            </aside>
          )}
        </section>

        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-header">
            <div>
              <div className="eyebrow">Student responses</div>
              <h2>All submissions</h2>
            </div>
            {isFreeResponse && (
              <span className="status-pill status-pending">
                <CircleDashed size={16} />
                {pendingAnswers.length} pending
              </span>
            )}
          </div>
          <div className="response-list">
            {sortedAnswers.map((answer) => {
              const status = responseStatus(answer);
              const StatusIcon = status.Icon;
              return (
                <article className="response-row" key={answer.id}>
                  <div>
                    <strong>{answer.session.student.displayName}</strong>
                    <span className="muted">{formatDateTime(answer.updatedAt)}</span>
                  </div>
                  <p>{answer.answerText}</p>
                  <span className={`status-pill ${status.className}`}>
                    <StatusIcon size={16} />
                    {status.label}
                  </span>
                </article>
              );
            })}
            {sortedAnswers.length === 0 && <p>No students have answered this question yet.</p>}
          </div>
        </section>
      </main>
    </>
  );
}
