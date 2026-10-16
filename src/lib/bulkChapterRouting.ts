import type { ParsedQuestion } from "./bulkQuestions";

export type ImportChapter = { id: number; name: string };
const CHAPTER_ERROR = "অধ্যায়: ";
const heading = /^\s*(?:অধ্যায়|অধ্যায়|chapter)\s*[:ঃ]\s*(.*?)\s*$/iu;

/** A chapter heading applies until the next heading, including multiple questions. */
export function splitChapterSections(text: string) {
  const sections: { text: string; chapterName?: string }[] = [];
  let lines: string[] = [];
  let chapterName: string | undefined;
  const flush = () => {
    if (lines.join("\n").trim()) sections.push({ text: lines.join("\n"), chapterName });
    lines = [];
  };
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const match = line.match(heading);
    if (match) { flush(); chapterName = match[1]; }
    else lines.push(line);
  }
  flush();
  return sections;
}

function chapterKey(value: string) {
  return value.normalize("NFC").replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[০-৯]/g, digit => String("০১২৩৪৫৬৭৮৯".indexOf(digit)))
    .toLocaleLowerCase("bn-BD").trim()
    .replace(/^(?:অধ্যায়|অধ্যায়|chapter)\s*/iu, "")
    .replace(/[\s.\-–—:ঃ]+/g, " ").trim();
}

export function resolveQuestionChapters(items: ParsedQuestion[], chapters: ImportChapter[], defaultChapterId?: string | number) {
  return items.map(question => {
    const errors = question.errors.filter(error => !error.startsWith(CHAPTER_ERROR));
    const explicit = question.chapterName !== undefined;
    let matches: ImportChapter[];
    if (!explicit) {
      matches = chapters.filter(chapter => String(chapter.id) === String(defaultChapterId));
    } else {
      const key = chapterKey(question.chapterName!);
      matches = key ? chapters.filter(chapter => chapterKey(chapter.name) === key) : [];
      if (key && matches.length === 0) {
        matches = chapters.filter(chapter => {
          const candidate = chapterKey(chapter.name);
          return /^\d+$/.test(key)
            ? candidate.match(/^\d+(?=\s|$)/)?.[0] === key
            : candidate.replace(/^\d+\s+/, "") === key;
        });
      }
    }
    if (matches.length !== 1) {
      errors.push(CHAPTER_ERROR + (matches.length > 1
        ? `"${question.chapterName}" নামে একাধিক অধ্যায় আছে; সম্পূর্ণ নাম লিখুন`
        : explicit
          ? `"${question.chapterName || "(খালি)"}" নির্বাচিত বিষয়ে পাওয়া যায়নি; সঠিক অধ্যায়ের নাম লিখুন`
          : "টেমপ্লেটে অধ্যায় লিখুন অথবা উপরে ডিফল্ট অধ্যায় বাছাই করুন"));
    }
    return { ...question, chapterId: matches.length === 1 ? matches[0].id : undefined,
      resolvedChapterName: matches.length === 1 ? matches[0].name : undefined, errors };
  });
}
