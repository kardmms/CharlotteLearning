import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { createFirstTeacher } from "@/app/teacher/actions";
import { PublicTopbar } from "@/components/AppTopbar";
import { Message } from "@/components/Message";
import { PasswordField } from "@/components/PasswordField";
import { TurnstileField } from "@/components/TurnstileField";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TeacherSetupPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const existing = await prisma.teacher.count();
  if (existing > 0) redirect("/teacher/login");

  return (
    <>
      <PublicTopbar />
      <main className="page narrow-page">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Teacher setup</div>
              <h1>Create the first teacher account.</h1>
            </div>
            <KeyRound color="#2f7d4a" />
          </div>
          <p>
            This account controls classes, uploads, question review, student progress, and exports.
          </p>
          <Message error={params.error} />
          <form className="form-grid" action={createFirstTeacher}>
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
            <TurnstileField action="teacher_setup" />
            <button className="button" type="submit">
              Create teacher account
            </button>
          </form>
          <p>
            Already set up? <Link href="/teacher/login">Sign in</Link>
          </p>
        </div>
      </main>
    </>
  );
}
