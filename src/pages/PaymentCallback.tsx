import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import logoImg from "@/assets/logo.png";

type Phase = "verifying" | "success" | "failed" | "cancelled";

export default function PaymentCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("verifying");
  const [message, setMessage] = useState<string>("");
  const [trxId, setTrxId] = useState<string>("");

  const paymentID = params.get("paymentID") || params.get("paymentId") || "";
  const status = (params.get("status") || "").toLowerCase();

  useEffect(() => {
    (async () => {
      if (!paymentID) {
        setPhase("failed");
        setMessage("অবৈধ কলব্যাক — paymentID পাওয়া যায়নি");
        return;
      }
      if (status === "cancel" || status === "cancelled") {
        setPhase("cancelled");
        setMessage("আপনি পেমেন্ট বাতিল করেছেন");
        return;
      }
      if (status === "failure" || status === "failed") {
        setPhase("failed");
        setMessage("বিকাশ থেকে পেমেন্ট ব্যর্থ হয়েছে");
        return;
      }

      // status === 'success' → execute
      try {
        const { data, error } = await supabase.functions.invoke("bkash-execute-payment", {
          body: { paymentID },
        });
        if (error) throw error;
        if (data?.status === "completed") {
          setPhase("success");
          setTrxId(data.trxID || "");
          setTimeout(() => navigate("/dashboard/subscription"), 3000);
        } else {
          setPhase("failed");
          setMessage(data?.error || "পেমেন্ট নিশ্চিত করা যায়নি");
        }
      } catch (e: any) {
        setPhase("failed");
        setMessage(e?.message || "সার্ভার এরর");
      }
    })();
  }, [paymentID, status, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-card border p-8 text-center">
        <img src={logoImg} alt="Proshno Lab" className="w-14 h-14 rounded-xl mx-auto mb-4 object-contain" />

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
            <p className="text-sm text-muted-foreground mb-2">আপনার সাবস্ক্রিপশন সক্রিয় করা হয়েছে</p>
            {trxId && <p className="text-xs text-muted-foreground mb-4">TrxID: <span className="font-mono">{trxId}</span></p>}
            <p className="text-xs text-muted-foreground mb-4">৩ সেকেন্ডের মধ্যে সাবস্ক্রিপশন পেইজে রিডাইরেক্ট হবে…</p>
            <Link to="/dashboard/subscription">
              <Button className="gradient-green text-white border-0">সাবস্ক্রিপশন দেখুন</Button>
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
              <Link to="/pricing"><Button variant="outline">আবার চেষ্টা করুন</Button></Link>
              <Link to="/dashboard"><Button className="gradient-green text-white border-0">ড্যাশবোর্ড</Button></Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
