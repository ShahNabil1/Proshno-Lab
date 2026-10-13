import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("VITE_META_PIXEL_ID", "39691774247102448");
  vi.stubEnv("VITE_META_PIXEL_ENABLED", "true");
  window.history.replaceState({}, "", "/");
  localStorage.clear();
  delete window.fbq;
  delete window._fbq;
  document.head.querySelectorAll('script[src*="fbevents.js"]').forEach(el => el.remove());
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "test-event-id") });
});

describe("Meta marketing events", () => {
  it("initializes the exact string ID once and tracks explicit standard events", async () => {
    const { trackMetaEvent } = await import("./metaPixel");
    trackMetaEvent("page_view");
    trackMetaEvent("begin_checkout", { value: 450, currency: "BDT" });
    expect(window.fbq?.queue.filter(args => args[0] === "init")).toEqual([["init", "39691774247102448"]]);
    expect(document.head.querySelectorAll('script[src*="fbevents.js"]')).toHaveLength(1);
    expect(window.fbq?.queue.at(-1)).toEqual(["trackSingle", "39691774247102448", "InitiateCheckout", { value: 450, currency: "BDT" }, { eventID: "test-event-id" }]);
  });

  it("deduplicates verified purchases across refresh and uses stable event IDs", async () => {
    let pixel = await import("./metaPixel");
    pixel.trackMetaEvent("purchase", { transaction_id: "TRX123", value: 320, currency: "BDT" });
    pixel.trackMetaEvent("purchase", { transaction_id: "TRX123", value: 320, currency: "BDT" });
    vi.resetModules();
    pixel = await import("./metaPixel");
    pixel.trackMetaEvent("purchase", { transaction_id: "TRX123", value: 320, currency: "BDT" });
    const purchases = window.fbq?.queue.filter(args => args[2] === "Purchase");
    expect(purchases).toHaveLength(1);
    expect(purchases?.[0][4]).toEqual({ eventID: "purchase:TRX123" });
  });

  it("deduplicates registrations when auth sends repeated sign-in notifications", async () => {
    const { trackMetaEvent } = await import("./metaPixel");
    trackMetaEvent("sign_up", { registration_id: "new-account", method: "google" });
    trackMetaEvent("sign_up", { registration_id: "new-account", method: "google" });
    expect(window.fbq?.queue.filter(args => args[2] === "CompleteRegistration")).toHaveLength(1);
    expect(window.fbq?.queue.at(-1)?.[3]).toEqual({ method: "google", status: true });
  });

  it("rejects incomplete/invalid purchases without loading tracking", async () => {
    const { trackMetaEvent } = await import("./metaPixel");
    trackMetaEvent("purchase", { value: 100 });
    trackMetaEvent("purchase", { transaction_id: "bad", value: NaN });
    trackMetaEvent("purchase", { transaction_id: "bad", value: -10 });
    expect(window.fbq).toBeUndefined();
  });

  it("does not copy personal checkout fields to Meta", async () => {
    const { trackMetaEvent } = await import("./metaPixel");
    trackMetaEvent("view_item", { item_id: "14", item_name: "Class 9", email: "private@example.com", phone: "01700000000", teacher_name: "Private", access_token: "secret" });
    expect(window.fbq?.queue.at(-1)?.[3]).toEqual({ content_ids: ["14"], content_type: "product", content_name: "Class 9" });
  });

  it("excludes admin pages and respects the GTM/disable switch", async () => {
    const { trackMetaEvent } = await import("./metaPixel");
    window.history.replaceState({}, "", "/admin/packages");
    trackMetaEvent("page_view");
    expect(window.fbq).toBeUndefined();
    window.history.replaceState({}, "", "/");
    vi.stubEnv("VITE_META_PIXEL_ENABLED", "false");
    trackMetaEvent("page_view");
    expect(window.fbq).toBeUndefined();
  });

  it("does not break checkout if the external pixel throws", async () => {
    const { initMetaPixel, trackMetaEvent } = await import("./metaPixel");
    initMetaPixel();
    window.fbq!.callMethod = () => { throw new Error("blocked"); };
    expect(() => trackMetaEvent("purchase", { transaction_id: "retry", value: 10 })).not.toThrow();
    window.fbq!.callMethod = undefined;
    trackMetaEvent("purchase", { transaction_id: "retry", value: 10 });
    expect(window.fbq?.queue.at(-1)?.[2]).toBe("Purchase");
  });
});
