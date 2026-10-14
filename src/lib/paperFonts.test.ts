import { describe, expect, it } from "vitest";
import { UNICODE_PAPER_FONTS, paperFontFamily, paperWordFont } from "./paperFonts";
import { ENGLISH_PAPER_FONTS } from "./englishPaperFonts";

describe("paper font selection", () => {
  it("uses the selected English face before Times and retains Bengali fallback", () => {
    for (const font of ENGLISH_PAPER_FONTS) {
      expect(paperFontFamily(font.id).split(",")[0]).toBe(`"${font.family}"`);
      expect(paperFontFamily(font.id)).toContain("SolaimanLipi");
      expect(paperWordFont(font.id)).toBe(font.family);
    }
  });
  it("preserves existing Bengali and saved default font choices", () => {
    expect(paperFontFamily("bangla")).toContain("SolaimanLipi");
    expect(paperFontFamily("kalpurush")).toContain("Kalpurush");
    expect(paperFontFamily("li-ador-noirrit")).toContain('"Li Ador Noirrit"');
    expect(new Set(UNICODE_PAPER_FONTS.map(f => f.id)).size).toBe(UNICODE_PAPER_FONTS.length);
  });
});
