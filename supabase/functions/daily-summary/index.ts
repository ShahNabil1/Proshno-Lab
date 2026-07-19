// Daily summary — invoked by pg_cron every night at 11 PM Asia/Dhaka (17:00 UTC).
// Aggregates today's registrations, revenue, and questions and sends to Telegram.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function dhakaDayBounds(): { start: string; end: string; label: string } {
  // Asia/Dhaka is UTC+6, no DST
  const now = new Date();
  const dhakaNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const y = dhakaNow.getUTCFullYear();
  const m = dhakaNow.getUTCMonth();
  const d = dhakaNow.getUTCDate();
  // Start of Dhaka day (00:00 Dhaka = -6h UTC)
  const startUtc = new Date(Date.UTC(y, m, d, -6, 0, 0));
  const endUtc = new Date(Date.UTC(y, m, d, 18, 0, 0)); // 24:00 Dhaka
  const label = dhakaNow.toLocaleDateString("bn-BD", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return { start: startUtc.toISOString(), end: endUtc.toISOString(), label };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { start, end, label } = dhakaDayBounds();

    const [regs, pays, qs, feeds, reports] = await Promise.all([
      supabase.from("institutes").select("id", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end),
      supabase.from("bkash_payments").select("amount, status, created_at").gte("created_at", start).lt("created_at", end),
      supabase.from("questions").select("id", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end),
      supabase.from("feedback").select("id", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end),
      supabase.from("question_reports" as any).select("id", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end),
    ]);

    const payRows = pays.data ?? [];
    const completed = payRows.filter((p: any) => p.status === "completed");
    const totalRevenue = completed.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const failedCount = payRows.filter((p: any) => p.status === "failed" || p.status === "cancelled").length;
    const initiatedCount = payRows.filter((p: any) => p.status === "initiated").length;

    // Send via notify-telegram
    const raw = [
      `📊 <b>Daily Summary — Proshno Lab</b>`,
      `📅 ${label}`,
      ``,
      `👤 <b>New registrations:</b> ${regs.count ?? 0}`,
      `💰 <b>Revenue (completed):</b> ৳${totalRevenue.toLocaleString("bn-BD")} (${completed.length} txn)`,
      `❌ <b>Failed / Cancelled:</b> ${failedCount}`,
      `⏳ <b>Initiated (pending):</b> ${initiatedCount}`,
      `📝 <b>Questions created:</b> ${qs.count ?? 0}`,
      `💬 <b>Feedback:</b> ${feeds.count ?? 0}`,
      `🚩 <b>Question reports:</b> ${reports.count ?? 0}`,
      ``,
      `🔗 <a href="https://proshnolab.com/admin">Admin Panel</a>`,
    ].join("\n");

    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-telegram`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ event_type: "daily_summary", title: "Daily Summary", raw_text: raw }),
    });
    const body = await res.text();
    return new Response(JSON.stringify({ ok: res.ok, telegram: body }), {
      status: res.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("daily-summary error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
