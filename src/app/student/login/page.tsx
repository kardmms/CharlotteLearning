import Link from "next/link";
import { BookOpen } from "lucide-react";
import { loginStudent } from "@/app/student/actions";
import { PublicTopbar } from "@/components/AppTopbar";
import { Message } from "@/components/Message";

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
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Password
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
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
