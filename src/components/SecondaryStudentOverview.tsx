import Link from 'next/link';
import { StartActivityButton } from './StartActivityButton';
import { gradeLabel } from '@/lib/grade';
export function SecondaryStudentOverview({ name, grade, className, assignments, completed, average, latestResult, hasPractice, gamesEnabled }: {
  name: string; grade: string; className: string;
  assignments: { id: string; title: string; minutes: number; due: string; questions: number }[];
  completed: number; average: number | null; latestResult?: string; hasPractice: boolean; gamesEnabled: boolean;
}) {
  return <div className="secondary-portal">
    <header className="portal-heading"><div className="eyebrow">{gradeLabel(grade)} · {className}</div><h1>Hello, {name.split(' ')[0]}.</h1><p>Here’s what is ready for you in class.</p></header>
    <div className="portal-layout"><div className="portal-stack">
      <section className="portal-card"><div className="portal-card-head"><div><h2>Assignments</h2><p>Start with the work your teacher assigned.</p></div><span className="portal-pill">{assignments.length} ready now</span></div>
        {assignments.length ? assignments.map(assignment => <div className="portal-assignment" key={assignment.id}><div><h3>{assignment.title}</h3><p>{assignment.due} · About {assignment.minutes} minutes</p><span className="portal-pill">In class · {assignment.questions} questions</span></div><StartActivityButton materialId={assignment.id} /></div>) : <p>No in-class assignments are open right now.</p>}
        <div className="portal-assignment"><div><h3>Vocabulary review</h3><p>{hasPractice ? 'Review words from your class materials.' : 'Your vocabulary sets will appear here when available.'}</p></div><Link className="ghost-button" href="/student/practice">Review words →</Link></div>
      </section>
      <section className="portal-card"><div className="portal-card-head"><div><h2>Your progress</h2><p>In-class work this month.</p></div></div><div className="portal-stats"><div><strong>{completed}</strong><span>Completed assignments</span></div><div><strong>{average === null ? '—' : `${average}%`}</strong><span>Fully graded average</span></div></div>{latestResult && <Link className="portal-link" href={`/student/results/${latestResult}`}>View latest results →</Link>}</section>
    </div><aside className="portal-stack"><section className="portal-card soft"><h2>My classes</h2><div className="portal-course"><strong>{className}</strong><span>Active</span></div><Link className="portal-link" href="/student/classes">Manage classes →</Link></section>
      <section className="portal-card"><h2>Extra practice</h2><p>Review material your class has already covered, at your own pace.</p><Link className="portal-link" href="/student?view=home">Explore practice →</Link></section>
      {gamesEnabled && <section className="portal-card"><h2>Classroom games</h2><p>Join your teacher’s live vocabulary activity.</p><Link className="portal-link" href="/play">Join a game →</Link></section>}
    </aside></div>
  </div>;
}
