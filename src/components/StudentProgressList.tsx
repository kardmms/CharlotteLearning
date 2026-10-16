import Link from 'next/link';
import { summarizePerformanceHistory, latestAssignmentChange } from '@/lib/performance-trends';
export function StudentProgressList({ classroomId, students }: { classroomId: string; students: { id: string; displayName: string; scores: number[] }[] }) {
  return <section className="panel student-progress-list" aria-labelledby="progress-list-title">
    <div className="panel-header"><div><div className="eyebrow">Class performance</div><h2 id="progress-list-title">Progress at a glance</h2></div></div>
    <p>Each student’s overall average across all fully graded assignments in this class, including in-class and at-home work. Each assignment counts once, using its latest fully graded attempt. Green means the latest assignment score improved over the previous assignment; red means it declined.</p>
    <div className="watchlist-header" aria-hidden="true"><span>Student</span><span>Overall average</span><span>Graded assignments</span></div>
    <ul>{students.map(student => {
      const history = summarizePerformanceHistory(student.scores);
      const change = latestAssignmentChange(student.scores);
      return <li key={student.id}><Link href={`/teacher/classes/${classroomId}/students/${student.id}`} className="watchlist-row">
        <span><strong>{student.displayName}</strong><small>Entire class history</small></span>
        <span className={`watchlist-score trend-${change.direction}`}><strong>{history.average === null ? '—' : `${history.average}%`}</strong>{history.count > 0 && <small>{change.label}</small>}</span>
        <span><strong>{history.count}</strong>{!history.count && <small>No scored work yet</small>}</span>
      </Link></li>;
    })}</ul>
    {!students.length && <p>Add students to begin tracking progress.</p>}
  </section>;
}
