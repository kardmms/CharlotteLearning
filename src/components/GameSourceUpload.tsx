"use client";

export function GameSourceUpload() {
  return <input name="sourceFile" type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain" onChange={(event) => {
    const input = event.currentTarget;
    input.setCustomValidity(input.files?.[0] && input.files[0].size > 4 * 1024 * 1024
      ? "Choose a file under 4 MB, or paste your word list below." : "");
    input.reportValidity();
  }} />;
}
