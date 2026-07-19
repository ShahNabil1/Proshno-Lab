## লক্ষ্য

`purchase_requests` + admin approval + manual "Send Money → trxID" ফ্লো সম্পূর্ণ বাদ। বদলে **bKash Tokenized Checkout (PGW)** — user "এখনই কিনুন" চাপলে bKash-এর hosted page-এ গিয়ে PIN দিয়ে পেমেন্ট করবে, callback URL-এ ফিরে এলে আমাদের edge function **Execute Payment** কল করে bKash-এর sync response দেখে সঙ্গে সঙ্গে subscription + permissions activate করবে। কোনো webhook লাগবে না — Execute Payment-এর response-ই final confirmation।

---

## bKash Tokenized Checkout ফ্লো (ডকুমেন্টেশন অনুযায়ী)

```text
Client                        Our Edge Fn                       bKash Sandbox
  │  "এখনই কিনুন" ক্লিক  →      │
  │                              │  POST /token/grant  →           │  id_token (3600s)
  │                              │  POST /tokenized/checkout/create│  paymentID + bkashURL
  │  ← paymentID + bkashURL     │                                  │
  │──── redirect → bkashURL ───────────────────────────────────────►│
  │                              │        (user PIN → OTP)          │
  │◄──── redirect back: /payment/callback?paymentID=…&status=success│
  │  → POST /bkash-execute {paymentID}                              │
  │                              │  POST /tokenized/checkout/execute│  trxID + transactionStatus=Completed
  │                              │  ✔ create subscriptions/perms   │
  │  ← success                  │                                  │
```

সব credential (`BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_BASE_URL`) Supabase secret-এ থাকবে। এখন sandbox value (`https://tokenized.sandbox.bka.sh/v1.2.0-beta`) দিয়ে টেস্ট, পরে শুধু secret আপডেট করলেই live হবে।

---

## Database changes (single migration)

1. নতুন টেবিল `public.bkash_payments`:
  - `id bigserial pk`, `user_id uuid`, `payment_id text unique` (bKash-এর paymentID), `merchant_invoice_number text unique`, `trx_id text`, `amount numeric`, `discount numeric`, `coupon_code text`, `selected_packages jsonb`, `payer_reference text`, `status text` (`initiated|completed|failed|cancelled`), `bkash_response jsonb`, `created_at`, `updated_at`
  - GRANTS: `authenticated` SELECT own, `service_role` ALL
  - RLS: user নিজের row দেখতে পাবে; insert/update শুধু edge function (service role)
2. `subscriptions`-এ optional `bkash_payment_id bigint` FK যোগ (audit trail-এর জন্য)।
3. `purchase_requests` টেবিল **রাখা হবে read-only archive হিসেবে** (পুরনো ডাটা যাতে অ্যাডমিন দেখতে পারে); নতুন কোনো row আর যাবে না। Admin sidebar থেকে "Purchase Requests" মেনু সরিয়ে "Payment History" (নতুন `bkash_payments` view) দেয়া হবে।

---

## Edge Functions (নতুন)

সব ফাংশন `verify_jwt=false`, ভেতরে auth check + Zod validation + CORS।

### 1. `bkash-create-payment`

- Input: `{ selected_packages, coupon_code?, phone, institute_name }`
- Validate user session (`getUser(jwt)`), coupon, packages → compute `amount`।
- Grant/refresh cached bKash token (in-memory + `app_settings` fallback with 55-min expiry)।
- Generate unique `merchantInvoiceNumber` (e.g. `PL-<userId8>-<timestamp>`)।
- `POST /tokenized/checkout/create` with `mode:"0011"`, `payerReference:phone`, `callbackURL: https://<app>/payment/callback`, `amount`, `currency:"BDT"`, `intent:"sale"`।
- Insert `bkash_payments` row `status='initiated'` + full request context।
- Return `{ paymentID, bkashURL }` — frontend `window.location.href = bkashURL` করবে।

### 2. `bkash-execute-payment`

