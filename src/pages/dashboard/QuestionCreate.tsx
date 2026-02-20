import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { mongoQuery } from "@/hooks/useMongo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, MessageSquare } from "lucide-react";

const typeOptions = ["MCQ", "সংক্ষিপ্ত", "সৃজনশীল", "বর্ণনামূলক"];

const collectionMap: Record<string, string> = {
  MCQ: "mcq",
  "সংক্ষিপ্ত": "short",
  "সৃজনশীল": "cq",
  "বর্ণনামূলক": "descriptive",
};

const classLabelMap: Record<string, string> = {
  "৩": "তৃতীয় শ্রেণী",
  "৪": "চতুর্থ শ্রেণী",
  "৫": "পঞ্চম শ্রেণী",
  "৬": "ষষ্ঠ শ্রেণী",
  "৭": "সপ্তম শ্রেণী",
  "৮": "অষ্টম শ্রেণী",
  "৯": "নবম/দশম",
  "১০": "দশম শ্রেণী",
  "১১": "এইচএসসি",
};

type WarningField = "subject" | "chapter" | null;

const warningMessages: Record<string, { title: string; prerequisite: string }> = {
  subject: { title: "বিষয় সিলেক্ট করুন", prerequisite: "বিষয় সিলেক্ট করার জন্য আগে শ্রেণী সিলেক্ট করুন !" },
  chapter: { title: "অধ্যায় সিলেক্ট করুন", prerequisite: "অধ্যায় সিলেক্ট করার জন্য আগে বিষয় সিলেক্ট করুন !" },
};

type Step = "form" | "questionSet" | "questionList";

interface MCQQuestion {
  _id: string;
  question: string;
  options?: string[];
  answer?: string;
  board?: string;
  year?: string;
  chapter?: string;
}

