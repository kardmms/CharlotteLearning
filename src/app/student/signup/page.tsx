import Link from "next/link";
import { UserRoundPlus } from "lucide-react";
import { registerStudent } from "@/app/student/actions";
import { Message } from "@/components/Message";
import { PasswordField } from "@/components/PasswordField";
import { PublicTopbar } from "@/components/AppTopbar";
import { TurnstileField } from "@/components/TurnstileField";

export const dynamic = "force-dynamic";

export default async function StudentSignupPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  return (
    <>
      <PublicTopbar />
      <main className="page narrow-page">
        <div className="panel">
          <div className="panel-header">
            <div><div className="eyebrow">Student account</div><h1>Create your Charlotte login.</h1></div>
            <UserRoundPlus color="#725aa6" />
          </div>
          <p>Your teacher must add your email to a class first. You only need one account for every Charlotte class.</p>
          <Message error={query.error} />
          <form className="form-grid" action={registerStudent}>
            <label>Your name<input name="displayName" autoComplete="name" maxLength={120} required /></label>
            <label>Student email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
            <PasswordField name="password" label="Password" minLength={10} autoComplete="new-password" helpText="Use at least 10 characters." />
            <PasswordField name="confirmPassword" label="Confirm password" minLength={10} autoComplete="new-password" />
            <TurnstileField action="student_signup" />
            <button className="button" type="submit">Create account</button>
          </form>
          <p>Already have an account? <Link href="/student/login">Sign in</Link></p>
        </div>
      </main>
    </>
  );
}
