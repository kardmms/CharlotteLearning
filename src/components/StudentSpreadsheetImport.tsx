"use client";

import { useActionState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import {
  addStudents,
  prepareStudentImport,
  type RosterImportState
} from "@/app/teacher/actions";
import { PasswordField } from "@/components/PasswordField";

const initialState: RosterImportState = { rows: [], fileName: "" };

export function StudentSpreadsheetImport({
  classroomId,
  privacyProtected,
  privacyKeyHint
}: {
  classroomId: string;
  privacyProtected?: boolean;
  privacyKeyHint?: string | null;
}) {
  const [state, prepareAction, pending] = useActionState(prepareStudentImport, initialState);

  return (
    <div className="spreadsheet-import-flow">
      <form className="form-grid" action={prepareAction}>
        <input type="hidden" name="classroomId" value={classroomId} />
        <label>
          Student spreadsheet
          <input
            name="studentFile"
            type="file"
            accept=".csv,.tsv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
          />
        </label>
        <button className="button" disabled={pending} type="submit">
          <Sparkles size={18} />
          {pending ? "Charlotte is reading the spreadsheet..." : "Review spreadsheet with Charlotte"}
        </button>
      </form>

      {state.error && <div className="message error">{state.error}</div>}

      {state.rows.length > 0 && (
        <form className="spreadsheet-review-form form-grid" action={addStudents}>
          <input type="hidden" name="classroomId" value={classroomId} />
          <div className="spreadsheet-review-heading">
            <div>
              <div className="eyebrow">Review before adding</div>
              <h3>Charlotte found {state.rows.length} {state.rows.length === 1 ? "student" : "students"}</h3>
              <p>Double-check every field below. Nothing is official until you confirm.</p>
            </div>
            <span className="status-pill status-blue"><Sparkles size={15} /> {state.fileName}</span>
          </div>

          {privacyProtected && (
            <PasswordField
              name="privacyKey"
              label="School privacy key"
              required
              minLength={12}
              autoComplete="off"
              helpText={
                privacyKeyHint
                  ? `Hint: ${privacyKeyHint}`
                  : "Charlotte uses this once to encrypt the roster entry. The key is not stored."
              }
            />
          )}

          <div className="student-entry-fields spreadsheet-review-fields">
            <div className="student-entry-head" aria-hidden="true">
              <span>Student name</span>
              <span>Student email</span>
            </div>
            {state.rows.map((row, index) => (
              <div className="student-entry-row" key={`${row.email}-${index}`}>
                <label>
                  <span>Student name</span>
                  <input name="studentName" defaultValue={row.displayName} maxLength={120} required />
                </label>
                <label>
                  <span>Student email</span>
                  <input name="studentEmail" defaultValue={row.email} maxLength={254} required type="email" />
                </label>
              </div>
            ))}
          </div>

          <button className="button" type="submit">
            <CheckCircle2 size={18} />
            Confirm and add {state.rows.length} {state.rows.length === 1 ? "student" : "students"}
          </button>
        </form>
      )}
    </div>
  );
}
