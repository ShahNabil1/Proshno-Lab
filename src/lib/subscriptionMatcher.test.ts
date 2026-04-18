import { describe, it, expect } from "vitest";
import {
  normalizeSubscriptionText,
  extractClassLevels,
  planCoversSelection,
  hasActiveAccess,
  isPackagePurchased,
} from "./subscriptionMatcher";

describe("normalizeSubscriptionText", () => {
  it("trims and removes 'শ্রেণি'", () => {
    expect(normalizeSubscriptionText("  ষষ্ঠ শ্রেণি - বিজ্ঞান  ")).toBe("ষষ্ঠ - বিজ্ঞান");
  });

  it("normalizes en/em dashes and whitespace", () => {
    expect(normalizeSubscriptionText("ষষ্ঠ – দশম   সকল বিষয়")).toBe("ষষ্ঠ - দশম সকল বিষয়");
  });

  it("handles empty/null-like input", () => {
    expect(normalizeSubscriptionText("")).toBe("");
    // @ts-expect-error testing runtime safety
    expect(normalizeSubscriptionText(undefined)).toBe("");
  });
});

describe("extractClassLevels", () => {
  it("returns single level for one class", () => {
    expect(extractClassLevels("সপ্তম শ্রেণি")).toEqual([7]);
  });

  it("expands range bundles like 'ষষ্ঠ - দশম' into [6..10]", () => {
    expect(extractClassLevels("ষষ্ঠ - দশম")).toEqual([6, 7, 8, 9, 10]);
  });

  it("expands range with em-dash and whitespace", () => {
    expect(extractClassLevels("ষষ্ঠ — অষ্টম")).toEqual([6, 7, 8]);
  });

  it("does NOT expand when separator is '/'", () => {
    expect(extractClassLevels("ষষ্ঠ / দশম")).toEqual([6, 10]);
  });

  it("returns empty array when no class label found", () => {
    expect(extractClassLevels("শুধু বিজ্ঞান")).toEqual([]);
  });

  it("dedupes and sorts", () => {
    expect(extractClassLevels("দশম, ষষ্ঠ, দশম")).toEqual([6, 10]);
  });
});

describe("planCoversSelection — single subject plans", () => {
  it("matches exact class + subject", () => {
    expect(planCoversSelection("ষষ্ঠ শ্রেণি - বিজ্ঞান", "ষষ্ঠ শ্রেণি", "বিজ্ঞান")).toBe(true);
  });

  it("rejects when subject differs", () => {
    expect(planCoversSelection("ষষ্ঠ শ্রেণি - বিজ্ঞান", "ষষ্ঠ শ্রেণি", "গণিত")).toBe(false);
  });

  it("rejects when class differs", () => {
    expect(planCoversSelection("ষষ্ঠ শ্রেণি - বিজ্ঞান", "সপ্তম শ্রেণি", "বিজ্ঞান")).toBe(false);
  });
});

describe("planCoversSelection — 'সকল বিষয়' plans", () => {
  it("covers any subject for the matching class", () => {
    const plan = "সপ্তম শ্রেণি - সকল বিষয়";
    expect(planCoversSelection(plan, "সপ্তম শ্রেণি", "বিজ্ঞান")).toBe(true);
    expect(planCoversSelection(plan, "সপ্তম শ্রেণি", "গণিত")).toBe(true);
    expect(planCoversSelection(plan, "সপ্তম শ্রেণি", "বাংলা")).toBe(true);
  });

  it("does not leak across classes", () => {
    expect(planCoversSelection("সপ্তম শ্রেণি - সকল বিষয়", "অষ্টম শ্রেণি", "গণিত")).toBe(false);
  });
});

