const hasAnswerContent = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  // An image can be the entire answer; empty rich-text paragraphs cannot.
  if (/<(?:img|svg|math)\b/i.test(value)) return true;
  return value.replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;|&#x0*a0;/gi, " ")
    .replace(/[\s\u200B-\u200D\uFEFF]/g, "").length > 0;
};

export function questionHasNoExplanation(question: {
  type?: string;
  explanation?: unknown;
}): boolean {
  return (question.type === "mcq" || question.type === "short")
    && !hasAnswerContent(question.explanation);
}

export function questionHasNoAnswer(question: {
  type?: string;
  correct_answer?: unknown;
  creative_data?: Record<string, unknown> | null;
}): boolean {
  const creative = question.creative_data || {};
  const answers = question.type === "cq"
    ? [creative.ans_ka, creative.ans_kha, creative.ans_ga, creative.ans_gha]
    : question.type === "descriptive"
      ? [creative.desc_ans_ka, creative.desc_ans_kha]
      : [question.correct_answer];
  return !answers.some(hasAnswerContent);
}

/** Any required CQ answer missing, with the three-part mathematics exception. */
export function questionHasIncompleteCqAnswers(question: {
  type?: string; creative_data?: Record<string, unknown> | string | null;
  subjects?: { name?: string } | null;
}): boolean {
  if (question.type !== "cq") return false;
  let creative = question.creative_data;
  if (typeof creative === "string") {
    try { creative = JSON.parse(creative); } catch { return true; }
  }
  const answers = (creative || {}) as Record<string, unknown>;
  const subject = (question.subjects?.name || "").trim();
  const math = /(?:\u0997\u09a3\u09bf\u09a4|\b(?:math(?:ematics)?|hmath|higher\s*math(?:ematics)?)\b)/i.test(subject);
  const required = math ? ["ans_ka", "ans_kha", "ans_ga"] : ["ans_ka", "ans_kha", "ans_ga", "ans_gha"];
  return required.some(key => !hasAnswerContent(answers[key]));
}
