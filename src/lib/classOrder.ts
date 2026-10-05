// Canonical ordering for Bangla class names (শ্রেণি) used across admin & dashboard dropdowns.
const LEVEL_WORDS: Record<string, number> = {
  "প্রাক": 0,
  "প্লে": 0,
  "নার্সারি": 0,
  "কেজি": 0,
  "প্রথম": 1,
  "দ্বিতীয়": 2,
  "তৃতীয়": 3,
  "চতুর্থ": 4,
  "পঞ্চম": 5,
  "ষষ্ঠ": 6,
  "সপ্তম": 7,
  "অষ্টম": 8,
  "নবম": 9,
  "দশম": 10,
  "একাদশ": 11,
  "দ্বাদশ": 12,
};

/** Returns the highest class level found in a name, e.g. "নবম-দশম শ্রেণি" -> 10 */
export function getClassLevel(name?: string | null): number {
  if (!name) return -1;
  let max = -1;
  for (const [word, level] of Object.entries(LEVEL_WORDS)) {
    if (name.includes(word)) max = Math.max(max, level);
  }
  return max;
}

/** Sorts class-like objects from highest class to lowest (একাদশ-দ্বাদশ first). */
export function sortClasses<T extends { name?: string | null; id?: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const diff = getClassLevel(b.name) - getClassLevel(a.name);
    if (diff !== 0) return diff;
    return (a.name || "").localeCompare(b.name || "", "bn");
  });
}

// ---- Subject ordering ----------------------------------------------------
// Keep the question-builder's subject picker in the familiar NCTB-style
// sequence instead of the database's alphabetical order.  Names that do not
// appear in this list still remain available and are sorted alphabetically.
const SUBJECT_ORDER = [
  "বাংলা", "বাংলা ১ম পত্র", "বাংলা ২য় পত্র", "বাংলা ২য় পত্র",
  "English", "English First Paper", "English Second Paper", "ইংরেজি ১ম পত্র", "ইংরেজি ২য় পত্র", "ইংরেজি ২য় পত্র",
  "গণিত", "সাধারণ গণিত", "সাধারন গণিত", "উচ্চতর গণিত",
  "বিজ্ঞান", "তথ্য ও যোগাযোগ প্রযুক্তি", "Information and Communication Technology",
  "বাংলাদেশ ও বিশ্বপরিচয়", "বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা", "সামাজিক বিজ্ঞান", "ভূগোল ও পরিবেশ", "পৌরনীতি ও নাগরিকতা", "অর্থনীতি",
  "পদার্থবিজ্ঞান", "রসায়ন", "জীববিজ্ঞান",
  "হিসাববিজ্ঞান", "ফিন্যান্স ও ব্যাংকিং", "ব্যবসায় উদ্যোগ",
  "কৃষিশিক্ষা", "গার্হস্থ্য বিজ্ঞান", "ইসলাম ও নৈতিক শিক্ষা", "হিন্দু ধর্ম ও নৈতিক শিক্ষা",
];

const normalizeSubjectName = (name?: string | null) =>
  (name || "").normalize("NFC").replace(/য়/g, "য়").replace(/\s+/g, " ").trim().toLowerCase();

const SUBJECT_RANK = new Map(SUBJECT_ORDER.map((name, index) => [normalizeSubjectName(name), index]));

/** Sorts subjects in the standard question-paper sequence, then by Bangla name. */
export function sortSubjects<T extends { name?: string | null; id?: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const ar = SUBJECT_RANK.get(normalizeSubjectName(a.name)) ?? Number.POSITIVE_INFINITY;
    const br = SUBJECT_RANK.get(normalizeSubjectName(b.name)) ?? Number.POSITIVE_INFINITY;
    if (ar !== br) return ar - br;
    return (a.name || "").localeCompare(b.name || "", "bn");
  });
}

// ---- Chapter ordering ----------------------------------------------------
const BN_DIGITS: Record<string, string> = { "০":"0","১":"1","২":"2","৩":"3","৪":"4","৫":"5","৬":"6","৭":"7","৮":"8","৯":"9" };

function normalizeDigits(name: string): string {
  return name.replace(/[০-৯]/g, (d) => BN_DIGITS[d]);
}

/**
 * First number found in a name, e.g. "১০. দূরত্ব" -> 10, "অধ্যায় ১০ - ..." -> 10,
 * "Unit 12 : Roots" -> 12, "কবিতা ১৪ - ..." -> 14. Infinity when absent.
 */
export function getChapterNumber(name?: string | null): number {
  if (!name) return Number.POSITIVE_INFINITY;
  const match = normalizeDigits(name.trim()).match(/\d+/);
  return match ? parseInt(match[0], 10) : Number.POSITIVE_INFINITY;
}

/** Use one spelling, Bengali serials and separator for numbered chapter labels. */
export function formatChapterName(name?: string | null): string {
  const value = (name || "").trim();
  const match = value.match(/^\s*(?:\u0985\u09a7\u09cd\u09af\u09be[\u09df\u09af](?:\u09bc)?|\u0985\u09a7\u09be[\u09df\u09af](?:\u09bc)?)\s*([0-9\u09e6-\u09ef]+)\s*[.\-:\u2014\u2013]*\s*(.*)$/u);
  if (!match) return value;
  const serial = String(parseInt(normalizeDigits(match[1]), 10)).replace(/\d/g, d => String.fromCharCode(0x09e6 + Number(d)));
  return `\u0985\u09a7\u09cd\u09af\u09be\u09af\u09bc ${serial}${match[2] ? ` - ${match[2]}` : ""}`;
}

/** Label prefix before the first number, e.g. "কবিতা ২ - ..." -> "কবিতা", "Unit 3" -> "unit". */
function getChapterLabel(name?: string | null): string {
  if (!name) return "";
  const normalized = normalizeDigits(formatChapterName(name));
  const idx = normalized.search(/\d/);
  const prefix = idx === -1 ? normalized : normalized.slice(0, idx);
  return prefix.replace(/[\s.\-:—–|)(]+/g, " ").trim().toLowerCase();
}

/** Sorts chapters by label group, then by their serial number (1, 2, 3 … ), then by name. */
export function sortChapters<T extends { name?: string | null; id?: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const la = getChapterLabel(a.name), lb = getChapterLabel(b.name);
    if (la !== lb) return la.localeCompare(lb, "bn");
    const an = getChapterNumber(a.name), bn = getChapterNumber(b.name);
    if (an !== bn) return an - bn;
    return (a.name || "").localeCompare(b.name || "", "bn");
  });
}