describe("planCoversSelection — range bundle plans", () => {
  const bundle = "ষষ্ঠ - দশম - সকল বিষয়";

  it("covers every class within the range", () => {
    for (const cls of ["ষষ্ঠ শ্রেণি", "সপ্তম শ্রেণি", "অষ্টম শ্রেণি", "নবম শ্রেণি", "দশম শ্রেণি"]) {
      expect(planCoversSelection(bundle, cls, "বিজ্ঞান")).toBe(true);
      expect(planCoversSelection(bundle, cls, "গণিত")).toBe(true);
    }
  });

  it("does NOT cover classes outside the range", () => {
    expect(planCoversSelection(bundle, "একাদশ শ্রেণি", "বিজ্ঞান")).toBe(false);
    expect(planCoversSelection(bundle, "দ্বাদশ শ্রেণি", "বিজ্ঞান")).toBe(false);
  });

  it("range bundle limited to a specific subject still respects subject", () => {
    const plan = "ষষ্ঠ - দশম - বিজ্ঞান";
    expect(planCoversSelection(plan, "সপ্তম শ্রেণি", "বিজ্ঞান")).toBe(true);
    expect(planCoversSelection(plan, "সপ্তম শ্রেণি", "গণিত")).toBe(false);
  });
});

describe("planCoversSelection — mismatched / edge cases", () => {
  it("returns false for empty plan", () => {
    expect(planCoversSelection("", "ষষ্ঠ শ্রেণি", "বিজ্ঞান")).toBe(false);
  });

  it("returns false for completely unrelated plan text", () => {
    expect(planCoversSelection("free", "ষষ্ঠ শ্রেণি", "বিজ্ঞান")).toBe(false);
  });

  it("tolerates extra whitespace and em-dashes in plan", () => {
    expect(planCoversSelection("  ষষ্ঠ   শ্রেণি — সকল বিষয় ", "ষষ্ঠ শ্রেণি", "বিজ্ঞান")).toBe(true);
  });
});

describe("hasActiveAccess", () => {
  const plans = ["ষষ্ঠ - দশম - সকল বিষয়", "একাদশ শ্রেণি - পদার্থবিজ্ঞান"];

  it("returns true if any plan covers the selection", () => {
    expect(hasActiveAccess(plans, "অষ্টম শ্রেণি", "গণিত")).toBe(true);
    expect(hasActiveAccess(plans, "একাদশ শ্রেণি", "পদার্থবিজ্ঞান")).toBe(true);
  });

  it("returns false when no plan matches", () => {
    expect(hasActiveAccess(plans, "একাদশ শ্রেণি", "রসায়ন")).toBe(false);
    expect(hasActiveAccess(plans, "দ্বাদশ শ্রেণি", "গণিত")).toBe(false);
  });

  it("returns false for empty plan list", () => {
    expect(hasActiveAccess([], "ষষ্ঠ শ্রেণি", "বিজ্ঞান")).toBe(false);
  });
});

describe("isPackagePurchased", () => {
  const activePlans = ["ষষ্ঠ - দশম - সকল বিষয়"];

  it("marks individual subject packages within bundle range as purchased", () => {
    expect(isPackagePurchased({ class_name: "সপ্তম শ্রেণি", subject_name: "বিজ্ঞান" }, activePlans)).toBe(true);
    expect(isPackagePurchased({ class_name: "দশম শ্রেণি", subject_name: "গণিত" }, activePlans)).toBe(true);
  });

  it("marks 'সকল বিষয়' class packages within range as purchased", () => {
    expect(isPackagePurchased({ class_name: "অষ্টম শ্রেণি", subject_name: "সকল বিষয়" }, activePlans)).toBe(true);
  });

  it("does not mark out-of-range packages as purchased", () => {
    expect(isPackagePurchased({ class_name: "একাদশ শ্রেণি", subject_name: "বিজ্ঞান" }, activePlans)).toBe(false);
  });

  it("returns false with no active plans", () => {
    expect(isPackagePurchased({ class_name: "ষষ্ঠ শ্রেণি", subject_name: "বিজ্ঞান" }, [])).toBe(false);
  });
});
