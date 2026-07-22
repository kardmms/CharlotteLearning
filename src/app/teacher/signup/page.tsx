import Link from "next/link";
import { UserRoundPlus } from "lucide-react";
import { createTeacherAccount } from "@/app/teacher/actions";
import { PublicTopbar } from "@/components/AppTopbar";
import { Message } from "@/components/Message";
import { PasswordField } from "@/components/PasswordField";
import { TurnstileField } from "@/components/TurnstileField";

export const dynamic = "force-dynamic";

export default async function TeacherSignupPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      <PublicTopbar />
      <main className="page narrow-page">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Teacher signup</div>
              <h1>Create your teacher account.</h1>
            </div>
            <UserRoundPlus color="#2f7d4a" />
          </div>
          <p>
            Start with your account, then create a class, save the classroom recovery key,
            and add your students.
          </p>
          <Message error={params.error} />
          <form className="form-grid" action={createTeacherAccount}>
            <label>
              Teacher name
              <input name="name" autoComplete="name" maxLength={120} required />
            </label>
            <label>
              Email
              <input name="email" type="email" autoComplete="email" maxLength={254} required />
            </label>
            <PasswordField
              name="password"
              label="Password"
              minLength={10}
              autoComplete="new-password"
              helpText="Use at least 10 characters. Longer is better."
            />
            <TurnstileField action="teacher_signup" />
            <button className="button" type="submit">
              Create teacher account
            </button>
          </form>
          <p>
            Already have an account? <Link href="/teacher/login">Sign in</Link>
          </p>
        </div>
      </main>
    </>
  );
}
