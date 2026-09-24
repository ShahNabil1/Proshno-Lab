export type DuplicateComparableQuestion = {
  id: number;
  type: string;
  question: string;
  stimulus_text?: string | null;
  creative_data?: any | null;
};

const IGNORED_CREATIVE_KEYS = /^(id|answer|answers|explanation|correct_answer|ans_|desc_ans_|marks?|created_at|updated_at)/i;

export function normalizeQuestionDuplicateText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, " image:$1 ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(nbsp|ensp|emsp|thinsp);|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[â€œâ€â€žâ€Ÿ]/g, '"')
    .replace(/[â€˜â€™â€šâ€›]/g, "'")
    .replace(/[âˆ’â€“â€”]/g, "-")
    .replace(/\\(?:left|right|displaystyle|textstyle)/gi, "")
    .replace(/\\[a-z]+/gi, "")
    .replace(/[{}()[\]$^_`'".,;:!?à¥¤à¥¥|]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}+\-=/<>%]/gu, "")
    .toLocaleLowerCase("bn-BD")
    .trim();
}

function collectCreativeQuestionText(value: unknown, key = ""): string[] {
  if (value == null || IGNORED_CREATIVE_KEYS.test(key)) return [];
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => collectCreativeQuestionText(item, key));
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([childKey, childValue]) => collectCreativeQuestionText(childValue, childKey));
  }
  return [];
}

export function getQuestionDuplicateSignature(question: DuplicateComparableQuestion): string {
  const base = [question.question, question.stimulus_text];
  if (/^(cq|creative|descriptive)$/i.test(question.type) || !normalizeQuestionDuplicateText(question.question)) {
    base.push(...collectCreativeQuestionText(question.creative_data));
  }
  return `${question.type.toLowerCase()}::${normalizeQuestionDuplicateText(base.join(" "))}`;
}

export function questionDuplicateSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  if (left.length < 24 || right.length < 24) return 0;
  const leftPairs = new Map<string, number>();
  for (let i = 0; i < left.length - 1; i += 1) {
    const pair = left.slice(i, i + 2);
    leftPairs.set(pair, (leftPairs.get(pair) || 0) + 1);
  }
  let overlap = 0;
  for (let i = 0; i < right.length - 1; i += 1) {
    const pair = right.slice(i, i + 2);
    const available = leftPairs.get(pair) || 0;
    if (available > 0) {
      overlap += 1;
      leftPairs.set(pair, available - 1);
    }
  }
  return (2 * overlap) / (left.length + right.length - 2);
}

export function areQuestionsDuplicates(left: DuplicateComparableQuestion, right: DuplicateComparableQuestion): boolean {
  const [leftType, leftText] = getQuestionDuplicateSignature(left).split("::", 2);
  const [rightType, rightText] = getQuestionDuplicateSignature(right).split("::", 2);
  return Boolean(leftText && rightText && leftType === rightType
    && (leftText === rightText || questionDuplicateSimilarity(leftText, rightText) >= 0.94));
}

export function removeNearDuplicateQuestions<T extends DuplicateComparableQuestion>(rows: T[]): T[] {
  const kept: T[] = [];
  for (const question of rows) {
    if (!kept.some((candidate) => areQuestionsDuplicates(candidate, question))) kept.push(question);
  }
  return kept;
}
