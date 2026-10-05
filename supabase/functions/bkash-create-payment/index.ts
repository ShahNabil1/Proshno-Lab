import { preparePayg } from "../_shared/payg.ts";
// bKash Tokenized Checkout: Create Payment
// Called by frontend to initiate a bKash payment. Returns paymentID + bkashURL.

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

// simple in-memory token cache (per-warm-instance)
let cachedToken: { id_token: string; expires_at: number } | null = null;

async function getBkashToken(): Promise<string> {
  if (cachedToken && cachedToken.expires_at > Date.now() + 60_000) {
  return cachedToken.id_token;
  }
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
  if (!res.ok || !data.id_token) {
  throw new Error(`Token grant failed: ${JSON.stringify(data)}`);
  }
  cachedToken = {
  id_token: data.id_token,
  expires_at: Date.now() + (Number(data.expires_in ?? 3500) * 1000),
  };
  return cachedToken.id_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

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

    const body = await req.json();
    const {
      selected_packages,
      payg,
      coupon_code,
      phone,
      institute_name,
      teacher_name,
      callback_origin,
    } = body ?? {};

    if (!payg && (!Array.isArray(selected_packages) || selected_packages.length === 0)) {
      return json({ error: "প্যাকেজ সিলেক্ট করুন" }, 400);
    }
    if (!phone || !/^01[3-9]\d{8}$/.test(String(phone))) {
      return json({ error: "সঠিক বাংলাদেশি ফোন নম্বর দিন" }, 400);
    }

    // Compute amount server-side using DB prices
    let baseAmount = 0;
    const resolvedPackages: any[] = [];
    if (payg) {
      const order = await preparePayg(admin, payg);
      baseAmount = order.price;
      resolvedPackages.push(order);
    } else {
    const ids = selected_packages.map((p: any) => Number(p.id)).filter(Boolean);
    if (ids.length > 0) {
      const { data: pkgs } = await admin
        .from("pricing_packages")
        .select("id, class_name, subject_name, price")
        .in("id", ids);
      for (const sel of selected_packages) {
        const match = pkgs?.find((p: any) => p.id === Number(sel.id));
        if (!match) return json({ error: `প্যাকেজ পাওয়া যায়নি: ${sel.id}` }, 400);
        baseAmount += Number(match.price);
        resolvedPackages.push({
          id: match.id,
          class_name: match.class_name,
          subject_name: match.subject_name,
          price: Number(match.price),
        });
      }
    } else {
      // Fallback: trust client-provided prices only when no id (should not happen)
      for (const sel of selected_packages) {
        baseAmount += Number(sel.price ?? 0);
        resolvedPackages.push(sel);
      }
    }

    }

    // Validate coupon
    let discount = 0;
    let normalizedCoupon: string | null = null;
    if (coupon_code && !payg) {
      const code = String(coupon_code).trim().toUpperCase();
      const { data: c } = await admin.from("coupons").select("*").eq("code", code).eq("is_active", true).maybeSingle();
      if (!c) return json({ error: "কুপন কোড সঠিক নয়" }, 400);
      if (c.expires_at && new Date(c.expires_at) < new Date()) return json({ error: "কুপনের মেয়াদ শেষ" }, 400);
      if (c.use_limit !== null && c.used_count >= c.use_limit) return json({ error: "কুপনের ব্যবহার সীমা শেষ" }, 400);
      if (baseAmount < Number(c.min_purchase ?? 0)) return json({ error: `ন্যূনতম ক্রয় ৳${c.min_purchase} প্রয়োজন` }, 400);
      if (c.discount_type === "percentage") {
        discount = Math.round((baseAmount * Number(c.discount_value)) / 100);
        if (c.max_discount && discount > Number(c.max_discount)) discount = Number(c.max_discount);
      } else {
        discount = Number(c.discount_value);
      }
      discount = Math.min(discount, baseAmount);
      normalizedCoupon = code;
    }

    const finalAmount = Math.max(0, baseAmount - discount);
    if (finalAmount <= 0) return json({ error: "পরিশোধযোগ্য পরিমাণ শূন্য" }, 400);

    const merchantInvoiceNumber = `PL${user.id.slice(0, 8)}${Date.now().toString(36).toUpperCase()}`;

    // Get bKash token
    const token = await getBkashToken();

    const origin = (callback_origin as string) || req.headers.get("origin") || "";
    const callbackURL = `${origin.replace(/\/$/, "")}/payment/callback${payg ? "?payg=1" : ""}`;

    const createRes = await fetch(`${BKASH_BASE_URL}/tokenized/checkout/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: token,
        "X-App-Key": BKASH_APP_KEY,
      },
      body: JSON.stringify({
        mode: "0011",
        payerReference: String(phone),
        callbackURL,
        amount: finalAmount.toFixed(2),
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber,
      }),
    });
    const createData = await createRes.json();

    if (!createRes.ok || !createData.paymentID || !createData.bkashURL) {
      console.error("bKash create failed", createData);
      return json({ error: `bKash create ব্যর্থ: ${createData?.statusMessage || createData?.errorMessage || "Unknown"}`, details: createData }, 502);
    }

    // Persist initiated row
    const environment = BKASH_BASE_URL.includes("sandbox") ? "sandbox" : "live";
    const { error: insErr } = await admin.from("bkash_payments").insert({
      user_id: user.id,
      payment_id: createData.paymentID,
      merchant_invoice_number: merchantInvoiceNumber,
      amount: finalAmount,
      discount,
      coupon_code: normalizedCoupon,
      selected_packages: resolvedPackages,
      payer_reference: String(phone),
      institute_name: institute_name || null,
      teacher_name: teacher_name || null,
      teacher_email: user.email || null,
      status: "initiated",
      bkash_response: createData,
      environment,
    });
    if (insErr) {
      console.error("Persist initiated payment failed", insErr);
      return json({ error: "ডাটাবেসে পেমেন্ট সংরক্ষণ ব্যর্থ" }, 500);
    }

    return json({ paymentID: createData.paymentID, bkashURL: createData.bkashURL });
  } catch (e: any) {
    console.error("bkash-create-payment error", e);
    return json({ error: e.message ?? "Unknown error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
