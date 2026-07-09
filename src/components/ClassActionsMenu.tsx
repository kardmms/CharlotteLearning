import { Archive, MoreVertical, RotateCcw, Trash2 } from "lucide-react";
import {
  archiveClassroom,
  deleteClassroom,
  unarchiveClassroom
} from "@/app/teacher/actions";

export function ClassActionsMenu({
  classroomId,
  archived = false
}: {
  classroomId: string;
  archived?: boolean;
}) {
  return (
    <details className="kebab-menu">
      <summary aria-label="Class actions">
        <MoreVertical size={18} />
      </summary>
      <div className="kebab-menu-panel">
        <form action={archived ? unarchiveClassroom : archiveClassroom}>
          <input type="hidden" name="classroomId" value={classroomId} />
          <button type="submit">
            {archived ? <RotateCcw size={16} /> : <Archive size={16} />}
            {archived ? "Restore class" : "Archive class"}
          </button>
        </form>
        <form action={deleteClassroom}>
          <input type="hidden" name="classroomId" value={classroomId} />
          <button className="danger-menu-item" type="submit">
            <Trash2 size={16} />
            Delete class
          </button>
        </form>
      </div>
    </details>
  );
}
