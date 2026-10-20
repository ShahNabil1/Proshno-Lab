export type SubjectVersion = "all" | "bangla" | "english";

export interface VersionedClass {
  id: number;
  name: string;
}

export interface VersionedSubject {
  id: number;
  class_id: number;
  name: string;
  subject_code?: string | null;
}

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";
const CLASS_WORDS: Array<[RegExp, string]> = [
  [/তৃতীয়|তৃতীয়/g, "3"],
  [/চতুর্থ/g, "4"],
  [/পঞ্চম/g, "5"],
  [/ষষ্ঠ/g, "6"],
  [/সপ্তম/g, "7"],
  [/অষ্টম/g, "8"],
  [/নবম/g, "9"],
  [/দশম/g, "10"],
  [/একাদশ/g, "11"],
  [/দ্বাদশ/g, "12"],
];

export const isEnglishVersionClass = (name: string): boolean =>
  /english|eglish|ইংলিশ/i.test(name || "");

export const getClassLevelKey = (name: string): string => {
  if (/\bssc\b/i.test(name || "")) return "9-10";
  if (/\bhsc\b/i.test(name || "")) return "11-12";
  let normalized = (name || "").replace(/[০-৯]/g, (digit) =>
    String(BANGLA_DIGITS.indexOf(digit)),
  );
  CLASS_WORDS.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });
  const levels = normalized.match(/\d+/g)?.map(Number) || [];
  return levels.slice(0, 2).join("-") || normalized.trim().toLowerCase();
};

export const getRelatedVersionClassIds = (
  selectedClassId: string | number,
  classes: VersionedClass[],
): number[] => {
  const selected = classes.find((item) => String(item.id) === String(selectedClassId));
  if (!selected) return selectedClassId ? [Number(selectedClassId)] : [];
  const levelKey = getClassLevelKey(selected.name);
  const related = classes
    .filter((item) => getClassLevelKey(item.name) === levelKey)
    .map((item) => item.id);
  return related.length > 0 ? related : [selected.id];
};

export const getSubjectVersion = (
  subject: Pick<VersionedSubject, "class_id">,
  classes: VersionedClass[],
): Exclude<SubjectVersion, "all"> => {
  const ownerClass = classes.find((item) => item.id === subject.class_id);
  return ownerClass && isEnglishVersionClass(ownerClass.name) ? "english" : "bangla";
};

const SHARED_SUBJECT_PATTERNS = [
  /^বাংলা\s*(১ম|২য়|২য়)\s*(পত্র)?$/u,
  /^bangla\s*(1st|2nd)\s*(paper)?$/i,
  /^english\s*(1st|2nd)\s*(paper)?$/i,
];

const isClassThreeToTwelve = (className: string): boolean => {
  const levels = getClassLevelKey(className).match(/\d+/g)?.map(Number) || [];
  return levels.some((level) => level >= 3 && level <= 12);
};

export const isSharedBanglaEnglishSubject = (
  subject: Pick<VersionedSubject, "class_id" | "name">,
  classes: VersionedClass[],
): boolean => {
  const ownerClass = classes.find((item) => item.id === subject.class_id);
  return Boolean(ownerClass)
    && isClassThreeToTwelve(ownerClass.name)
    && SHARED_SUBJECT_PATTERNS.some((pattern) => pattern.test(subject.name.trim()));
};

export const filterSubjectsByVersion = <T extends VersionedSubject>(
  subjects: T[],
  classes: VersionedClass[],
  version: SubjectVersion,
): T[] =>
  version === "all"
    ? subjects
    : subjects.filter((subject) =>
      isSharedBanglaEnglishSubject(subject, classes)
      || getSubjectVersion(subject, classes) === version,
    );
