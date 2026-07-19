import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Clock, AlertCircle, MessageSquareReply, Flag } from "lucide-react";

const categories = ["সাধারণ", "বাগ রিপোর্ট", "ফিচার রিকোয়েস্ট", "অন্যান্য"];
const priorities = [
  { value: "low", label: "কম" },
  { value: "medium", label: "মাঝারি" },
  { value: "high", label: "বেশি" },
];

const statusMap: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "অপেক্ষমান", icon: Clock, color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  in_progress: { label: "প্রক্রিয়াধীন", icon: AlertCircle, color: "bg-blue-100 text-blue-800 border-blue-300" },
  resolved: { label: "সমাধান হয়েছে", icon: CheckCircle2, color: "bg-green-100 text-green-800 border-green-300" },
};

export default function Feedback() {
  const { user } = useAuth();
  const [form, setForm] = useState({ category: "সাধারণ", subject: "", details: "", priority: "low" });
  const [loading, setLoading] = useState(false);
  const [myFeedbacks, setMyFeedbacks] = useState<any[]>([]);
  const [myReports, setMyReports] = useState<any[]>([]);

  const fetchMyFeedbacks = async () => {
    if (!user) return;
    const { data } = await supabase.from("feedback").select("*").eq("teacher_id", user.id).order("created_at", { ascending: false });
    setMyFeedbacks(data || []);
  };

  const fetchMyReports = async () => {
    if (!user) return;
    const { data } = await supabase.from("question_reports" as any).select("*").eq("teacher_id", user.id).order("created_at", { ascending: false });
    setMyReports((data as any[]) || []);
  };

  useEffect(() => { fetchMyFeedbacks(); fetchMyReports(); }, [user]);

  const ensureTeacherExists = async () => {
    if (!user) return false;
    const { data } = await supabase.from("teachers").select("id").eq("id", user.id).maybeSingle();
    if (!data) {
      const { error } = await supabase.from("teachers").insert({
        id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
        email: user.email || "",
      });
      if (error) return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!user || !form.subject || !form.details) {
      toast.error("সব ফিল্ড পূরণ করুন");
      return;
    }
    setLoading(true);
    const teacherReady = await ensureTeacherExists();
    if (!teacherReady) {
      toast.error("ইউজার ভেরিফিকেশন ব্যর্থ হয়েছে");
      setLoading(false);
      return;
    }
    const { error } = await supabase.from("feedback").insert({
      teacher_id: user.id,
      category: form.category,
      subject: form.subject,
      details: form.details,
      priority: form.priority,
    });
    setLoading(false);
    if (error) {
      toast.error("সাবমিট ব্যর্থ হয়েছে");
    } else {
      supabase.functions.invoke("notify-telegram", {
        body: {
          event_type: "new_feedback",
          title: "💬 নতুন Feedback — Proshno Lab",
          fields: [
            { label: "👤 Teacher", value: user.email },
            { label: "📂 Category", value: form.category },
            { label: "⚡ Priority", value: form.priority },
            { label: "📝 Subject", value: form.subject },
            { label: "💭 Details", value: form.details.slice(0, 500) },
          ],
          link: { label: "Admin → Feedback", url: "https://proshnolab.com/admin/feedback" },
        },
      }).catch(() => {});
      toast.success("মতামত সাবমিট হয়েছে!");
      setForm({ category: "সাধারণ", subject: "", details: "", priority: "low" });
      fetchMyFeedbacks();
    }
  };

  const getStatusBadge = (s: string) => {
    const opt = statusMap[s] || statusMap.pending;
    const Icon = opt.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${opt.color}`}>
        <Icon className="w-3 h-3" />
        {opt.label}
      </span>
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold mb-6">মতামত জানান !</h1>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <Label>ক্যাটাগরি</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="ক্যাটাগরি নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>মতামতের বিষয়</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="বিষয় লিখুন" />
            </div>
            <div>
              <Label>বিস্তারিত লিখুন</Label>
              <Textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} placeholder="বিস্তারিত..." rows={5} />
            </div>
            <div>
              <Label>গুরুত্বের স্তর</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full gradient-hero text-white border-0 font-heading font-semibold" onClick={handleSubmit} disabled={loading}>
              {loading ? "সাবমিট হচ্ছে..." : "সাবমিট"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for history */}
      <Tabs defaultValue="feedback">
        <TabsList className="w-full">
          <TabsTrigger value="feedback" className="flex-1">মতামত ইতিহাস ({myFeedbacks.length})</TabsTrigger>
          <TabsTrigger value="reports" className="flex-1">প্রশ্ন রিপোর্ট ({myReports.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="feedback" className="space-y-3 mt-4">
          {myFeedbacks.length === 0 && <p className="text-center text-muted-foreground py-4">কোনো মতামত নেই</p>}
          {myFeedbacks.map((fb) => (
            <Card key={fb.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{fb.subject}</span>
                  {getStatusBadge(fb.status)}
                </div>
                <p className="text-sm text-muted-foreground">{fb.details}</p>
                {fb.admin_reply && (
                  <div className="mt-2 bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <div className="flex items-center gap-1 text-xs font-semibold text-primary mb-1">
                      <MessageSquareReply className="w-3 h-3" /> এ্যাডমিনের উত্তর
                    </div>
                    <p className="text-sm">{fb.admin_reply}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{new Date(fb.created_at).toLocaleDateString("bn-BD")}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="reports" className="space-y-3 mt-4">
          {myReports.length === 0 && <p className="text-center text-muted-foreground py-4">কোনো প্রশ্ন রিপোর্ট নেই</p>}
          {myReports.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-destructive" />
                    <span className="font-medium text-sm">{r.error_type}</span>
                  </div>
                  {getStatusBadge(r.status)}
                </div>
                {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                {r.admin_reply && (
                  <div className="mt-2 bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <div className="flex items-center gap-1 text-xs font-semibold text-primary mb-1">
                      <MessageSquareReply className="w-3 h-3" /> এ্যাডমিনের উত্তর
                    </div>
                    <p className="text-sm">{r.admin_reply}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("bn-BD")}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