- Input: `{ paymentID }`
- Look up `bkash_payments` row (must belong to caller)।
- `POST /tokenized/checkout/execute`।
- If `transactionStatus === "Completed"` এবং amount match:
  - Row update: `status='completed'`, `trx_id`, `bkash_response`
  - Loop over `selected_packages`: insert `subscriptions` (1 year) + `user_permissions` (সকল বিষয় হলে সব subject expand) — বর্তমান `AdminPurchases.handleAction` logic-টাই reuse করা হবে (helper-এ বের করে)।
  - Increment coupon usage।
- Else: row `status='failed'`, return error।
- Idempotent — একই paymentID আবার এলে subscription duplicate হবে না।

### 3. `bkash-query-payment` (safety net)

- Callback query-string যদি অপ্রত্যাশিতভাবে হারিয়ে যায় বা user browser বন্ধ করে দেয়, admin/user later "যাচাই করুন" চাপলে `POST /tokenized/checkout/payment/status` দিয়ে reconcile করবে।

পুরনো `submit-purchase` edge function delete করা হবে।

---

## Frontend changes

### `InlineCheckout.tsx` + `CheckoutPage.tsx`

- "সেন্ড মানি নাম্বার", "কোনটাতে সেন্ড করেছেন?", "যে নাম্বার থেকে টাকা পাঠিয়েছেন" — সব সরানো।
- Payment section replaced with single **"বিকাশে পেমেন্ট করুন"** বাটন (bKash logo + branded pink)।
- Click → `supabase.functions.invoke('bkash-create-payment', { body })` → পেলে `window.location.href = bkashURL`।
- WhatsApp fallback UI থাকবে।

### নতুন page: `src/pages/PaymentCallback.tsx` (route `/payment/callback`)

- Query params পড়ে (`paymentID`, `status`)।
- `status !== 'success'` হলে failure UI ("বাতিল/ব্যর্থ") + retry link।
- Success হলে loading spinner সহ `bkash-execute-payment` কল → success হলে `/dashboard/subscription`-এ redirect + toast; fail হলে error UI + support contact।

### `AdminPurchases.tsx` → `AdminPayments.tsx`

- `bkash_payments` টেবিল read-only list (status badge, trxID, invoice, packages, amount, timestamp)।
- Approve/Reject বাটন নেই — শুধু "যাচাই করুন" (calls `bkash-query-payment`) stuck initiated row-এর জন্য।
- Route: `/admin/payments` (পুরনো `/admin/purchases` এখানে redirect)।

---

## Secrets to add (build phase)

`BKASH_BASE_URL`, `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD` — user-কে `add_secret` দিয়ে চাইবো, sandbox value বসাতে বলবো। পরে user নিজেই dashboard থেকে live value দিয়ে আপডেট করবে।

---

## Rollout order

1. Migration (bkash_payments + subs FK + grants/RLS)
2. Secrets add (sandbox creds)
3. Three edge functions (create/execute/query) + shared subscription-provisioning helper
4. PaymentCallback page + route
5. InlineCheckout/CheckoutPage refactor
6. AdminPayments rewrite + sidebar/route update
7. Delete `submit-purchase` function
8. Sandbox end-to-end test (test wallet `01770618575` / OTP `123456` / PIN `12121`)

Live-এ যেতে হলে শুধু ৫টা secret আপডেট + `BKASH_BASE_URL` পরিবর্তন — কোড টাচ করা লাগবে না।  
  
callbackurl কী কোড/ফাংশনের ভিতরেই সেট হবে? যেহেতু আমাদের কাছে অফিসিয়াল বিকাশ এর কোনো ড্যাশবোরড নাই এইটা সেটাপ এর জন্য এইজন্য বললাম আর এ্যাডমিন প্যানেলে সাবস্ক্রিপশন পেইজ আপগ্রেড করো এই হিসেবে আর বিকাশের কোনটার কত পেমেন্ট ঢুকলো বিকাশ যেরকম সব ডিটেইলস দিবে সেই ডিটেইলস সহ এখন সাবস্ক্রিপশন পেইজে দেখাবে এ্যাডমিন প্যানেলে