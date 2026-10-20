import { describe, it, expect } from "vitest";
import { reportingStart, remainingDays, expiresWithin, normalizeBDPhone } from "./subscriptionReports";
describe("subscription reports", () => {
  const now = Date.parse("2026-10-20T20:00:00Z");
  it("counts Dhaka calendar days rather than UTC days", () => {
    expect(new Date(reportingStart(1, now)).toISOString()).toBe("2026-10-20T18:00:00.000Z");
    expect(now - reportingStart(7, now)).toBe(6 * 86400000 + 2 * 3600000);
  });
  it("excludes queued, cancelled and expired subscriptions from advance warnings", () => {
    const s = {teacher_id:"a",plan:"Math",status:"active",created_at:"",starts_at:null,ends_at:new Date(now + 86400000).toISOString()};
    expect(expiresWithin(s, 7, now)).toBe(true);
    expect(expiresWithin({...s,status:"inactive"},7,now)).toBe(false);
    expect(expiresWithin({...s,starts_at:new Date(now+1000).toISOString()},7,now)).toBe(false);
    expect(expiresWithin({...s,ends_at:new Date(now-1).toISOString()},7,now)).toBe(false);
    expect(remainingDays(null,now)).toBeNull();
  });
  it("normalizes and validates local and international Bangladeshi numbers", () => {
    expect(normalizeBDPhone("০১৭১২৩৪৫৬৭৮")).toBe("8801712345678");
    expect(normalizeBDPhone("+880 1712-345678")).toBe("8801712345678");
    expect(normalizeBDPhone("invoice123")).toBeNull();
  });
});
