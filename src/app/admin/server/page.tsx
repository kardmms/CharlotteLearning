import { AdminViewPage } from "@/app/admin/AdminViewPage";

export const dynamic = "force-dynamic";

export default async function AdminServerPage() {
  return <AdminViewPage view="server" />;
}
