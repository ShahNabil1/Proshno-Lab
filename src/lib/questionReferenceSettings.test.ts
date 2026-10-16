import { describe, expect, it } from "vitest";
import { normalizeQuestionReferenceSettings as normalize } from "./questionReferenceSettings";

describe("reference settings restored before the first toggle", () => {
  it("uses a visible outline for missing or obsolete settings", () => {
    for (const saved of [{}, { questionReferenceStyle: "default", questionReferenceTextColor: "#ffffff" }]) {
      expect(normalize(saved)).toEqual({ questionReferenceStyle: "outline", questionReferenceColor: "#000000", questionReferenceTextColor: "#000000" });
    }
  });
  it("repairs invisible text while retaining valid custom colors", () => {
    expect(normalize({ questionReferenceStyle: "black", questionReferenceTextColor: "#000000" }).questionReferenceTextColor).toBe("#ffffff");
    expect(normalize({ questionReferenceStyle: "outline", questionReferenceTextColor: "#123456" }).questionReferenceTextColor).toBe("#123456");
  });
});
