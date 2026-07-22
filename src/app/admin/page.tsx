import { redirect } from "next/navigation";
import { readInviteFlash } from "@/app/admin/actions";
import { AdminDashboardClient } from "@/components/AdminDashboardClient";
import { getAdminSession, requireAdmin } from "@/lib/auth";
import { getAdminMetrics } from "@/lib/admin-metrics";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
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
    />
  );
}
