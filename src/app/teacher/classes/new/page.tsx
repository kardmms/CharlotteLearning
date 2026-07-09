import Link from "next/link";
import { Plus } from "lucide-react";
import { createClassroom } from "@/app/teacher/actions";
import { TeacherTopbar } from "@/components/AppTopbar";
import { GradeSlider } from "@/components/GradeSlider";
import { requireTeacher } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewClassPage() {
  const teacher = await requireTeacher();

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
          <form className="form-grid" action={createClassroom}>
            <label>
              Class name
              <input name="name" placeholder="Period 2 Literacy" required />
            </label>
            <GradeSlider defaultValue="3" />
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
