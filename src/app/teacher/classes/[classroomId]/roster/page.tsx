import { FileSpreadsheet, ShieldCheck, UserPlus } from "lucide-react";
import { cookies } from "next/headers";
import { addStudents } from "@/app/teacher/actions";
import { TeacherTopbar } from "@/components/AppTopbar";
import { ClassNav } from "@/components/ClassNav";
import { Message } from "@/components/Message";
import { PasswordField } from "@/components/PasswordField";
import { RecoveryKeyPopup } from "@/components/RecoveryKeyPopup";
import { RosterIdentityReveal } from "@/components/RosterIdentityReveal";
import { StudentSpreadsheetImport } from "@/components/StudentSpreadsheetImport";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gradeLabel } from "@/lib/grade";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function readRecoveryKeyFlash(value?: string) {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      classroomId: string;
      className: string;
      recoveryKey: string;
    };
  } catch {
    return null;
  }
}

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
  const cookieStore = await cookies();
  const recoveryKeyFlash = readRecoveryKeyFlash(
    cookieStore.get("charlotte_class_recovery_key_flash")?.value
  );
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
  const isPrivacyProtected = classroom.identityMode === "SCHOOL_KEY";
  const recoveryKeyToSave = recoveryKeyFlash?.classroomId === classroom.id
    ? recoveryKeyFlash.recoveryKey
    : null;

  return (
    <>
      <TeacherTopbar name={teacher.name} classroomId={classroomId} />
      {recoveryKeyToSave && (
        <RecoveryKeyPopup classroomName={classroom.name} recoveryKey={recoveryKeyToSave} />
      )}
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

        <section className="panel privacy-roster-panel" style={{ marginTop: 18 }}>
          <div className="panel-header">
            <div>
              <div className="eyebrow">Student privacy</div>
              <h2>{isPrivacyProtected ? "Recovery-key protected roster" : "Standard roster"}</h2>
            </div>
            <ShieldCheck color={isPrivacyProtected ? "#15803d" : "#376c8f"} />
          </div>
          <p>
            {isPrivacyProtected
              ? "Student names and emails are stored as encrypted identity data. Students only use email and password. The classroom recovery key is for teachers and approved admin recovery."
              : "This class stores student names and emails normally. New classes use classroom recovery keys for database-anonymous student identities."}
          </p>
          {isPrivacyProtected && classroom.privacyKeyHint && (
            <span className="status-pill status-blue">Hint: {classroom.privacyKeyHint}</span>
          )}
          {isPrivacyProtected && (
            <RosterIdentityReveal
              classroomId={classroom.id}
              privacyKeyHint={classroom.privacyKeyHint}
            />
          )}
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
              Charlotte copies student rows into a review table. Students create their own password
              after you enroll their email.
            </p>
            <StudentSpreadsheetImport
              classroomId={classroom.id}
              privacyProtected={isPrivacyProtected}
              privacyKeyHint={classroom.privacyKeyHint}
            />
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
              {isPrivacyProtected && (
                <PasswordField
                  name="privacyKey"
                  label="Classroom recovery key"
                  required
                  minLength={12}
                  autoComplete="off"
                  helpText="Students do not need this. Charlotte uses it to encrypt the roster entry, then does not store the raw key."
                />
              )}
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
                    <td>
                      {student.email || (student.emailKeyHash ? "Encrypted with recovery key" : "No email linked")}
                    </td>
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
