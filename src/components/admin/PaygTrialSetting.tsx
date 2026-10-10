import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
export default function PaygTrialSetting() {
  const [paygTrial, setPaygTrial] = useState(true);
  const [paygSaving, setPaygSaving] = useState(false);
  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "payg_all_chapters_trial").maybeSingle()
      .then(({ data }) => setPaygTrial(data?.value !== false));
  }, []);
  const togglePaygTrial = async (enabled: boolean) => {
    setPaygSaving(true);
    const { error } = await supabase.from("app_settings").upsert({ key: "payg_all_chapters_trial", value: enabled, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setPaygSaving(false);
    if (error) { toast.error(error.message); return; }
    setPaygTrial(enabled);
    toast.success(enabled ? "Pay as you go trial enabled" : "Previous experience restored");
  };
  return (      <Card><CardContent className="p-6 flex items-center justify-between gap-4">
        <div><Label className="font-heading font-bold">সব অধ্যায়ে Pay as you go — পরীক্ষামূলক</Label>
          <p className="text-sm text-muted-foreground mt-1">প্যাকেজ ছাড়াই সব সক্রিয় অধ্যায় বেছে প্রশ্নপত্র কিনুন। বন্ধ করলে আগের ইন্টারফেস ফিরে আসবে। সক্রিয় প্যাকেজের সুবিধা থাকবে।</p></div>
        <Switch aria-label="সব অধ্যায়ে Pay as you go পরীক্ষামূলক" checked={paygTrial} disabled={paygSaving} onCheckedChange={togglePaygTrial} />
      </CardContent></Card>);
}
