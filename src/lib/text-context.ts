export type SourceExcerpt = {
  excerpt: string;
  sourcePage: string | null;
};

const ignoredWords = new Set([
  "about", "after", "answer", "because", "before", "best", "choice", "does", "from",
  "have", "important", "most", "question", "reading", "should", "student", "text", "that",
  "their", "this", "what", "when", "where", "which", "with", "word", "would"
]);

function searchWords(value: string) {
  return new Set((value.toLowerCase().match(/[a-z]{4,}/g) || []).filter((word) => !ignoredWords.has(word)));
}

function normalizeText(value: string) {
  return value
    .replace(/\[\[PAGE \d+\]\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function visiblePageLabel(text: string) {
  const explicit = text.match(/\b(?:book\s+)?p(?:age|\.)\s*(\d{1,4})\b/i);
  if (explicit) return `book page ${explicit[1]}`;
  return null;
}

export function sourceExcerptWindows(text: string, limit = 80): SourceExcerpt[] {
  const windows: SourceExcerpt[] = [];
  let currentPage: string | null = null;
  const parts = text.split(/(\[\[PAGE \d+\]\])/gi);

  for (const part of parts) {
    const pageMatch = part.match(/\[\[PAGE (\d+)\]\]/i);
    if (pageMatch) {
      currentPage = `PDF page ${pageMatch[1]}`;
      continue;
    }

    const sentences = part
      .split(/(?<=[.!?])\s+/)
      .map(normalizeText)
      .filter((sentence) => sentence.length >= 30 && sentence.length <= 260);

    for (let index = 0; index < sentences.length && windows.length < limit; index += 1) {
      const firstSentence = sentences[index];
      const excerptSentences = firstSentence.length >= 90
        ? [firstSentence]
        : sentences.slice(index, index + 2);
      const excerpt = excerptSentences.join(" ");
      if (excerpt.length < 45 || excerpt.length > 520) continue;
      windows.push({
        excerpt,
        sourcePage: visiblePageLabel(excerpt) || currentPage
      });
    }
  }

  return windows;
}

export function excerptForQuestion(text: string, questionText: string): SourceExcerpt {
  const windows = sourceExcerptWindows(text, 120);
  if (windows.length === 0) return excerptForIndex(text, 0);
  const targets = searchWords(questionText);
  if (targets.size === 0) return windows[0];

  return windows
    .map((window, index) => {
      const words = searchWords(window.excerpt);
      const overlap = [...targets].filter((word) => words.has(word)).length;
      const exactPhraseBonus = [...targets].some((word) => window.excerpt.toLowerCase().includes(word)) ? 2 : 0;
      return { window, score: overlap * 5 + exactPhraseBonus - index * 0.001 };
    })
    .sort((a, b) => b.score - a.score)[0].window;
}

export function excerptForIndex(text: string, index: number): SourceExcerpt {
  const windows = sourceExcerptWindows(text, Math.max(12, index + 6));
  return windows[index % Math.max(1, windows.length)] || {
    excerpt: normalizeText(text).slice(0, 500),
    sourcePage: null
  };
}
