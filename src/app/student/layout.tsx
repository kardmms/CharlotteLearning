import { StudentAccessibilityBoundary } from '@/components/StudentAccessibilityBoundary';
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentAccessibilityBoundary>{children}</StudentAccessibilityBoundary>;
}
