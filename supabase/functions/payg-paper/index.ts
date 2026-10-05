import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const json = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers });
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { paymentID } = await req.json();
    const { data: payment } = await admin.from("bkash_payments").select("*").eq("payment_id", paymentID).eq("user_id", user.id).maybeSingle();
    const order = payment?.selected_packages?.find((p: any) => p.kind === "payg");
    if (!order || payment.status !== "completed" || !payment.trx_id) return json({ error: "Verified payment required" }, 403);
    // Re-query bKash, rather than accepting a client-writable status field.
    const base = Deno.env.get("BKASH_BASE_URL")!;
    const tokenResponse = await fetch(`${base}/tokenized/checkout/token/grant`, { method: "POST", headers: { "Content-Type": "application/json", username: Deno.env.get("BKASH_USERNAME")!, password: Deno.env.get("BKASH_PASSWORD")! }, body: JSON.stringify({ app_key: Deno.env.get("BKASH_APP_KEY"), app_secret: Deno.env.get("BKASH_APP_SECRET") }) });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.id_token) throw new Error("Payment verification unavailable");
    const verified = await fetch(`${base}/tokenized/checkout/payment/status`, { method: "POST", headers: { Authorization: token.id_token, "X-App-Key": Deno.env.get("BKASH_APP_KEY")!, "Content-Type": "application/json" }, body: JSON.stringify({ paymentID }) });
    const result = await verified.json();
    if (!verified.ok || result.transactionStatus !== "Completed" || Number(result.amount) !== Number(order.price) || result.trxID !== payment.trx_id) return json({ error: "Payment verification failed" }, 403);
    const { data: rows, error } = await admin.from("questions").select("*").in("id", order.question_ids);
    if (error || rows?.length !== order.question_ids.length) return json({ error: "Paid questions unavailable; contact support with your transaction ID" }, 409);
    const byId = new Map(rows.map((q: any) => [q.id, q]));
    const { data: institute } = await admin.from("institutes").select("*").eq("owner_id", user.id).order("id").limit(1).maybeSingle();
    return json({ questions: order.question_ids.map((id: number) => byId.get(id)), context: { classId: order.class_ids.join(","), subjectId: order.subject_ids.join(","), chapterIds: order.chapter_ids.map(String) }, meta: { className: order.class_name, subjectName: order.subject_name, chapterNames: order.chapter_names, instituteName: institute?.name || "", instituteUpazila: institute?.upazila || "", instituteDistrict: institute?.district || "", institutePhone: institute?.phone || "", teacherName: user.user_metadata?.full_name || user.email, programName: "", topicNames: [] } });
  } catch (e: any) { return json({ error: e.message }, 500); }
});
