import { AdminViewPage } from "@/app/admin/AdminViewPage";

export const dynamic = "force-dynamic";

export default async function AdminAiUsagePage() {
  return <AdminViewPage view="ai-usage" />;
}
