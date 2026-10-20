import { describe, it, expect } from "vitest";
import {
  CLASS_LEVELS,
  normalizeSubscriptionText,
  extractClassLevels,
  planCoversSelection,
  hasActiveAccess,
  isPackagePurchased,
  isSubscriptionActive,
  activePlanNames,
  resolvePlanClasses,
} from "./subscriptionMatcher";

describe("resolvePlanClasses", () => {
  const classes = [
    { id: 1, name: "ষষ্ঠ শ্রেণি" },
    { id: 2, name: "সপ্তম শ্রেণি" },
    { id: 3, name: "নবম শ্রেণি" },
    { id: 4, name: "দশম শ্রেণি" },
    { id: 5, name: "দ্বাদশ শ্রেণি" },
  ];

  it("resolves an exact single class", () => {
    expect(resolvePlanClasses("দ্বাদশ শ্রেণি", classes)).toEqual([{ id: 5, name: "দ্বাদশ শ্রেণি" }]);
  });

  it("resolves a range bundle to every class inside it", () => {
    expect(resolvePlanClasses("ষষ্ঠ - দশম", classes).map(c => c.id)).toEqual([1, 2, 3, 4]);
  });

  it("resolves the spelling variant used by pricing packages", () => {
    expect(resolvePlanClasses("নবম-দশম শ্রেনি", classes).map(c => c.id)).toEqual([3, 4]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(resolvePlanClasses("কেজি", classes)).toEqual([]);
    expect(resolvePlanClasses("", classes)).toEqual([]);
  });
});

const NOW = new Date("2026-09-18T12:00:00.000Z");

describe("isSubscriptionActive", () => {
  it("accepts an active subscription inside its window", () => {
    expect(isSubscriptionActive(
      { status: "active", starts_at: "2026-01-01T00:00:00.000Z", ends_at: "2027-01-01T00:00:00.000Z" },
      NOW,
    )).toBe(true);
  });

  it("rejects rows that are not active", () => {
    expect(isSubscriptionActive({ status: "inactive", starts_at: null, ends_at: null }, NOW)).toBe(false);
    expect(isSubscriptionActive({ status: "pending" }, NOW)).toBe(false);
    expect(isSubscriptionActive(null, NOW)).toBe(false);
    expect(isSubscriptionActive(undefined, NOW)).toBe(false);
  });

  it("rejects before starts_at and at or after ends_at", () => {
    expect(isSubscriptionActive({ status: "active", starts_at: "2026-10-01T00:00:00.000Z" }, NOW)).toBe(false);
    expect(isSubscriptionActive({ status: "active", ends_at: "2026-09-18T12:00:00.000Z" }, NOW)).toBe(false);
    expect(isSubscriptionActive({ status: "active", ends_at: "2026-09-18T11:59:59.000Z" }, NOW)).toBe(false);
  });

  it("treats missing start or end as open ended", () => {
    expect(isSubscriptionActive({ status: "active", starts_at: null, ends_at: null }, NOW)).toBe(true);
    expect(isSubscriptionActive({ status: "active" }, NOW)).toBe(true);
  });

  it("ignores unparseable dates instead of blocking access", () => {
    expect(isSubscriptionActive({ status: "active", ends_at: "not-a-date" }, NOW)).toBe(true);
  });
});

describe("activePlanNames", () => {
  it("keeps only currently usable plans", () => {
    const subs = [
      { plan: "Class 12 - All Subjects", status: "active", starts_at: "2026-01-01T00:00:00.000Z", ends_at: "2027-01-01T00:00:00.000Z" },
      { plan: "Expired Plan", status: "active", starts_at: "2024-01-01T00:00:00.000Z", ends_at: "2025-01-01T00:00:00.000Z" },
      { plan: "Inactive Plan", status: "inactive", starts_at: null, ends_at: null },
      { plan: "Queued Plan", status: "active", starts_at: "2027-01-01T00:00:00.000Z" },
    ];
    expect(activePlanNames(subs, NOW)).toEqual(["Class 12 - All Subjects"]);
  });

  it("handles null input and drops blank plans", () => {
    expect(activePlanNames(null, NOW)).toEqual([]);
    expect(activePlanNames(undefined, NOW)).toEqual([]);
    expect(activePlanNames([{ plan: "   ", status: "active" }], NOW)).toEqual([]);
  });
});

describe("general math package aliases", () => {
  it("covers the shared ninth-tenth general math book with either spelling", () => {
    for (const subject of ["সাধারন গণিত", "সাধারণ গণিত"]) {
      expect(planCoversSelection("ষষ্ঠ - দশম - গণিত", "নবম-দশম শ্রেণি", subject)).toBe(true);
    }
  });
  it("keeps higher math, English version and other classes outside the alias", () => {
    expect(planCoversSelection("ষষ্ঠ - দশম - গণিত", "নবম-দশম শ্রেণি", "উচ্চতর গণিত")).toBe(false);
    expect(planCoversSelection("ষষ্ঠ - দশম - গণিত", "SSC (Eglish Version)", "Mathemathis")).toBe(false);
    expect(planCoversSelection("ষষ্ঠ - অষ্টম - গণিত", "নবম-দশম শ্রেণি", "সাধারন গণিত")).toBe(false);
    expect(planCoversSelection("নবম-দশম - উচ্চতর গণিত", "নবম-দশম শ্রেণি", "সাধারন গণিত")).toBe(false);
  });
});

describe("normalizeSubscriptionText", () => {
  it("trims and removes 'শ্রেণি'", () => {
    expect(normalizeSubscriptionText("  ষষ্ঠ শ্রেণি - বিজ্ঞান  ")).toBe("ষষ্ঠ - বিজ্ঞান");
  });

  it("normalizes en/em dashes and whitespace", () => {
    expect(normalizeSubscriptionText("ষষ্ঠ – দশম   সকল বিষয়")).toBe("ষষ্ঠ - দশম সকল বিষয়");
  });

  it("handles empty/null-like input", () => {
    expect(normalizeSubscriptionText("")).toBe("");
    expect(normalizeSubscriptionText(null as unknown as string)).toBe("");
    expect(normalizeSubscriptionText(undefined as unknown as string)).toBe("");
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
  it("covers every subject listed in a multi-subject custom plan", () => {
    const plan = "দ্বাদশ শ্রেণি - বাংলা, ইংরেজি";
    expect(planCoversSelection(plan, "দ্বাদশ শ্রেণি", "বাংলা")).toBe(true);
    expect(planCoversSelection(plan, "দ্বাদশ শ্রেণি", "ইংরেজি")).toBe(true);
    expect(planCoversSelection(plan, "দ্বাদশ শ্রেণি", "গণিত")).toBe(false);
  });

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
  it("limits custom multi-subject packages to the selected class and subjects", () => {
    const plan = "ষষ্ঠ শ্রেণি - গণিত, বিজ্ঞান";
    expect(planCoversSelection(plan, "ষষ্ঠ শ্রেণি", "গণিত")).toBe(true);
    expect(planCoversSelection(plan, "ষষ্ঠ শ্রেণি", "বিজ্ঞান")).toBe(true);
    expect(planCoversSelection(plan, "ষষ্ঠ শ্রেণি", "English 1st Paper")).toBe(false);
    expect(planCoversSelection(plan, "সপ্তম শ্রেণি", "গণিত")).toBe(false);
  });
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

describe("primary-to-secondary bundles", () => {
  it("covers every class in the paid third-to-twelfth bundle", () => {
    expect(extractClassLevels("তৃতীয় - দ্বাদশ - সকল বিষয়")).toEqual([3,4,5,6,7,8,9,10,11,12]);
    for (const { label } of CLASS_LEVELS) {
      expect(planCoversSelection("তৃতীয় - দ্বাদশ - সকল বিষয়", label, "Mathematics")).toBe(true);
    }
  });
});
