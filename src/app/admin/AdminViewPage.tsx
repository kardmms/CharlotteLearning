import { redirect } from "next/navigation";
import { readInviteFlash } from "@/app/admin/actions";
import { AdminDashboardClient, type AdminView } from "@/components/AdminDashboardClient";
import { getAdminMetrics, getEmptyAdminMetrics } from "@/lib/admin-metrics";
import { getAdminSession, requireAdmin } from "@/lib/auth";
import { getOpenAiUsageMetrics } from "@/lib/openai-usage";
import { getVercelServerMetrics } from "@/lib/vercel-monitoring";

export async function AdminViewPage({ view }: { view: AdminView }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const admin = await requireAdmin();
  const [metrics, inviteFlash, serverMetrics, aiUsageMetrics] = await Promise.all([
    getAdminMetrics().catch((error) => {
      console.error("Admin metrics failed to load", error);
      return getEmptyAdminMetrics();
    }),
    readInviteFlash().catch((error) => {
      console.error("Admin invite flash failed to load", error);
      return null;
    }),
    view === "server"
      ? getVercelServerMetrics().catch((error) => {
          console.error("Vercel server metrics failed to load", error);
          return undefined;
        })
      : Promise.resolve(undefined),
    view === "ai-usage"
      ? getOpenAiUsageMetrics().catch((error) => {
          console.error("OpenAI usage metrics failed to load", error);
          return undefined;
        })
      : Promise.resolve(undefined)
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
