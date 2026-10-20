/** Decode safe checkout failures without exposing gateway responses or credentials. */
export async function paymentError(error: unknown): Promise<Error> {
  const context = (error as { context?: unknown })?.context;
  if (!(context instanceof Response)) return error instanceof Error ? error : new Error("পেমেন্ট শুরু করা যায়নি। আবার চেষ্টা করুন।");
  let reason = "";
  let code = "";
  try {
    const payload = await context.clone().json();
    if (typeof payload?.error === "string") reason = payload.error;
    if (typeof payload?.code === "string") code = payload.code;
  } catch { /* Some gateway failures have no JSON body. */ }
  if (/already own|already owned/i.test(reason)) return new Error("নির্বাচিত বিষয় আপনার প্যাকেজে আগে থেকেই সক্রিয়। অন্য বিষয় নির্বাচন করুন।");
  if (code === "PAYMENT_ALREADY_COMPLETED") return new Error("আপনার আগের পেমেন্ট সম্পন্ন হয়েছে এবং প্যাকেজ চালু করা হয়েছে। পেজ রিফ্রেশ করুন। আবার টাকা দিতে হবে না।");
  if (code === "PAYMENT_ACTIVATION_PENDING") return new Error("আপনার পেমেন্ট পাওয়া গেছে। প্যাকেজ চালু হচ্ছে; আবার টাকা দেবেন না। সহায়তার জন্য যোগাযোগ করুন।");
  if (code === "PAYMENT_STATUS_UNAVAILABLE") return new Error("আগের পেমেন্টের অবস্থা এখন যাচাই করা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।");
  if (code === "PAYMENT_CREATION_IN_PROGRESS" || /pending|progress|unfinished/i.test(reason)) return new Error("পেমেন্ট লিংক তৈরি হচ্ছে। ৩০ সেকেন্ড পরে আবার চেষ্টা করুন।");
  if (context.status === 401) return new Error("আবার লগইন করে পেমেন্ট শুরু করুন।");
  if (context.status === 409) return new Error("প্যাকেজের বর্তমান অবস্থায় এই পেমেন্ট করা যাচ্ছে না। প্যাকেজ নির্বাচন আবার যাচাই করুন।");
  if (context.status === 400) return new Error("প্যাকেজ, কুপন এবং মোবাইল নম্বর যাচাই করে আবার চেষ্টা করুন।");
  return new Error("পেমেন্ট সেবা এখন সাড়া দিচ্ছে না। একটু পরে আবার চেষ্টা করুন।");
}
