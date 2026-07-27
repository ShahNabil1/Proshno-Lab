/**
 * Single source of truth for MCQ correct-answer handling.
 *
 * Canonical storage format is the lowercase latin key: "a" | "b" | "c" | "d".
 * Historically some rows were saved with Bangla labels (ক/খ/গ/ঘ), uppercase
 * letters, numbers, "(খ)", "option b", or even the full option text — every
 * reader/writer must go through the helpers below so those never break again.
 */

export type AnswerKey = "a" | "b" | "c" | "d";

export const ANSWER_KEYS: AnswerKey[] = ["a", "b", "c", "d"];
export const BANGLA_LABELS = ["ক", "খ", "গ", "ঘ"] as const;

const DIRECT: Record<string, AnswerKey> = {
  a: "a", b: "b", c: "c", d: "d",
  ক: "a", খ: "b", গ: "c", ঘ: "d",
  "1": "a", "2": "b", "3": "c", "4": "d",
  "১": "a", "২": "b", "৩": "c", "৪": "d",
  i: "a", ii: "b", iii: "c", iv: "d",
};

const stripHtml = (v: string) =>
  v.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ");

const clean = (v: string) =>
  stripHtml(v).replace(/\s+/g, " ").trim();

/**
 * Normalizes any human/AI/spreadsheet representation of an MCQ answer to
 * "a" | "b" | "c" | "d". Returns null when it cannot be resolved.
 *
 * When `options` are supplied, an answer written as the full option *text*
 * (e.g. "উত্তর: ঢাকা") is matched against the options too.
 */
export function normalizeAnswerKey(
  raw: unknown,
  options?: Array<string | null | undefined>
): AnswerKey | null {
  if (raw == null) return null;
  let v = clean(String(raw)).toLowerCase();
  if (!v) return null;

  // "option b", "অপশন খ", "ans: b", "উত্তর - খ"
  v = v
    .replace(/^(সঠিক\s*)?(উত্তর|answer|ans|option|অপশন|opt)\s*[:：\-–.)\]]*\s*/i, "")
    .replace(/^[([{"'\s]+/, "")
    .replace(/[)\]}"'.,;:।\s]+$/, "")
    .trim();
  if (!v) return null;

  if (DIRECT[v]) return DIRECT[v];

  // Leading marker such as "খ) ঢাকা" or "b. Dhaka"
  const first = v.slice(0, 1);
  const rest = v.slice(1).trim();
  if (DIRECT[first] && (rest === "" || /^[)\].:\-–।]/.test(v.slice(1).trimStart().slice(0, 1) || ""))) {
    return DIRECT[first];
  }

  // Fall back to matching the answer against the option texts.
  if (options) {
    const target = v;
    for (let i = 0; i < Math.min(options.length, 4); i++) {
      const opt = clean(String(options[i] ?? "")).toLowerCase();
      if (opt && opt === target) return ANSWER_KEYS[i];
    }
  }

  // Single leading char fallback (e.g. "খ ঢাকা")
  if (DIRECT[first]) return DIRECT[first];

  return null;
}

/** True when the option at `index` (0..3) is the stored correct answer. */
export function isCorrectOption(
  correctAnswer: unknown,
  index: number,
  options?: Array<string | null | undefined>
): boolean {
  const key = normalizeAnswerKey(correctAnswer, options);
  return key != null && ANSWER_KEYS[index] === key;
}

/** Bangla display label (ক/খ/গ/ঘ) for a stored answer, or "" when unknown. */
export function answerLabelBangla(correctAnswer: unknown, options?: Array<string | null | undefined>): string {
  const key = normalizeAnswerKey(correctAnswer, options);
  return key ? BANGLA_LABELS[ANSWER_KEYS.indexOf(key)] : "";
}
