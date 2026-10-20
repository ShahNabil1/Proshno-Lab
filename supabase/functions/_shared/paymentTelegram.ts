export function verifiedPaymentReceipt(payment: any, receipt: any): boolean {
  return receipt?.statusCode === "0000" && receipt.paymentID === payment.payment_id && receipt.currency === "BDT" &&
    Number(receipt.amount) === Number(payment.amount);
}
export function paymentTelegramPayload(payment: any, event: string) {
  const titles: Record<string,string> = {
    payment_success: "✅ পেমেন্ট সফল — bKash",
    payment_incomplete: "⏳ চেকআউট শুরু করেছেন, পেমেন্ট সম্পন্ন হয়নি",
    payment_failed: "❌ পেমেন্ট ব্যর্থ — bKash",
    payment_cancelled: "↩️ চেকআউট বাতিল — bKash",
  };
  const escape = (s: unknown) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const packages = (payment.selected_packages || []).map((p:any)=>`${p.class_name || ""} — ${p.subject_name || p.kind || ""}`).join(" | ").slice(0,1800);
  return [ `<b>${titles[event] || "পেমেন্ট আপডেট"}</b>`,
    `শিক্ষক: ${escape(payment.teacher_name || "নাম দেওয়া হয়নি")}`,
    `পরিমাণ: ৳${escape(payment.amount)}`, `প্যাকেজ: ${escape(packages)}`,
    `রেফারেন্স: #${escape(payment.id)}`,
    ...(event === "payment_success" ? [`TrxID: ${escape(payment.trx_id)}`] : []),
    ...(payment.coupon_code ? [`কুপন: ${escape(payment.coupon_code)}`] : []),
    `চেকআউটের সময়: ${escape(new Date(payment.created_at).toLocaleString("bn-BD",{timeZone:"Asia/Dhaka"}))}`,
    '<a href="https://proshnolab.com/admin/subscriptions">পেমেন্টের বিস্তারিত দেখুন</a>',
  ].join("\n");
}
export async function deliverPaymentTelegram(text: string, chatId: string, config: {lovableKey:string;telegramKey:string}, fetcher:typeof fetch=fetch) {
  const response = await fetcher("https://connector-gateway.lovable.dev/telegram/sendMessage", {
    method:"POST",headers:{Authorization:`Bearer ${config.lovableKey}`,"X-Connection-Api-Key":config.telegramKey,"Content-Type":"application/json"},
    body:JSON.stringify({chat_id:chatId,text,parse_mode:"HTML",disable_web_page_preview:true}),signal:AbortSignal.timeout(10_000),
  });
  const data = await response.json().catch(()=>null);
  // Both transport errors and Telegram's own ok:false must be retried.
  return response.ok && data !== null && data.ok !== false && data.error === undefined;
}
