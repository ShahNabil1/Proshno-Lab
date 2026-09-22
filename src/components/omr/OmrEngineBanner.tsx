import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toBn } from "@/lib/omrLayout";
import type { OmrEngineHealth } from "@/lib/omrEngine";

interface OmrEngineBannerProps {
  status: OmrEngineHealth | null;
  loading: boolean;
  onRetry: () => void;
}

/**
 * "Everything is ready" strip.  Scanning happens in the browser, so the only
 * thing that can be missing is the answer-key store.
 */
export default function OmrEngineBanner({ status, loading, onRetry }: OmrEngineBannerProps) {
  const counts = useMemo(() => {
    if (!status?.ok) return "";
    return `টোকেন ${toBn(status.tokens ?? 0)}টি · মূল্যায়ন ${toBn(status.evaluations ?? 0)}টি`;
  }, [status]);

  if (loading && !status) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <RefreshCw className="w-4 h-4 animate-spin" />
        OMR প্রস্তুতি দেখা হচ্ছে...
      </div>
    );
  }

  if (status?.ok) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <CheckCircle2 className="w-4 h-4" />
        <span className="font-semibold">OMR প্রস্তুত</span>
        <span className="inline-flex items-center gap-1 text-emerald-700">
          <ScanLine className="w-3.5 h-3.5" /> ছবি পড়া হয় আপনার ব্রাউজারেই - কিছু ইনস্টল করতে হবে না
        </span>
        {counts ? <span className="text-emerald-700">{counts}</span> : null}
        <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-emerald-800" onClick={onRetry}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> রিফ্রেশ
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">OMR এখনো চালু করা যায়নি</p>
          <p className="text-amber-800">{status?.error || "OMR সংক্রান্ত তথ্য আনা যায়নি।"}</p>
          <p className="text-amber-800">
            শীট তৈরি ও প্রিন্ট করতে ডেটাবেস লাগে না - উপরের টোকেন ছাড়াও শীট বানাতে পারবেন।
          </p>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="w-3.5 h-3.5 mr-1" /> আবার চেক করুন
      </Button>
    </div>
  );
}
