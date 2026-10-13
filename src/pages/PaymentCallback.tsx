import { analytics, trackEvent } from "@/lib/analytics";
import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import BrandLockup from "@/components/BrandLockup";

type Phase = "verifying" | "success" | "failed" | "cancelled";

export default function PaymentCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("verifying");
  const [message, setMessage] = useState<string>("");
  const [trxId, setTrxId] = useState<string>("");
  const [retrying, setRetrying] = useState(false);

  const paymentID = params.get("paymentID") || params.get("paymentId") || "";
  const isPayg = params.get("payg") === "1";
  const returnPath = isPayg ? `/dashboard/create?paygPayment=${encodeURIComponent(paymentID)}` : "/dashboard/subscription";
  const status = (params.get("status") || "").toLowerCase();

  const trackCompletedPurchase = async () => {
    try {
      const { data: payment, error } = await supabase.from("bkash_payments")
        .select("status, trx_id, amount").eq("payment_id", paymentID).maybeSingle();
      if (!error && payment?.status === "completed" && payment.trx_id) {
        const amount = Number(payment.amount);
        if (Number.isFinite(amount) && amount >= 0) analytics.purchase(payment.trx_id, amount, "BDT");
      }
    } catch { /* Tracking must not delay access or change payment state. */ }
  };

  useEffect(() => {
    (async () => {
      if (!paymentID) {
        setPhase("failed");
        setMessage("অবৈধ কলব্যাক — paymentID পাওয়া যায়নি");
        return;
      }
      if (status === "cancel" || status === "cancelled") {
        trackEvent("payment_cancelled", { method: "bkash" });
        setPhase("cancelled");
        setMessage("আপনি পেমেন্ট বাতিল করেছেন");
        await supabase.from("bkash_payments")
          .update({ status: "cancelled" })
          .eq("payment_id", paymentID)
          .eq("status", "initiated");
        return;
      }
      if (status === "failure" || status === "failed") {
        trackEvent("payment_failed", { method: "bkash" });
        setPhase("failed");
        setMessage("বিকাশ থেকে পেমেন্ট ব্যর্থ হয়েছে");
        await supabase.from("bkash_payments")
          .update({ status: "failed", error_message: "bKash returned failure" })
          .eq("payment_id", paymentID)
          .eq("status", "initiated");
        return;
      }

      // status === 'success' → execute
      try {
        const { data, error } = await supabase.functions.invoke("bkash-execute-payment", {
          body: { paymentID },
        });
        if (error) throw error;
        if (data?.status === "completed") {
          void trackCompletedPurchase();
          setPhase("success");
          setTrxId(data.trxID || "");
          setTimeout(() => navigate(returnPath), 3000);
        } else {
          setPhase("failed");
          setMessage(data?.error || "পেমেন্ট নিশ্চিত করা যায়নি");
        }
      } catch (e: any) {
        setPhase("failed");
        setMessage(e?.message || "সার্ভার এরর");
      }
    })();
  }, [paymentID, status, navigate, returnPath]);

  const handleRetry = async () => {
    if (!paymentID) {
      navigate("/pricing");
      return;
    }
    setRetrying(true);
    try {
      // Fetch original payment context
      const { data: row, error: rowErr } = await supabase
        .from("bkash_payments")
        .select("selected_packages, coupon_code, payer_reference, institute_name, teacher_name, status")
        .eq("payment_id", paymentID)
        .maybeSingle();

      if (rowErr || !row || !Array.isArray(row.selected_packages) || row.selected_packages.length === 0) {
        toast.error("পূর্বের অর্ডার পাওয়া যায়নি — প্যাকেজ পেইজ থেকে আবার শুরু করুন");
        navigate("/pricing");
        return;
      }

      if (row.status === "completed") { void trackCompletedPurchase(); navigate(returnPath); return; }
      // Retry the same initiated payment, avoiding a second charge while a
      // verified custom payment is awaiting transactional access activation.
      if (row.status === "initiated") {
        const { data, error } = await supabase.functions.invoke("bkash-execute-payment", { body: { paymentID } });
        if (error || data?.status !== "completed") throw new Error("পেমেন্ট যাচাই এখনও সম্পন্ন হয়নি। আবার চেষ্টা করুন অথবা সাপোর্টে যোগাযোগ করুন।");
        void trackCompletedPurchase();
        navigate(returnPath); return;
      }
      const customOrder = row.selected_packages.find(p => p && typeof p === "object" && !Array.isArray(p) && p.kind === "custom");
      const { data, error } = await supabase.functions.invoke("bkash-create-payment", {
        body: {
          selected_packages: isPayg || customOrder ? undefined : row.selected_packages,
          custom_package: customOrder,
          payg: isPayg ? { chapter_ids: (row.selected_packages[0] as any).chapter_ids, counts: (row.selected_packages[0] as any).counts } : undefined,
          coupon_code: row.coupon_code || undefined,
          phone: row.payer_reference,
          institute_name: row.institute_name || undefined,
          teacher_name: row.teacher_name || undefined,
          callback_origin: window.location.origin,
        },
      });
      if (error) throw error;
      if (!data?.bkashURL) throw new Error(data?.error || "bKash URL পাওয়া যায়নি");
      window.location.href = data.bkashURL;
    } catch (e: any) {
      toast.error(e?.message || "পুনরায় চেষ্টা ব্যর্থ");
      setRetrying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-card border p-8 text-center">
        <div className="mb-4 flex justify-center"><BrandLockup size={36} dark={false} /></div>

        {phase === "verifying" && (
          <>
            <Loader2 className="w-14 h-14 text-primary mx-auto mb-4 animate-spin" />
            <h2 className="font-heading text-xl font-bold mb-1">পেমেন্ট যাচাই হচ্ছে…</h2>
            <p className="text-sm text-muted-foreground">অনুগ্রহ করে পেইজ বন্ধ করবেন না</p>
          </>
        )}

        {phase === "success" && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-100 mx-auto mb-4 flex items-center justify-center">
              <Check className="w-9 h-9 text-emerald-600" />
            </div>
            <h2 className="font-heading text-2xl font-bold mb-1 text-emerald-700">পেমেন্ট সফল!</h2>
            <p className="text-sm text-muted-foreground mb-2">{isPayg ? "আপনার প্রশ্নপত্রের পেমেন্ট সম্পন্ন হয়েছে" : "আপনার সাবস্ক্রিপশন সক্রিয় করা হয়েছে"}</p>
            {trxId && <p className="text-xs text-muted-foreground mb-4">TrxID: <span className="font-mono">{trxId}</span></p>}
            <p className="text-xs text-muted-foreground mb-4">{isPayg ? "প্রশ্নপত্র খুলছে…" : "৩ সেকেন্ডের মধ্যে সাবস্ক্রিপশন পেইজে রিডাইরেক্ট হবে…"}</p>
            <Link to={returnPath}>
              <Button className="gradient-green text-white border-0">{isPayg ? "প্রশ্নপত্র খুলুন" : "সাবস্ক্রিপশন দেখুন"}</Button>
            </Link>
          </>
        )}

        {(phase === "failed" || phase === "cancelled") && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center">
              <X className="w-9 h-9 text-red-600" />
            </div>
            <h2 className="font-heading text-2xl font-bold mb-1 text-red-700">
              {phase === "cancelled" ? "পেমেন্ট বাতিল" : "পেমেন্ট ব্যর্থ"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">{message}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={handleRetry} disabled={retrying}>
                {retrying ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> শুরু হচ্ছে…</> : "আবার চেষ্টা করুন"}
              </Button>
              <Link to="/dashboard"><Button className="gradient-green text-white border-0">ড্যাশবোর্ড</Button></Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
