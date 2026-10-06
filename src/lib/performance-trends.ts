export type ScoredAssignment = {
  studentId: string;
  score: number;
};

export function latestScoredSession<T extends {
  studentId: string;
  status: string;
  signInAt: Date;
  completedAt: Date | null;
  answers: { isCorrect: boolean | null }[];
}>(sessions: T[], studentId: string) {
  return sessions
    .filter((row) => row.studentId === studentId && row.status === "COMPLETED" && row.answers.length > 0 && row.answers.every((answer) => answer.isCorrect !== null))
    .sort((a, b) => (b.completedAt || b.signInAt).getTime() - (a.completedAt || a.signInAt).getTime())[0];
}

export function performanceAlertsFromMaterials(
  materials: {
    sessions: {
      studentId: string;
      status: string;
      pointsEarned: number;
      signInAt: Date;
      completedAt: Date | null;
      answers: { isCorrect: boolean | null }[];
    }[];
  }[],
  students: { id: string; displayName: string }[]
) {
  return performanceAlerts(materials.map((material) => students.flatMap((student) => {
    const session = latestScoredSession(material.sessions, student.id);
    return session ? [{ studentId: student.id, score: Math.min(100, session.pointsEarned) }] : [];
  })), students);
}

export function performanceAlerts(
  assignments: ScoredAssignment[][],
  students: { id: string; displayName: string }[]
) {
  const averages = assignments.map((scores) =>
    scores.length ? scores.reduce((sum, row) => sum + row.score, 0) / scores.length : null
  );
  return students.flatMap((student) => {
    const scored = assignments.flatMap((assignment, index) => {
      const score = assignment.find((row) => row.studentId === student.id)?.score;
      return score === undefined ? [] : [{ score, classAverage: averages[index] }];
    }).slice(0, 3);
    if (scored.length < 3) return [];
    const [latest, previous, oldest] = scored.map((row) => row.score);
    const declining = oldest - previous >= 5 && previous - latest >= 5;
    const belowClass = scored.every((row) =>
      row.classAverage !== null && row.score <= row.classAverage - 15
    );
    const persistentlyLow = scored.every((row) => row.score < 60);
    if (!declining && !belowClass && !persistentlyLow) return [];
    return [{
      studentId: student.id,
      studentName: student.displayName,
      message: declining
        ? `Scores fell across three assignments (${oldest}% → ${previous}% → ${latest}%).`
        : belowClass
          ? `Scored at least 15 points below the class average on three assignments.`
          : `Scored below 60% on three assignments in a row.`
    }];
  });
}

/** Two adjacent, non-overlapping groups of fully graded assignments, newest first.
 * Each assignment has equal weight; retakes contribute only their latest graded session.
 * Values are percentage points, not relative percentage growth.
 */
export function comparePerformancePeriods(scores: number[], periodSize = 3) {
  const size = periodSize === 5 ? 5 : 3;
  const valid = scores.filter(Number.isFinite).map(score => Math.max(0, Math.min(100, score)));
  const recent = valid.slice(0, size);
  const previous = valid.slice(size, size * 2);
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const current = average(recent);
  const prior = average(previous);
  const sufficient = recent.length === size && previous.length === size;
  const delta = sufficient ? Math.round(((current ?? 0) - (prior ?? 0)) * 10) / 10 : null;
  return { current: current === null ? null : Math.round(current * 10) / 10, previous: prior === null ? null : Math.round(prior * 10) / 10, delta, direction: delta === null ? 'insufficient' : Math.abs(delta) < 0.5 ? 'steady' : delta > 0 ? 'up' : 'down', recentCount: recent.length, previousCount: previous.length };
}
