# Telegram Bot ইন্টিগ্রেশন প্ল্যান (Proshno Lab)

> এইটা শুধু গাইড ও প্ল্যান — কোনো কোড এখনই লেখা হবে না। আপনি "বিল্ড করো" বললে তখন কানেক্টর enable + সব কোড বসানো হবে।

---

## ১. Vite + Supabase-এ কোন অ্যাপ্রোচ সঠিক?

আপনার প্রজেক্ট Vite (client-side React) — এখানে সরাসরি ব্রাউজার থেকে Telegram API কল করা **যাবে না**, কারণ:

- Bot token/connector key ব্রাউজারে expose করা মানে যেকেউ chat_id বদলে spam পাঠাবে।
- CORS + rate-limit issue।

**সঠিক অ্যাপ্রোচ (recommended):**


| Layer                      | কাজ                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------- |
| Vite frontend              | শুধু form submit → `supabase.functions.invoke("notify-telegram", { body })`         |
| Supabase Edge Function     | Server-side এ Lovable Telegram **Connector Gateway**-এ call করে notification পাঠায় |
| Lovable Telegram Connector | Bot token/auth automatic manage করে, token কখনো code-এ আসে না                       |


**অর্থাৎ — Lovable Telegram Connector + Supabase Edge Function দুইটাই লাগবে**, একটার বদলে আরেকটা না। Connector = auth layer, Edge function = আপনার business logic + trigger point। Vite নিজে থেকে connector কল করতে পারে না।

---

## ২. Feature Scope — এখন কী বানাবো

### (ক) Onboarding নোটিফিকেশন

`OnboardingModal` সফলভাবে institute insert করার পর edge function কল হবে। Admin এর Telegram-এ একটা formatted message যাবে:

```
🎉 নতুন রেজিস্ট্রেশন — Proshno Lab

👤 শিক্ষক: {name}
📧 ইমেইল: {email}
📱 ফোন: {phone}
🏫 প্রতিষ্ঠান: {institute_name}
📍 ঠিকানা: {division} > {district} > {upazila}
🏠 নির্দিষ্ট: {specific_address}
🕐 সময়: {timestamp — Asia/Dhaka locale, বাংলা}
🔗 Admin panel: proshnolab.com/admin/teachers
```

### (খ) আরও যেসব জায়গায় Telegram Bot ব্যবহার করা যায় (সুপারিশ)


| #   | ইভেন্ট                                | Trigger                                | কেন গুরুত্বপূর্ণ                                                   |
| --- | ------------------------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| 1   | নতুন bKash পেমেন্ট সফল                | `bkash-execute-payment` success branch | রেভিনিউ রিয়েল-টাইম alert                                          |
| 2   | পেমেন্ট failed/cancelled              | payment reconcile                      | কোন ইউজার আটকে আছে তা জানা                                         |
| 3   | Coupon apply                          | checkout success                       | কোন coupon কতবার হিট হচ্ছে                                         |
| 4   | নতুন Feedback/Contact/Question Report | insert trigger                         | সাপোর্ট দ্রুত response                                             |
| 5   | নতুন Review submit                    | admin approve pending                  | moderate করতে                                                      |
| 6   | Bulk question upload finished         | AdminQuestionsBulk শেষে                | কতটা success/failed                                                |
| 7   | Subscription expire হচ্ছে ৩ দিনে      | scheduled cron edge function           | renewal reminder                                                   |
| 8   | Daily summary (রাত ১১টা)              | pg_cron → edge function                | আজকের registration/revenue/questions count                         |
| 9   | System error alert                    | edge function catch block              | production issue immediately জানা                                  |
| 10  | ২-way Bot commands (advanced)         | Telegram webhook → edge function       | `/stats`, `/pending`, `/user <email>` — Telegram থেকেই admin query |


প্রথমে (ক) + (খ)-এর 1, 2, 4, 8 বানানো ideal — বাকিগুলো পরে যোগ করা যাবে।

---

## ৩. Setup Sequence — যখন "বিল্ড করো" বলবেন

**Step 1 — BotFather-এ Bot বানানো (আপনি করবেন):**

1. Telegram-এ `@BotFather` খুলুন → `/newbot`
2. নাম দিন: `Proshno Lab Notifier` (বা যা পছন্দ)
3. Username দিন: `proshnolab_bot` (available হতে হবে, `_bot` দিয়ে শেষ)
4. Bot token পাবেন (এটা copy করে রাখবেন কিন্তু কোথাও paste করতে হবে না — Lovable connector নিজে চাইবে)

