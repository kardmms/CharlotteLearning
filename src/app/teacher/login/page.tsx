import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { loginTeacher } from "@/app/teacher/actions";
import { PublicTopbar } from "@/components/AppTopbar";
import { Message } from "@/components/Message";

export const dynamic = "force-dynamic";

export default async function TeacherLoginPage({
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
              <div className="eyebrow">Teacher login</div>
              <h1>Open the dashboard.</h1>
            </div>
            <GraduationCap color="#2f7d4a" />
          </div>
          <Message error={params.error} />
          <form className="form-grid" action={loginTeacher}>
            <label>
              Email
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
          <p>
            First time here? <Link href="/teacher/setup">Create the first teacher account</Link>
          </p>
        </div>
      </main>
    </>
  );
}
