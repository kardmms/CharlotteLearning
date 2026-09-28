function chapterStart(text: string, chapter: number) {
  const named = new RegExp(`(?:^|\\n)\\s*chapter\\s+${chapter}\\s*(?:\\n|$)`, "i").exec(text);
  if (named) return named.index + (named[0].startsWith("\n") ? 1 : 0);
  const pageMarkers = [...text.matchAll(/\[\[PAGE \d+\]\]/g)];
  for (let index = 0; index < pageMarkers.length; index += 1) {
    const start = pageMarkers[index].index! + pageMarkers[index][0].length;
    const end = Math.min(text.length, pageMarkers[index + 1]?.index ?? text.length, start + 1200);
    const firstLines = text.slice(start, end);
    const numeric = new RegExp(`(?:^|\\n)\\s*${chapter}\\s*(?:\\n|$)`).exec(firstLines);
    if (numeric) return start + numeric.index + (numeric[0].startsWith("\n") ? 1 : 0);
  }
  return -1;
}

export function selectReadingScope(text: string, rawScope: string) {
  const scope = rawScope.trim().toLowerCase().replace(/[–—]/g, "-");
  if (!scope) return text;

  const pages = scope.match(/(?:pdf\s*)?pages?\s*(\d+)\s*(?:-|to|through)\s*(\d+)/) ||
    scope.match(/^(\d+)\s*(?:-|to|through)\s*(\d+)$/);
  if (pages) {
    const first = Number(pages[1]);
    const last = Number(pages[2]);
    if (first < 1 || last < first || last - first > 100) throw new Error("Choose a valid PDF page range.");
    const matches = [...text.matchAll(/\[\[PAGE (\d+)\]\]/g)];
    const selected = matches.filter((match) => Number(match[1]) >= first && Number(match[1]) <= last);
    if (selected.length !== last - first + 1) throw new Error("Those PDF pages were not found in the uploaded reading.");
    const start = selected[0].index!;
    const next = matches.find((match) => Number(match[1]) === last + 1);
    const scoped = text.slice(start, next?.index ?? text.length).trim();
    if (scoped.length < 500) throw new Error("The selected PDF pages do not contain enough readable text.");
    return scoped;
  }

  const chapters = scope.match(/chapters?\s*(\d+)\s*(?:-|to|through)\s*(\d+)/) ||
    scope.match(/through\s+chapter\s*(\d+)/);
  if (chapters) {
    const first = chapters.length === 2 ? 1 : Number(chapters[1]);
    const last = chapters.length === 2 ? Number(chapters[1]) : Number(chapters[2]);
    if (first < 1 || last < first || last - first > 30) throw new Error("Choose a valid chapter range.");
    const start = chapterStart(text, first);
    const end = chapterStart(text, last + 1);
    if (start < 0 || end < 0 || end <= start) {
      throw new Error("Charlotte could not verify those chapter boundaries. Enter PDF pages instead, such as pages 1-8.");
    }
    const precedingPage = [...text.slice(0, start).matchAll(/\[\[PAGE (\d+)\]\]/g)].at(-1)?.[1];
    const scoped = `${precedingPage ? `[[PAGE ${precedingPage}]]\n` : ""}${text.slice(start, end).trim()}`;
    if (scoped.length < 500) throw new Error("The selected chapters do not contain enough readable text.");
    return scoped;
  }
  throw new Error("Enter a chapter range such as Chapters 1-2 or a PDF page range such as pages 1-8.");
}
