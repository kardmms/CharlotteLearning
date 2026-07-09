import { TeacherTopbar } from "@/components/AppTopbar";
import { AppearanceControls } from "@/components/AppearanceControls";
import { requireTeacher } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TeacherAppearancePage() {
  const teacher = await requireTeacher();

  return (
    <>
      <TeacherTopbar name={teacher.name} />
      <main className="page">
        <section className="workspace-heading">
          <div>
            <div className="eyebrow">Appearance</div>
            <h1>Workspace display</h1>
            <p>Small visual preferences for the teacher dashboard.</p>
          </div>
        </section>
        <AppearanceControls />
      </main>
    </>
  );
}
