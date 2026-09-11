const banglaDigits: Record<string, string> = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
};

const chapterCollator = new Intl.Collator("bn", {
  numeric: true,
  sensitivity: "base",
});

const normalizeChapterName = (name: string) =>
  name.replace(/[০-৯]/g, digit => banglaDigits[digit]).normalize("NFKC");

export const sortChaptersNaturally = <T extends { name: string }>(chapters: T[]): T[] =>
  [...chapters].sort((first, second) =>
    chapterCollator.compare(
      normalizeChapterName(first.name),
      normalizeChapterName(second.name),
    ),
  );
