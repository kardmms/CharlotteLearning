import { redirect } from "next/navigation";
import { readInviteFlash } from "@/app/admin/actions";
import { AdminDashboardClient, type AdminView } from "@/components/AdminDashboardClient";
import { getAdminMetrics } from "@/lib/admin-metrics";
import { getAdminSession, requireAdmin } from "@/lib/auth";
import { getOpenAiUsageMetrics } from "@/lib/openai-usage";
import { getVercelServerMetrics } from "@/lib/vercel-monitoring";

export async function AdminViewPage({ view }: { view: AdminView }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const [admin, metrics, inviteFlash, serverMetrics, aiUsageMetrics] = await Promise.all([
    requireAdmin(),
    getAdminMetrics(),
    readInviteFlash(),
    view === "server" ? getVercelServerMetrics() : Promise.resolve(undefined),
    view === "ai-usage" ? getOpenAiUsageMetrics() : Promise.resolve(undefined)
  ]);

  return (
    <AdminDashboardClient
      admin={{
        name: admin.name,
        email: admin.email,
        username: admin.username,
        role: admin.role
      }}
      initialMetrics={metrics}
      inviteFlash={inviteFlash}
      view={view}
      serverMetrics={serverMetrics}
      aiUsageMetrics={aiUsageMetrics}
    />
  );
}
