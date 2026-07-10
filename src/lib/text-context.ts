export type SourceExcerpt = {
  excerpt: string;
  sourcePage: string | null;
};

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
      const excerptSentences = sentences.slice(index, index + 3);
      if (excerptSentences.length < 2) continue;
      const excerpt = excerptSentences.join(" ");
      if (excerpt.length < 120 || excerpt.length > 720) continue;
      windows.push({
        excerpt,
        sourcePage: visiblePageLabel(excerpt) || currentPage
      });
    }
  }

  return windows;
}

export function excerptForIndex(text: string, index: number): SourceExcerpt {
  const windows = sourceExcerptWindows(text, Math.max(12, index + 6));
  return windows[index % Math.max(1, windows.length)] || {
    excerpt: normalizeText(text).slice(0, 500),
    sourcePage: null
  };
}