export default function QuestionCreate() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({
    programName: "",
    classLevel: "",
    subject: "",
    chapter: "",
    type: "MCQ",
    count: "10",
  });
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [chapters, setChapters] = useState<string[]>([]);
  const [warningDialog, setWarningDialog] = useState<WarningField>(null);

  // Question set state
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Institute info from Supabase
  const [institute, setInstitute] = useState<{ name: string } | null>(null);

  const currentCollection = collectionMap[form.type] || "mcq";

  // Fetch institute info
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("institutes")
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setInstitute(data);
      });
  }, [user?.id]);

  // Load classes dynamically
  useEffect(() => {
    mongoQuery({
      action: "aggregate",
      collection: currentCollection,
      pipeline: [
        { $group: { _id: "$class" } },
        { $sort: { _id: 1 } },
      ],
    }).then((r) => {
      const vals = (r?.documents?.map((d: any) => d._id).filter(Boolean) as string[]) || [];
      setClasses(vals);
    }).catch(() => setClasses([]));
    setForm((prev) => ({ ...prev, classLevel: "", subject: "", chapter: "" }));
    setSubjects([]);
    setChapters([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCollection]);

  // Load subjects when class changes
  useEffect(() => {
    if (!form.classLevel) { setSubjects([]); return; }
    mongoQuery({
      action: "aggregate",
      collection: currentCollection,
      pipeline: [
        { $match: { class: form.classLevel } },
        { $group: { _id: "$subject" } },
        { $sort: { _id: 1 } },
      ],
    }).then((r) => {
      setSubjects((r?.documents?.map((d: any) => d._id).filter(Boolean) as string[]) || []);
    }).catch(() => setSubjects([]));
  }, [form.classLevel, currentCollection]);

  // Load chapters when subject changes
  useEffect(() => {
    if (!form.classLevel || !form.subject) { setChapters([]); return; }
    mongoQuery({
      action: "aggregate",
      collection: currentCollection,
      pipeline: [
        { $match: { class: form.classLevel, subject: form.subject } },
        { $group: { _id: "$chapter" } },
        { $sort: { _id: 1 } },
      ],
    }).then((r) => {
      setChapters((r?.documents?.map((d: any) => d._id).filter(Boolean) as string[]) || []);
    }).catch(() => setChapters([]));
  }, [form.classLevel, form.subject, currentCollection]);

  const handleSubjectClick = () => {
    if (!form.classLevel) setWarningDialog("subject");
  };

  const handleChapterClick = () => {
    if (!form.subject) setWarningDialog("chapter");
  };

  // Step 1 → Step 2: Generate question set
  const handleCreateQuestionSet = async () => {
    if (!form.classLevel || !form.subject) {
      toast.error("শ্রেণী ও বিষয় নির্বাচন করুন");
      return;
    }
    setLoading(true);
    try {
      const filter: Record<string, unknown> = { class: form.classLevel, subject: form.subject };
      if (form.chapter) filter.chapter = form.chapter;

      const result = await mongoQuery({
        action: "find",
        collection: currentCollection,
        filter,
        limit: parseInt(form.count) || 10,
      });

      const docs = result?.documents || [];
      if (docs.length === 0) {
        toast.info("এই ফিল্টারে কোনো প্রশ্ন পাওয়া যায়নি");
        return;
      }

      setQuestions(docs);
      toast.success(`${docs.length}টি প্রশ্ন পাওয়া গেছে!`);
      setStep("questionSet");
    } catch {
      toast.error("প্রশ্ন আনতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 → Step 3
  const handleAddQuestions = () => {
    setStep("questionList");
  };

  // Toggle question selection
  const toggleQuestion = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === questions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(questions.map((q) => q._id)));
    }
  };

  const classLabel = classLabelMap[form.classLevel] || form.classLevel;
  const chapterLabel = form.chapter || "";

  const filteredQuestions = searchQuery
    ? questions.filter((q) => q.question?.includes(searchQuery))
    : questions;

  // ─── STEP 2: Question Set Header ───
  if (step === "questionSet") {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardContent className="p-8">
            {/* Header info */}
            <div className="text-center space-y-1 mb-6">
              <h2 className="text-xl font-bold font-heading">
                {institute?.name || "আপনার প্রতিষ্ঠানের নাম"}
              </h2>
              <p className="text-sm">{classLabel}</p>
              <p className="text-sm">{form.subject}</p>
              {chapterLabel && <p className="text-sm">{chapterLabel}</p>}
            </div>

            <div className="flex justify-between text-sm mb-4 border-t border-b border-border py-2">
              <span>সময়: ১০ মিনিট</span>
              <span>পূর্ণমান: {form.count}</span>
            </div>

            <p className="text-center text-sm text-muted-foreground mb-8">
              প্রশ্নপত্রে কোনো প্রকার দাগ/চিহ্ন দেয়া যাবেনা ।
            </p>

            {/* Success message */}
            <div className="text-center space-y-3 py-6">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="h-6 w-6" />
                <span className="text-lg font-semibold font-heading">প্রশ্নসেট তৈরী হয়েছে!</span>
              </div>
              <p className="text-sm text-muted-foreground">
                নিচের বাটনে ক্লিক করে ডেটাবেজ থেকে প্রশ্ন যুক্ত করুন
              </p>
              <Button
                className="gradient-green text-primary-foreground border-0 font-heading font-semibold px-8"
                onClick={handleAddQuestions}
              >
                প্রশ্ন যুক্ত করুন
              </Button>
            </div>
          </CardContent>
        </Card>

        <Button variant="outline" className="mt-4" onClick={() => setStep("form")}>
          ← ফিরে যান
        </Button>
      </div>
    );
  }

  // ─── STEP 3: Question List ───
  if (step === "questionList") {
    return (
      <div className="space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Selected: {selectedIds.size}/{questions.length}</span>
            <Button variant="outline" size="sm" onClick={selectAll}>
              {selectedIds.size === questions.length ? "Deselect All" : "Select All"}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setStep("questionSet")}>
              ← ফিরে যান
            </Button>
            <Button
              className="gradient-green text-primary-foreground border-0"
              size="sm"
              onClick={() => {
                toast.success(`${selectedIds.size}টি প্রশ্ন সংরক্ষিত হয়েছে!`);
              }}
              disabled={selectedIds.size === 0}
            >
              💾 Save
            </Button>
          </div>
        </div>

        {/* Warning banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center text-sm text-amber-800">
          প্রশ্নে ভুল পেলে রিপোর্ট করে প্রশ্নব্যাংককে সমৃদ্ধ করুন ।
        </div>

        {/* Title edit */}
        <div className="flex items-center gap-2">
          <Input
            value={form.programName || `টাইটেল - Test ${parseInt(form.count)}`}
            onChange={(e) => setForm({ ...form, programName: e.target.value })}
            className="max-w-xs"
          />
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <Input
            placeholder="কিওয়ার্ড সার্চ করুন"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
        </div>

        {/* Question Cards */}
        <div className="space-y-4">
          {filteredQuestions.map((q, idx) => (
            <Card
              key={q._id}
              className={`transition-colors ${selectedIds.has(q._id) ? "border-primary/50 bg-primary/5" : ""}`}
            >
              <CardContent className="p-4">
                {/* Badge row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedIds.has(q._id)}
                      onCheckedChange={() => toggleQuestion(q._id)}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {q.board && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{q.board}</span>
                    )}
                    {q.year && (
                      <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">{q.year}</span>
                    )}
                    <button className="text-muted-foreground hover:text-foreground">
                      <MessageSquare className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Question text */}
                <p className="font-medium mb-3">
                  {idx + 1}. {q.question}
                </p>

                {/* MCQ options */}
                {q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {q.options.map((opt, oi) => {
                      const label = ["ক", "খ", "গ", "ঘ"][oi] || String(oi + 1);
                      const isAnswer = q.answer === opt || q.answer === String(oi);
                      return (
                        <div
                          key={oi}
                          className={`flex items-center gap-2 p-2 rounded text-sm ${
                            isAnswer ? "bg-green-100 text-green-800 font-semibold" : "bg-muted/50"
                          }`}
                        >
                          <span className="font-medium">{label})</span> {opt}
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
          <p className="text-sm text-muted-foreground text-center mb-2">
            নিচের ইনপুট ফিল্ড গুলো ফিল্ড সিলেক্ট করে সাবমিট করুন
          </p>

          <div className="space-y-3">
            <div>
              <Label>প্রোগ্রাম/পরীক্ষার নাম লিখুন *</Label>
              <Input
                placeholder="প্রোগ্রাম/পরীক্ষার নাম"
                value={form.programName}
                onChange={(e) => setForm({ ...form, programName: e.target.value })}
              />
            </div>

            <div>
              <Label>টাইপ</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {typeOptions.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>শ্রেণী</Label>
              <Select
                value={form.classLevel}
                onValueChange={(v) => setForm({ ...form, classLevel: v, subject: "", chapter: "" })}
              >
                <SelectTrigger><SelectValue placeholder="শ্রেণী সিলেক্ট করুন" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c} value={c}>
                      {classLabelMap[c] || `${c} শ্রেণী`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div onClick={!form.classLevel ? handleSubjectClick : undefined}>
              <Label>বিষয়</Label>
              <Select
                value={form.subject}
                onValueChange={(v) => setForm({ ...form, subject: v, chapter: "" })}
                disabled={!form.classLevel}
              >
                <SelectTrigger><SelectValue placeholder="বিষয় সিলেক্ট করুন" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div onClick={!form.subject ? handleChapterClick : undefined}>
              <Label>অধ্যায়</Label>
              <Select
                value={form.chapter}
                onValueChange={(v) => setForm({ ...form, chapter: v })}
                disabled={!form.subject}
              >
                <SelectTrigger><SelectValue placeholder="অধ্যায় সিলেক্ট করুন" /></SelectTrigger>
                <SelectContent>
                  {chapters.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>সংখ্যা</Label>
              <Input
                type="number"
                value={form.count}
                onChange={(e) => setForm({ ...form, count: e.target.value })}
              />
            </div>

            <Button
              className="w-full gradient-green text-primary-foreground border-0 font-heading font-semibold"
              onClick={handleCreateQuestionSet}
              disabled={loading}
            >
              {loading ? "অপেক্ষা করুন..." : "প্রশ্ন তৈরী করুন"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Warning Dialog */}
      <Dialog open={!!warningDialog} onOpenChange={() => setWarningDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              {warningDialog && warningMessages[warningDialog].title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-sm py-2">
            {warningDialog && warningMessages[warningDialog].prerequisite}
          </p>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" className="flex-1 bg-accent/50 hover:bg-accent border-accent" onClick={() => setWarningDialog(null)}>
              সিলেক্ট করুন
            </Button>
            <Button variant="outline" className="flex-1 bg-destructive/10 hover:bg-destructive/20 border-destructive/30" onClick={() => setWarningDialog(null)}>
              বন্ধ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
