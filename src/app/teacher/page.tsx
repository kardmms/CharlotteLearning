import Link from "next/link";
import { ArrowRight, Plus, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { createClassroom } from "@/app/teacher/actions";
import { TeacherTopbar } from "@/components/AppTopbar";
import { ClassActionsMenu } from "@/components/ClassActionsMenu";
import { GradeSlider } from "@/components/GradeSlider";
import { Message } from "@/components/Message";
import { TeacherTutorial } from "@/components/TeacherTutorial";
import { gradeLabel } from "@/lib/grade";
import { prisma } from "@/lib/db";
import { requireTeacher } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TeacherHomePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const teacher = await requireTeacher();
  const classrooms = await prisma.classroom.findMany({
    where: { teacherId: teacher.id, archivedAt: null },
    include: {
      _count: {
        select: {
          students: true,
          materials: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  if (classrooms.length > 0) redirect("/teacher/classes");

  return (
    <>
      <TeacherTopbar name={teacher.name} />
      <TeacherTutorial />
      <main className="page">
        <section className="panel" data-tour="teacher-workspace">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Teacher workspace</div>
              <h1>Classes and assignments</h1>
            </div>
            <UsersRound color="#2563EB" />
          </div>
          <Message error={params.error} />
        </section>

        <section style={{ marginTop: 18 }} data-tour="create-class">
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Create class</div>
                <h2>Class setup</h2>
              </div>
              <Plus color="#2563EB" />
            </div>
            <form className="form-grid" action={createClassroom}>
              <input type="hidden" name="returnPath" value="/teacher" />
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
          </div>
        </section>

        <section style={{ marginTop: 22 }} data-tour="class-dashboards">
          <div className="panel-header" style={{ marginBottom: 14 }}>
            <div>
              <div className="eyebrow">Classes</div>
              <h2>Your dashboards</h2>
            </div>
          </div>
          <div className="grid two">
            {classrooms.map((classroom) => (
              <div className="tile class-card" key={classroom.id}>
                <div className="row-between">
                  <div className="class-card-copy">
                    <h3>{classroom.name}</h3>
                    <p>{gradeLabel(classroom.gradeLevel)}</p>
                  </div>
                  <Link
                    className="icon-button"
                    href={`/teacher/classes/${classroom.id}`}
                    aria-label={`Open ${classroom.name}`}
                  >
                    <ArrowRight size={18} />
                  </Link>
                </div>
                <div className="class-card-metrics">
                  <div className="metric">
                    <strong>{classroom._count.students}</strong>
                    <span>Students</span>
                  </div>
                  <div className="metric">
                    <strong>{classroom._count.materials}</strong>
                    <span>Assignments</span>
                  </div>
                </div>
                <div className="class-card-delete">
                  <ClassActionsMenu classroomId={classroom.id} />
                </div>
              </div>
            ))}
            {classrooms.length === 0 && (
              <div className="tile">
                <h3>No classes yet</h3>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
