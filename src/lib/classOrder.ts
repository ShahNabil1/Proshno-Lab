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

/** Returns the lowest class level found in a name, e.g. "নবম-দশম শ্রেণি" -> 9 */
export function getClassLevel(name?: string | null): number {
  if (!name) return 999;
  let min = 999;
  for (const [word, level] of Object.entries(LEVEL_WORDS)) {
    if (name.includes(word)) min = Math.min(min, level);
  }
  return min;
}

/** Sorts a list of class-like objects by their natural academic level. */
export function sortClasses<T extends { name?: string | null; id?: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const diff = getClassLevel(a.name) - getClassLevel(b.name);
    if (diff !== 0) return diff;
    return (a.name || "").localeCompare(b.name || "", "bn");
  });
}
