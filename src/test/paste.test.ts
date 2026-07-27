import { describe, it, expect } from "vitest";
import { parsePastedText, markBatchDuplicates, markDbDuplicates, parsedSignature, toDbPayload } from "@/lib/bulkQuestions";

describe("paste parser", () => {
  it("mcq with refs, explanation, image", () => {
    const t = `১. বাংলাদেশের রাজধানী কোথায়?
ছবি: https://res.cloudinary.com/demo/image/upload/x.jpg
ক) চট্টগ্রাম
খ) ঢাকা
গ) রাজশাহী
ঘ) সিলেট
উত্তর: খ
ব্যাখ্যা: ঢাকা রাজধানী।
বোর্ড: ঢাকা-২০২৩, যশোর ২০২২
বিশ্ববিদ্যালয়: ঢাবি-২০২১

২. $x^2-5x+6=0$ এর মূল?
ক) $1,6$
খ) $2,3$
গ) $-2,-3$
ঘ) $0,5$
উত্তর: খ`;
    const qs = parsePastedText(t, "mcq");
    expect(qs.length).toBe(2);
    expect(qs[0].errors).toEqual([]);
    expect(qs[0].option_b).toBe("ঢাকা");
    expect(qs[0].correct_answer).toBe("b");
    expect(qs[0].stimulus).toContain("<img");
    const p = toDbPayload(qs[0], { class_id: 1, subject_id: 1, chapter_id: 1, teacher_id: "t" });
    expect(p.board_references).toEqual([{ board: "ঢাকা", year: "২০২৩" }, { board: "যশোর", year: "২০২২" }]);
    expect(p.university_references).toEqual([{ name: "ঢাবি", year: "২০২১" }]);
    expect(qs[1].option_b).toBe("$2,3$");
  });

  it("multi-completion mcq keeps roman lines in question", () => {
    const t = `১. সালোকসংশ্লেষণে প্রয়োজন—
i. সূর্যালোক
ii. ক্লোরোফিল
নিচের কোনটি সঠিক?
ক) i ও ii
খ) শুধু i
গ) শুধু ii
ঘ) কোনোটিই নয়
উত্তর: ক`;
    const [q] = parsePastedText(t, "mcq");
    expect(q.errors).toEqual([]);
    expect(q.question).toContain("i. সূর্যালোক");
    expect(q.question).toContain("<br/>");
  });

  it("cq with answers and math mode", () => {
    const t = `উদ্দীপক: একটি সমকোণী ত্রিভুজের ভূমি $3$ ও উচ্চতা $4$।
ক) অতিভুজ কাকে বলে?
খ) অতিভুজ নির্ণয় করো।
গ) ক্ষেত্রফল নির্ণয় করো।
উত্তর খ: $5$
বোর্ড: যশোর-২০২২`;
    const [q] = parsePastedText(t, "cq", true);
    expect(q.errors).toEqual([]);
    expect(q.creative_data.is_math).toBe(true);
    expect(q.creative_data.ans_kha).toBe("$5$");
    expect(q.boardRefs).toEqual([{ board: "যশোর", year: "২০২২" }]);
  });

  it("cq splits multiple blocks", () => {
    const t = `উদ্দীপক: প্রথম
ক) a
খ) b
গ) c
ঘ) d

উদ্দীপক: দ্বিতীয়
ক) a2
খ) b2
গ) c2
ঘ) d2`;
    const qs = parsePastedText(t, "cq");
    expect(qs.length).toBe(2);
    expect(qs[1].creative_data.q_ka).toBe("a2");
    expect(qs[0].creative_data.q_gha).toBe("d");
  });

  it("short with answer + explanation", () => {
    const t = `১. সালোকসংশ্লেষণ কী?
উত্তর: খাদ্য তৈরির প্রক্রিয়া।
ব্যাখ্যা: বিস্তারিত।
বিশ্ববিদ্যালয়: ঢাবি-২০২০`;
    const [q] = parsePastedText(t, "short");
    expect(q.question).toBe("সালোকসংশ্লেষণ কী?");
    expect(q.explanation).toBe("খাদ্য তৈরির প্রক্রিয়া।<br/>বিস্তারিত।");
    expect(q.uniRefs).toEqual([{ name: "ঢাবি", year: "২০২০" }]);
  });

  it("descriptive two parts", () => {
    const t = `১. ক) প্রেক্ষাপট ব্যাখ্যা করো।
খ) ফলাফল আলোচনা করো।
উত্তর ক: A
উত্তর খ: B`;
    const [q] = parsePastedText(t, "descriptive");
    expect(q.creative_data.desc_q_ka).toBe("প্রেক্ষাপট ব্যাখ্যা করো।");
    expect(q.creative_data.desc_q_kha).toBe("ফলাফল আলোচনা করো।");
    expect(q.creative_data.desc_ans_kha).toBe("B");
  });

  it("detects duplicates in batch and against db", () => {
    const t = `১. প্রশ্ন এক?
ক) a
খ) b
গ) c
ঘ) d
উত্তর: ক

২. প্রশ্ন  এক?
ক) a
খ) b
গ) c
ঘ) d
উত্তর: ক`;
    const qs = markBatchDuplicates(parsePastedText(t, "mcq"));
    expect(qs[0].duplicate).toBeUndefined();
    expect(qs[1].duplicate).toBe("batch");
    const withDb = markDbDuplicates([qs[0]], new Set([parsedSignature(qs[0])]));
    expect(withDb[0].duplicate).toBe("db");
  });
});

describe("math CQ paste", () => {
  it("forces 3-question format for math subjects even if ঘ) present", () => {
    const t = `উদ্দীপক: $f(x)=x^2-5x+6$
ক) $f(0)$ কত?
খ) মূল নির্ণয় করো।
গ) শীর্ষবিন্দু নির্ণয় করো।
ঘ) ভুল করে দেওয়া চতুর্থ প্রশ্ন।
উত্তর গ: $(2.5,-0.25)$`;
    const [q] = parsePastedText(t, "cq", true);
    expect(q.errors).toEqual([]);
    expect(q.creative_data.is_math).toBe(true);
    expect(q.creative_data.q_gha).toBeUndefined();
    expect(q.creative_data.ans_ga).toBe("$(2.5,-0.25)$");
  });
});
