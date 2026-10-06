import { StudentTopbar } from '@/components/AppTopbar';
import { AccessibilitySettings } from '@/components/StudentAccessibility';
import { requireStudentAccount } from '@/lib/auth';
export default async function StudentSettingsPage() {
  const account = await requireStudentAccount();
  return <div className="student-shell"><StudentTopbar name={account.displayName} /><main className="page narrow-page"><section className="panel"><div className="eyebrow">Student settings</div><h1>Accessibility</h1><AccessibilitySettings /></section></main></div>;
}
