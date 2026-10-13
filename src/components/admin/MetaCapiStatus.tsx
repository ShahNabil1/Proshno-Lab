import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

interface CapiStatus { enabled: boolean; paused: boolean; pixel_id: string; pending: number; sent: number; failed: number; last_sent_at: string | null; last_error: string | null; }
export default function MetaCapiStatus() {
  const [status, setStatus] = useState<CapiStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const refresh = async () => {
    setLoading(true);
    const rpc = supabase.rpc.bind(supabase) as unknown as (name: string) => PromiseLike<{ data: unknown; error: unknown }>;
    try {
      const result = await rpc("meta_capi_status");
      setError(Boolean(result.error));
      if (!result.error) setStatus(result.data as CapiStatus);
    } catch { setError(true); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  return <Card>
    <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
      <CardTitle className="text-lg">Meta Conversions API</CardTitle>
      <Button size="sm" variant="outline" disabled={loading} onClick={() => void refresh()}><RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />রিফ্রেশ</Button>
    </CardHeader>
    <CardContent className="space-y-3">
      {error ? <p role="status" className="text-sm text-muted-foreground">ডেলিভারির অবস্থা এখন দেখা যাচ্ছে না। আবার রিফ্রেশ করুন।</p> : !status ? <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p> : <>
        <p className={`text-sm font-medium ${status.enabled && !status.paused ? "text-emerald-700" : "text-amber-700"}`}>
          {status.paused ? "পাঠানো স্থগিত — Meta token যাচাই প্রয়োজন" : status.enabled ? "চালু — সার্ভার থেকে ইভেন্ট পাঠানো হচ্ছে" : "প্রস্তুত — Meta token যুক্ত করে চালু করতে হবে"}
        </p>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[{label:"পাঠানোর অপেক্ষায়",value:status.pending},{label:"Meta গ্রহণ করেছে",value:status.sent},{label:"যাচাই প্রয়োজন",value:status.failed}].map(item => <div key={item.label} className="rounded-lg bg-muted/50 px-2 py-3"><p className="text-xl font-semibold">{item.value.toLocaleString("bn-BD")}</p><p className="mt-1 text-xs text-muted-foreground">{item.label}</p></div>)}
        </div>
        {status.last_sent_at && <p className="text-xs text-muted-foreground">সর্বশেষ ডেলিভারি: {new Date(status.last_sent_at).toLocaleString("bn-BD")}</p>}
        {status.last_error && <p className="text-xs text-muted-foreground">ত্রুটি: {status.last_error}</p>}
      </>}
    </CardContent>
  </Card>;
}
