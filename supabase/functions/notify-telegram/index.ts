// Reusable Telegram notifier — sends formatted messages to admin chat(s)
// via Lovable Telegram Connector Gateway.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

interface Field { label: string; value: string | number | null | undefined; }
interface Payload {
  event_type: string;
  title: string;
  fields?: Field[];
  link?: { label: string; url: string };
  raw_text?: string; // if provided, used as-is (no fields/title formatting)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtTime(): string {
  return new Date().toLocaleString("bn-BD", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function buildMessage(p: Payload): string {
  if (p.raw_text) return p.raw_text;
  const lines: string[] = [];
  lines.push(`<b>${escapeHtml(p.title)}</b>`);
  lines.push(`<i>${escapeHtml(p.event_type)}</i>`);
  lines.push("");
  for (const f of p.fields ?? []) {
    if (f.value === null || f.value === undefined || f.value === "") continue;
    lines.push(`<b>${escapeHtml(f.label)}:</b> ${escapeHtml(String(f.value))}`);
  }
  lines.push("");
  lines.push(`🕐 <b>Time:</b> ${escapeHtml(fmtTime())}`);
  if (p.link) lines.push(`🔗 <a href="${escapeHtml(p.link.url)}">${escapeHtml(p.link.label)}</a>`);
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    const CHAT_IDS_RAW = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID");
    if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) throw new Error("Telegram connector not configured");
    if (!CHAT_IDS_RAW) throw new Error("TELEGRAM_ADMIN_CHAT_ID not set");

    const payload = (await req.json()) as Payload;
    if (!payload?.event_type || (!payload.title && !payload.raw_text)) {
      return new Response(JSON.stringify({ error: "event_type and title/raw_text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = buildMessage(payload);
    const chatIds = CHAT_IDS_RAW.split(",").map((s) => s.trim()).filter(Boolean);

    const results: any[] = [];
    for (const chat_id of chatIds) {
      const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TELEGRAM_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
      const body = await res.text();
      if (!res.ok) console.error(`Telegram send failed [${res.status}] chat=${chat_id}: ${body}`);
      results.push({ chat_id, status: res.status, ok: res.ok });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notify-telegram error", e);
    return new Response(JSON.stringify({ error: e.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
