"use client";

import { useActionState } from "react";
import { Eye, LockKeyhole } from "lucide-react";
import {
  revealAdminRosterIdentities,
  type AdminRosterRevealState
} from "@/app/admin/actions";
import { PasswordField } from "@/components/PasswordField";

const initialState: AdminRosterRevealState = { rows: [] };

export function AdminRosterIdentityReveal({
  classroomId,
  privacyKeyHint
}: {
  classroomId: string;
  privacyKeyHint?: string | null;
}) {
  const [state, action, pending] = useActionState(revealAdminRosterIdentities, initialState);

  return (
    <section className="admin-glass-panel admin-roster-reveal">
      <div className="admin-card-head">
        <div>
          <h2>Access protected roster data</h2>
          <p>
            Enter the classroom recovery key to reveal student names and emails. The key is checked once,
            never stored, and identities are sealed again when this page is refreshed.
          </p>
        </div>
        <LockKeyhole size={20} />
      </div>

      <form className="admin-form admin-roster-reveal-form" action={action}>
        <input type="hidden" name="classroomId" value={classroomId} />
        <PasswordField
          name="privacyKey"
          label="Classroom recovery key"
          required
          minLength={12}
          autoComplete="off"
          helpText={privacyKeyHint ? `Key hint: ${privacyKeyHint}` : "Ask the classroom teacher for the saved recovery key."}
        />
        <button className="admin-primary-button" disabled={pending} type="submit">
          <Eye size={17} />
          {pending ? "Checking key..." : "Access roster data"}
        </button>
      </form>

      {state.error && <div className="admin-roster-reveal-message error">{state.error}</div>}
      {state.keyAccepted && (
        <div className="admin-table-wrap admin-roster-reveal-table">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Protected label</th>
                <th>Student name</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.protectedLabel}</strong></td>
                  <td>{row.displayName}</td>
                  <td>{row.email || "No email linked"}</td>
                </tr>
              ))}
              {state.rows.length === 0 && (
                <tr><td colSpan={3}>No active students are linked to this classroom.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
