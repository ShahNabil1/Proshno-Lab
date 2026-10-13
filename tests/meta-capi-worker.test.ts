const capturedHandlers: Array<(req: Request) => Promise<Response>> = [];
const originalServe = Deno.serve;
Object.defineProperty(Deno, "serve", { configurable: true, value: (handler: (req: Request) => Promise<Response>) => { capturedHandlers.push(handler); return {}; } });
Deno.env.set("SUPABASE_URL", "https://database.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "mock-service-key");
await import("../supabase/functions/meta-capi-worker/index.ts");
Object.defineProperty(Deno, "serve", { value: originalServe });
const handler = capturedHandlers[0];
const assert = (condition: unknown) => { if (!condition) throw new Error("Assertion failed"); };
const request = (body: unknown = {}, authorized = true) => new Request("https://function.test", {
  method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json", ...(authorized ? { "x-capi-worker-token": "mock-scheduler-key" } : {}), "x-forwarded-for": "203.0.113.10", "user-agent": "CAPI test client" },
});

function mock(settings = { enabled: true, delivery_paused: false }, graphCode = 0) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ url, body });
    const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
    if (url.includes("/rpc/authorize_meta_capi_worker")) return response(body.token === "mock-scheduler-key");
    if (url.includes("/meta_capi_settings")) return response(settings);
    if (url.includes("/rpc/claim_meta_capi_events")) return response([{ id: 1, lease: "mock-lease", pixel_id: "39691774247102448", event_name: "PageView", event_id: "real-shared-browser-id", event_time: 1791900000, source_url: "https://www.proshnolab.com/", user_data: { client_ip_address: "203.0.113.10", client_user_agent: "test" }, custom_data: {} }]);
    if (url.includes("/rpc/finish_meta_capi_event")) return response(null);
    if (url.startsWith("https://graph.facebook.com/")) return graphCode ? response({ error: { code: graphCode } }, 400) : response({ events_received: 1 });
    throw new Error(`Unmocked request: ${url}`);
  };
  return calls;
}

Deno.test("worker rejects unauthenticated requests before reading the event queue", async () => {
  const calls = mock();
  const response = await handler(request({}, false));
  assert(response.status === 401 && calls.length === 0);
});

Deno.test("missing Meta token leaves the durable queue unclaimed", async () => {
  Deno.env.delete("META_CAPI_ACCESS_TOKEN");
  const calls = mock();
  const response = await handler(request());
  assert((await response.json()).configured === false);
  assert(!calls.some(call => call.url.includes("claim_meta_capi_events")));
});

Deno.test("production delivery does not inherit a test-event environment variable", async () => {
  Deno.env.set("META_CAPI_ACCESS_TOKEN", "mock-token");
  Deno.env.set("META_CAPI_TEST_EVENT_CODE", "TEST-example");
  const calls = mock();
  const result = await (await handler(request())).json();
  assert(result.delivered === 1);
  const graph = calls.find(call => call.url.startsWith("https://graph.facebook.com/"))!;
  assert(!("test_event_code" in graph.body));
  assert(calls.find(call => call.url.includes("finish_meta_capi_event"))?.body.delivered === true);
});

Deno.test("administrative connection tests use an explicit code and never claim production conversions", async () => {
  const calls = mock({ enabled: false, delivery_paused: false });
  const result = await (await handler(request({ test: true, test_event_code: "TEST-example" }))).json();
  assert(result.test === true && result.delivered === true);
  assert(!calls.some(call => call.url.includes("claim_meta_capi_events")));
  const graph = calls.find(call => call.url.startsWith("https://graph.facebook.com/"))!;
  assert(graph.body.test_event_code === "TEST-example");
  assert((graph.body.data as Array<Record<string, unknown>>)[0].event_name === "CapiConnectionTest");
});

Deno.test("credential failures pause delivery and retain events for recovery", async () => {
  const calls = mock(undefined, 190);
  const result = await (await handler(request())).json();
  assert(result.paused === true && result.delivered === 0);
  assert(calls.some(call => call.body.delivery_paused === true));
  const finish = calls.find(call => call.url.includes("finish_meta_capi_event"))!;
  assert(finish.body.delivered === false && finish.body.retryable === true);
});
