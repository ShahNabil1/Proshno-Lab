import { beforeEach, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
const invoke = vi.hoisted(() => vi.fn(async () => ({ data: { success: true }, error: null })));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
  functions: { invoke },
} }));
beforeEach(() => {
  vi.resetModules(); invoke.mockClear();
  vi.stubEnv("VITE_META_PIXEL_ENABLED", "true");
  vi.stubEnv("VITE_META_PIXEL_ID", "39691774247102448");
  window.history.replaceState({}, "", "/pricing?code=private-token");
  delete window.fbq; delete window._fbq;
  window.dataLayer = [];
});

it("sends the same event ID to Pixel and the server and strips tokens from attribution URLs", async () => {
  const { trackEvent } = await import("./analytics");
  trackEvent("begin_checkout", { value: 299, currency: "BDT" });
  await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
  const args = invoke.mock.calls[0] as unknown as [string, { body: { event_id: string; marketing: { source_url: string }; params: unknown } }];
  const pixelId = (window.fbq?.queue.at(-1)?.[4] as { eventID: string }).eventID;
  expect(args[1].body.event_id).toBe(pixelId);
  expect(args[1].body.marketing.source_url).not.toContain("private-token");
  expect(window.dataLayer.at(-1)?.event_id).toBe(pixelId);
});

it("keeps a canonical transaction identity for Pixel and server retries", async () => {
  const { analytics } = await import("./analytics");
  analytics.purchase("verified-transaction", 299);
  await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
  const args = invoke.mock.calls[0] as unknown as [string, { body: { event_id: string } }];
  expect(args[1].body.event_id).toBe("purchase:verified-transaction");
  expect((window.fbq?.queue.at(-1)?.[4] as { eventID: string }).eventID).toBe("purchase:verified-transaction");
});

it("does not forward marketing metadata when marketing is disabled", async () => {
  vi.stubEnv("VITE_META_PIXEL_ENABLED", "false");
  const { analytics } = await import("./analytics");
  analytics.pageView("/pricing", "Packages");
  await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
  const args = invoke.mock.calls[0] as unknown as [string, { body: { event_id?: string; marketing?: unknown } }];
  expect(args[1].body.event_id).toBeUndefined();
  expect(args[1].body.marketing).toBeUndefined();
});
