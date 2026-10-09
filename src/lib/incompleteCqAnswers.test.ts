import { expect, it } from "vitest";
import { questionHasIncompleteCqAnswers as missing } from "./questionAnswers";
const complete = { ans_ka: "A", ans_kha: "B", ans_ga: "C", ans_gha: "D" };
it("requires ka through ga for math and higher math", () => {
  for (const name of ["Math", "Higher Mathematics", "hmath", "\u0997\u09a3\u09bf\u09a4", "\u0989\u099a\u09cd\u099a\u09a4\u09b0 \u0997\u09a3\u09bf\u09a4"]) {
    expect(missing({ type: "cq", subjects: { name }, creative_data: { ...complete, ans_gha: "" } })).toBe(false);
    expect(missing({ type: "cq", subjects: { name }, creative_data: { ...complete, ans_ga: "<p>&nbsp;</p>" } })).toBe(true);
  }
});
it("detects any missing part for other subjects", () => {
  for (const key of Object.keys(complete)) expect(missing({ type: "cq", subjects: { name: "Physics" }, creative_data: { ...complete, [key]: "" } })).toBe(true);
  expect(missing({ type: "cq", subjects: { name: "Physics" }, creative_data: complete })).toBe(false);
});
it("handles image answers, serialized data and excludes non-CQ", () => {
  expect(missing({ type: "cq", creative_data: JSON.stringify({ ...complete, ans_ka: '<img src="answer.png">' }) })).toBe(false);
  expect(missing({ type: "cq", creative_data: null })).toBe(true);
  expect(missing({ type: "mcq", creative_data: null })).toBe(false);
});
