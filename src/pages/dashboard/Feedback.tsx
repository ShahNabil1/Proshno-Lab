import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const categories = ["সাধারণ", "বাগ রিপোর্ট", "ফিচার রিকোয়েস্ট", "অন্যান্য"];
const priorities = [
  { value: "low", label: "কম" },
  { value: "medium", label: "মাঝারি" },
  { value: "high", label: "বেশি" },
];

export default function Feedback() {
  const { user } = useAuth();
  const [form, setForm] = useState({ category: "সাধারণ", subject: "", details: "", priority: "low" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user || !form.subject || !form.details) {
      toast.error("সব ফিল্ড পূরণ করুন");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("feedback").insert({
      user_id: user.id,
      category: form.category,
      subject: form.subject,
      details: form.details,
      priority: form.priority,
    });
    setLoading(false);
    if (error) {
      toast.error("সাবমিট ব্যর্থ হয়েছে");
    } else {
      toast.success("মতামত সাবমিট হয়েছে!");
      setForm({ category: "সাধারণ", subject: "", details: "", priority: "low" });
    }
  };

  return (
    <div className="max-w-lg mx-auto">
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
            <Input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="বিষয় লিখুন"
            />
          </div>

          <div>
            <Label>বিস্তারিত লিখুন</Label>
            <Textarea
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              placeholder="বিস্তারিত..."
              rows={5}
            />
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

          <Button
            className="w-full gradient-hero text-white border-0 font-heading font-semibold"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "সাবমিট হচ্ছে..." : "সাবমিট"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
