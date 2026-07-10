import { KeyRound, Mail, UserRound } from "lucide-react";
import { updateTeacherPassword } from "@/app/teacher/actions";
import { TeacherTopbar } from "@/components/AppTopbar";
import { Message } from "@/components/Message";
import { PasswordField } from "@/components/PasswordField";
import { requireTeacher } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TeacherAccountPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const teacher = await requireTeacher();
  const query = await searchParams;

  return (
    <>
      <TeacherTopbar name={teacher.name} />
      <main className="page">
        <section className="workspace-heading">
          <div>
            <div className="eyebrow">Account</div>
            <h1>Teacher profile</h1>
            <p>Keep the account details simple and locked down.</p>
          </div>
        </section>

        <section className="grid two" style={{ marginTop: 18 }}>
          <div className="panel account-card">
            <div className="account-line">
              <span>
                <UserRound size={19} />
              </span>
              <div>
                <strong>Name</strong>
                <p>{teacher.name}</p>
              </div>
            </div>
            <div className="account-line">
              <span>
                <Mail size={19} />
              </span>
              <div>
                <strong>Email</strong>
                <p>{teacher.email}</p>
              </div>
            </div>
            <div className="account-line">
              <span>
                <KeyRound size={19} />
              </span>
              <div>
                <strong>Password</strong>
                <p>Protected with hashing. Passwords are never shown after setup.</p>
              </div>
            </div>
          </div>

          <form className="panel form-grid" action={updateTeacherPassword}>
            <div>
              <div className="eyebrow">Security</div>
              <h2>Change password</h2>
              <p>Confirm the account email, then enter the new password twice.</p>
            </div>
            <Message
              error={query.error}
              success={query.saved ? "Password updated." : undefined}
            />
            <label>
              Confirm email
              <input name="confirmEmail" type="email" placeholder={teacher.email} required />
            </label>
            <PasswordField name="newPassword" label="New password" minLength={10} autoComplete="new-password" />
            <PasswordField name="confirmPassword" label="Confirm new password" minLength={10} autoComplete="new-password" />
            <button className="button" type="submit">
              Update password
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
