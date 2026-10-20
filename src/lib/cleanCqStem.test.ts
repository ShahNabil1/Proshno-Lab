import { describe, expect, it } from "vitest";
import { cleanCqStem } from "./cleanCqStem";
import { toDbPayload } from "./bulkQuestions";

const creative = { q_ka: "<span>কত?</span>", q_kha: "<span>নির্ণয় কর।</span>", q_ga: "<span>(খ) এর মান বসাও।</span>" };
const duplicate = "(ক)<span>কত?</span><span>২</span>(খ)<span>নির্ণয় কর।</span><span>৪</span>(গ)<span>(খ) এর মান বসাও।</span><span>৪</span>";

describe("cleanCqStem", () => {
  it("cleans four-part Bangladesh and Global Studies questions with 1/2/3/4 marks", () => {
    const cd = { ...creative, q_gha: "মূল্যায়ন করো।" };
    const suffix = "(ক)<span>কত?</span><span>১</span>(খ)<span>নির্ণয় কর।</span><span>২</span>(গ)<span>(খ) এর মান বসাও।</span><span>৩</span>(ঘ)<span>মূল্যায়ন করো।</span><span>৪</span>";
    const image = '<img src="stimulus.webp" />';
    expect(cleanCqStem("ঘটনা-১: উদ্দীপক।<br>ঘটনা-২: তথ্য।" + suffix + "\n" + image, cd)).toBe("ঘটনা-১: উদ্দীপক।<br>ঘটনা-২: তথ্য।\n" + image);
    const mismatch = "উদ্দীপক।" + suffix.replace("মূল্যায়ন করো।", "অন্য প্রশ্ন।");
    expect(cleanCqStem(mismatch, cd)).toBe(mismatch);
  });
  it("removes only a complete matching suffix, including nested labels", () => {
    expect(cleanCqStem("উদ্দীপক।" + duplicate, creative)).toBe("উদ্দীপক।");
  });
  it("preserves stimulus images and formulas, including image-only stems", () => {
    const img = '<img src="diagram.webp" />';
    expect(cleanCqStem("\\(x^2\\)" + duplicate + "\n" + img, creative)).toBe("\\(x^2\\)\n" + img);
    expect(cleanCqStem(duplicate + "\n" + img, creative)).toBe(img);
  });
  it("leaves mismatched, missing, or additional content unchanged", () => {
    for (const stem of ["উদ্দীপক।", "উদ্দীপক।" + duplicate + "আরও তথ্য", "উদ্দীপক।" + duplicate.replace("কত?", "ভিন্ন?")]) {
      expect(cleanCqStem(stem, creative)).toBe(stem);
    }
    expect(cleanCqStem(duplicate, creative)).toBe(duplicate);
  });
  it("cleans imported payloads without mutating questions or answers", () => {
    const cd = { ...creative, stem: "উদ্দীপক।" + duplicate, ans_ka: "উত্তর" };
    const payload = toDbPayload({ tempId: "1", type: "cq", errors: [], question: cd.stem.slice(0,100), stimulus: cd.stem, creative_data: cd }, { class_id: 32, subject_id: 131, chapter_id: 1027, teacher_id: "test" });
    expect(payload.creative_data).toEqual({ ...cd, stem: "উদ্দীপক।" });
    expect(payload.stimulus_text).toBe("উদ্দীপক।");
    expect(payload.question).toBe("উদ্দীপক।");
    expect(cd.stem).toContain(duplicate);
  });
});
