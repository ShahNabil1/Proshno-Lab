import { describe, expect, it } from "vitest";
import { expandSmartboardQuestions } from "./slideSequence";

describe("CQ classroom sequence", () => {
  it("keeps the stem on the overview and four independent part pages", () => {
    const question = { id: 7, type: "cq", question: "stem", creative_data: {
      stem: "stimulus", q_ka: "a", q_kha: "b", q_ga: "c", q_gha: "d",
    } };
    const slides = expandSmartboardQuestions([question, { id: 8, type: "short", question: "next" }]);
    expect(slides.map(s => s.cqPartIndex)).toEqual([undefined, 0, 1, 2, 3, undefined]);
    expect(slides.map(s => s.sourceQuestionNumber)).toEqual([1, 1, 1, 1, 1, 2]);
    expect(new Set(slides.map(s => s.id)).size).toBe(6);
    expect(slides.slice(0, 5).every(s => s.creative_data.stem === "stimulus")).toBe(true);
    expect(question).not.toHaveProperty("cqPartIndex");
  });
  it("supports array sub-questions and skips missing parts without relabeling", () => {
    const slides = expandSmartboardQuestions([{ id: 9, type: "cq", question: "stem", creative_data: {
      sub_questions: [{ text: "a" }, null, { question: "c" }],
    } }]);
    expect(slides.map(s => s.cqPartIndex)).toEqual([undefined, 0, 2]);
  });
});
