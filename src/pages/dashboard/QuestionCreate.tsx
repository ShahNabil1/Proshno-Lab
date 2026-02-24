import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, MessageSquare } from "lucide-react";

const typeOptions = ["mcq", "short", "cq", "mcq_short", "mcq_short_cq"];
const typeLabels: Record<string, string> = { mcq: "MCQ", short: "সংক্ষিপ্ত", cq: "সৃজনশীল", mcq_short: "MCQ, সংক্ষিপ্ত", mcq_short_cq: "MCQ, সংক্ষিপ্ত, সৃজনশীল" };
const typeDbValues: Record<string, string[]> = {
  mcq: ["mcq"], short: ["short"], cq: ["cq"],
  mcq_short: ["mcq", "short"],
  mcq_short_cq: ["mcq", "short", "cq"],
};

type WarningField = "subject" | "chapter" | null;
const warningMessages: Record<string, { title: string; prerequisite: string }> = {
  subject: { title: "বিষয় সিলেক্ট করুন", prerequisite: "বিষয় সিলেক্ট করার জন্য আগে শ্রেণী সিলেক্ট করুন !" },
  chapter: { title: "অধ্যায় সিলেক্ট করুন", prerequisite: "অধ্যায় সিলেক্ট করার জন্য আগে বিষয় সিলেক্ট করুন !" },
};

type Step = "form" | "questionSet" | "questionList";

interface QuestionRow {
  id: number;
  question: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_answer?: string;
  type: string;
  explanation?: string;
}

