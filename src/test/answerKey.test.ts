import { describe, it, expect } from "vitest";
import { normalizeAnswerKey, isCorrectOption, answerLabelBangla } from "@/lib/answerKey";
import { parsePastedText, toDbPayload } from "@/lib/bulkQuestions";

describe("normalizeAnswerKey", () => {
  it("latin, bangla, numeric and roman forms", () => {
    for (const [raw, exp] of [
      ["a", "a"], ["B", "b"], [" c ", "c"], ["D", "d"],
      ["ক", "a"], ["খ", "b"], ["গ", "c"], ["ঘ", "d"],
      ["1", "a"], ["৪", "d"], ["ii", "b"], ["IV", "d"],
    ] as const) {
      expect(normalizeAnswerKey(raw)).toBe(exp);
    }
  });

  it("prefixed / decorated forms", () => {
    expect(normalizeAnswerKey("(খ)")).toBe("b");
    expect(normalizeAnswerKey("উত্তর: গ")).toBe("c");
    expect(normalizeAnswerKey("সঠিক উত্তর - ঘ")).toBe("d");
    expect(normalizeAnswerKey("option b")).toBe("b");
    expect(normalizeAnswerKey("অপশন ক")).toBe("a");
    expect(normalizeAnswerKey("খ) ঢাকা")).toBe("b");
    expect(normalizeAnswerKey("<p>খ</p>")).toBe("b");
  });

  it("matches full option text", () => {
    const opts = ["চট্টগ্রাম", "ঢাকা", "রাজশাহী", "সিলেট"];
    expect(normalizeAnswerKey("উত্তর: ঢাকা", opts)).toBe("b");
    expect(normalizeAnswerKey("<p>সিলেট</p>", opts)).toBe("d");
  });

  it("returns null for junk", () => {
    expect(normalizeAnswerKey("")).toBeNull();
    expect(normalizeAnswerKey(null)).toBeNull();
    expect(normalizeAnswerKey("যেকোনো একটি")).toBeNull();
  });

  it("isCorrectOption / label helpers accept legacy bangla storage", () => {
    expect(isCorrectOption("খ", 1)).toBe(true);
    expect(isCorrectOption("b", 1)).toBe(true);
    expect(isCorrectOption("b", 2)).toBe(false);
    expect(answerLabelBangla("c")).toBe("গ");
  });
});

describe("paste + payload always stores canonical key", () => {
  const build = (ans: string) => `১. রাজধানী কোথায়?
ক) চট্টগ্রাম
খ) ঢাকা
গ) রাজশাহী
ঘ) সিলেট
উত্তর: ${ans}`;

  it.each(["খ", "b", "B", "(খ)", "২", "ঢাকা"])("answer '%s' -> b", (ans) => {
    const [q] = parsePastedText(build(ans), "mcq");
    expect(q.errors).toEqual([]);
    const p = toDbPayload(q, { class_id: 1, subject_id: 1, chapter_id: 1, teacher_id: "t" });
    expect(p.correct_answer).toBe("b");
  });

  it("flags undetectable answers instead of saving garbage", () => {
    const [q] = parsePastedText(build("জানি না"), "mcq");
    expect(q.errors.length).toBeGreaterThan(0);
  });
});
