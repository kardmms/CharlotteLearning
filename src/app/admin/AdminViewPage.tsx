import { redirect } from "next/navigation";
import { readInviteFlash } from "@/app/admin/actions";
import { AdminDashboardClient, type AdminView } from "@/components/AdminDashboardClient";
import { getAdminMetrics } from "@/lib/admin-metrics";
import { getAdminSession, requireAdmin } from "@/lib/auth";

export async function AdminViewPage({ view }: { view: AdminView }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const [admin, metrics, inviteFlash] = await Promise.all([
    requireAdmin(),
    getAdminMetrics(),
    readInviteFlash()
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
    />
  );
}
