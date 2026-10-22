export const notificationCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const notificationJson = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...notificationCors, "Content-Type": "application/json" },
});
export async function authorizeNotificationScheduler(req: Request, key: string,
  verifyWorker: (token: string) => Promise<boolean>) {
  if (key && req.headers.get("authorization") === `Bearer ${key}`) return true;
  const token = req.headers.get("x-capi-worker-token");
  return token ? await verifyWorker(token) : false;
}
const escape = (value: unknown) => String(value ?? "").slice(0, 600)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function notificationMessage(payload: any): string {
  return [
    `<b>${escape(payload.title)}</b>`, `<i>${escape(payload.event_type)}</i>`, "",
    ...(payload.fields ?? []).map((field: any) => `<b>${escape(field.label)}:</b> ${escape(field.value)}`),
    "", `🕐 ${escape(new Date().toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" }))}`,
    `<a href="https://proshnolab.com/admin/${payload.event_type === "new_registration" ? "teachers" : "feedback"}">Admin</a>`,
  ].join("\n");
}

// Inject dependencies so authorization tests never send Telegram messages.
export function createNotificationHandler(deps: {
  serviceKey: string;
  getUser: (token: string) => Promise<{ id: string } | null>;
  claim: (actor: string, event: string, record: number | null) => Promise<any>;
  deliver: (text: string, claim: any) => Promise<void>;
}) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: notificationCors });
    if (req.method !== "POST") return notificationJson({ error: "Method not allowed" }, 405);
    const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return notificationJson({ error: "Unauthorized" }, 401);
    try {
      const internal = !!deps.serviceKey && token === deps.serviceKey;
      const user = internal ? null : await deps.getUser(token);
      if (!internal && !user) return notificationJson({ error: "Unauthorized" }, 401);
      const raw = await req.text();
      if (raw.length > 16000) return notificationJson({ error: "Payload too large" }, 413);
      let body: any;
      try { body = JSON.parse(raw); } catch { return notificationJson({ error: "Invalid JSON" }, 400); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return notificationJson({ error: "Invalid payload" }, 400);
      if (internal) {
        // Payment alerts belong exclusively to the verified-receipt worker.
        if (body.event_type !== "daily_summary" || typeof body.raw_text !== "string" || body.raw_text.length > 3800)
          return notificationJson({ error: "Event not allowed" }, 403);
        await deps.deliver(body.raw_text, null);
        return notificationJson({ ok: true });
      }
      if (!["new_registration", "new_feedback"].includes(body.event_type) || body.raw_text !== undefined)
        return notificationJson({ error: "Event not allowed" }, 403);
      if (body.record_id !== undefined && (!Number.isSafeInteger(body.record_id) || body.record_id <= 0))
        return notificationJson({ error: "Invalid record" }, 400);
      // Ignore browser-supplied titles, fields, links and teacher identities.
      const claim = await deps.claim(user!.id, body.event_type, body.record_id ?? null);
      if (!claim) return notificationJson({ error: "Record unavailable" }, 404);
      if (claim.rate_limited) return notificationJson({ error: "Too many notifications" }, 429);
      if (claim.duplicate) return notificationJson({ ok: true, duplicate: true });
      await deps.deliver(notificationMessage(claim.payload), claim);
      return notificationJson({ ok: true });
    } catch {
      console.error("notification_request_failed");
      return notificationJson({ error: "Notification unavailable" }, 503);
    }
  };
}
