import Link from "next/link";
import { BookOpen } from "lucide-react";
import { loginStudent } from "@/app/student/actions";
import { PublicTopbar } from "@/components/AppTopbar";
import { Message } from "@/components/Message";
import { PasswordField } from "@/components/PasswordField";
import { TurnstileField } from "@/components/TurnstileField";

export const dynamic = "force-dynamic";

export default async function StudentLoginPage({
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
              <div className="eyebrow">Student station</div>
              <h1>Sign in to Charlotte.</h1>
            </div>
            <BookOpen color="#725aa6" />
          </div>
          <p>Use your student email and the password you created.</p>
          <Message error={params.error} />
          <form className="form-grid" action={loginStudent}>
            <label>
              Student email
              <input name="email" type="email" autoComplete="email" maxLength={254} required />
            </label>
            <PasswordField name="password" label="Password" autoComplete="current-password" />
            <TurnstileField action="student_login" />
            <button className="button" type="submit">
              Sign in
            </button>
          </form>
          <p>New to Charlotte? <Link href="/student/signup">Create your student account</Link></p>
        </div>
      </main>
    </>
  );
}
