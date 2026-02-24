import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import MathInput from "@/components/MathInput";
import LatexRenderer from "@/components/LatexRenderer";

const QUESTION_TYPES = [
  { value: "mcq", label: "বহুনির্বাচনী (MCQ)" },
  { value: "short", label: "সংক্ষিপ্ত প্রশ্ন" },
  { value: "creative", label: "সৃজনশীল (CQ)" },
  { value: "descriptive", label: "রচনামূলক" },
];

const TYPE_BADGE: Record<string, string> = {
  mcq: "bg-primary/10 text-primary",
  short: "bg-accent text-accent-foreground",
  creative: "bg-secondary text-secondary-foreground",
  descriptive: "bg-muted text-muted-foreground",
};

interface QuestionForm {
  type: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string;
  cq_stem: string;
  cq_q_ka: string;
  cq_q_kha: string;
  cq_q_ga: string;
  cq_q_gha: string;
  cq_ans_ka: string;
  cq_ans_kha: string;
  cq_ans_ga: string;
  cq_ans_gha: string;
}

const emptyForm: QuestionForm = {
  type: "mcq", question: "", option_a: "", option_b: "", option_c: "", option_d: "",
  correct_answer: "", explanation: "",
  cq_stem: "", cq_q_ka: "", cq_q_kha: "", cq_q_ga: "", cq_q_gha: "",
  cq_ans_ka: "", cq_ans_kha: "", cq_ans_ga: "", cq_ans_gha: "",
};

