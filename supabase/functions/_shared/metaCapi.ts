import { createMetaEvent } from "../../../src/lib/metaEvents.ts";

export const LIVE_ORIGINS = new Set(["https://www.proshnolab.com", "https://proshnolab.com"]);
export function normalizeMarketingContext(input: unknown, req?: Request) {
  const context = input && typeof input === "object" ? input as Record<string, unknown> : {};
  let source_url = "https://www.proshnolab.com/";
  if (typeof context.source_url === "string") {
    try {
      const url = new URL(context.source_url);
      if (LIVE_ORIGINS.has(url.origin)) source_url = `${url.origin}${url.pathname}`;
    } catch { /* canonical fallback */ }
  }
  const user_agent = typeof context.user_agent === "string" ? context.user_agent.slice(0, 512) : (req?.headers.get("user-agent") || "").slice(0, 512);
  const ip = (req?.headers.get("cf-connecting-ip") || req?.headers.get("x-forwarded-for")?.split(",")[0] || "").trim();
  const validIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) ? ip.split(".").every(n => Number(n) <= 255) : /^[0-9a-f:]{3,45}$/i.test(ip) && ip.includes(":");
  return {
    source_url, user_agent,
    ...(validIp ? { client_ip_address: ip } : {}),
    ...(typeof context.fbp === "string" && /^fb\.\d+\.\d{13}\.\d{1,20}$/.test(context.fbp) ? { fbp: context.fbp } : {}),
    ...(typeof context.fbc === "string" && /^fb\.\d+\.\d{13}\.[A-Za-z0-9_-]{10,500}$/.test(context.fbc) ? { fbc: context.fbc } : {}),
  };
}

export async function hashIdentifier(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.trim().toLowerCase()));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function createBrowserServerEvent(name: string, params: Record<string, unknown>, eventId: string, context: ReturnType<typeof normalizeMarketingContext>, user?: { id: string; email?: string }, matching = false) {
  // Purchases and registrations are queued by authoritative DB triggers only.
  if (name === "purchase" || name === "sign_up" || !/^[a-f0-9-]{36}$/i.test(eventId)) return;
  const mapped = createMetaEvent(name, params, eventId);
  if (!mapped) return;
  const user_data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (key === "source_url") continue;
    user_data[key === "user_agent" ? "client_user_agent" : key] = value;
  }
  if (matching && user) {
    user_data.external_id = [await hashIdentifier(user.id)];
    if (user.email) user_data.em = [await hashIdentifier(user.email)];
  }
  return { ...mapped, source_url: context.source_url, user_data };
}

export interface QueuedMetaEvent {
  pixel_id: string; event_name: string; event_id: string; event_time: number;
  source_url: string; user_data: Record<string, unknown>; custom_data: Record<string, unknown>;
}
export interface DeliveryResult { delivered: boolean; retryable: boolean; error_code?: string; authentication_error?: boolean; }

export async function deliverMetaEvent(event: QueuedMetaEvent, token: string, options: { version?: string; testCode?: string; fetcher?: typeof fetch } = {}): Promise<DeliveryResult> {
  const version = options.version || "v25.0";
  if (!/^v\d+\.0$/.test(version) || !/^\d+$/.test(event.pixel_id)) return { delivered: false, retryable: false, error_code: "invalid_configuration" };
  const body = {
    access_token: token,
    data: [{ event_name: event.event_name, event_id: event.event_id, event_time: Number(event.event_time),
      action_source: "website", event_source_url: event.source_url, user_data: event.user_data, custom_data: event.custom_data }],
    ...(options.testCode ? { test_event_code: options.testCode } : {}),
  };
  try {
    const response = await (options.fetcher || fetch)(`https://graph.facebook.com/${version}/${event.pixel_id}/events`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
    });
    const result = await response.json();
    if (response.ok && result.events_received === 1 && !result.error) return { delivered: true, retryable: false };
    const code = Number(result.error?.code || 0);
    const authentication_error = code === 190 || response.status === 401 || response.status === 403;
    return { delivered: false, retryable: authentication_error || response.ok || response.status === 429 || response.status >= 500 || [1,2,4,17,32,613].includes(code) || Boolean(result.error?.is_transient),
      authentication_error, error_code: `meta_http_${response.status}_code_${code}` };
  } catch {
    // Never log request bodies, access tokens, or customer identifiers.
    return { delivered: false, retryable: true, error_code: "meta_network_error" };
  }
}
