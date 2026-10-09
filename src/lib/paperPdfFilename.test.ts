import { describe, expect, it } from "vitest";
import { paperPdfFilename } from "./paperPdfFilename";
describe("PDF filename", () => {
  it("uses the subject name and Bangladesh date for questions", () => {
    expect(paperPdfFilename("Mathematics", false, new Date("2026-10-09T20:00:00Z")))
      .toBe("Ques-Mathematics-proshnolab.com_10-10-2026.pdf");
  });
  it("names answers using the full subject name", () => {
    expect(paperPdfFilename("Physics", true, new Date("2026-01-02T00:00:00Z")))
      .toBe("Ans-Physics-proshnolab.com_02-01-2026.pdf");
  });
});
