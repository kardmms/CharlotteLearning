import Link from 'next/link';
import { comparePerformancePeriods } from '@/lib/performance-trends';
export function StudentProgressList({ classroomId, students, period }: { classroomId: string; students: { id: string; displayName: string; scores: number[] }[]; period: number }) {
  return <section className="panel student-progress-list" aria-labelledby="progress-list-title">
    <div className="panel-header"><div><div className="eyebrow">Class performance</div><h2 id="progress-list-title">Progress at a glance</h2></div>
      <form><label>Comparison <select aria-label="Comparison" name="period" defaultValue={period}><option value="3">Latest 3 vs previous 3</option><option value="5">Latest 5 vs previous 5</option></select></label><button className="ghost-button" type="submit">Apply</button></form>
    </div>
    <p>Average assignment score: latest {period} fully graded in-class assignments versus the previous {period}, ordered by completion. Each assignment counts once. Changes are percentage points (pp); under 0.5 pp is steady.</p>
    <div className="watchlist-header" aria-hidden="true"><span>Student</span><span>Current average</span><span>Change / trend</span></div>
    <ul>{students.map(student => {
      const trend = comparePerformancePeriods(student.scores, period);
      return <li key={student.id}><Link href={`/teacher/classes/${classroomId}/students/${student.id}?period=${period}`} className="watchlist-row">
        <span><strong>{student.displayName}</strong><small>{trend.recentCount} recent · {trend.previousCount} previous scored assignments</small></span>
        <strong>{trend.current === null ? '—' : `${trend.current}%`}</strong>
        <span className={`watchlist-trend trend-${trend.direction}`}>{trend.delta === null ? <><strong>—</strong><small>{trend.current === null ? 'No scored work yet' : 'More history needed'}</small></> : <><strong>{trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'} {trend.delta > 0 ? '+' : ''}{trend.delta} pp</strong><small>{trend.direction === 'up' ? 'Improving' : trend.direction === 'down' ? 'Declining' : 'Steady'}</small></>}</span>
      </Link></li>;
    })}</ul>
    {!students.length && <p>Add students to begin tracking progress.</p>}
  </section>;
}
