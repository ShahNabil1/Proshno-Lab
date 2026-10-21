/** Conservative review flag; never changes or deletes question content. */
export function hasCorruptedText(value: string): boolean {
  const text = value.replace(/<[^>]*>/g, " ").replace(/https?:\/\/[^\s<>]+/g, " ")
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (entity, n) => {
      const code = n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n);
      return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    });
  if (/[\u0080-\u009f\ufffd]/u.test(text)) return true;
  // UTF-8 decoded as Latin-1, commonly seen in damaged Bengali imports.
  if (/(?:à[¦§]|Ã[\u0080-\u00bf]|Â[\u0080-\u00bf]|â[€™œž])/u.test(text)) return true;
  return text.split(/[\s]+/u).some(word => {
    const suspect = (word.match(/[\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff]/gu) || []).length;
    return suspect >= 4 && suspect / word.length >= 0.35;
  });
}

export function corruptedQuestionFields(question: Record<string, unknown>): string[] {
  const scan = (value: unknown): boolean => typeof value === "string" ? hasCorruptedText(value)
    : Array.isArray(value) ? value.some(scan)
    : value && typeof value === "object" ? Object.values(value).some(scan) : false;
  const fields: Record<string, string> = {question:"প্রশ্ন", stimulus_text:"উদ্দীপক", option_a:"অপশন ক", option_b:"অপশন খ", option_c:"অপশন গ", option_d:"অপশন ঘ", answer:"উত্তর", correct_answer:"সঠিক উত্তর", explanation:"ব্যাখ্যা", creative_data:"সৃজনশীল প্রশ্ন/উত্তর", language_data:"ভাষার প্রশ্ন/উত্তর"};
  return Object.entries(fields).filter(([key]) => scan(question[key])).map(([,label]) => label);
}

export function questionHasCorruptedText(question: Record<string, unknown>): boolean {
  return corruptedQuestionFields(question).length > 0;
}

/** Question-facing content only; damaged answers must not make a question deletable. */
export function questionBodyHasCorruptedText(question: Record<string, unknown>): boolean {
  const creative = question.creative_data && typeof question.creative_data === "object" ? question.creative_data as Record<string, unknown> : {};
  const body: Record<string, unknown> = {};
  for (const key of ["question", "stimulus_text", "option_a", "option_b", "option_c", "option_d"]) body[key] = question[key];
  body.creative_data = Object.fromEntries(["stem", "q_ka", "q_kha", "q_ga", "q_gha", "desc_q_ka", "desc_q_kha"].map(key => [key, creative[key]]));
  return questionHasCorruptedText(body);
}
export function questionHasOnlyCorruptedAnswers(question: Record<string, unknown>): boolean {
  return questionHasCorruptedText(question) && !questionBodyHasCorruptedText(question);
}
