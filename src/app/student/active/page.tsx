import { ExternalLink, LogOut } from "lucide-react";
import { logoutStudent } from "@/app/student/actions";
import { requireStudent } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ActiveAssignmentPage() {
  const student = await requireStudent();
  return (
    <main className="student-holding-page">
      <img className="holding-logo" src="/images/charlotte-ai-logo.png" alt="" />
      <ExternalLink size={30} />
      <h1>Your activity is open in its focus window.</h1>
      <p>{student.displayName}, finish there before returning to this screen.</p>
      <form action={logoutStudent}>
        <button className="ghost-button" type="submit"><LogOut size={18} /> Log out</button>
      </form>
    </main>
  );
}
