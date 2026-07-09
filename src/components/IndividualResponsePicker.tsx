"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

type ResponseOption = {
  sessionId: string;
  studentName: string;
  status: "COMPLETED" | "PARTIAL";
};

export function IndividualResponsePicker({
  classroomId,
  materialId,
  responses,
  currentSessionId = ""
}: {
  classroomId: string;
  materialId: string;
  responses: ResponseOption[];
  currentSessionId?: string;
}) {
  const router = useRouter();
  const currentIndex = responses.findIndex((response) => response.sessionId === currentSessionId);
  const previousResponse = currentIndex > 0 ? responses[currentIndex - 1] : null;
  const nextResponse = currentIndex >= 0 && currentIndex < responses.length - 1
    ? responses[currentIndex + 1]
    : null;

  function openResponse(sessionId: string) {
    router.push(`/teacher/classes/${classroomId}/materials/${materialId}/responses/${sessionId}`);
  }

  const picker = (
    <label className="individual-response-picker">
      <span>Individual response</span>
      <select
        aria-label="Choose an individual response"
        value={currentSessionId}
        onChange={(event) => {
          if (!event.target.value) return;
          openResponse(event.target.value);
        }}
      >
        {!currentSessionId && <option value="">Choose a student</option>}
        {responses.map((response) => (
          <option key={response.sessionId} value={response.sessionId}>
            {response.studentName}{response.status === "PARTIAL" ? " — timed out" : ""}
          </option>
        ))}
      </select>
    </label>
  );

  if (!currentSessionId) return picker;

  return (
    <div className="individual-response-navigation">
      <button
        aria-label="Previous student response"
        className="icon-button"
        data-no-loading="true"
        disabled={!previousResponse}
        title="Previous student"
        type="button"
        onClick={() => previousResponse && openResponse(previousResponse.sessionId)}
      >
        <ArrowLeft size={19} />
      </button>
      {picker}
      <button
        aria-label="Next student response"
        className="icon-button"
        data-no-loading="true"
        disabled={!nextResponse}
        title="Next student"
        type="button"
        onClick={() => nextResponse && openResponse(nextResponse.sessionId)}
      >
        <ArrowRight size={19} />
      </button>
    </div>
  );
}
