// bKash Tokenized Checkout: Execute Payment
// Called by /payment/callback after user returns from bKash. Finalizes payment
// and provisions subscriptions + user_permissions on success.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BKASH_BASE_URL = Deno.env.get("BKASH_BASE_URL")!;
const BKASH_APP_KEY = Deno.env.get("BKASH_APP_KEY")!;
const BKASH_APP_SECRET = Deno.env.get("BKASH_APP_SECRET")!;
const BKASH_USERNAME = Deno.env.get("BKASH_USERNAME")!;
const BKASH_PASSWORD = Deno.env.get("BKASH_PASSWORD")!;

async function notifyTelegram(payload: Record<string, unknown>) {
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-telegram`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) { console.error("notifyTelegram failed", e); }
}

let cachedToken: { id_token: string; expires_at: number } | null = null;

async function getBkashToken(): Promise<string> {
  if (cachedToken && cachedToken.expires_at > Date.now() + 60_000) return cachedToken.id_token;
  const res = await fetch(`${BKASH_BASE_URL}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: BKASH_USERNAME,
      password: BKASH_PASSWORD,
    },
    body: JSON.stringify({ app_key: BKASH_APP_KEY, app_secret: BKASH_APP_SECRET }),
  });
  const data = await res.json();
  if (!res.ok || !data.id_token) throw new Error(`Token grant failed: ${JSON.stringify(data)}`);
  cachedToken = { id_token: data.id_token, expires_at: Date.now() + (Number(data.expires_in ?? 3500) * 1000) };
  return cachedToken.id_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;
    const admin = createClient(supabaseUrl, serviceKey);

    const { paymentID } = await req.json();
    if (!paymentID) return json({ error: "paymentID required" }, 400);

    // Fetch our payment row
    const { data: paymentRow } = await admin
      .from("bkash_payments")
      .select("*")
      .eq("payment_id", paymentID)
      .maybeSingle();

    if (!paymentRow) return json({ error: "পেমেন্ট রেকর্ড পাওয়া যায়নি" }, 404);
    if (paymentRow.user_id !== user.id) return json({ error: "Forbidden" }, 403);

    // Idempotent: already completed → return existing success
    if (paymentRow.status === "completed") {
      return json({ status: "completed", trxID: paymentRow.trx_id, alreadyProcessed: true });
    }
    if (paymentRow.status === "failed" || paymentRow.status === "cancelled") {
      return json({ status: paymentRow.status, error: paymentRow.error_message ?? "পেমেন্ট ব্যর্থ" }, 400);
    }

    // Execute against bKash
    const token = await getBkashToken();
    const execRes = await fetch(`${BKASH_BASE_URL}/tokenized/checkout/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: token,
        "X-App-Key": BKASH_APP_KEY,
      },
      body: JSON.stringify({ paymentID }),
    });
    const execData = await execRes.json();

    const txStatus = execData?.transactionStatus;
    const isCompleted = execRes.ok && txStatus === "Completed" && execData?.trxID;

    if (!isCompleted) {
      const msg = execData?.statusMessage || execData?.errorMessage || "পেমেন্ট সম্পন্ন হয়নি";
      await admin.from("bkash_payments").update({
        status: "failed",
        bkash_response: execData,
        error_message: msg,
      }).eq("id", paymentRow.id);
      notifyTelegram({
        event_type: "payment_failed",
        title: "❌ পেমেন্ট Failed — bKash",
        fields: [
          { label: "👤 User", value: user.email },
          { label: "🏫 Institute", value: paymentRow.institute_name },
          { label: "💰 Amount", value: `৳${paymentRow.amount}` },
          { label: "🆔 Payment ID", value: paymentRow.payment_id },
          { label: "⚠️ Reason", value: msg },
        ],
        link: { label: "Admin → Subscriptions", url: "https://proshnolab.com/admin/subscriptions" },
      });
      return json({ status: "failed", error: msg, details: execData }, 400);
    }

    const paygOrder = Array.isArray(paymentRow.selected_packages) && paymentRow.selected_packages.find((p: any) => p.kind === "payg");
    if (paygOrder) {
      if (Number(execData.amount) !== Number(paymentRow.amount) || execData.currency !== "BDT") return json({ error: "Payment amount mismatch" }, 400);
      const { error } = await admin.from("bkash_payments").update({ status: "completed", trx_id: execData.trxID, bkash_response: execData }).eq("id", paymentRow.id);
      if (error) throw error;
      return json({ status: "completed", trxID: execData.trxID, kind: "payg" });
    }

    // Success — provision subscriptions and permissions
    const selectedPkgs = Array.isArray(paymentRow.selected_packages) ? paymentRow.selected_packages : [];
    const endsAt = new Date();
    endsAt.setFullYear(endsAt.getFullYear() + 1);

    for (const pkg of selectedPkgs) {
      const className = pkg.class_name as string;
      const subjectName = pkg.subject_name as string;
      const planName = `${className} - ${subjectName}`;

      const { data: subIns } = await admin.from("subscriptions").insert({
        teacher_id: user.id,
        plan: planName,
        status: "active",
        starts_at: new Date().toISOString(),
        ends_at: endsAt.toISOString(),
        bkash_payment_id: paymentRow.id,
      }).select("id").maybeSingle();

      const { data: classRow } = await admin.from("classes").select("id").eq("name", className).maybeSingle();
      if (!classRow) continue;

      if (subjectName === "সকল বিষয়" || subjectName.includes("সকল বিষয়")) {
        const { data: allSubjects } = await admin.from("subjects").select("id").eq("class_id", classRow.id);
        for (const sub of allSubjects ?? []) {
          const { data: existing } = await admin.from("user_permissions").select("id")
            .eq("user_id", user.id).eq("class_id", classRow.id).eq("subject_id", sub.id).maybeSingle();
          if (!existing) {
            await admin.from("user_permissions").insert({ user_id: user.id, class_id: classRow.id, subject_id: sub.id });
          }
        }
      } else {
        const { data: subjectRow } = await admin.from("subjects").select("id")
          .eq("class_id", classRow.id).eq("name", subjectName).maybeSingle();
        if (subjectRow) {
          const { data: existing } = await admin.from("user_permissions").select("id")
            .eq("user_id", user.id).eq("class_id", classRow.id).eq("subject_id", subjectRow.id).maybeSingle();
          if (!existing) {
            await admin.from("user_permissions").insert({ user_id: user.id, class_id: classRow.id, subject_id: subjectRow.id });
          }
        }
      }
    }

    // Increment coupon usage
    if (paymentRow.coupon_code) {
      await admin.rpc("increment_coupon_usage", { coupon_code: paymentRow.coupon_code });
    }

    await admin.from("bkash_payments").update({
      status: "completed",
      trx_id: execData.trxID,
      payer_account: execData.payerAccount ?? null,
      customer_msisdn: execData.customerMsisdn ?? null,
      bkash_response: execData,
    }).eq("id", paymentRow.id);

    notifyTelegram({
      event_type: "payment_success",
      title: "✅ পেমেন্ট Success — bKash",
      fields: [
        { label: "👤 Teacher", value: paymentRow.teacher_name || user.email },
        { label: "📧 Email", value: user.email },
        { label: "📱 Phone", value: paymentRow.phone },
        { label: "🏫 Institute", value: paymentRow.institute_name },
        { label: "💰 Amount", value: `৳${execData.amount}` },
        { label: "🧾 TrxID", value: execData.trxID },
        { label: "🎟️ Coupon", value: paymentRow.coupon_code || "—" },
        { label: "📦 Packages", value: selectedPkgs.map((p: any) => `${p.class_name} — ${p.subject_name}`).join(" | ") },
      ],
      link: { label: "Admin → Subscriptions", url: "https://proshnolab.com/admin/subscriptions" },
    });

    return json({ status: "completed", trxID: execData.trxID, amount: execData.amount });
  } catch (e: any) {
    console.error("bkash-execute-payment error", e);
    return json({ error: e.message ?? "Unknown error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
