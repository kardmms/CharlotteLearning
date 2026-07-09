"use client";

import { Trash2 } from "lucide-react";
import { deleteMaterial } from "@/app/teacher/actions";

export function DeleteMaterialButton({ classroomId, materialId }: { classroomId: string; materialId: string }) {
  return (
    <form
      action={deleteMaterial}
      onSubmit={(event) => {
        if (!window.confirm("Delete this assignment and all of its responses? This cannot be undone.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="classroomId" value={classroomId} />
      <input type="hidden" name="materialId" value={materialId} />
      <button className="icon-button assignment-delete-button" type="submit" title="Delete assignment" aria-label="Delete assignment">
        <Trash2 size={17} />
      </button>
    </form>
  );
}