**Step 2 — Admin/Group chat_id বের করা:**

- Personal notification হলে: `@userinfobot` কে message পাঠালে আপনার `chat_id` দিবে
- Group notification হলে: bot-কে group-এ add করুন → group-এ যেকোনো message পাঠান → `@RawDataBot` দিয়ে group chat_id বের করুন (negative number, যেমন `-1001234567890`)
- এই chat_id গুলো Supabase secret-এ রাখব: `TELEGRAM_ADMIN_CHAT_ID` (comma-separated multi-recipient support)

**Step 3 — Lovable Telegram Connector enable (আমি করব):**

- `standard_connectors--connect` দিয়ে `telegram` connector link — আপনাকে UI popup-এ bot token paste করতে হবে একবার
- Enable-এর পর `TELEGRAM_API_KEY` + `LOVABLE_API_KEY` automatic edge function-এ available হবে

**Step 4 — Edge Function `notify-telegram` বানানো:**

- Reusable function যেটা `{ event_type, title, fields[], link? }` accept করে
- Lovable gateway (`https://connector-gateway.lovable.dev/telegram/sendMessage`) কল করে HTML formatted message পাঠায়
- Error surfacing (provider error → JSON return, silent fail না)
- CORS + Zod validation

**Step 5 — Trigger points integrate:**

- `OnboardingModal.tsx` — insert success এর পর invoke
- `bkash-execute-payment/index.ts` — success/fail branch-এ invoke
- (optional এই phase-এ) feedback/report insert-এর জায়গায়
- Silent-fail: Telegram fail করলেও user experience break হবে না

**Step 6 — Daily summary (optional, later):**

- `pg_cron` extension enable
- `daily-summary` edge function schedule (রাত ১১টা Asia/Dhaka)
- আজকের count query করে Telegram-এ পাঠায়

**Step 7 — 2-way commands (optional, much later):**

- `telegram-webhook` edge function (verify_jwt=false, secret_token validation সহ Skill doc pattern অনুযায়ী)
- `setWebhook` register
- `/stats`, `/pending_payments`, `/find_user` etc. commands handle

---

## ৪. Security & Reliability

- Bot token কখনো frontend/git-এ যাবে না — শুধু Lovable connector-এ থাকবে
- Admin `chat_id` secret হিসেবে store (leak হলেও damage কম, তবু hardcode না)
- Edge function-এ Zod validation — malicious payload block
- Notification failure ≠ user action failure — try/catch দিয়ে silent log
- Rate consideration: Telegram bot limit ~30 msg/sec — আমাদের scale-এ issue না
- Webhook (Phase 2) হলে `X-Telegram-Bot-Api-Secret-Token` verify করা হবে (SHA-256 derived, Skill pattern অনুযায়ী)

---

## ৫. Cost & Dependency

- Telegram Bot API: **সম্পূর্ণ ফ্রি**, unlimited
- Lovable Connector Gateway: ফ্রি (আপনার existing plan-এ included)
- Supabase Edge Function invocations: বর্তমান quota-এর মধ্যে (নোটিফিকেশন = খুব হালকা load)
- নতুন কোনো paid dependency নেই

---

## ৬. Deliverables Checklist (build phase)

- Lovable Telegram Connector linked
- Secrets: `TELEGRAM_ADMIN_CHAT_ID` set
- Edge function: `supabase/functions/notify-telegram/index.ts`
- `config.toml`-এ function entry
- Deploy edge function
- `OnboardingModal.tsx` — invoke after successful insert
- `bkash-execute-payment` — invoke on success + fail
- Test: dummy registration → real message আসে কিনা verify
- Error scenario test: chat_id ভুল দিলে user flow break হয় না verify

---

## ৭. আপনার সিদ্ধান্ত দরকার (build শুরুর আগে)

1. **Recipient:** personal chat নাকি group? (group হলে পরে multiple admin add করা সহজ) personal chat
2. **Phase 1 scope:** শুধু onboarding? নাকি onboarding + payment success/fail একসাথে? প্রথমে (ক) + (খ)-এর 1, 2, 4, 8 বানানো 
3. **Language:** message সব বাংলায় নাকি English mixed? বাংলা + ইংলিশ মিক্সড 
4. **Daily summary** এখনই লাগবে নাকি পরে? এখনই দাও 

এই ৪টার উত্তর দিয়ে "বিল্ড করো" বললে আমি step 3 থেকে শুরু করব।