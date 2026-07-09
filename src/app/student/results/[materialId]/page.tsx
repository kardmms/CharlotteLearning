import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, LogOut, Star, Trophy } from "lucide-react";
import { logoutStudent } from "@/app/student/actions";
import { CompletionCelebration } from "@/components/CompletionCelebration";
import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function StudentResultPage({
  params,
  searchParams
}: {
  params: Promise<{ materialId: string }>;
  searchParams: Promise<{ ended?: string }>;
}) {
  const student = await requireStudent();
  const { materialId } = await params;
  const query = await searchParams;
  const material = await prisma.material.findFirst({
    where: { id: materialId, classroomId: student.classroomId },
    include: {
      sessions: {
        where: { studentId: student.id, status: { in: ["COMPLETED", "PARTIAL"] } },
        orderBy: { completedAt: "desc" },
        take: 1,
        include: { answers: { include: { question: true } } }
      }
    }
  });
  const session = material?.sessions[0];
  if (!material || !session) redirect("/student");

  const graded = session.answers.filter((answer) => answer.isCorrect !== null);
  const correct = graded.filter((answer) => answer.isCorrect === true).length;
  const score = graded.length ? Math.round((correct / graded.length) * 100) : 0;
  const pending = session.answers.filter((answer) => answer.isCorrect === null).length;
  const durationMinutes = Math.max(
    1,
    Math.round(((session.completedAt?.getTime() || Date.now()) - session.signInAt.getTime()) / 60000)
  );

  const leaderboard = material.activityKind === "AT_HOME"
    ? (await prisma.student.findMany({
        where: { classroomId: student.classroomId, active: true },
        orderBy: { displayName: "asc" },
        include: {
          sessions: {
            where: {
              status: "COMPLETED",
              material: { activityKind: "AT_HOME", isAdaptiveHome: true }
            },
            select: { pointsEarned: true }
          }
        }
      }))
        .map((entry) => ({
          id: entry.id,
          name: entry.displayName,
          points: entry.sessions.reduce((total, item) => total + item.pointsEarned, 0)
        }))
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    : [];
  const rank = leaderboard.findIndex((entry) => entry.id === student.id) + 1;

  return (
    <div className="student-result-shell">
      {query.ended !== "focus" && !session.endedByFocusLoss && <CompletionCelebration points={session.pointsEarned} />}
      <header className="result-topbar">
        <div className="brand"><img className="brand-logo" src="/images/charlotte-ai-logo.png" alt="" /><span>Charlotte AI</span></div>
        <form action={logoutStudent}><button className="ghost-button" type="submit"><LogOut size={18} /> Log out</button></form>
      </header>
      <main className="student-result-page">
        <section className={`result-hero ${session.endedByFocusLoss ? "flagged" : ""}`}>
          <div className="result-hero-icon">
            {session.endedByFocusLoss ? <AlertTriangle size={34} /> : <CheckCircle2 size={34} />}
          </div>
          <span>{material.activityKind === "IN_CLASS" ? "In-class activity" : "At-home Daily Win"}</span>
          <h1>{session.endedByFocusLoss ? "Activity ended." : "You finished!"}</h1>
          <p>{material.title}</p>
          {session.endedByFocusLoss && (
            <div className="result-flag-notice">
              This session ended after leaving the activity window twice. Your teacher can see the flag.
            </div>
          )}
        </section>

        <section className="result-score-grid">
          <div className="result-score-card"><strong>{score}%</strong><span>Score</span></div>
          <div className="result-score-card points"><strong>{session.pointsEarned}</strong><span>Points earned</span></div>
          <div className="result-score-card"><strong>{durationMinutes}m</strong><span>Time</span></div>
        </section>
        {pending > 0 && <p className="result-pending"><Clock3 size={17} /> {pending} written {pending === 1 ? "response is" : "responses are"} waiting for teacher review.</p>}

        {material.activityKind === "AT_HOME" && (
          <section className="leaderboard-panel">
            <div className="leaderboard-heading">
              <div><span>Class leaderboard</span><h2>Top point earners</h2></div>
              <div className="rank-badge"><Trophy size={20} /> Your rank: #{rank || "-"}</div>
            </div>
            <div className="leaderboard-list">
              {leaderboard.slice(0, 10).map((entry, index) => (
                <div className={`leaderboard-row ${entry.id === student.id ? "current" : ""}`} key={entry.id}>
                  <span className="leaderboard-rank">{index + 1}</span>
                  <strong>{entry.name}</strong>
                  <span><Star size={16} /> {entry.points} pts</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
