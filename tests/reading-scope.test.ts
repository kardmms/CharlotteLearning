import test from "node:test";
import assert from "node:assert/strict";
import { selectReadingScope } from "../src/lib/reading-scope.ts";

const pages = [
  `[[PAGE 1]]\nBook title\n1\n${"Opening scene. ".repeat(50)}`,
  `[[PAGE 2]]\n${"More of chapter one. ".repeat(40)}`,
  `[[PAGE 3]]\n2\n${"Second chapter. ".repeat(50)}`,
  `[[PAGE 4]]\n${"More of chapter two. ".repeat(40)}`,
  `[[PAGE 5]]\n3\n${"Third chapter. ".repeat(50)}`
].join("\n");

test("a page limit excludes later pages", () => {
  const scoped = selectReadingScope(pages, "pages 1-4");
  assert.match(scoped, /Second chapter/);
  assert.doesNotMatch(scoped, /Third chapter/);
});

test("a chapter limit stops at the next numbered chapter", () => {
  const scoped = selectReadingScope(pages, "Chapters 1-2");
  assert.match(scoped, /Second chapter/);
  assert.doesNotMatch(scoped, /Third chapter/);
});

test("unknown chapter boundaries fail instead of using the whole book", () => {
  assert.throws(() => selectReadingScope("no chapter headings".repeat(100), "Chapters 1-2"));
  assert.throws(() => selectReadingScope(pages, "Chapter 1"));
});
