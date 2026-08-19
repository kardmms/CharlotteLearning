export type StudentSafetyCategory = "self_harm" | "violence" | "abuse_or_exploitation";

export type StudentSafetySignal = {
  flagged: boolean;
  categories: StudentSafetyCategory[];
  severity: "none" | "elevated" | "urgent";
  studentNotice: string | null;
};

const selfHarmPatterns = [
  /\b(kill myself|end my life|hurt myself|harm myself|cut myself|self[-\s]?harm|suicidal)\b/i,
  /\bi\s+(want|wanted|need|plan|planned|am planning|might|will|would|can't|cannot|do not|don't)\s+(to\s+)?(die|not be alive|stop living|disappear forever)\b/i,
  /\bi\s*(am|'m|m)\s+(going|gonna|about)\s+to\s+(kill myself|hurt myself|end my life|die)\b/i
];

const violencePatterns = [
  /\b(i|we)\s+(will|would|want to|plan to|am going to|'m going to|m going to|gonna)\s+(kill|shoot|stab|hurt|attack)\b/i,
  /\b(i|we)\s+(brought|have|will bring|am bringing|'m bringing|m bringing)\s+(a\s+)?(gun|knife|weapon|bomb)\s+(to\s+)?(school|class|classroom)\b/i,
  /\b(bomb|shoot up|attack)\s+(the\s+)?(school|class|classroom)\b/i,
  /\bkill\s+(everyone|my class|my teacher|students)\b/i
];

const abusePatterns = [
  /\b(my|our)\s+(mom|dad|parent|guardian|teacher|coach|uncle|aunt|sibling|brother|sister)\s+(hits|hit|hurts|hurt|abuses|abused|touches|touched)\s+me\b/i,
  /\b(i|we)\s+(am|are|'m|m)\s+(not safe|being abused|being hurt)\b/i,
  /\b(someone|a person)\s+(is\s+)?(hurting|abusing|touching)\s+me\b/i
];

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

export function evaluateStudentSafety(text: string): StudentSafetySignal {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return { flagged: false, categories: [], severity: "none", studentNotice: null };
  }

  const categories: StudentSafetyCategory[] = [];
  if (matchesAny(normalized, selfHarmPatterns)) categories.push("self_harm");
  if (matchesAny(normalized, violencePatterns)) categories.push("violence");
  if (matchesAny(normalized, abusePatterns)) categories.push("abuse_or_exploitation");

  if (!categories.length) {
    return { flagged: false, categories, severity: "none", studentNotice: null };
  }

  const severity = categories.includes("self_harm") || categories.includes("violence")
    ? "urgent"
    : "elevated";
  const studentNotice = categories.includes("self_harm")
    ? "If this is about you or someone nearby, tell your teacher or another trusted adult now. If there is immediate danger in the U.S., call or text 988 or contact local emergency services."
    : categories.includes("violence")
      ? "If someone may be hurt, tell your teacher or another trusted adult now. If there is immediate danger, contact local emergency services."
      : "If this is about you or someone nearby, tell your teacher or another trusted adult now so they can help.";

  return {
    flagged: true,
    categories: [...new Set(categories)],
    severity,
    studentNotice
  };
}
