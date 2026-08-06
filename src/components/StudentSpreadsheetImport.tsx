"use client";

import { useActionState } from "react";
import { CheckCircle2, Download, FileUp, Sparkles } from "lucide-react";
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
  privacyKeyHint,
  isShowcase = false
}: {
  classroomId: string;
  privacyProtected?: boolean;
  privacyKeyHint?: string | null;
  isShowcase?: boolean;
}) {
  const [state, prepareAction, pending] = useActionState(prepareStudentImport, initialState);

  return (
    <div className="spreadsheet-import-flow">
      {isShowcase && (
        <div className="showcase-roster-walkthrough" data-showcase-target="showcase-roster-import">
          <div>
            <span>1</span>
            <strong>Download the sample</strong>
            <small>It contains 12 fictional students—no real student data.</small>
          </div>
          <a
            className="ghost-button showcase-next-action"
            href="/samples/charlotte-showcase-roster.csv"
            download="charlotte-showcase-roster.csv"
          >
            <Download size={17} />
            Download sample roster
          </a>
          <div>
            <span>2</span>
            <strong>Upload it below</strong>
            <small>Charlotte will identify the name and email columns.</small>
          </div>
          <div>
            <span>3</span>
            <strong>Approve the generated list</strong>
            <small>No recovery key is needed. Students are verified and activated automatically.</small>
          </div>
        </div>
      )}
      <form className="form-grid" action={prepareAction}>
        <input type="hidden" name="classroomId" value={classroomId} />
        <label className={isShowcase && state.rows.length === 0 ? "showcase-click-box" : undefined}>
          Student spreadsheet
          <input
            name="studentFile"
            type="file"
            accept=".csv,.tsv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
          />
        </label>
        <button
          className={`button ${isShowcase && state.rows.length === 0 ? "showcase-next-action" : ""}`}
          disabled={pending}
          type="submit"
        >
          {pending ? <Sparkles size={18} /> : <FileUp size={18} />}
          {pending
            ? "Charlotte is generating the class list..."
            : isShowcase
              ? "Have Charlotte generate the class list"
              : "Review spreadsheet with Charlotte"}
        </button>
      </form>

      {state.error && <div className="message error">{state.error}</div>}

      {state.rows.length > 0 && (
        <form className="spreadsheet-review-form form-grid" action={addStudents}>
          <input type="hidden" name="classroomId" value={classroomId} />
          <div className="spreadsheet-review-heading">
            <div>
              <div className="eyebrow">{isShowcase ? "AI-generated class list" : "Review before adding"}</div>
              <h3>Charlotte found {state.rows.length} {state.rows.length === 1 ? "student" : "students"}</h3>
              <p>
                {isShowcase
                  ? "Check the fictional roster, then approve it. Every student account will be activated automatically."
                  : "Double-check every field below. Nothing is official until you confirm."}
              </p>
            </div>
            <span className="status-pill status-blue"><Sparkles size={15} /> {state.fileName}</span>
          </div>

          {privacyProtected && !isShowcase && (
            <PasswordField
              name="privacyKey"
              label="Classroom recovery key"
              required
              minLength={12}
              autoComplete="off"
              helpText={
                privacyKeyHint
                  ? `Hint: ${privacyKeyHint}`
                  : "Students do not need this. Charlotte uses it to encrypt the roster entry, then does not store the raw key."
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

          <button className={`button ${isShowcase ? "showcase-next-action" : ""}`} type="submit">
            <CheckCircle2 size={18} />
            {isShowcase ? "Approve and add" : "Confirm and add"} {state.rows.length} {state.rows.length === 1 ? "student" : "students"}
          </button>
        </form>
      )}
    </div>
  );
}