export default function AdminTopicQuestions() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const topicId = Number(searchParams.get("topic_id"));
  const topicName = searchParams.get("topic_name") || "";
  const chapterName = searchParams.get("chapter_name") || "";

  const [questions, setQuestions] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<QuestionForm>({ ...emptyForm });
  const [meta, setMeta] = useState<{ class_id: number; subject_id: number; chapter_id: number } | null>(null);

  useEffect(() => {
    if (!topicId) return;
    (async () => {
      const { data: topic } = await supabase.from("topics").select("chapter_id").eq("id", topicId).single();
      if (!topic) return;
      const { data: chapter } = await supabase.from("chapters").select("id, subject_id").eq("id", topic.chapter_id).single();
      if (!chapter) return;
      const { data: subject } = await supabase.from("subjects").select("id, class_id").eq("id", chapter.subject_id).single();
      if (!subject) return;
      setMeta({ class_id: subject.class_id, subject_id: subject.id, chapter_id: chapter.id });
    })();
  }, [topicId]);

  const fetchQuestions = async () => {
    if (!topicId) return;
    const { data } = await supabase.from("questions").select("*").eq("topic_id", topicId).order("created_at", { ascending: false });
    setQuestions(data || []);
  };

  useEffect(() => { fetchQuestions(); }, [topicId]);

  const openCreate = () => { setEditItem(null); setForm({ ...emptyForm }); setDialogOpen(true); };

  const openEdit = (item: any) => {
    setEditItem(item);
    const cd = item.creative_data || {};
    setForm({
      type: item.type || "mcq", question: item.question || "",
      option_a: item.option_a || "", option_b: item.option_b || "",
      option_c: item.option_c || "", option_d: item.option_d || "",
      correct_answer: item.correct_answer || "", explanation: item.explanation || "",
      cq_stem: cd.stem || "", cq_q_ka: cd.q_ka || "", cq_q_kha: cd.q_kha || "",
      cq_q_ga: cd.q_ga || "", cq_q_gha: cd.q_gha || "",
      cq_ans_ka: cd.ans_ka || "", cq_ans_kha: cd.ans_kha || "",
      cq_ans_ga: cd.ans_ga || "", cq_ans_gha: cd.ans_gha || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (form.type === "creative") {
      if (!form.cq_stem.trim()) { toast.error("উদ্দীপক লিখুন"); return; }
      if (!form.cq_q_ka.trim()) { toast.error("প্রশ্ন (ক) লিখুন"); return; }
    } else {
      if (!form.question.trim()) { toast.error("প্রশ্ন লিখুন"); return; }
    }
    if (!meta || !user) { toast.error("মেটাডাটা লোড হয়নি"); return; }

    const creativeData = form.type === "creative" ? {
      stem: form.cq_stem, q_ka: form.cq_q_ka, q_kha: form.cq_q_kha,
      q_ga: form.cq_q_ga, q_gha: form.cq_q_gha,
      ans_ka: form.cq_ans_ka, ans_kha: form.cq_ans_kha,
      ans_ga: form.cq_ans_ga, ans_gha: form.cq_ans_gha,
    } : null;

    const payload: any = {
      type: form.type,
      question: form.type === "creative" ? form.cq_stem.trim().substring(0, 100) + "..." : form.question.trim(),
      option_a: form.type === "mcq" ? form.option_a : null,
      option_b: form.type === "mcq" ? form.option_b : null,
      option_c: form.type === "mcq" ? form.option_c : null,
      option_d: form.type === "mcq" ? form.option_d : null,
      correct_answer: ["mcq", "short"].includes(form.type) ? form.correct_answer : null,
      explanation: form.type === "descriptive" ? form.explanation : null,
      creative_data: creativeData,
      topic_id: topicId, class_id: meta.class_id, subject_id: meta.subject_id,
      chapter_id: meta.chapter_id, teacher_id: user.id,
    };

    if (editItem) {
      const { error } = await supabase.from("questions").update(payload).eq("id", editItem.id);
      if (error) { toast.error("আপডেট ব্যর্থ: " + error.message); return; }
      toast.success("আপডেট হয়েছে");
    } else {
      const { error } = await supabase.from("questions").insert(payload);
      if (error) { toast.error("তৈরি ব্যর্থ: " + error.message); return; }
      toast.success("প্রশ্ন তৈরি হয়েছে");
    }
    setDialogOpen(false);
    fetchQuestions();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("মুছে ফেলতে চান?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) { toast.error("ডিলিট ব্যর্থ"); return; }
    toast.success("মুছে ফেলা হয়েছে");
    fetchQuestions();
  };

  const setField = (key: keyof QuestionForm, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const typeLabel = (t: string) => QUESTION_TYPES.find((q) => q.value === t)?.label || t;

  return (
    <div>
      <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4" /> টপিক ম্যানেজমেন্টে ফিরুন
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">প্রশ্ন ম্যানেজমেন্ট</h1>
          <p className="text-muted-foreground text-sm">অধ্যায়: {chapterName} → টপিক: {topicName}</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> নতুন প্রশ্ন যোগ করুন</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>প্রশ্ন</TableHead>
                <TableHead>ধরন</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>{q.id}</TableCell>
                  <TableCell className="font-medium max-w-xs truncate">
                    <LatexRenderer text={q.question} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={TYPE_BADGE[q.type] || ""}>{typeLabel(q.type)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(q)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {questions.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">কোনো প্রশ্ন নেই</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "প্রশ্ন সম্পাদনা" : "নতুন প্রশ্ন যোগ করুন"}</DialogTitle>
          </DialogHeader>

          <Tabs value={form.type} onValueChange={(v) => setField("type", v)} className="mt-2">
            <TabsList className="grid grid-cols-4 w-full">
              {QUESTION_TYPES.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="text-xs">{t.label}</TabsTrigger>
              ))}
            </TabsList>

            {/* MCQ */}
            <TabsContent value="mcq" className="space-y-3 mt-4">
              <div>
                <Label>প্রশ্ন</Label>
                <MathInput value={form.question} onChange={(v) => setField("question", v)} placeholder="প্রশ্নটি লিখুন... (LaTeX: $\\sqrt{x}$)" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>অপশন ক</Label><MathInput value={form.option_a} onChange={(v) => setField("option_a", v)} singleLine /></div>
                <div><Label>অপশন খ</Label><MathInput value={form.option_b} onChange={(v) => setField("option_b", v)} singleLine /></div>
                <div><Label>অপশন গ</Label><MathInput value={form.option_c} onChange={(v) => setField("option_c", v)} singleLine /></div>
                <div><Label>অপশন ঘ</Label><MathInput value={form.option_d} onChange={(v) => setField("option_d", v)} singleLine /></div>
              </div>
              <div>
                <Label>সঠিক উত্তর</Label>
                <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={form.correct_answer} onChange={(e) => setField("correct_answer", e.target.value)}>
                  <option value="">নির্বাচন করুন</option>
                  <option value="ক">ক</option><option value="খ">খ</option>
                  <option value="গ">গ</option><option value="ঘ">ঘ</option>
                </select>
              </div>
            </TabsContent>

            {/* Short */}
            <TabsContent value="short" className="space-y-3 mt-4">
              <div>
                <Label>প্রশ্ন</Label>
                <MathInput value={form.question} onChange={(v) => setField("question", v)} placeholder="সংক্ষিপ্ত প্রশ্নটি লিখুন" />
              </div>
              <div>
                <Label>নমুনা উত্তর</Label>
                <MathInput value={form.correct_answer} onChange={(v) => setField("correct_answer", v)} placeholder="নমুনা উত্তর লিখুন" />
              </div>
            </TabsContent>

            {/* Creative / CQ */}
            <TabsContent value="creative" className="space-y-4 mt-4">
              <div>
                <Label className="text-base font-semibold">উদ্দীপক (Stem/Stimulus)</Label>
                <MathInput value={form.cq_stem} onChange={(v) => setField("cq_stem", v)} placeholder="উদ্দীপক / প্যাসেজ লিখুন... (LaTeX: $\\vec{P}$)" rows={5} />
              </div>
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <p className="text-sm font-semibold text-muted-foreground">উপ-প্রশ্নসমূহ</p>
                <div><Label>প্রশ্ন (ক) — জ্ঞানমূলক</Label><MathInput value={form.cq_q_ka} onChange={(v) => setField("cq_q_ka", v)} singleLine placeholder="জ্ঞানমূলক প্রশ্ন" /></div>
                <div><Label>প্রশ্ন (খ) — অনুধাবনমূলক</Label><MathInput value={form.cq_q_kha} onChange={(v) => setField("cq_q_kha", v)} singleLine placeholder="অনুধাবনমূলক প্রশ্ন" /></div>
                <div><Label>প্রশ্ন (গ) — প্রয়োগমূলক</Label><MathInput value={form.cq_q_ga} onChange={(v) => setField("cq_q_ga", v)} singleLine placeholder="প্রয়োগমূলক প্রশ্ন" /></div>
                <div><Label>প্রশ্ন (ঘ) — উচ্চতর দক্ষতামূলক</Label><MathInput value={form.cq_q_gha} onChange={(v) => setField("cq_q_gha", v)} singleLine placeholder="উচ্চতর দক্ষতামূলক প্রশ্ন" /></div>
              </div>
              <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                <p className="text-sm font-semibold text-muted-foreground">নমুনা উত্তর (ঐচ্ছিক)</p>
                <div><Label>উত্তর (ক)</Label><MathInput value={form.cq_ans_ka} onChange={(v) => setField("cq_ans_ka", v)} rows={2} placeholder="ঐচ্ছিক নমুনা উত্তর" /></div>
                <div><Label>উত্তর (খ)</Label><MathInput value={form.cq_ans_kha} onChange={(v) => setField("cq_ans_kha", v)} rows={2} placeholder="ঐচ্ছিক নমুনা উত্তর" /></div>
                <div><Label>উত্তর (গ)</Label><MathInput value={form.cq_ans_ga} onChange={(v) => setField("cq_ans_ga", v)} rows={2} placeholder="ঐচ্ছিক নমুনা উত্তর" /></div>
                <div><Label>উত্তর (ঘ)</Label><MathInput value={form.cq_ans_gha} onChange={(v) => setField("cq_ans_gha", v)} rows={2} placeholder="ঐচ্ছিক নমুনা উত্তর" /></div>
              </div>
            </TabsContent>

            {/* Descriptive */}
            <TabsContent value="descriptive" className="space-y-3 mt-4">
              <div>
                <Label>প্রশ্ন</Label>
                <MathInput value={form.question} onChange={(v) => setField("question", v)} placeholder="রচনামূলক প্রশ্নটি লিখুন" rows={5} />
              </div>
              <div>
                <Label>ব্যাখ্যা / নোট (ঐচ্ছিক)</Label>
                <MathInput value={form.explanation} onChange={(v) => setField("explanation", v)} placeholder="ঐচ্ছিক ব্যাখ্যা" />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>বাতিল</Button>
            <Button onClick={handleSave}>{editItem ? "আপডেট" : "তৈরি করুন"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
