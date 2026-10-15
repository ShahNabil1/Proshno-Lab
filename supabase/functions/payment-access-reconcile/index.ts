import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { activateFixedPayment } from "../_shared/fixedPayment.ts";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
Deno.serve(async req => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, key);
  let authorized = req.headers.get("authorization") === `Bearer ${key}`;
  const schedulerToken = req.headers.get("x-capi-worker-token");
  if (!authorized && schedulerToken) {
    const { data, error } = await admin.rpc("authorize_meta_capi_worker", { token: schedulerToken });
    authorized = !error && data === true;
  }
  if (!authorized) return json({ error: "Unauthorized" }, 401);
  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: payments, error } = await admin.from("bkash_payments").select("*")
    .in("status", ["initiated", "completed"])
    .or("status.eq.initiated,access_checked_at.is.null,error_message.like.Access activation pending*")
    .or(`access_checked_at.is.null,access_checked_at.lt.${cutoff}`)
    .lt("created_at", new Date(Date.now() - 60_000).toISOString())
    .order("access_checked_at", { ascending: true, nullsFirst: true }).order("id", { ascending: true }).limit(10);
  if (error) return json({ error: "Payment queue unavailable" }, 503);
  let activated = 0, pending = 0;
  let token: string | undefined;
  const base = Deno.env.get("BKASH_BASE_URL")!;
  async function query(paymentID: string) {
    if (!token) {
      const response = await fetch(`${base}/tokenized/checkout/token/grant`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", username: Deno.env.get("BKASH_USERNAME")!, password: Deno.env.get("BKASH_PASSWORD")! }, body: JSON.stringify({ app_key: Deno.env.get("BKASH_APP_KEY"), app_secret: Deno.env.get("BKASH_APP_SECRET") }) });
      const data = await response.json();
      if (!response.ok || !data.id_token) throw new Error("Gateway authentication unavailable");
      token = data.id_token;
    }
    const response = await fetch(`${base}/tokenized/checkout/payment/status`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: token!, "X-App-Key": Deno.env.get("BKASH_APP_KEY")! }, body: JSON.stringify({ paymentID }) });
    if (!response.ok) throw new Error("Gateway query unavailable");
    return response.json();
  }
  for (const payment of payments || []) {
    try {
      // Rotate the queue even when a gateway or order needs attention.
      const { error: stampError } = await admin.from("bkash_payments").update({ access_checked_at: new Date().toISOString() }).eq("id", payment.id);
      if (stampError) throw stampError;
      if (!payment.payment_id) continue;
      let receipt = payment.bkash_response;
      const valid = receipt?.transactionStatus === "Completed" && receipt?.trxID && receipt.paymentID === payment.payment_id && receipt.currency === "BDT" && Number(receipt.amount) === Number(payment.amount);
      if (!valid) receipt = await query(payment.payment_id);
      if (receipt?.transactionStatus !== "Completed") continue;
      const items = payment.selected_packages;
      if (!Array.isArray(items) || !items.length) { pending++; continue; }
      if (items.some((p: any) => p.kind === "custom")) {
        const { error } = await admin.rpc("complete_custom_payment", { payment_ref: payment.id, receipt });
        if (error) { pending++; continue; }
      } else if (items.some((p: any) => p.kind === "payg")) {
        // PAYG has no subscriptions; leave its existing checkout flow intact.
        continue;
      } else {
        const result = await activateFixedPayment(admin, payment, receipt);
        if (!result.ok) { pending++; continue; }
      }
      activated++;
    } catch { pending++; console.error("payment_access_reconciliation_failed", payment.id); }
  }
  return json({ checked: payments?.length || 0, activated, pending });
});
