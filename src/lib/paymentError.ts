/** Decode safe checkout failures without exposing gateway responses or credentials. */
export async function paymentError(error: unknown): Promise<Error> {
  const context = (error as { context?: unknown })?.context;
  if (!(context instanceof Response)) return error instanceof Error ? error : new Error("পেমেন্ট শুরু করা যায়নি। আবার চেষ্টা করুন।");
  let reason = "";
  try {
    const payload = await context.clone().json();
    if (typeof payload?.error === "string") reason = payload.error;
  } catch { /* Some gateway failures have no JSON body. */ }
  if (/already own|already owned/i.test(reason)) return new Error("নির্বাচিত বিষয় আপনার প্যাকেজে আগে থেকেই সক্রিয়। অন্য বিষয় নির্বাচন করুন।");
  if (/pending|progress/i.test(reason)) return new Error("এই প্যাকেজের একটি পেমেন্ট অপেক্ষমাণ আছে। আগের পেমেন্টের অবস্থা যাচাই করুন।");
  if (context.status === 401) return new Error("আবার লগইন করে পেমেন্ট শুরু করুন।");
  if (context.status === 409) return new Error("প্যাকেজের বর্তমান অবস্থায় এই পেমেন্ট করা যাচ্ছে না। প্যাকেজ নির্বাচন আবার যাচাই করুন।");
  if (context.status === 400) return new Error("প্যাকেজ, কুপন এবং মোবাইল নম্বর যাচাই করে আবার চেষ্টা করুন।");
  return new Error("পেমেন্ট সেবা এখন সাড়া দিচ্ছে না। একটু পরে আবার চেষ্টা করুন।");
}
