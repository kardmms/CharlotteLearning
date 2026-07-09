import { FileSpreadsheet, UserPlus } from "lucide-react";
import { addStudents } from "@/app/teacher/actions";
import { TeacherTopbar } from "@/components/AppTopbar";
import { ClassNav } from "@/components/ClassNav";
import { Message } from "@/components/Message";
import { StudentSpreadsheetImport } from "@/components/StudentSpreadsheetImport";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gradeLabel } from "@/lib/grade";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RosterPage({
  params,
  searchParams
}: {
  params: Promise<{ classroomId: string }>;
  searchParams: Promise<{ error?: string; saved?: string; imported?: string }>;
}) {
  const teacher = await requireTeacher();
  const { classroomId } = await params;
  const query = await searchParams;
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacherId: teacher.id },
    include: {
      students: {
        where: { active: true },
        orderBy: { displayName: "asc" },
        include: {
          account: { select: { id: true } },
          _count: { select: { sessions: true } }
        }
      }
    }
  });
  if (!classroom) notFound();

  return (
    <>
      <TeacherTopbar name={teacher.name} classroomId={classroomId} />
      <main className="page">
        <section className="panel">
          <div className="eyebrow">Students</div>
          <h1>{classroom.name}</h1>
          <p>{gradeLabel(classroom.gradeLevel)}</p>
          <ClassNav classroomId={classroom.id} />
          <Message
            error={query.error}
            success={
              query.saved
                ? "Students added."
                : query.imported
                  ? "Spreadsheet imported."
                  : undefined
            }
          />
        </section>

        <section className="grid roster-entry-grid" style={{ marginTop: 18 }}>
          <div className="panel spreadsheet-import-panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">AI-assisted spreadsheet import</div>
                <h2>Upload and review students</h2>
              </div>
              <FileSpreadsheet color="#2f7d4a" />
            </div>
            <p>
              Charlotte copies student names and emails into a review table. Students create their
              own password after you enroll their email.
            </p>
            <StudentSpreadsheetImport classroomId={classroom.id} />
          </div>

          <div className="panel manual-student-panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Manual entry</div>
                <h2>Add student info</h2>
              </div>
              <UserPlus color="#376c8f" />
            </div>
            <form className="form-grid" action={addStudents}>
              <input type="hidden" name="classroomId" value={classroom.id} />
              <div className="student-entry-fields">
                <div className="student-entry-head" aria-hidden="true">
                  <span>Student name</span>
                  <span>Student email</span>
                </div>
                {Array.from({ length: 8 }).map((_, index) => (
                  <div className="student-entry-row" key={index}>
                    <label>
                      <span>Student name</span>
                      <input name="studentName" placeholder={index === 0 ? "Ari Johnson" : ""} />
                    </label>
                    <label>
                      <span>Student email</span>
                      <input
                        name="studentEmail"
                        placeholder={index === 0 ? "ari@school.org" : ""}
                        type="email"
                      />
                    </label>
                  </div>
                ))}
              </div>
              <button className="button" type="submit">
                Add students
              </button>
            </form>
          </div>

        </section>

        <section style={{ marginTop: 18 }}>
          <div className="panel-header" style={{ marginBottom: 12 }}>
            <div>
              <div className="eyebrow">Linked accounts</div>
              <h2>Students</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Sessions</th>
                  <th>Status</th>
                  <th>Login security</th>
                </tr>
              </thead>
              <tbody>
                {classroom.students.map((student) => (
                  <tr key={student.id}>
                    <td>{student.displayName}</td>
                    <td>{student.email || "No email linked"}</td>
                    <td>{student._count.sessions}</td>
                    <td>
                      <span className={`status-pill ${student.account ? "status-green" : "status-yellow"}`}>
                        {student.account ? "Account active" : "Invitation ready"}
                      </span>
                    </td>
                    <td>{student.account ? "Student-created password" : "Waiting for student signup"}</td>
                  </tr>
                ))}
                {classroom.students.length === 0 && (
                  <tr>
                    <td colSpan={5}>No students are linked yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
