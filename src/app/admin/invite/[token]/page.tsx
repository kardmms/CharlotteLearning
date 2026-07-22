import Link from "next/link";
import { KeyRound, UserPlus } from "lucide-react";
import { acceptAdminInvite } from "@/app/admin/actions";
import { Message } from "@/components/Message";
import { PasswordField } from "@/components/PasswordField";
import { TurnstileField } from "@/components/TurnstileField";
import { prisma } from "@/lib/db";
import { hashText } from "@/lib/security";

export const dynamic = "force-dynamic";

export default async function AdminInvitePage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const invite = await prisma.adminInvite.findUnique({
    where: { tokenHash: hashText(token) }
  });
  const isUsable = Boolean(invite && !invite.usedAt && invite.expiresAt >= new Date());

  return (
    <main className="admin-auth-page">
      <section className="admin-auth-card wide">
        <Link className="admin-auth-brand" href="/">
          <img src="/images/charlotte-ai-logo.png" alt="" />
          <span>Charlotte AI</span>
        </Link>
        <div className="admin-auth-icon">
          <UserPlus size={30} />
        </div>
        <div>
          <div className="admin-breadcrumb">Admin invitation</div>
          <h1>Create your admin password.</h1>
          <p>
            After setup, return by going to the Charlotte AI homepage, scrolling to the bottom,
            and clicking the small Admin link.
          </p>
        </div>
        <Message error={query.error} />
        {isUsable ? (
          <form className="admin-form light" action={acceptAdminInvite}>
            <input type="hidden" name="token" value={token} />
            <label>
              Email
              <input value={invite!.email} readOnly />
            </label>
            <label>
              Name
              <input name="name" maxLength={120} required placeholder={invite!.name || "Your name"} />
            </label>
            <label>
              Username
              <input name="username" minLength={3} maxLength={40} autoComplete="username" required />
            </label>
            <PasswordField name="password" label="Password" minLength={12} autoComplete="new-password" />
            <PasswordField name="confirmPassword" label="Confirm password" minLength={12} autoComplete="new-password" />
            <TurnstileField action="admin_accept_invite" />
            <button className="admin-primary-button" type="submit">
              <KeyRound size={18} />
              Create admin account
            </button>
          </form>
        ) : (
          <div className="admin-empty-state">
            <strong>This invite is expired or already used.</strong>
            <p>Ask the Charlotte AI owner to send a fresh admin invite.</p>
            <Link className="admin-primary-button" href="/admin/login">Go to admin login</Link>
          </div>
        )}
      </section>
    </main>
  );
}
