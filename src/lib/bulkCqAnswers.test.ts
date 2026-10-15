import { describe, expect, it } from "vitest";
import { parseCqAnswers } from "./bulkCqAnswers";
describe("CQ answer sections", () => {
  it("keeps multiline HTML and math under the correct part", () => {
    expect(parseCqAnswers("[ক] <p>One</p>\n$\\frac{1}{2}$\n[খ] Two\n[গ] Three\n[ঘ] Four")).toEqual({ answers: { ans_ka: "<p>One</p>\n$\\frac{1}{2}$", ans_kha: "Two", ans_ga: "Three", ans_gha: "Four" }, errors: [] });
  });
  it("rejects missing, duplicate, empty and unlabelled answers", () => {
    expect(parseCqAnswers("[ক] One").errors).toHaveLength(3);
    expect(parseCqAnswers("[ক] One\n[ক] Other\n[খ] Two\n[গ] Three\n[ঘ] Four").errors).toHaveLength(1);
    expect(parseCqAnswers("Unlabelled").errors.length).toBeGreaterThan(0);
  });
});
