import { StudentProgressList } from "@/components/StudentProgressList";
import { gradeIndex } from "@/lib/grade";
import Link from "next/link";
import { Mail } from "lucide-react";
import { TeacherTopbar } from "@/components/AppTopbar";
import { ClassNav } from "@/components/ClassNav";
import { BubbleState, StatusBubble } from "@/components/StatusBubble";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gradeLabel } from "@/lib/grade";
import { buildStudentMonthlyScores, recentMonthStarts } from "@/lib/monthly-performance";
import { latestScoredSession, performanceAlertsFromMaterials } from "@/lib/performance-trends";
import { suggestTrendFollowUps } from "@/lib/ai";
import { enforceRateLimit } from "@/lib/rate-limit";
import { notFound } from "next/navigation";
import { CATEGORY_LABELS, QUESTION_CATEGORIES, selectedQuestions } from "@/lib/adaptive-assessment";

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

function monthlyScoreClass(score: number | null) {
  if (score === null) return "score-muted";
  if (score >= 80) return "score-strong";
  if (score >= 60) return "score-mid";
  return "score-low";
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
  params,
  searchParams
}: {
  params: Promise<{ classroomId: string }>;
  searchParams: Promise<{ materialId?: string; period?: string }>;
}) {
  const teacher = await requireTeacher();
  const { classroomId } = await params;
  const query = await searchParams;
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacherId: teacher.id, schoolId: teacher.schoolId },
    include: {
      students: {
        where: { schoolId: teacher.schoolId, active: true },
        orderBy: { displayName: "asc" },
      },
      materials: {
        where: {
          schoolId: teacher.schoolId,
          status: "PUBLISHED",
          activityKind: "IN_CLASS",
          ...(query.materialId ? { id: query.materialId } : {})
        },
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
  const progressHeaders = material?.adaptiveQuestionSet
    ? Array.from({ length: 10 }, (_, index) => ({ label: `${CATEGORY_LABELS[QUESTION_CATEGORIES[Math.floor(index / 2)]]} ${index % 2 + 1}`, questionId: null as string | null }))
    : (material?.questions || []).map((question, index) => ({ label: String(index + 1), questionId: question.id }));
  const [sessions, monthlyMaterials, trendMaterials] = await Promise.all([
    material
      ? prisma.studentSession.findMany({
        where: {
          schoolId: teacher.schoolId,
          materialId: material.id,
          student: { schoolId: teacher.schoolId, classroomId: classroom.id, active: true }
        },
        orderBy: { signInAt: "desc" },
        include: { answers: true }
      })
      : Promise.resolve([]),
    prisma.material.findMany({
      where: {
        schoolId: teacher.schoolId,
        classroomId: classroom.id,
        teacherId: teacher.id,
        status: "PUBLISHED",
        activityKind: "IN_CLASS",
        isAdaptiveHome: false,
        createdAt: { gte: recentMonthStarts(1)[0] }
      },
      select: {
        id: true,
        createdAt: true,
        sessions: {
          where: { schoolId: teacher.schoolId, status: { in: ["COMPLETED", "PARTIAL"] } },
          select: {
            studentId: true,
            status: true,
            pointsEarned: true,
            signInAt: true,
            lastSeenAt: true,
            signedOutAt: true,
            completedAt: true
          }
        }
      }
    }),
    prisma.material.findMany({
      where: {
        schoolId: teacher.schoolId,
        classroomId: classroom.id,
        teacherId: teacher.id,
        status: "PUBLISHED",
        activityKind: "IN_CLASS",
        isAdaptiveHome: false
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        sessions: {
          where: { schoolId: teacher.schoolId, status: "COMPLETED" },
          select: {
            id: true,
            studentId: true,
            status: true,
            pointsEarned: true,
            signInAt: true,
            completedAt: true,
            answers: { select: {
              isCorrect: true,
              answerText: true,
              question: { select: { prompt: true, skillTag: true, correctAnswer: true } }
            } }
          }
        }
      }
    })
  ]);
  const trendAlerts = performanceAlertsFromMaterials(trendMaterials, classroom.students);
  const classAverages = new Map(trendMaterials.map((assignment) => {
    const scores = classroom.students.flatMap((student) => {
      const session = latestScoredSession(assignment.sessions, student.id);
      return session ? [Math.max(0, Math.min(100, session.pointsEarned))] : [];
    });
    return [assignment.id, scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0];
  }));
  const trendEvidence = new Map(trendAlerts.map((alert) => [alert.studentId, trendMaterials.flatMap((assignment) => {
    const session = latestScoredSession(assignment.sessions, alert.studentId);
    if (!session) return [];
    return [{
      materialId: assignment.id,
      sessionId: session.id,
      title: assignment.title,
      date: assignment.createdAt,
      score: Math.max(0, Math.min(100, session.pointsEarned)),
      classAverage: classAverages.get(assignment.id) || 0,
      missed: session.answers.filter((answer) => answer.isCorrect === false).map((answer) => ({
        prompt: answer.question.prompt,
        skill: answer.question.skillTag || "Reading comprehension",
        answer: answer.answerText,
        correctAnswer: answer.question.correctAnswer
      }))
    }];
  }).reverse()]));
  let trendAdvice = new Map<string, { analysis: string; nextStep: string }>();
  if (gradeIndex(classroom.gradeLevel) < 6 && trendAlerts.length && (process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY)) {
    try {
      await enforceRateLimit({ scope: "teacher-trend-advice", limit: 12, windowSeconds: 60 * 60, identifier: `${teacher.id}:${classroomId}` });
      trendAdvice = await suggestTrendFollowUps(
        trendAlerts.map((alert, index) => {
          const evidence = trendEvidence.get(alert.studentId) || [];
          return {
            label: `S${index + 1}`,
            trend: alert.message,
            gradeLevel: classroom.gradeLevel,
            scores: evidence.slice(-8).map(({ score, classAverage }) => ({ score, classAverage })),
            missedQuestions: evidence.flatMap(({ missed }) => missed).slice(-12).map(({ prompt, skill }) => ({ prompt: prompt.slice(0, 300), skill }))
          };
        })
      );
    } catch { /* Show numeric trends when AI advice is unavailable. */ }
  }
  const studentMonthlyScores = buildStudentMonthlyScores(
    monthlyMaterials,
    classroom.students.map((student) => student.id),
    1
  );
  const monthlyScoreByStudent = new Map(
    studentMonthlyScores.map((student) => [student.studentId, student.months[0]])
  );
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
  const alerts = classroom.students.flatMap((student) => {
    const session = latestSessionByStudent.get(student.id);
    if (!session) return [];
    const safetyFlags = session.answers.filter((answer) => answer.safetyFlaggedAt).length;
    return safetyFlags || session.focusViolationCount
      ? [{ student, session, safetyFlags }]
      : [];
  });
  const colSpan = 7 + progressHeaders.length;

  return (
    <>
      <TeacherTopbar name={teacher.name} classroomId={classroomId} />
      <main className={`page ${gradeIndex(classroom.gradeLevel) >= 6 ? "secondary-progress-page" : ""}`}>
        <section className="panel">
          <div className="eyebrow">Student progress</div>
          <h1>{classroom.name}</h1>
          <p>{gradeLabel(classroom.gradeLevel)}</p>
          <ClassNav classroomId={classroom.id} />
          <div className="bubble-key" style={{ marginTop: 18 }} hidden={gradeIndex(classroom.gradeLevel) >= 6}>
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

        {gradeIndex(classroom.gradeLevel) >= 6 && <StudentProgressList classroomId={classroom.id} period={query.period === "5" ? 5 : 3} students={classroom.students.map(student => ({ ...student, scores: trendMaterials.flatMap(assignment => {
          const session = latestScoredSession(assignment.sessions, student.id);
          return session ? [{ score: session.pointsEarned, date: (session.completedAt || session.signInAt).getTime() }] : [];
        }).sort((a, b) => b.date - a.date).map(row => row.score) }))} />}

        <details className="progress-detail-disclosure" open={gradeIndex(classroom.gradeLevel) < 6}><summary>Assignment details and notifications</summary>
        <section className="panel progress-attention-panel" id="notifications" aria-labelledby="notifications-title">
          <div className="panel-header">
            <div><div className="eyebrow">Student trends</div><h2 id="notifications-title">Notifications</h2></div>
            {trendAlerts.length > 0 && <span className="trend-alert-count">{trendAlerts.length}</span>}
          </div>
          {trendAlerts.length ? (
            <div className="charlotte-message-list">
              {trendAlerts.map((alert, index) => {
                const evidence = trendEvidence.get(alert.studentId) || [];
                const insight = trendAdvice.get(`S${index + 1}`);
                const declining = alert.message.startsWith("Scores fell");
                const persistentlyLow = alert.message.startsWith("Scored below 60%");
                return <article className="charlotte-message" key={alert.studentId}>
                  <header className="charlotte-message-header">
                    <span className="charlotte-message-avatar"><Mail size={21} /></span>
                    <div><strong>Charlotte</strong><span>To: Your class dashboard</span></div>
                    <span className="status-pill status-yellow">Student trend</span>
                  </header>
                  <div className="charlotte-message-body">
                    <h3>{declining ? `Looks like ${alert.studentName}’s scores have been going down` : persistentlyLow ? `Looks like ${alert.studentName} has been struggling across recent assignments` : `Looks like ${alert.studentName} has been scoring below the class average`}</h3>
                    <p>Take a look at their assignments and trends below. {alert.message}</p>
                    <section className="trend-score-chart" aria-label={`${alert.studentName}'s assignment score chart`}>
                      <div className="trend-section-heading"><h4>Previous assignments</h4><span>Blue: student · Marker: class average</span></div>
                      <div className="trend-chart-axis" aria-hidden="true"><span>0</span><span>25</span><span>50</span><span>75</span><span>100%</span></div>
                      <ol>
                        {evidence.map((assignment) => <li key={assignment.materialId}>
                          <div className="trend-assignment-heading"><strong>{assignment.title}</strong><span>{formatDate(assignment.date)}</span></div>
                          <div className="trend-score-row" aria-label={`${assignment.score}% score; class average ${assignment.classAverage}%`}>
                            <div className="trend-score-track"><span style={{ width: `${assignment.score}%` }} /><i style={{ left: `${assignment.classAverage}%` }} /></div>
                            <strong>{assignment.score}%</strong>
                          </div>
                          <div className="trend-missed-questions">
                            <strong>Questions missed ({assignment.missed.length})</strong>
                            {assignment.missed.length ? <ul>{assignment.missed.map((missed, questionIndex) => <li key={questionIndex}>
                              <span>{missed.skill}</span>
                              <p>{missed.prompt}</p>
                              <small>Student answer: {missed.answer || "No answer recorded"}{missed.correctAnswer ? ` · Correct answer: ${missed.correctAnswer}` : ""}</small>
                            </li>)}</ul> : <p>No missed graded questions on this assignment.</p>}
                            <Link href={`/teacher/classes/${classroom.id}/materials/${assignment.materialId}/responses/${assignment.sessionId}`}>View full response</Link>
                          </div>
                        </li>)}
                      </ol>
                    </section>
                    <section className="trend-ai-analysis" aria-label="Charlotte's analysis">
                      <h4>Charlotte’s analysis</h4>
                      {insight ? <><p>{insight.analysis}</p><p><strong>How to help:</strong> {insight.nextStep}</p></> : <p>AI analysis is unavailable right now. Review the missed questions above for patterns.</p>}
                    </section>
                  </div>
                </article>;
              })}
            </div>
          ) : <p>No repeated declines or below-class scores across each student&apos;s latest three scored assignments.</p>}
        </section>

        <section className="panel progress-attention-panel" id="alerts" aria-labelledby="alerts-title">
          <div className="panel-header">
            <div><div className="eyebrow">Current assignment</div><h2 id="alerts-title">Alerts</h2></div>
            {alerts.length > 0 && <span className="trend-alert-count alert-count">{alerts.length}</span>}
          </div>
          {alerts.length ? (
            <ul className="trend-alert-list">
              {alerts.map(({ student, session, safetyFlags }) => (
                <li key={student.id}>
                  <strong>{student.displayName}</strong>
                  <span>{[
                    safetyFlags ? `${safetyFlags} safety flag${safetyFlags === 1 ? "" : "s"}` : "",
                    session.focusViolationCount ? `${session.focusViolationCount} focus violation${session.focusViolationCount === 1 ? "" : "s"}` : ""
                  ].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          ) : <p>No safety or focus alerts for this assignment.</p>}
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
                  {progressHeaders.map((header, index) => (
                    <th key={index}>
                      {header.questionId && material ? <Link className="question-number-link" href={`/teacher/classes/${classroom.id}/materials/${material.id}/questions/${header.questionId}/responses`}>{header.label}</Link> : header.label}
                    </th>
                  ))}
                  <th>Answers</th>
                  <th>Score</th>
                  <th>Signed in</th>
                  <th>Last seen / out</th>
                  <th>Alerts</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {classroom.students.map((student) => {
                  const latest = latestSessionByStudent.get(student.id);
                  const latestFinalized = latestFinalizedSessionByStudent.get(student.id);
                  const monthly = monthlyScoreByStudent.get(student.id);
                  const safetyFlagCount = latest?.answers.filter((answer) => answer.safetyFlaggedAt).length ?? 0;
                  const rowQuestions = material?.adaptiveQuestionSet
                    ? latest ? selectedQuestions(material.questions, latest.assignedQuestionIdsJson) : []
                    : material?.questions || [];
                  return (
                    <tr key={student.id}>
                      <td>
                        <div className="progress-student-identity">
                          <span>{student.displayName}</span>
                          <span
                            className={`monthly-average-bubble ${monthlyScoreClass(monthly?.average ?? null)}`}
                            title={`${monthly?.label ?? "This month"}: ${monthly?.assignmentCount ?? 0} scored assignments`}
                          >
                            {monthly?.shortLabel ?? "Month"} {monthly?.average === null || monthly?.average === undefined ? "—" : `${monthly.average}%`}
                          </span>
                        </div>
                      </td>
                      {progressHeaders.map((_, index) => {
                        const question = rowQuestions[index];
                        if (!question) return <td key={index}><StatusBubble state="not-started" label={`Question ${index + 1}`} /></td>;
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
                        {latest?.focusViolationCount || safetyFlagCount ? (
                          <div className="progress-alert-list">
                            {safetyFlagCount > 0 && (
                              <span className="status-pill status-red">
                                Safety ({safetyFlagCount})
                              </span>
                            )}
                            {latest?.focusViolationCount ? (
                              <span className="status-pill status-red">
                                {latest.endedByFocusLoss ? "Ended" : "Focus"} ({latest.focusViolationCount})
                              </span>
                            ) : null}
                          </div>
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
        </details>
      </main>
    </>
  );
}
