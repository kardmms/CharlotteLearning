import { z } from "zod";

function textField(maxLength: number, minLength = 0) {
  return z.preprocess(
    (value) => typeof value === "string" ? value.trim().slice(0, maxLength) : value,
    z.string().min(minLength).max(maxLength)
  );
}

const termSchema = z.object({
  word: textField(80, 1),
  definition: textField(260, 4),
  // The generation prompt explicitly asks for an empty string when a word
  // has no alternate meaning. That is valid, not a failed AI response.
  alternateDefinition: textField(260).optional().default("")
});

export const VocabDashTermsSchema = z.object({
  terms: z.array(termSchema).min(1).max(30)
});

export type VocabDashTermDraft = z.infer<typeof termSchema>;
