import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, UserRound, XCircle } from "lucide-react";
import { TeacherTopbar } from "@/components/AppTopbar";
import { IndividualResponsePicker } from "@/components/IndividualResponsePicker";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function formatDate(date?: Date | null) {
  if (!date) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function questionPointValue(sortOrder: number, questionCount: number) {
  const base = Math.floor(100 / Math.max(1, questionCount));
  const remainder = 100 % Math.max(1, questionCount);
  return base + (sortOrder <= remainder ? 1 : 0);
}

export default async function IndividualResponsePage({
  params
}: {
  params: Promise<{ classroomId: string; materialId: string; sessionId: string }>;
}) {
  const teacher = await requireTeacher();
  const { classroomId, materialId, sessionId } = await params;
  const session = await prisma.studentSession.findFirst({
    where: {
      id: sessionId,
      materialId,
      status: { in: ["COMPLETED", "PARTIAL"] },
      material: { classroomId, teacherId: teacher.id }
    },
    include: {
      student: true,
      answers: true,
      material: {
        include: {
          classroom: true,
          questions: { orderBy: { sortOrder: "asc" } }
        }
      }
    }
  });
  if (!session) notFound();

  const responses = await prisma.studentSession.findMany({
    where: {
      materialId,
      status: { in: ["COMPLETED", "PARTIAL"] },
      material: { classroomId, teacherId: teacher.id }
    },
    orderBy: { completedAt: "desc" },
    include: { student: true }
  });
  const responseOptions = [...responses]
    .sort((a, b) => a.student.displayName.localeCompare(b.student.displayName))
    .map((response) => ({
      sessionId: response.id,
      studentName: response.student.displayName,
      status: response.status as "COMPLETED" | "PARTIAL"
    }));
  const responseNumber = responseOptions.findIndex((response) => response.sessionId === session.id) + 1;

  return (
    <>
      <TeacherTopbar name={teacher.name} classroomId={classroomId} />
      <main className="form-workspace individual-response-workspace">
        <header className="form-workspace-header">
          <div>
            <Link
              className="back-link"
              href={`/teacher/classes/${classroomId}/materials/${materialId}/review?tab=responses`}
            >
              <ArrowLeft size={17} /> Responses
            </Link>
            <h1>{session.material.title}</h1>
            <span className={`status-pill ${session.status === "COMPLETED" ? "status-green" : "status-red"}`}>
              {session.status === "COMPLETED" ? "submitted" : "timed out"}
            </span>
          </div>
        </header>

        <div className="individual-response-toolbar">
          <div>
            <strong>Individual</strong>
            <span>{responseNumber} of {responseOptions.length}</span>
          </div>
          <IndividualResponsePicker
            classroomId={classroomId}
            materialId={materialId}
            responses={responseOptions}
            currentSessionId={session.id}
          />
        </div>

        <div className="form-workspace-body individual-response-body">
          <section className="individual-respondent-card">
            <div className="individual-respondent-heading">
              <span><UserRound size={20} /></span>
              <div>
                <small>Respondent</small>
                <h2>{session.student.displayName}</h2>
                <p>{session.student.email || "No email on file"}</p>
              </div>
            </div>
            <div className="individual-response-score">
              <strong>{session.pointsEarned}/100</strong>
              <span>points</span>
            </div>
            <div className="individual-response-meta">
              <span>Submitted</span>
              <strong>{formatDate(session.completedAt || session.signedOutAt || session.lastSeenAt)}</strong>
            </div>
          </section>

          <div className="individual-answer-list">
            {session.material.questions.map((question, index) => {
              const answer = session.answers.find((item) => item.questionId === question.id);
              const unanswered = !answer || answer.answerText === "No response";
              const pending = answer?.isCorrect === null && !unanswered;
              const correct = answer?.isCorrect === true;
              const maxPoints = questionPointValue(question.sortOrder, session.material.questions.length);
              return (
                <article className="individual-answer-card" key={question.id}>
                  <div className="individual-answer-heading">
                    <div>
                      <span>Question {index + 1}</span>
                      <h3>{question.prompt}</h3>
                    </div>
                    <strong>{answer?.pointsEarned || 0} / {maxPoints}</strong>
                  </div>

                  <div className={`individual-answer-value ${unanswered ? "unanswered" : ""}`}>
                    <span>Student answer</span>
                    <p>{unanswered ? "No response" : answer?.answerText}</p>
                  </div>

                  <div className="individual-answer-footer">
                    {pending ? (
                      <span className="status-pill status-pending"><Clock3 size={16} /> Needs grading</span>
                    ) : correct ? (
                      <span className="status-pill status-green"><CheckCircle2 size={16} /> Correct</span>
                    ) : (
                      <span className="status-pill status-red"><XCircle size={16} /> Incorrect</span>
                    )}
                    {!correct && question.correctAnswer && (
                      <p><strong>Correct answer:</strong> {question.correctAnswer}</p>
                    )}
                    {pending && (
                      <Link
                        className="ghost-button"
                        href={`/teacher/classes/${classroomId}/materials/${materialId}/questions/${question.id}/responses`}
                      >
                        Grade response
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
