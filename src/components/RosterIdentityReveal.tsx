"use client";

import { useActionState } from "react";
import { Eye } from "lucide-react";
import {
  revealRosterIdentities,
  type RosterRevealState
} from "@/app/teacher/actions";
import { PasswordField } from "@/components/PasswordField";

const initialState: RosterRevealState = { rows: [] };

export function RosterIdentityReveal({
  classroomId,
  privacyKeyHint
}: {
  classroomId: string;
  privacyKeyHint?: string | null;
}) {
  const [state, action, pending] = useActionState(revealRosterIdentities, initialState);

  return (
    <div className="roster-reveal">
      <form className="form-grid" action={action}>
        <input type="hidden" name="classroomId" value={classroomId} />
        <PasswordField
          name="privacyKey"
          label="Reveal roster with classroom recovery key"
          required
          minLength={12}
          autoComplete="off"
          helpText={privacyKeyHint ? `Hint: ${privacyKeyHint}` : "The recovery key is checked once and not stored."}
        />
        <button className="ghost-button" disabled={pending} type="submit">
          <Eye size={17} />
          {pending ? "Checking key..." : "Reveal names"}
        </button>
      </form>
      {state.error && <div className="message error">{state.error}</div>}
      {state.keyAccepted && (
        <div className="table-wrap roster-reveal-table">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.displayName}</td>
                  <td>{row.email || "No email linked"}</td>
                </tr>
              ))}
              {state.rows.length === 0 && (
                <tr>
                  <td colSpan={2}>No students are linked yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
