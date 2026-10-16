import { AdminViewPage } from '@/app/admin/AdminViewPage';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export default async function AdminExpensesPage() { return <AdminViewPage view="expenses" />; }
