import { describe, expect, it } from "vitest";
import { questionHasNoAnswer, questionHasNoExplanation } from "./questionAnswers";

describe("questionHasNoAnswer", () => {
  it("finds missing answers and empty rich text", () => {
    for (const correct_answer of [null, undefined, "", "  ", "<p><br></p>", "<p>&nbsp;&#160;&#xA0;\u200B</p>"]) {
      expect(questionHasNoAnswer({ type: "short", correct_answer })).toBe(true);
    }
  });
  it("keeps text, MCQ keys, and image answers out of the filter", () => {
    for (const correct_answer of ["a", "খ", "<p>উত্তর</p>", '<p><img src="answer.png"></p>']) {
      expect(questionHasNoAnswer({ type: "mcq", correct_answer })).toBe(false);
    }
  });
  it("uses the separate creative and descriptive answer fields", () => {
    expect(questionHasNoAnswer({ type: "cq", creative_data: { ans_ka: "<p><br></p>" } })).toBe(true);
    expect(questionHasNoAnswer({ type: "cq", creative_data: { ans_ga: "উত্তর" } })).toBe(false);
    expect(questionHasNoAnswer({ type: "descriptive", creative_data: {} })).toBe(true);
    expect(questionHasNoAnswer({ type: "descriptive", creative_data: { desc_ans_kha: "উত্তর" } })).toBe(false);
  });
});

describe("questionHasNoExplanation", () => {
  it("finds missing or empty explanations only for MCQ and short questions", () => {
    for (const type of ["mcq", "short"]) {
      for (const explanation of [null, undefined, "", " ", "<p><br></p>", "<p>&nbsp;\u200B</p>"]) {
        expect(questionHasNoExplanation({ type, explanation })).toBe(true);
      }
    }
    for (const type of ["cq", "descriptive", "gap_filling", undefined]) {
      expect(questionHasNoExplanation({ type })).toBe(false);
    }
  });
  it("excludes questions with text or image explanations", () => {
    for (const type of ["mcq", "short"]) {
      for (const explanation of ["<p>ব্যাখ্যা</p>", '<img src="explanation.png">']) {
        expect(questionHasNoExplanation({ type, explanation })).toBe(false);
      }
    }
  });
});
