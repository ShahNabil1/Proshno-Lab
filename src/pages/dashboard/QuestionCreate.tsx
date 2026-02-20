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

const typeOptions = ["MCQ", "সংক্ষিপ্ত", "সৃজনশীল", "বর্ণনামূলক"];

const collectionMap: Record<string, string> = {
  MCQ: "mcq",
  "সংক্ষিপ্ত": "short",
  "সৃজনশীল": "cq",
  "বর্ণনামূলক": "descriptive",
};

// Map DB class values (Bengali numerals) to display labels
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

export default function QuestionCreate() {
  const { user } = useAuth();
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

  const currentCollection = collectionMap[form.type] || "mcq";

  // Load classes dynamically from the selected type's collection
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
    // Reset downstream selections when type changes
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
    if (!form.classLevel) { setWarningDialog("subject"); }
  };

  const handleChapterClick = () => {
    if (!form.subject) { setWarningDialog("chapter"); }
  };

  const handleSubmit = async () => {
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

            {/* টাইপ — moved before class so collection is selected first */}
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

            {/* শ্রেণী — dynamically loaded */}
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
              {!form.classLevel && (
                <p className="text-xs text-destructive mt-1">শ্রেণী সিলেক্ট করুন</p>
              )}
            </div>

            {/* বিষয় */}
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

            {/* অধ্যায় */}
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
