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

// ---- Chapter ordering ----------------------------------------------------
const BN_DIGITS: Record<string, string> = { "০":"0","১":"1","২":"2","৩":"3","৪":"4","৫":"5","৬":"6","৭":"7","৮":"8","৯":"9" };

/** Leading chapter number from a name, e.g. "১০. দূরত্ব" -> 10. Returns Infinity when absent. */
export function getChapterNumber(name?: string | null): number {
  if (!name) return Number.POSITIVE_INFINITY;
  const normalized = name.trim().replace(/[০-৯]/g, (d) => BN_DIGITS[d]);
  const match = normalized.match(/^\s*(\d+)/);
  return match ? parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
}

/** Sorts chapters by their leading serial number (1, 2, 3 … ), then by name. */
export function sortChapters<T extends { name?: string | null; id?: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const diff = getChapterNumber(a.name) - getChapterNumber(b.name);
    if (diff !== 0 && Number.isFinite(diff)) return diff;
    const an = getChapterNumber(a.name), bn = getChapterNumber(b.name);
    if (an !== bn) return an - bn;
    return (a.name || "").localeCompare(b.name || "", "bn");
  });
}
