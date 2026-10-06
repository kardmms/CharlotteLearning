import { getStudentSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { gradeIndex } from '@/lib/grade';
import { StudentAccessibility } from './StudentAccessibility';
export async function StudentAccessibilityBoundary({ children }: { children: React.ReactNode }) {
  const session = await getStudentSession();
  if (!session) return <>{children}</>;
  const account = await prisma.studentAccount.findUnique({ where: { id: session.sub }, select: { id: true, accessibilityPreferences: true, enrollments: { where: { classroomId: session.classroomId || '', active: true }, select: { classroom: { select: { gradeLevel: true } } }, take: 1 } } });
  if (!account) return <>{children}</>;
  return <StudentAccessibility key={account.id} accountId={account.id} initial={account.accessibilityPreferences} secondary={gradeIndex(account.enrollments[0]?.classroom.gradeLevel) >= 6}>{children}</StudentAccessibility>;
}
