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
