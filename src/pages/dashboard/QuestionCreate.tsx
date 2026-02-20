import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { mongoQuery } from "@/hooks/useMongo";
import { toast } from "sonner";

const classOptions = ["এইচএসসি", "নবম/দশম", "অষ্টম শ্রেণী", "সপ্তম শ্রেণী", "ষষ্ঠ শ্রেণী", "পঞ্চম শ্রেণী", "চতুর্থ শ্রেণী", "তৃতীয় শ্রেণী"];
const typeOptions = ["MCQ", "সংক্ষিপ্ত", "সৃজনশীল", "বর্ণনামূলক"];

type WarningField = "subject" | "chapter" | "topic" | null;

const warningMessages: Record<string, { title: string; prerequisite: string }> = {
  subject: { title: "বিষয় সিলেক্ট করুন", prerequisite: "বিষয় সিলেক্ট করার জন্য আগে শ্রেণী সিলেক্ট করুন !" },
  chapter: { title: "অধ্যায় সিলেক্ট করুন", prerequisite: "অধ্যায় সিলেক্ট করার জন্য আগে বিষয় সিলেক্ট করুন !" },
  topic: { title: "টপিক সিলেক্ট করুন", prerequisite: "টপিক সিলেক্ট করার জন্য আগে অধ্যায় সিলেক্ট করুন !" },
};

export default function QuestionCreate() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    programName: "",
    classLevel: "",
    subject: "",
    chapter: "",
    topic: "",
    type: "MCQ",
    count: "10",
  });
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [chapters, setChapters] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [warningDialog, setWarningDialog] = useState<WarningField>(null);

  // Load subjects when class changes
  useEffect(() => {
    if (!form.classLevel) { setSubjects([]); return; }
    mongoQuery({
      action: "aggregate",
      collection: "mcq",
      pipeline: [
        { $match: { class: form.classLevel } },
        { $group: { _id: "$subject" } },
      ],
    }).then((r) => {
      setSubjects(r?.documents?.map((d: any) => d._id).filter(Boolean) || []);
    }).catch(() => {});
  }, [form.classLevel]);

  // Load chapters when subject changes
  useEffect(() => {
    if (!form.classLevel || !form.subject) { setChapters([]); return; }
    mongoQuery({
      action: "aggregate",
      collection: "mcq",
      pipeline: [
        { $match: { class: form.classLevel, subject: form.subject } },
        { $group: { _id: "$chapter" } },
      ],
    }).then((r) => {
      setChapters(r?.documents?.map((d: any) => d._id).filter(Boolean) || []);
    }).catch(() => {});
  }, [form.classLevel, form.subject]);

  // Load topics when chapter changes
  useEffect(() => {
    if (!form.classLevel || !form.subject || !form.chapter) { setTopics([]); return; }
    mongoQuery({
      action: "aggregate",
      collection: "mcq",
      pipeline: [
        { $match: { class: form.classLevel, subject: form.subject, chapter: form.chapter } },
        { $group: { _id: "$topic" } },
      ],
    }).then((r) => {
      setTopics(r?.documents?.map((d: any) => d._id).filter(Boolean) || []);
    }).catch(() => {});
  }, [form.classLevel, form.subject, form.chapter]);

  const handleSubjectClick = () => {
    if (!form.classLevel) { setWarningDialog("subject"); return; }
  };

  const handleChapterClick = () => {
    if (!form.subject) { setWarningDialog("chapter"); return; }
  };

  const handleTopicClick = () => {
    if (!form.chapter) { setWarningDialog("topic"); return; }
  };

  const handleSubmit = async () => {
    if (!form.classLevel || !form.subject) {
      toast.error("শ্রেণী ও বিষয় নির্বাচন করুন");
      return;
    }
    setLoading(true);
    try {
      const collectionMap: Record<string, string> = {
        MCQ: "mcq",
        "সংক্ষিপ্ত": "short",
        "সৃজনশীল": "cq",
        "বর্ণনামূলক": "descriptive",
      };
      const coll = collectionMap[form.type] || "mcq";
      const filter: Record<string, unknown> = { class: form.classLevel, subject: form.subject };
      if (form.chapter) filter.chapter = form.chapter;
      if (form.topic) filter.topic = form.topic;

      const result = await mongoQuery({
        action: "find",
        collection: coll,
        filter,
        limit: parseInt(form.count) || 10,
      });

      const questions = result?.documents || [];
      if (questions.length === 0) {
        toast.info("এই ফিল্টারে কোনো প্রশ্ন পাওয়া যায়নি");
      } else {
        toast.success(`${questions.length}টি প্রশ্ন পাওয়া গেছে!`);
      }
    } catch {
      toast.error("প্রশ্ন আনতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Banner */}
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

            {/* শ্রেণী */}
            <div>
              <Label>শ্রেণী</Label>
              <Select value={form.classLevel} onValueChange={(v) => setForm({ ...form, classLevel: v, subject: "", chapter: "", topic: "" })}>
                <SelectTrigger><SelectValue placeholder="শ্রেণী" /></SelectTrigger>
                <SelectContent>
                  {classOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!form.classLevel && (
                <p className="text-xs text-destructive mt-1">শ্রেণী সিলেক্ট করুন</p>
              )}
            </div>

            {/* বিষয় */}
            <div onClick={!form.classLevel ? handleSubjectClick : undefined}>
              <Label>বিষয়</Label>
              <Select
                value={form.subject}
                onValueChange={(v) => setForm({ ...form, subject: v, chapter: "", topic: "" })}
                disabled={!form.classLevel}
              >
                <SelectTrigger><SelectValue placeholder="বিষয়" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* অধ্যায় */}
            <div onClick={!form.subject ? handleChapterClick : undefined}>
              <Label>অধ্যায়</Label>
              <Select
                value={form.chapter}
                onValueChange={(v) => setForm({ ...form, chapter: v, topic: "" })}
                disabled={!form.subject}
              >
                <SelectTrigger><SelectValue placeholder="অধ্যায়" /></SelectTrigger>
                <SelectContent>
                  {chapters.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* টপিক */}
            <div onClick={!form.chapter ? handleTopicClick : undefined}>
              <Label>টপিক</Label>
              <Select
                value={form.topic}
                onValueChange={(v) => setForm({ ...form, topic: v })}
                disabled={!form.chapter}
              >
                <SelectTrigger><SelectValue placeholder="টপিক" /></SelectTrigger>
                <SelectContent>
                  {topics.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                <Label>সংখ্যা</Label>
                <Input
                  type="number"
                  value={form.count}
                  onChange={(e) => setForm({ ...form, count: e.target.value })}
                />
              </div>
            </div>

            <Button
              className="w-full gradient-green text-primary-foreground border-0 font-heading font-semibold"
              onClick={handleSubmit}
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
            <Button
              variant="outline"
              className="flex-1 bg-accent/50 hover:bg-accent border-accent"
              onClick={() => setWarningDialog(null)}
            >
              সিলেক্ট করুন
            </Button>
            <Button
              variant="outline"
              className="flex-1 bg-destructive/10 hover:bg-destructive/20 border-destructive/30"
              onClick={() => setWarningDialog(null)}
            >
              বন্ধ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
