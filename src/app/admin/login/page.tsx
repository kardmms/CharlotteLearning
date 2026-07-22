import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { loginAdmin } from "@/app/admin/actions";
import { Message } from "@/components/Message";
import { PasswordField } from "@/components/PasswordField";
import { TurnstileField } from "@/components/TurnstileField";
import { getAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getAdminSession();
  if (session) redirect("/admin");
  const query = await searchParams;

  return (
    <main className="admin-auth-page">
      <section className="admin-auth-card">
        <Link className="admin-auth-brand" href="/">
          <img src="/images/charlotte-ai-logo.png" alt="" />
          <span>Charlotte AI</span>
        </Link>
        <div className="admin-auth-icon">
          <ShieldCheck size={30} />
        </div>
        <div>
          <div className="admin-breadcrumb">Private admin</div>
          <h1>Open the command center.</h1>
          <p>Use the admin username and password. This area is separate from teacher and student accounts.</p>
        </div>
        <Message error={query.error} />
        <form className="admin-form light" action={loginAdmin}>
          <label>
            Username or email
            <input name="username" autoComplete="username" maxLength={254} required />
          </label>
          <PasswordField name="password" label="Password" autoComplete="current-password" />
          <TurnstileField action="admin_login" />
          <button className="admin-primary-button" type="submit">
            <LockKeyhole size={18} />
            Sign in
          </button>
        </form>
        <p className="admin-auth-foot">
          To find this page later, scroll to the bottom of the Charlotte AI homepage and click Admin.
        </p>
      </section>
    </main>
  );
}
