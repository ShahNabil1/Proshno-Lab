export interface ReportSubscription {
  teacher_id: string; plan: string; status: string; created_at: string;
  starts_at: string | null; ends_at: string | null;
}
const DAY = 86400000;
export function remainingDays(end: string | null, now = Date.now()): number | null {
  return end ? Math.max(0, Math.ceil((Date.parse(end) - now) / DAY)) : null;
}
export function activeSubscription(s: ReportSubscription, now = Date.now()) {
  return s.status === "active" && (!s.starts_at || Date.parse(s.starts_at) <= now) && (!s.ends_at || Date.parse(s.ends_at) > now);
}
// Reporting days begin at midnight in Bangladesh, independent of the browser timezone.
export function reportingStart(days: number, now = Date.now()) {
  const dhakaDay = new Date(now + 6 * 3600000).toISOString().slice(0, 10);
  return Date.parse(`${dhakaDay}T00:00:00+06:00`) - (days - 1) * DAY;
}
export function expiresWithin(s: ReportSubscription, days: number, now = Date.now()) {
  return activeSubscription(s, now) && s.ends_at !== null && Date.parse(s.ends_at) <= now + days * DAY;
}
export function normalizeBDPhone(raw: string | null | undefined): string | null {
  let phone = (raw || "").replace(/[০-৯]/g, d => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/[\s()+-]/g, "");
  if (/^01[3-9]\d{8}$/.test(phone)) phone = `88${phone}`;
  return /^8801[3-9]\d{8}$/.test(phone) ? phone : null;
}
