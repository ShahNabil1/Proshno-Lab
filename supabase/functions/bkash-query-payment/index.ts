// bKash Tokenized Checkout: Query Payment Status
// Safety-net endpoint for admin/user to reconcile stuck "initiated" rows.

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

async function getBkashToken(): Promise<string> {
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
  return data.id_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    // Admin-only
    const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const admin = createClient(supabaseUrl, serviceKey);
    const { paymentID } = await req.json();
    if (!paymentID) return json({ error: "paymentID required" }, 400);

    const token = await getBkashToken();
    const res = await fetch(`${BKASH_BASE_URL}/tokenized/checkout/payment/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: token,
        "X-App-Key": BKASH_APP_KEY,
      },
      body: JSON.stringify({ paymentID }),
    });
    const data = await res.json();

    // Persist snapshot + reconcile status on the row
    const txStatus = String(data?.transactionStatus || data?.statusMessage || "").toLowerCase();
    const patch: Record<string, any> = { bkash_response: data };
    if (data?.statusCode === "0000" && txStatus.includes("complet")) {
      patch.status = "completed";
      if (data.trxID) patch.trx_id = data.trxID;
    } else if (txStatus.includes("cancel")) {
      patch.status = "cancelled";
    } else if (
      (data?.statusCode && data.statusCode !== "0000" && !txStatus.includes("initiat")) ||
      txStatus.includes("fail") || txStatus.includes("expire")
    ) {
      patch.status = "failed";
      patch.error_message = data?.statusMessage || data?.errorMessage || "bKash reported failure";
    }
    await admin.from("bkash_payments").update(patch).eq("payment_id", paymentID);

    return json({ ok: res.ok, data, newStatus: patch.status || "initiated" }, res.ok ? 200 : 502);
  } catch (e: any) {
    console.error("bkash-query-payment error", e);
    return json({ error: e.message ?? "Unknown error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
