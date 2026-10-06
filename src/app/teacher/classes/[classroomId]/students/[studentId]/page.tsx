import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireTeacher } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { gradeIndex } from '@/lib/grade';
import { TeacherTopbar } from '@/components/AppTopbar';
import { comparePerformancePeriods, latestScoredSession } from '@/lib/performance-trends';

export const dynamic = 'force-dynamic';
export default async function StudentDetailPage({ params, searchParams }: { params: Promise<{ classroomId: string; studentId: string }>; searchParams: Promise<{ period?: string }> }) {
  const teacher = await requireTeacher();
  const { classroomId, studentId } = await params;
  const query = await searchParams;
  const period = query.period === '5' ? 5 : 3;
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: teacher.schoolId, classroomId, classroom: { teacherId: teacher.id } },
    include: { classroom: true, sessions: {
      where: { schoolId: teacher.schoolId, status: { in: ['COMPLETED', 'PARTIAL'] }, material: { classroomId, schoolId: teacher.schoolId } },
      orderBy: { completedAt: 'desc' },
      include: { material: true, answers: { include: { question: { select: { skillTag: true, category: true } } } } }
    } }
  });
  if (!student) notFound();
  const response = student.sessions[0];
  if (gradeIndex(student.classroom.gradeLevel) < 6) {
    if (!response) redirect(`/teacher/classes/${classroomId}/progress`);
    redirect(`/teacher/classes/${classroomId}/materials/${response.materialId}/responses/${response.id}`);
  }
  const materialIds = [...new Set(student.sessions.filter(session => session.material.activityKind === 'IN_CLASS' && !session.material.isAdaptiveHome).map(session => session.materialId))];
  const scored = materialIds.flatMap(id => {
    const session = latestScoredSession(student.sessions.filter(row => row.materialId === id), studentId);
    return session ? [session] : [];
  }).sort((a,b) => (b.completedAt || b.signInAt).getTime() - (a.completedAt || a.signInAt).getTime());
  const trend = comparePerformancePeriods(scored.map(row => row.pointsEarned), period);
  const skills = [...new Set(scored.slice(0,period * 2).flatMap(row => row.answers.map(answer => answer.question.skillTag || answer.question.category || 'Reading')))];
  function skillScore(skill: string, start: number) {
    const answers = scored.slice(start, start + period).flatMap(row => row.answers).filter(answer => (answer.question.skillTag || answer.question.category || 'Reading') === skill);
    return { count: answers.length, score: answers.length ? Math.round(100 * answers.filter(answer => answer.isCorrect).length / answers.length) : null };
  }
  return <><TeacherTopbar name={teacher.name} classroomId={classroomId} /><main className="page">
    <Link className="ghost-button" href={`/teacher/classes/${classroomId}/progress?period=${period}`}>← Class progress</Link>
    <section className="panel"><div className="eyebrow">Student analytics · Latest {period} vs previous {period}</div><h1>{student.displayName}</h1><p>Current average: <strong>{trend.current === null ? 'No scored work' : `${trend.current}%`}</strong> · Change: <strong>{trend.delta === null ? 'More history needed' : `${trend.delta > 0 ? '+' : ''}${trend.delta} percentage points`}</strong></p>
      <h2>Skills behind the trend</h2><p>Correct-answer rates within the same assignment groups. These skill rates differ from assignment points, which also account for attempts. Small samples and different question difficulty can affect comparisons.</p>
      <div className="table-wrap"><table><thead><tr><th>Skill / topic</th><th>Recent accuracy</th><th>Previous accuracy</th><th>Change</th></tr></thead><tbody>{skills.map(skill => {
        const current = skillScore(skill,0), previous = skillScore(skill,period);
        return <tr key={skill}><th scope="row">{skill}</th><td>{current.score === null ? '—' : `${current.score}% (${current.count} questions)`}</td><td>{previous.score === null ? '—' : `${previous.score}% (${previous.count} questions)`}</td><td>{trend.delta === null || current.score === null || previous.score === null ? 'More history needed' : `${current.score - previous.score > 0 ? '+' : ''}${current.score - previous.score} pp`}</td></tr>;
      })}</tbody></table></div>{!skills.length && <p>No fully graded in-class assignments yet.</p>}
    </section>
    <section className="panel"><h2>Assignment responses</h2><p>Open an assignment for the existing question-by-question analysis.</p><ul>{student.sessions.map(session => <li key={session.id}><Link href={`/teacher/classes/${classroomId}/materials/${session.materialId}/responses/${session.id}`}>{session.material.title}</Link> · {session.status === 'PARTIAL' ? 'Partial' : session.answers.some(answer => answer.isCorrect === null) ? 'Awaiting review' : `${Math.min(100,session.pointsEarned)}%`} · {(session.completedAt || session.signInAt).toLocaleDateString('en-US')}</li>)}</ul>{!response && <p>This student has not submitted any work yet.</p>}</section>
  </main></>;
}
