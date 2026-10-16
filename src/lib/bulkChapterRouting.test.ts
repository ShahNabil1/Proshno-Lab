import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parsePastedText, parseExcelFile, markBatchDuplicates } from "./bulkQuestions";
import { resolveQuestionChapters } from "./bulkChapterRouting";

const chapters = [{ id: 10, name: "অধ্যায় ১ - বাস্তব সংখ্যা" }, { id: 20, name: "অধ্যায় ২ - সেট" }];
const mcq = "১. দুই যোগ দুই কত?\nক) ১\nখ) ২\nগ) ৩\nঘ) ৪\nউত্তর: ঘ";
const cq = "উদ্দীপক: একটি ত্রিভুজের তিন বাহু দেওয়া আছে।\nক) ত্রিভুজ কী?\nখ) পরিসীমা কী?\nগ) ক্ষেত্রফল নির্ণয় করো।\nঘ) বিশ্লেষণ করো।\nউত্তর ক: তিন বাহুর চিত্র।";
const sq = "১. বাস্তব সংখ্যা কী?\nউত্তর: একটি সংখ্যার শ্রেণি।";

describe("chapter-aware question import", () => {
  it.each([["mcq", mcq], ["cq", cq], ["short", sq]])("routes %s sections without adding chapter labels to question content", (type, sample) => {
    const items = parsePastedText(`অধ্যায়: বাস্তব সংখ্যা\n${sample}\n\nChapter: ২\n${sample}`, type);
    const resolved = resolveQuestionChapters(items, chapters);
    expect(resolved.map(q => q.chapterId)).toEqual([10, 20]);
    expect(resolved.every(q => q.errors.length === 0)).toBe(true);
    expect(resolved[0].question).not.toMatch(/অধ্যায়|Chapter/);
    expect(resolved[0].correct_answer).toBe(type === "mcq" ? "d" : undefined);
    if (type === "cq") expect(resolved[1].creative_data.ans_ka).toBe("তিন বাহুর চিত্র।");
  });
  it("inherits a heading for multiple questions and supports per-question headings", () => {
    const result = resolveQuestionChapters(parsePastedText(`অধ্যায়: ১\n${sq}\n\n২. দ্বিতীয় প্রশ্ন?\nউত্তর: দুই।\n\nঅধ্যায়: সেট\n${sq}`, "short"), chapters);
    expect(result.map(q => q.chapterId)).toEqual([10, 10, 20]);
    expect(result[1].explanation).toBe("দুই।");
  });
  it("retains dashboard fallback for unlabelled rows but explicit chapters override it", () => {
    const result = resolveQuestionChapters(parsePastedText(`${sq}\n\nঅধ্যায়: সেট\n${sq}`, "short"), chapters, "10");
    expect(result.map(q => q.chapterId)).toEqual([10, 20]);
    expect(result.every(q => q.errors.length === 0)).toBe(true);
  });
  it("never silently falls back for unknown, empty or ambiguous chapters", () => {
    for (const name of ["", "ভুল নাম", "অন্য বিষয়ের অধ্যায়"]) {
      const [q] = resolveQuestionChapters(parsePastedText(`Chapter: ${name}\n${sq}`, "short"), chapters, 10);
      expect(q.chapterId).toBeUndefined();
      expect(q.errors).toHaveLength(1);
    }
    const [q] = resolveQuestionChapters(parsePastedText(`Chapter: সেট\n${sq}`, "short"), [...chapters, { id: 30, name: "অধ্যায় ৩ - সেট" }]);
    expect(q.chapterId).toBeUndefined(); expect(q.errors[0]).toContain("একাধিক");
  });
  it("requires a destination when no heading or dashboard chapter exists", () => {
    const [q] = resolveQuestionChapters(parsePastedText(sq, "short"), chapters);
    expect(q.errors[0]).toContain("ডিফল্ট");
    expect(resolveQuestionChapters([q], chapters, 10)[0].errors).toEqual([]);
  });
  it("normalizes Bengali digits, whitespace and chapter prefixes", () => {
    const [q] = resolveQuestionChapters(parsePastedText(`Chapter: অধ্যায় 1 — বাস্তব   সংখ্যা\n${mcq}`, "mcq"), chapters);
    expect(q.chapterId).toBe(10); expect(q.errors).toEqual([]);
  });
  it("only marks batch duplicates within the same destination chapter", () => {
    const items = resolveQuestionChapters(parsePastedText(`Chapter: 1\n${mcq}\n\n${mcq}\n\nChapter: 2\n${mcq}`, "mcq"), chapters);
    expect(markBatchDuplicates(items).map(q => q.duplicate)).toEqual([undefined, "batch", undefined]);
  });
  it("accepts Excel chapters and topics in any column position without shifting content", async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Chapter", "টপিক", "উদ্দীপক", "প্রশ্ন*", "উত্তর", "ছবি URL", "ব্যাখ্যা"],
      ["সেট", "উপসেট", "", "সেট কী?", "সংগ্রহ", "", "বিশদ"],
      ["", "", "", "সংখ্যা কী?", "মান", "", ""],
    ]), "Questions");
    const data = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const items = await parseExcelFile({ arrayBuffer: async () => data } as File, "short");
    const result = resolveQuestionChapters(items, chapters, 10);
    expect(result.map(q => q.chapterId)).toEqual([20, 10]);
    expect(result[0]).toMatchObject({ question: "সেট কী?", topicName: "উপসেট", explanation: "সংগ্রহ\nবিশদ" });
  });
});
