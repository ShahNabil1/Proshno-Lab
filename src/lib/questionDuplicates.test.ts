import { describe, expect, it } from "vitest";
import { getExactQuestionDuplicateSignature as signature } from "./questionDuplicates";
const question = { id: 1, type: "mcq", question: "Find the value of $x^2 + 1$ when x = 5", option_a: "2", option_b: "4", option_c: "8", option_d: "10" };
describe("exact cleanup duplicates", () => {
  it("ignores HTML formatting and option order", () => {
    expect(signature(question)).toBe(signature({ ...question, id: 2, question: `<p>${question.question}</p>`, option_a: "4", option_b: "2" }));
  });
  it("keeps different numbers, powers, decimals, operators and case distinct", () => {
    for (const [left, right] of [["x = 5", "x = 6"], ["x^2", "x2"], ["1.5", "15"], ["x+y", "x-y"], ["M+N", "m+n"], ["\\frac{x}{2}", "\\sqrt{x}{2}"]]) {
      expect(signature({ ...question, question: left })).not.toBe(signature({ ...question, question: right }));
    }
  });
  it("requires matching MCQ options", () => {
    expect(signature(question)).not.toBe(signature({ ...question, option_d: "11" }));
  });
  it("preserves CQ subquestion differences but ignores explanations", () => {
    const cq = { ...question, type: "cq", creative_data: { stem: "Given x = 5", q_ka: "Find x squared", ans_ka: "25" } };
    expect(signature(cq)).not.toBe(signature({ ...cq, creative_data: { ...cq.creative_data, q_ka: "Find x cubed" } }));
    expect(signature(cq)).toBe(signature({ ...cq, creative_data: { ...cq.creative_data, ans_ka: "Another explanation" } }));
  });
  it("ignores math font styling without removing math operations", () => {
    expect(signature({ ...question, question: "$\\mathrm{x}+1$" })).toBe(signature({ ...question, question: "$x+1$" }));
  });
});
