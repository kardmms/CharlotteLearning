export const gradeOptions = [
  { value: "K", label: "Kindergarten" },
  { value: "1", label: "1st grade" },
  { value: "2", label: "2nd grade" },
  { value: "3", label: "3rd grade" },
  { value: "4", label: "4th grade" },
  { value: "5", label: "5th grade" },
  { value: "6", label: "6th grade" },
  { value: "7", label: "7th grade" },
  { value: "8", label: "8th grade" },
  { value: "9", label: "9th grade" },
  { value: "10", label: "10th grade" },
  { value: "11", label: "11th grade" },
  { value: "12", label: "12th grade" }
];

export function gradeLabel(value?: string | null) {
  return gradeOptions.find((option) => option.value === value)?.label || value || "Not set";
}

export function normalizeGrade(value: string) {
  const trimmed = value.trim();
  return gradeOptions.some((option) => option.value === trimmed) ? trimmed : "3";
}

export function gradeIndex(value?: string | null) {
  const index = gradeOptions.findIndex((option) => option.value === value);
  return index >= 0 ? index : 3;
}

export function studentBandClass(value?: string | null) {
  const index = gradeIndex(value);
  if (index <= 4) return "student-k4";
  if (index <= 7) return "student-5-7";
  return "student-8plus";
}

export function studentBandLabel(value?: string | null) {
  const index = gradeIndex(value);
  if (index <= 4) return "Adventure mode";
  if (index <= 7) return "Goal mode";
  return "Focus mode";
}
