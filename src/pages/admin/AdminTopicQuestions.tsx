import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

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
}

const emptyForm: QuestionForm = {
  type: "mcq",
  question: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_answer: "",
  explanation: "",
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

  // We need class_id, subject_id, chapter_id for inserting questions
  const [meta, setMeta] = useState<{ class_id: number; subject_id: number; chapter_id: number } | null>(null);

  useEffect(() => {
    if (!topicId) return;
    // Resolve chapter -> subject -> class
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
    const { data } = await supabase
      .from("questions")
      .select("*")
      .eq("topic_id", topicId)
      .order("created_at", { ascending: false });
    setQuestions(data || []);
  };

  useEffect(() => { fetchQuestions(); /* eslint-disable-next-line */ }, [topicId]);

  const openCreate = () => { setEditItem(null); setForm({ ...emptyForm }); setDialogOpen(true); };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({
      type: item.type || "mcq",
      question: item.question || "",
      option_a: item.option_a || "",
      option_b: item.option_b || "",
      option_c: item.option_c || "",
      option_d: item.option_d || "",
      correct_answer: item.correct_answer || "",
      explanation: item.explanation || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.question.trim()) { toast.error("প্রশ্ন লিখুন"); return; }
    if (!meta || !user) { toast.error("মেটাডাটা লোড হয়নি"); return; }

    const payload: any = {
      type: form.type,
      question: form.question.trim(),
      option_a: form.type === "mcq" ? form.option_a : null,
      option_b: form.type === "mcq" ? form.option_b : null,
      option_c: form.type === "mcq" ? form.option_c : null,
      option_d: form.type === "mcq" ? form.option_d : null,
      correct_answer: ["mcq", "short"].includes(form.type) ? form.correct_answer : null,
      explanation: form.type === "creative" ? form.explanation : (form.type === "descriptive" ? form.explanation : null),
      topic_id: topicId,
      class_id: meta.class_id,
      subject_id: meta.subject_id,
      chapter_id: meta.chapter_id,
      teacher_id: user.id,
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
    if (error) { toast.error("ডিলিট ব্যর্থ: " + error.message); return; }
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
                  <TableCell className="font-medium max-w-xs truncate">{q.question}</TableCell>
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

      {/* Question dialog */}
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
                <Textarea value={form.question} onChange={(e) => setField("question", e.target.value)} placeholder="প্রশ্নটি লিখুন" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>অপশন ক</Label><Input value={form.option_a} onChange={(e) => setField("option_a", e.target.value)} /></div>
                <div><Label>অপশন খ</Label><Input value={form.option_b} onChange={(e) => setField("option_b", e.target.value)} /></div>
                <div><Label>অপশন গ</Label><Input value={form.option_c} onChange={(e) => setField("option_c", e.target.value)} /></div>
                <div><Label>অপশন ঘ</Label><Input value={form.option_d} onChange={(e) => setField("option_d", e.target.value)} /></div>
              </div>
              <div>
                <Label>সঠিক উত্তর</Label>
                <select
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  value={form.correct_answer}
                  onChange={(e) => setField("correct_answer", e.target.value)}
                >
                  <option value="">নির্বাচন করুন</option>
                  <option value="ক">ক</option>
                  <option value="খ">খ</option>
                  <option value="গ">গ</option>
                  <option value="ঘ">ঘ</option>
                </select>
              </div>
            </TabsContent>

            {/* Short */}
            <TabsContent value="short" className="space-y-3 mt-4">
              <div>
                <Label>প্রশ্ন</Label>
                <Textarea value={form.question} onChange={(e) => setField("question", e.target.value)} placeholder="সংক্ষিপ্ত প্রশ্নটি লিখুন" />
              </div>
              <div>
                <Label>নমুনা উত্তর</Label>
                <Textarea value={form.correct_answer} onChange={(e) => setField("correct_answer", e.target.value)} placeholder="নমুনা উত্তর লিখুন" />
              </div>
            </TabsContent>

            {/* Creative / CQ */}
            <TabsContent value="creative" className="space-y-3 mt-4">
              <div>
                <Label>উদ্দীপক (Stem)</Label>
                <Textarea value={form.question} onChange={(e) => setField("question", e.target.value)} placeholder="উদ্দীপক লিখুন" rows={4} />
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div><Label>প্রশ্ন (ক)</Label><Input value={form.option_a} onChange={(e) => setField("option_a", e.target.value)} placeholder="জ্ঞানমূলক প্রশ্ন" /></div>
                <div><Label>প্রশ্ন (খ)</Label><Input value={form.option_b} onChange={(e) => setField("option_b", e.target.value)} placeholder="অনুধাবনমূলক প্রশ্ন" /></div>
                <div><Label>প্রশ্ন (গ)</Label><Input value={form.option_c} onChange={(e) => setField("option_c", e.target.value)} placeholder="প্রয়োগমূলক প্রশ্ন" /></div>
                <div><Label>প্রশ্ন (ঘ)</Label><Input value={form.option_d} onChange={(e) => setField("option_d", e.target.value)} placeholder="উচ্চতর দক্ষতামূলক প্রশ্ন" /></div>
              </div>
            </TabsContent>

            {/* Descriptive */}
            <TabsContent value="descriptive" className="space-y-3 mt-4">
              <div>
                <Label>প্রশ্ন</Label>
                <Textarea value={form.question} onChange={(e) => setField("question", e.target.value)} placeholder="রচনামূলক প্রশ্নটি লিখুন" rows={5} />
              </div>
              <div>
                <Label>ব্যাখ্যা / নোট (ঐচ্ছিক)</Label>
                <Textarea value={form.explanation} onChange={(e) => setField("explanation", e.target.value)} placeholder="ঐচ্ছিক ব্যাখ্যা" />
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
