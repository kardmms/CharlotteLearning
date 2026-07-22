import Link from "next/link";
import { Plus } from "lucide-react";
import { createClassroom } from "@/app/teacher/actions";
import { TeacherTopbar } from "@/components/AppTopbar";
import { GradeSlider } from "@/components/GradeSlider";
import { Message } from "@/components/Message";
import { requireTeacher } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewClassPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const teacher = await requireTeacher();
  const query = await searchParams;

  return (
    <>
      <TeacherTopbar name={teacher.name} />
      <main className="page narrow-page">
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Create class</div>
              <h1>New classroom</h1>
            </div>
            <Plus color="#2563EB" />
          </div>
          <Message error={query.error} />
          <form className="form-grid" action={createClassroom}>
            <input type="hidden" name="returnPath" value="/teacher/classes/new" />
            <label>
              Class name
              <input name="name" placeholder="Period 2 Literacy" required />
            </label>
            <GradeSlider defaultValue="3" />
            <p className="form-note">
              Charlotte will generate a classroom recovery key after setup. Save it somewhere
              safe; students will not need it.
            </p>
            <button className="button" type="submit">
              Create class
            </button>
          </form>
          <div className="actions">
            <Link className="ghost-button" href="/teacher/classes">
              Back to classes
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
