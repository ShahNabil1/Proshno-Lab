export type StimulusQuestion = {
  stimulus?: string | null;
  stimulus_text?: string | null;
  stimulus_group_id?: string | null;
};

/**
 * Normalizes only insignificant HTML/text whitespace so questions that share
 * the same stimulus can be recognized without changing the rendered content.
 */
export const normalizeStimulusKey = (stimulus?: string | null): string =>
  String(stimulus || "")
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .trim();

export const hasRenderableStimulus = (stimulus?: string | null): boolean => {
  if (!stimulus) return false;
  return (
    stimulus.replace(/<[^>]*>/g, "").trim().length > 0 ||
    /<(img|table|svg|figure)\b/i.test(stimulus)
  );
};

/** Returns normalized stimulus keys that occur in more than one question. */
export const findRepeatedStimuli = <T extends StimulusQuestion>(
  questions: T[],
  getStimulus: (question: T) => string | null | undefined,
): Set<string> => {
  const counts = new Map<string, number>();

  questions.forEach((question) => {
    const stimulus = getStimulus(question);
    if (!hasRenderableStimulus(stimulus)) return;
    const key = normalizeStimulusKey(stimulus);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([key]) => key),
  );
};

