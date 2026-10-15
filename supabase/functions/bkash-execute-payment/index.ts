// bKash Tokenized Checkout: Execute Payment
// Called by /payment/callback after user returns from bKash. Finalizes payment
// and provisions subscriptions + user_permissions on success.

import { activateFixedPayment } from "../_shared/fixedPayment.ts";

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
      const fixed = Array.isArray(paymentRow.selected_packages) && paymentRow.selected_packages.length > 0 && paymentRow.selected_packages.every((p: any) => !p.kind);
      if (!fixed) return json({ status: "completed", trxID: paymentRow.trx_id, alreadyProcessed: true });
      const result = await activateFixedPayment(admin, paymentRow, paymentRow.bkash_response);
      if (result.ok) return json({ status: "completed", trxID: paymentRow.trx_id, alreadyProcessed: true });
      if (!result.verificationRequired) return json({ status: "activation_pending", error: "Payment received; access activation pending. Retry verification.", ...result }, 503);
      // Old completed rows may lack a receipt. Re-query the gateway below.
    }
    if (paymentRow.status === "failed" || paymentRow.status === "cancelled") {
      return json({ status: paymentRow.status, error: paymentRow.error_message ?? "পেমেন্ট ব্যর্থ" }, 400);
    }

    // Execute against bKash
    const token = await getBkashToken();
    const execRes = await fetch(`${BKASH_BASE_URL}/tokenized/checkout/${paymentRow.status === "completed" ? "payment/status" : "execute"}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: token,
        "X-App-Key": BKASH_APP_KEY,
      },
      body: JSON.stringify({ paymentID }),
    });
    let execData = await execRes.json();
    // A refreshed page may execute an already-settled payment. Query bKash
    // before treating an ambiguous execute response as failure.
    if (!(execData?.transactionStatus === "Completed" && execData?.trxID)) {
      const queryRes = await fetch(`${BKASH_BASE_URL}/tokenized/checkout/payment/status`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: token, "X-App-Key": BKASH_APP_KEY },
        body: JSON.stringify({ paymentID }),
      });
      const queryData = await queryRes.json();
      if (queryRes.ok && queryData?.transactionStatus === "Completed" && queryData?.trxID) execData = queryData;
    }

    const txStatus = execData?.transactionStatus;
    const isCompleted = txStatus === "Completed" && execData?.trxID;

    if (!isCompleted) {
      const msg = execData?.statusMessage || execData?.errorMessage || "পেমেন্ট সম্পন্ন হয়নি";
      await admin.from("bkash_payments").update({
        status: ["Failed", "Cancelled", "Expired"].includes(String(txStatus)) ? "failed" : "initiated",
        bkash_response: execData,
        error_message: msg,
      }).eq("id", paymentRow.id).eq("status", "initiated");
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

    if (Number(execData.amount) !== Number(paymentRow.amount) || execData.currency !== "BDT" || execData.paymentID !== paymentRow.payment_id) return json({ error: "Payment verification mismatch" }, 400);
    const customOrder = Array.isArray(paymentRow.selected_packages) && paymentRow.selected_packages.find((p: unknown) => p !== null && typeof p === "object" && "kind" in p && p.kind === "custom");
    if (customOrder) {
      const { data: subscriptionId, error } = await admin.rpc("complete_custom_payment", { payment_ref: paymentRow.id, receipt: execData });
      if (error) {
        // Keep the verified receipt so the admin query endpoint can retry
        // activation; never mark settled money as a failed payment.
        await admin.from("bkash_payments").update({ bkash_response: execData, trx_id: execData.trxID, error_message: "Access activation pending: " + error.message }).eq("id", paymentRow.id).eq("status", "initiated");
        return json({ status: "activation_pending", error: "Payment received; access activation pending. Retry or contact support." }, 503);
      }
      return json({ status: "completed", trxID: execData.trxID, kind: "custom", subscriptionId });
    }

    const paygOrder = Array.isArray(paymentRow.selected_packages) && paymentRow.selected_packages.find((p: any) => p.kind === "payg");
    if (paygOrder) {
      if (Number(execData.amount) !== Number(paymentRow.amount) || execData.currency !== "BDT") return json({ error: "Payment amount mismatch" }, 400);
      const { error } = await admin.from("bkash_payments").update({ status: "completed", trx_id: execData.trxID, bkash_response: execData }).eq("id", paymentRow.id);
      if (error) throw error;
      return json({ status: "completed", trxID: execData.trxID, kind: "payg" });
    }

    const selectedPkgs = paymentRow.selected_packages;
    const activated = await activateFixedPayment(admin, paymentRow, execData);
    if (!activated.ok) return json({ status: "activation_pending", error: "Payment received; access activation pending. Retry verification.", ...activated }, 503);

    if (paymentRow.status !== "completed") notifyTelegram({
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
