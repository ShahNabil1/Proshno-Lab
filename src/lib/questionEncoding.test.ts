import { describe, it, expect } from "vitest";
import { hasCorruptedText, questionHasCorruptedText, corruptedQuestionFields, questionBodyHasCorruptedText, questionHasOnlyCorruptedAnswers } from "./questionEncoding";
describe("corrupted question text", () => {
  it("flags damaged imports and encoded controls", () => {
    for (const value of ["©ß\u0083Á|\u0082v\u0089T\u008f°Ù»¸ ïÏÜ¦ÙÆ\u009bÎÉT", "à¦¬à¦¾à¦‚à¦²à¦¾", "bad � text", "bad &#x83; text", "ïÏÜÙÆÎÉ"]) expect(hasCorruptedText(value)).toBe(true);
  });
  it("preserves Bengali English math accents and image attributes", () => {
    for (const value of ["2×3×4×5×6÷2÷3÷4÷5", "বাংলাদেশ ও বিশ্বপরিচয়", "English question café résumé", "© 2026 — 45° × 2 ÷ 4 ± ² √ π", String.raw`$\frac{a}{b} \times 2$`, '<img src="https://example.com/ïÏÜÙÆÎÉ.png" alt="চিত্র">']) expect(hasCorruptedText(value)).toBe(false);
  });
  it("checks nested CQ answers and all content fields", () => {
    expect(questionHasCorruptedText({question:"ঠিক আছে",creative_data:{ans_ga:"bad �"}})).toBe(true);
    expect(corruptedQuestionFields({question:"সঠিক গণিত", explanation:"bad �"})).toEqual(["ব্যাখ্যা"]);
    expect(questionHasCorruptedText({option_d:"bad &#131;"})).toBe(true);
    expect(questionHasCorruptedText({question:"ঠিক আছে",id:"ïÏÜÙÆÎÉ"})).toBe(false);
  });
});

it("keeps good questions with damaged answers out of bulk deletion", () => {
  for (const q of [{question:"সঠিক প্রশ্ন", explanation:"�"}, {question:"সঠিক প্রশ্ন",creative_data:{ans_ga:"�"}}]) {
    expect(questionBodyHasCorruptedText(q)).toBe(false);
    expect(questionHasOnlyCorruptedAnswers(q)).toBe(true);
  }
  for (const q of [{question:"�"}, {question:"সঠিক প্রশ্ন",option_b:"�"}, {creative_data:{q_ga:"�",ans_ga:"সঠিক"}}]) {
    expect(questionBodyHasCorruptedText(q)).toBe(true);
    expect(questionHasOnlyCorruptedAnswers(q)).toBe(false);
  }
});
