import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { deliverMetaEvent, normalizeMarketingContext, type QueuedMetaEvent } from "../_shared/metaCapi.ts";

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
Deno.serve(async req => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, key);
  const schedulerToken = req.headers.get("x-capi-worker-token");
  let authorized = false;
  if (schedulerToken) {
    const { data, error } = await admin.rpc("authorize_meta_capi_worker", { token: schedulerToken });
    authorized = !error && data === true;
  } else if (req.headers.get("authorization") === `Bearer ${key}`) authorized = true;
  if (!authorized) return json({ error: "Unauthorized" }, 401);
  const { data: settings, error: settingsError } = await admin.from("meta_capi_settings").select("enabled,delivery_paused").eq("singleton", true).single();
  if (settingsError) return json({ error: "Configuration unavailable" }, 503);
  const token = Deno.env.get("META_CAPI_ACCESS_TOKEN");
  const body = await req.json().catch(() => ({}));
  if (body.test === true) {
    const code = body.test_event_code || Deno.env.get("META_CAPI_TEST_EVENT_CODE");
    if (!token || typeof code !== "string" || !/^TEST[A-Za-z0-9_-]{1,80}$/.test(code)) return json({ error: "Test configuration required" }, 400);
    const context = normalizeMarketingContext({}, req);
    const result = await deliverMetaEvent({
      pixel_id: "39691774247102448", event_name: "CapiConnectionTest", event_id: `test:${crypto.randomUUID()}`,
      event_time: Math.floor(Date.now() / 1000), source_url: "https://www.proshnolab.com/", custom_data: {},
      user_data: { client_user_agent: context.user_agent, ...(context.client_ip_address ? { client_ip_address: context.client_ip_address } : {}) },
    }, token, { version: Deno.env.get("META_GRAPH_API_VERSION"), testCode: code });
    return json({ test: true, ...result }, result.delivered ? 200 : 502);
  }
  if (!settings.enabled || settings.delivery_paused || !token) return json({ active: false, configured: Boolean(token), paused: Boolean(settings.delivery_paused) });
  const { data: events, error } = await admin.rpc("claim_meta_capi_events", { batch_size: 10 });
  if (error) return json({ error: "Queue unavailable" }, 503);
  let delivered = 0;
  let authFailure = false;
  for (const event of (events || []) as Array<QueuedMetaEvent & { id: number; lease: string }>) {
    const result = authFailure ? { delivered: false, retryable: true, error_code: "delivery_paused" } : await deliverMetaEvent(event, token, {
      // Production conversions must never inherit an administrative test code.
      version: Deno.env.get("META_GRAPH_API_VERSION"),
    });
    const { error: finishError } = await admin.rpc("finish_meta_capi_event", {
      event_ref: event.id, lease_ref: event.lease, delivered: result.delivered, error_code: result.error_code || null, retryable: result.retryable,
    });
    if (finishError) console.error("meta_capi_queue_ack_failed");
    if (result.delivered) delivered++;
    if ("authentication_error" in result && result.authentication_error) {
      authFailure = true;
      await admin.from("meta_capi_settings").update({ delivery_paused: true }).eq("singleton", true);
    }
  }
  return json({ active: true, claimed: events?.length || 0, delivered, paused: authFailure });
});
