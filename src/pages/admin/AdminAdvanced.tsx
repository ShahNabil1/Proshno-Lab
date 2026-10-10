import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CloudUpload, Settings, LayoutDashboard, PlusCircle, Package, FileText,
  Building2, CreditCard, Phone, MessageSquare, GraduationCap, BookOpen,
  Layers, Users, Tag, HelpCircle, Star, Flag, ShieldCheck
} from "lucide-react";


const dashboardPages = [
  { path: "/dashboard", label: "ড্যাশবোর্ড", icon: LayoutDashboard },
  { path: "/dashboard/create", label: "১ ক্লিকে প্রশ্ন তৈরি", icon: PlusCircle },
  { path: "/dashboard/packages", label: "রেডি প্রশ্ন/সাজেশন", icon: Package },
  { path: "/dashboard/my-questions", label: "আমার তৈরি প্রশ্ন", icon: FileText },
  { path: "/dashboard/institute", label: "আমার প্রতিষ্ঠান", icon: Building2 },
  { path: "/dashboard/subscription", label: "আমার সাবস্ক্রিপশন", icon: CreditCard },
  { path: "/dashboard/contact", label: "যোগাযোগ", icon: Phone },
  { path: "/dashboard/feedback", label: "মতামত", icon: MessageSquare },
];

const adminPages = [
  { path: "/admin", label: "ড্যাশবোর্ড", icon: LayoutDashboard },
  { path: "/admin/classes", label: "শ্রেণী", icon: GraduationCap },
  { path: "/admin/subjects", label: "বিষয়", icon: BookOpen },
  { path: "/admin/chapters", label: "অধ্যায়", icon: Layers },
  { path: "/admin/questions", label: "প্রশ্ন", icon: FileText },
  { path: "/admin/topics", label: "টপিক", icon: Layers },
  { path: "/admin/announcements", label: "অ্যানাউন্সমেন্ট", icon: MessageSquare },
  { path: "/admin/reviews", label: "রিভিউ", icon: Star },
  { path: "/admin/coupons", label: "কুপন", icon: Tag },
  { path: "/admin/packages", label: "প্যাকেজ", icon: Package },
  { path: "/admin/question-reports", label: "প্রশ্নের রিপোর্ট", icon: Flag },
  { path: "/admin/feedback", label: "মতামত", icon: MessageSquare },
  { path: "/admin/teachers", label: "শিক্ষক", icon: Users },
  { path: "/admin/institutes", label: "প্রতিষ্ঠান", icon: Building2 },
  { path: "/admin/subscriptions", label: "সাবস্ক্রিপশন ও পেমেন্ট", icon: CreditCard },
];

type ToggleSectionProps = {
  title: string;
  description: string;
  icon: React.ElementType;
  pages: typeof dashboardPages;
  hiddenPages: string[];
  onToggle: (path: string, visible: boolean) => void;
};

function ToggleSection({ title, description, icon: Icon, pages, hiddenPages, onToggle }: ToggleSectionProps) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <Label className="font-heading font-bold text-base">{title}</Label>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <div className="divide-y divide-border rounded-lg border border-border">
          {pages.map((page) => {
            const isVisible = !hiddenPages.includes(page.path);
            return (
              <div key={page.path} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <page.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{page.label}</span>
                  <span className="text-xs text-muted-foreground">{page.path}</span>
                </div>
                <Switch checked={isVisible} onCheckedChange={(checked) => onToggle(page.path, checked)} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminAdvanced() {

  const [cloudBackup, setCloudBackup] = useState(false);
  const [hiddenPages, setHiddenPages] = useState<string[]>([]);
  const [adminHiddenPages, setAdminHiddenPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("app_settings").select("value").eq("key", "cloud_backup_enabled").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "dashboard_hidden_pages").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "admin_hidden_pages").maybeSingle(),
    ]).then(([backupRes, hiddenRes, adminHiddenRes]) => {
      setCloudBackup(backupRes.data?.value === true);
      const hidden = hiddenRes.data?.value;
      setHiddenPages(Array.isArray(hidden) ? (hidden as string[]) : []);
      const adminHidden = adminHiddenRes.data?.value;
      setAdminHiddenPages(Array.isArray(adminHidden) ? (adminHidden as string[]) : []);
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

  const createPageToggleHandler = (settingKey: string, currentHidden: string[], setHidden: (v: string[]) => void) =>
    async (path: string, visible: boolean) => {
      const newHidden = visible
        ? currentHidden.filter(p => p !== path)
        : [...currentHidden, path];

      setHidden(newHidden);
      const { error } = await supabase
        .from("app_settings")
        .update({ value: newHidden as any, updated_at: new Date().toISOString() })
        .eq("key", settingKey);

      if (error) {
        toast.error("আপডেট করতে সমস্যা হয়েছে");
        setHidden(currentHidden);
        return;
      }
      toast.success(visible ? "পেইজ দেখানো হচ্ছে" : "পেইজ হাইড করা হয়েছে");
    };

  if (loading) return null;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
        <Settings className="w-6 h-6" /> সেটিংস
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


      <ToggleSection
        title="টিচার ড্যাশবোর্ড"
        description="টগল অফ করলে পেইজটি টিচার ড্যাশবোর্ড থেকে হাইড হয়ে যাবে।"
        icon={LayoutDashboard}
        pages={dashboardPages}
        hiddenPages={hiddenPages}
        onToggle={createPageToggleHandler("dashboard_hidden_pages", hiddenPages, setHiddenPages)}
      />

      <ToggleSection
        title="অ্যাডমিন ড্যাশবোর্ড"
        description="টগল অফ করলে পেইজটি অ্যাডমিন প্যানেল থেকে হাইড হয়ে যাবে। ডেভেলপারের জন্য সবসময় দেখাবে।"
        icon={ShieldCheck}
        pages={adminPages}
        hiddenPages={adminHiddenPages}
        onToggle={createPageToggleHandler("admin_hidden_pages", adminHiddenPages, setAdminHiddenPages)}
      />
    </div>
  );
}
