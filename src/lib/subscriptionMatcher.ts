/**
 * Shared subscription matcher used across QuestionCreate, Packages, and Subscription pages.
 * Handles Bangla class names, range bundles (e.g. "ষষ্ঠ - দশম"), "সকল বিষয়" plans,
 * and normalization of whitespace, dashes, and the word "শ্রেণি".
 */

export const CLASS_LEVELS: { label: string; level: number }[] = [
  { label: "তৃতীয়", level: 3 },
  { label: "চতুর্থ", level: 4 },
  { label: "পঞ্চম", level: 5 },
  { label: "ষষ্ঠ", level: 6 },
  { label: "সপ্তম", level: 7 },
  { label: "অষ্টম", level: 8 },
  { label: "নবম", level: 9 },
  { label: "দশম", level: 10 },
  { label: "একাদশ", level: 11 },
  { label: "দ্বাদশ", level: 12 },
];

export const ALL_SUBJECTS_LABEL = "সকল বিষয়";

/** Normalize plan / class strings for comparison. */
export const normalizeSubscriptionText = (value: string): string =>
  (value || "").normalize("NFC")
    .trim()
    .replace(/শ্রেণি/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");

/**
 * Extract numeric class levels from a normalized string.
 * "ষষ্ঠ - দশম" → [6,7,8,9,10]; "সপ্তম" → [7]; "ষষ্ঠ / অষ্টম" → [6,8].
 */
export const extractClassLevels = (value: string): number[] => {
  const normalized = normalizeSubscriptionText(value);
  const levels = CLASS_LEVELS
    .filter(({ label }) => normalized.includes(normalizeSubscriptionText(label)))
    .map(({ level }) => level);

  // Range like "ষষ্ঠ - দশম" → expand to inclusive range
  if (
    levels.length === 2 &&
    normalized.includes("-") &&
    !normalized.includes("/") &&
    Math.abs(levels[0] - levels[1]) > 1
  ) {
    const start = Math.min(...levels);
    const end = Math.max(...levels);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  return [...new Set(levels)].sort((a, b) => a - b);
};

/**
 * Does a subscription plan cover a (className, subjectName) selection?
 * Used in QuestionCreate to check chapter/subject access.
 */
export const planCoversSelection = (
  plan: string,
  className: string,
  subjectName: string,
): boolean => {
  if (plan.startsWith("Custom #")) return false;
  const normalizedPlan = normalizeSubscriptionText(plan);
  const normalizedClass = normalizeSubscriptionText(className);
  const normalizedSubject = normalizeSubscriptionText(subjectName);

  const subjectMatches =
    normalizedPlan.includes(normalizedSubject) ||
    (["সাধারন গণিত", "সাধারণ গণিত", "গণিত"].includes(normalizedSubject) &&
      /(?:^| - )(?:সাধারন গণিত|সাধারণ গণিত|গণিত)$/.test(normalizedPlan)) ||
    normalizedPlan.includes(ALL_SUBJECTS_LABEL);
  if (!subjectMatches) return false;

  const selectedLevels = extractClassLevels(normalizedClass);
  const planLevels = extractClassLevels(normalizedPlan);

  if (selectedLevels.length === 0 || planLevels.length === 0) {
    return normalizedPlan.includes(normalizedClass);
  }

  return selectedLevels.some((level) => planLevels.includes(level));
};

/**
 * Does any of the user's active subscription plans cover this selection?
 */
export const hasActiveAccess = (
  plans: string[],
  className: string,
  subjectName: string,
): boolean => plans.some((p) => planCoversSelection(p, className, subjectName));

/**
 * Is a pricing package already covered by one of the active plans?
 * Used in Packages & Subscription pages to mark "ইতিমধ্যেই কেনা হয়েছে".
 */
export const isPackagePurchased = (
  pkg: { class_name: string; subject_name: string },
  activePlans: string[],
): boolean => hasActiveAccess(activePlans, pkg.class_name, pkg.subject_name);

/** Minimal shape of a subscription row needed to decide whether it is usable right now. */
export interface SubscriptionWindow {
  plan?: string | null;
  status?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
}

/**
 * Is a subscription usable right now?
 * A row only counts when it is marked active AND today falls inside its
 * starts_at / ends_at window, so manually granted access expires on its own.
 */
export const isSubscriptionActive = (
  sub: SubscriptionWindow | null | undefined,
  now: Date = new Date(),
): boolean => {
  if (!sub || sub.status !== "active") return false;
  const time = now.getTime();
  if (sub.starts_at) {
    const start = new Date(sub.starts_at).getTime();
    if (!Number.isNaN(start) && start > time) return false;
  }
  if (sub.ends_at) {
    const end = new Date(sub.ends_at).getTime();
    if (!Number.isNaN(end) && end <= time) return false;
  }
  return true;
};

/**
 * Plan names of the subscriptions that are usable right now.
 * Use this instead of filtering on status alone, otherwise expired
 * subscriptions keep granting access.
 */
export const activePlanNames = (
  subs: SubscriptionWindow[] | null | undefined,
  now: Date = new Date(),
): string[] =>
  (subs || [])
    .filter((sub) => isSubscriptionActive(sub, now))
    .map((sub) => sub.plan || "")
    .filter((plan) => plan.trim().length > 0);

/**
 * Resolve the class part of a plan to concrete class rows.
 * Handles single classes ("দ্বাদশ শ্রেণি"), range bundles ("ষষ্ঠ - দ্বাদশ"),
 * and the spelling variants used across pricing packages.
 */
export const resolvePlanClasses = <T extends { name: string }>(
  className: string,
  classes: T[],
): T[] => {
  const normalized = normalizeSubscriptionText(className);
  if (!normalized) return [];

  const exact = classes.filter((c) => normalizeSubscriptionText(c.name) === normalized);
  if (exact.length > 0) return exact;

  const levels = extractClassLevels(className);
  if (levels.length > 0) {
    const ranged = classes.filter((c) =>
      extractClassLevels(c.name).some((level) => levels.includes(level)),
    );
    if (ranged.length > 0) return ranged;
  }

  return classes.filter((c) => {
    const name = normalizeSubscriptionText(c.name);
    return name.includes(normalized) || normalized.includes(name);
  });
};
