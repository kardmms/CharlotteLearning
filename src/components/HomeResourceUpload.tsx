"use client";

import { useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { uploadAtHomeResource } from "@/app/teacher/actions";

export function HomeResourceUpload({ classroomId }: { classroomId: string }) {
  const [fileName, setFileName] = useState("");

  return (
    <form className="home-resource-upload" action={uploadAtHomeResource}>
      <input type="hidden" name="classroomId" value={classroomId} />
      <label className="home-resource-scope">
        Reading/chapter limit
        <input name="readingScope" placeholder="Example: Through chapter 2 or pages 1-5" maxLength={160} />
        <small>Optional, but recommended for books and longer readings so Charlotte stays in-bounds.</small>
      </label>
      <label className={`home-resource-dropzone ${fileName ? "has-file" : ""}`}>
        <input
          name="sourceFile"
          type="file"
          accept=".pdf,.docx,.txt,application/pdf"
          required
          onChange={(event) => setFileName(event.target.files?.[0]?.name || "")}
        />
        {fileName ? <FileText size={30} /> : <UploadCloud size={34} />}
        <span>
          <strong>{fileName || "Upload book text, one chapter, or a question sheet"}</strong>
          <small>{fileName ? "Ready to add" : "For at-home reinforcement · PDF, DOCX, or TXT · up to 4 MB"}</small>
        </span>
      </label>
      <button className="button" type="submit" disabled={!fileName}>
        <UploadCloud size={18} /> Add reading to at-home practice
      </button>
    </form>
  );
}
