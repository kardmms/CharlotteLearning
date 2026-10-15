import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireTeacher } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { gradeIndex } from '@/lib/grade';
import { TeacherTopbar } from '@/components/AppTopbar';
import { summarizePerformanceHistory, latestScoredSession } from '@/lib/performance-trends';

export const dynamic = 'force-dynamic';
export default async function StudentDetailPage({ params }: { params: Promise<{ classroomId: string; studentId: string }> }) {
  const teacher = await requireTeacher();
  const { classroomId, studentId } = await params;
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
  const materialIds = [...new Set(student.sessions.map(session => session.materialId))];
  const scored = materialIds.flatMap(id => {
    const session = latestScoredSession(student.sessions.filter(row => row.materialId === id), studentId);
    return session ? [session] : [];
  }).sort((a,b) => (b.completedAt || b.signInAt).getTime() - (a.completedAt || a.signInAt).getTime());
  const history = summarizePerformanceHistory(scored.map(row => row.pointsEarned));
  const skills = [...new Set(scored.flatMap(row => row.answers.map(answer => answer.question.skillTag || answer.question.category || 'Reading')))];
  function skillScore(skill: string) {
    const answers = scored.flatMap(row => row.answers).filter(answer => (answer.question.skillTag || answer.question.category || 'Reading') === skill);
    return { count: answers.length, score: answers.length ? Math.round(100 * answers.filter(answer => answer.isCorrect).length / answers.length) : null };
  }
  return <><TeacherTopbar name={teacher.name} classroomId={classroomId} /><main className="page">
    <Link className="ghost-button" href={`/teacher/classes/${classroomId}/progress`}>← Class progress</Link>
    <section className="panel"><div className="eyebrow">Student analytics · Entire class history</div><h1>{student.displayName}</h1><p>Overall average: <strong>{history.average === null ? 'No scored work' : `${history.average}%`}</strong> · <strong>{history.count}</strong> fully graded assignments</p>
      <h2>Skills across all assignments</h2><p>All fully graded in-class and at-home assignments in this class, using the latest fully graded attempt for each assignment. Skill accuracy is the share of questions answered correctly; assignment scores also account for attempts.</p>
      <div className="table-wrap"><table><thead><tr><th>Skill / topic</th><th>Overall accuracy</th><th>Questions</th></tr></thead><tbody>{skills.map(skill => {
        const overall = skillScore(skill);
        return <tr key={skill}><th scope="row">{skill}</th><td>{overall.score === null ? '—' : `${overall.score}%`}</td><td>{overall.count}</td></tr>;
      })}</tbody></table></div>{!skills.length && <p>No fully graded assignments yet.</p>}
    </section>
    <section className="panel"><h2>Assignment responses</h2><p>Open an assignment for the existing question-by-question analysis.</p><ul>{student.sessions.map(session => <li key={session.id}><Link href={`/teacher/classes/${classroomId}/materials/${session.materialId}/responses/${session.id}`}>{session.material.title}</Link> · {session.status === 'PARTIAL' ? 'Partial' : session.answers.some(answer => answer.isCorrect === null) ? 'Awaiting review' : `${Math.min(100,session.pointsEarned)}%`} · {(session.completedAt || session.signInAt).toLocaleDateString('en-US')}</li>)}</ul>{!response && <p>This student has not submitted any work yet.</p>}</section>
  </main></>;
}
