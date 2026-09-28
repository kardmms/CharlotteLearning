import test from "node:test";
import assert from "node:assert/strict";
import { excerptForQuestion } from "../src/lib/text-context.ts";

test("secondary excerpts include a longer passage from one page", () => {
  const text = "[[PAGE 2]] The young botanist packed a field notebook before sunrise. She followed the narrow trail beside the river. A sudden storm bent the reeds across the path. She recorded how the plants recovered after the rain. [[PAGE 3]] A new chapter begins with a different place.";
  const excerpt = excerptForQuestion(text, "How did the plants recover after the storm?", 4);
  assert.equal(excerpt.sourcePage, "PDF page 2");
  assert.match(excerpt.excerpt, /botanist packed/);
  assert.match(excerpt.excerpt, /plants recovered/);
  assert.doesNotMatch(excerpt.excerpt, /new chapter/);
});