export default function QuestionCreate() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({
    programName: "",
    classId: "",
    subjectId: "",
    chapterId: "",
    type: "mcq",
    count: "10",
  });
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; name: string }[]>([]);
  const [chapters, setChapters] = useState<{ id: number; name: string }[]>([]);
  const [warningDialog, setWarningDialog] = useState<WarningField>(null);

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const [institute, setInstitute] = useState<{ name: string } | null>(null);

  // Fetch institute
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("institutes").select("name").eq("owner_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setInstitute(data); });
  }, [user?.id]);

  // Load classes
  useEffect(() => {
    supabase.from("classes").select("id, name").order("name")
      .then(({ data }) => setClasses(data || []));
  }, []);

  // Load subjects when class changes
  useEffect(() => {
    if (!form.classId) { setSubjects([]); return; }
    supabase.from("subjects").select("id, name").eq("class_id", Number(form.classId)).order("name")
      .then(({ data }) => setSubjects(data || []));
  }, [form.classId]);

  // Load chapters when subject changes
  useEffect(() => {
    if (!form.subjectId) { setChapters([]); return; }
    supabase.from("chapters").select("id, name").eq("subject_id", Number(form.subjectId)).order("name")
      .then(({ data }) => setChapters(data || []));
  }, [form.subjectId]);

  const handleCreateQuestionSet = async () => {
    if (!form.classId || !form.subjectId) {
      toast.error("শ্রেণী ও বিষয় নির্বাচন করুন");
      return;
    }
    setLoading(true);
    try {
      const dbTypes = typeDbValues[form.type] || [form.type];
      let query = supabase.from("questions").select("*")
        .eq("class_id", Number(form.classId))
        .eq("subject_id", Number(form.subjectId))
        .in("type", dbTypes);
      if (form.chapterId) query = query.eq("chapter_id", Number(form.chapterId));
      query = query.limit(parseInt(form.count) || 10);

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.info("এই ফিল্টারে কোনো প্রশ্ন পাওয়া যায়নি");
        return;
      }
      setQuestions(data);
      toast.success(`${data.length}টি প্রশ্ন পাওয়া গেছে!`);
      setStep("questionSet");
    } catch {
      toast.error("প্রশ্ন আনতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestions = () => setStep("questionList");

  const toggleQuestion = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === questions.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(questions.map((q) => q.id)));
  };

  const className = classes.find(c => String(c.id) === form.classId)?.name || "";
  const subjectName = subjects.find(s => String(s.id) === form.subjectId)?.name || "";
  const chapterName = chapters.find(c => String(c.id) === form.chapterId)?.name || "";

  const filteredQuestions = searchQuery
    ? questions.filter((q) => q.question?.includes(searchQuery))
    : questions;

  // ─── STEP 2: Question Set Header ───
  if (step === "questionSet") {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardContent className="p-8">
            <div className="text-center space-y-1 mb-6">
              <h2 className="text-xl font-bold font-heading">{institute?.name || "আপনার প্রতিষ্ঠানের নাম"}</h2>
              <p className="text-sm">{className}</p>
              <p className="text-sm">{subjectName}</p>
              {chapterName && <p className="text-sm">{chapterName}</p>}
            </div>
            <div className="flex justify-between text-sm mb-4 border-t border-b border-border py-2">
              <span>সময়: ১০ মিনিট</span>
              <span>পূর্ণমান: {form.count}</span>
            </div>
            <p className="text-center text-sm text-muted-foreground mb-8">প্রশ্নপত্রে কোনো প্রকার দাগ/চিহ্ন দেয়া যাবেনা ।</p>
            <div className="text-center space-y-3 py-6">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="h-6 w-6" />
                <span className="text-lg font-semibold font-heading">প্রশ্নসেট তৈরী হয়েছে!</span>
              </div>
              <p className="text-sm text-muted-foreground">নিচের বাটনে ক্লিক করে ডেটাবেজ থেকে প্রশ্ন যুক্ত করুন</p>
              <Button className="gradient-green text-primary-foreground border-0 font-heading font-semibold px-8" onClick={handleAddQuestions}>
                প্রশ্ন যুক্ত করুন
              </Button>
            </div>
          </CardContent>
        </Card>
        <Button variant="outline" className="mt-4" onClick={() => setStep("form")}>← ফিরে যান</Button>
      </div>
    );
  }

  // ─── STEP 3: Question List ───
  if (step === "questionList") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Selected: {selectedIds.size}/{questions.length}</span>
            <Button variant="outline" size="sm" onClick={selectAll}>
              {selectedIds.size === questions.length ? "Deselect All" : "Select All"}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setStep("questionSet")}>← ফিরে যান</Button>
            <Button className="gradient-green text-primary-foreground border-0" size="sm"
              onClick={() => toast.success(`${selectedIds.size}টি প্রশ্ন সংরক্ষিত হয়েছে!`)}
              disabled={selectedIds.size === 0}>💾 Save</Button>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center text-sm text-amber-800">
          প্রশ্নে ভুল পেলে রিপোর্ট করে প্রশ্নব্যাংককে সমৃদ্ধ করুন ।
        </div>

        <Input placeholder="কিওয়ার্ড সার্চ করুন" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-xs" />

        <div className="space-y-4">
          {filteredQuestions.map((q, idx) => (
            <Card key={q.id} className={`transition-colors ${selectedIds.has(q.id) ? "border-primary/50 bg-primary/5" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Checkbox checked={selectedIds.has(q.id)} onCheckedChange={() => toggleQuestion(q.id)} />
                  <button className="text-muted-foreground hover:text-foreground"><MessageSquare className="h-4 w-4" /></button>
                </div>
                <p className="font-medium mb-3">{idx + 1}. {q.question}</p>
                {q.type === "mcq" && q.option_a && (
                  <div className="grid grid-cols-2 gap-2">
                    {["option_a", "option_b", "option_c", "option_d"].map((key, oi) => {
                      const val = (q as any)[key];
                      if (!val) return null;
                      const label = ["ক", "খ", "গ", "ঘ"][oi];
                      const isAnswer = q.correct_answer === val || q.correct_answer === label;
                      return (
                        <div key={key} className={`flex items-center gap-2 p-2 rounded text-sm ${isAnswer ? "bg-green-100 text-green-800 font-semibold" : "bg-muted/50"}`}>
                          <span className="font-medium">{label})</span> {val}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ─── STEP 1: Form ───
  return (
    <div className="max-w-2xl mx-auto">
      <div className="gradient-hero rounded-2xl p-8 text-center text-white mb-6">
        <h1 className="font-heading text-2xl font-bold">১ ক্লিকে প্রশ্ন তৈরীর সফটওয়্যার !</h1>
        <p className="text-white/60 text-sm mt-2">শিক্ষা এবং সফটওয়্যার, একসাথে এগিয়ে চলা! 🎓</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground text-center mb-2">নিচের ইনপুট ফিল্ড গুলো ফিল্ড সিলেক্ট করে সাবমিট করুন</p>
          <div className="space-y-3">
            <div>
              <Label>প্রোগ্রাম/পরীক্ষার নাম লিখুন *</Label>
              <Input placeholder="প্রোগ্রাম/পরীক্ষার নাম" value={form.programName} onChange={(e) => setForm({ ...form, programName: e.target.value })} />
            </div>
            <div>
              <Label>টাইপ</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {typeOptions.map((t) => <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>শ্রেণী</Label>
              <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v, subjectId: "", chapterId: "" })}>
                <SelectTrigger><SelectValue placeholder="শ্রেণী সিলেক্ট করুন" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div onClick={!form.classId ? () => setWarningDialog("subject") : undefined}>
              <Label>বিষয়</Label>
              <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v, chapterId: "" })} disabled={!form.classId}>
                <SelectTrigger><SelectValue placeholder="বিষয় সিলেক্ট করুন" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div onClick={!form.subjectId ? () => setWarningDialog("chapter") : undefined}>
              <Label>অধ্যায়</Label>
              <Select value={form.chapterId} onValueChange={(v) => setForm({ ...form, chapterId: v })} disabled={!form.subjectId}>
                <SelectTrigger><SelectValue placeholder="অধ্যায় সিলেক্ট করুন" /></SelectTrigger>
                <SelectContent>
                  {chapters.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>সংখ্যা</Label>
              <Input type="number" value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} />
            </div>
            <Button className="w-full gradient-green text-primary-foreground border-0 font-heading font-semibold" onClick={handleCreateQuestionSet} disabled={loading}>
              {loading ? "অপেক্ষা করুন..." : "প্রশ্ন তৈরী করুন"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!warningDialog} onOpenChange={() => setWarningDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">{warningDialog && warningMessages[warningDialog].title}</DialogTitle>
          </DialogHeader>
          <p className="text-center text-sm py-2">{warningDialog && warningMessages[warningDialog].prerequisite}</p>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" className="flex-1 bg-accent/50 hover:bg-accent border-accent" onClick={() => setWarningDialog(null)}>সিলেক্ট করুন</Button>
            <Button variant="outline" className="flex-1 bg-destructive/10 hover:bg-destructive/20 border-destructive/30" onClick={() => setWarningDialog(null)}>বন্ধ করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
