import { createBrowserServerEvent, deliverMetaEvent, hashIdentifier, normalizeMarketingContext, type QueuedMetaEvent } from "../supabase/functions/_shared/metaCapi.ts";
const assert = (condition: unknown, message = "Assertion failed") => { if (!condition) throw new Error(message); };
const event: QueuedMetaEvent = { pixel_id: "39691774247102448", event_name: "Purchase", event_id: "purchase:TRX-test",
  event_time: 1791900000, source_url: "https://www.proshnolab.com/payment/callback", user_data: { fbp: "fb.1.1791900000000.123" }, custom_data: { value: 299, currency: "BDT" } };

Deno.test("shares browser/server identity but cannot forge conversion events through the browser endpoint", async () => {
  const context = normalizeMarketingContext({ source_url: "https://www.proshnolab.com/pricing" });
  const id = "44444444-4444-4444-8444-444444444444";
  const mapped = await createBrowserServerEvent("begin_checkout", { value: 299, currency: "BDT", email: "private@example.test" }, id, context);
  assert(mapped?.event_id === id && mapped.event_name === "InitiateCheckout");
  assert(!JSON.stringify(mapped?.custom_data).includes("private"));
  assert(!await createBrowserServerEvent("purchase", { transaction_id: "fake", value: 1 }, id, context));
  assert(!await createBrowserServerEvent("sign_up", { registration_id: "fake" }, id, context));
});

Deno.test("validates attribution, strips tokens from URLs, and never invents an ad click", () => {
  const context = normalizeMarketingContext({ source_url: "https://www.proshnolab.com/pricing?access_token=secret#state",
    fbp: "fb.1.1791900000000.123", fbc: "not-an-ad-click" }, new Request("https://function.test", { headers: { "x-forwarded-for": "203.0.113.42, 10.0.0.1" } }));
  assert(context.source_url === "https://www.proshnolab.com/pricing");
  assert(context.client_ip_address === "203.0.113.42" && !("fbc" in context));
  assert(normalizeMarketingContext({ source_url: "https://attacker.test/path" }).source_url === "https://www.proshnolab.com/");
});

Deno.test("hashes normalized matching identifiers and only includes email when enabled", async () => {
  assert(await hashIdentifier(" TEST ") === "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
  const context = normalizeMarketingContext({});
  const id = "44444444-4444-4444-8444-444444444444";
  const without = await createBrowserServerEvent("page_view", {}, id, context, { id: "user-id", email: "Private@Example.test" }, false);
  const withMatching = await createBrowserServerEvent("page_view", {}, id, context, { id: "user-id", email: "Private@Example.test" }, true);
  assert(!("em" in without!.user_data));
  assert(JSON.stringify(withMatching?.user_data).includes(await hashIdentifier("private@example.test")));
  assert(!JSON.stringify(withMatching).includes("Private@"));
});

Deno.test("uses the exact dataset string, durable event time, and an explicit test-event code", async () => {
  let captured: Record<string, unknown> = {};
  const result = await deliverMetaEvent(event, "mock-token", { testCode: "TEST-example", fetcher: async (url, init) => {
    assert(String(url) === "https://graph.facebook.com/v25.0/39691774247102448/events");
    assert(!String(url).includes("mock-token"));
    captured = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
  } });
  assert(result.delivered);
  const payload = (captured.data as Array<Record<string, unknown>>)[0];
  assert(payload.event_id === "purchase:TRX-test" && payload.event_time === event.event_time);
  assert(captured.test_event_code === "TEST-example");
});

Deno.test("requires Meta acceptance and distinguishes retries, bad data and invalid credentials", async () => {
  const respond = (body: unknown, status: number) => async () => new Response(JSON.stringify(body), { status });
  assert(!(await deliverMetaEvent(event, "mock", { fetcher: respond({ events_received: 0 }, 200) })).delivered);
  assert((await deliverMetaEvent(event, "mock", { fetcher: respond({ error: { code: 2 } }, 503) })).retryable);
  assert(!(await deliverMetaEvent(event, "mock", { fetcher: respond({ error: { code: 100 } }, 400) })).retryable);
  const auth = await deliverMetaEvent(event, "mock", { fetcher: respond({ error: { code: 190, message: "mock-secret" } }, 400) });
  assert(auth.authentication_error && !JSON.stringify(auth).includes("mock-secret"));
  const offline = await deliverMetaEvent(event, "mock", { fetcher: async () => { throw new Error("offline"); } });
  assert(offline.retryable && !offline.delivered);
});
