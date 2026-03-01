import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CloudUpload, Settings } from "lucide-react";

export default function AdminAdvanced() {
  const [cloudBackup, setCloudBackup] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "cloud_backup_enabled")
      .maybeSingle()
      .then(({ data }) => {
        setCloudBackup(data?.value === true);
        setLoading(false);
      });
  }, []);

  const handleToggle = async (checked: boolean) => {
    setCloudBackup(checked);
    const { error } = await supabase
      .from("app_settings")
      .update({ value: checked as any, updated_at: new Date().toISOString() })
      .eq("key", "cloud_backup_enabled");

    if (error) {
      toast.error("সেটিং আপডেট করতে সমস্যা হয়েছে");
      setCloudBackup(!checked);
      return;
    }
    toast.success(checked ? "ক্লাউড ব্যাকআপ চালু হয়েছে" : "ক্লাউড ব্যাকআপ বন্ধ হয়েছে");
  };

  if (loading) return null;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
        <Settings className="w-6 h-6" /> অ্যাডভান্সড সেটিংস
      </h1>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CloudUpload className="w-5 h-5 text-primary" />
              </div>
              <div>
                <Label className="font-heading font-bold text-base">ক্লাউড ব্যাকআপ</Label>
                <p className="text-sm text-muted-foreground mt-0.5">
                  চালু করলে শিক্ষকদের প্রশ্নপত্র স্বয়ংক্রিয়ভাবে সেভ হবে এবং "আমার তৈরি প্রশ্ন" পেইজ দেখাবে।
                </p>
              </div>
            </div>
            <Switch checked={cloudBackup} onCheckedChange={handleToggle} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
