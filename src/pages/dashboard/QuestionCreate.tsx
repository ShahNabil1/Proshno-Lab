import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { mongoQuery } from "@/hooks/useMongo";
import { toast } from "sonner";

const classOptions = ["এইচএসসি", "নবম/দশম", "অষ্টম শ্রেণী", "সপ্তম শ্রেণী", "ষষ্ঠ শ্রেণী", "পঞ্চম শ্রেণী", "চতুর্থ শ্রেণী", "তৃতীয় শ্রেণী"];
const typeOptions = ["MCQ", "সংক্ষিপ্ত", "সৃজনশীল", "বর্ণনামূলক"];

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
  const [subjects, setSubjects] = useState<string[]>([]);
  const [chapters, setChapters] = useState<string[]>([]);

  // Load subjects when class changes
  useEffect(() => {
    if (!form.classLevel) return;
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
    if (!form.classLevel || !form.subject) return;
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

  const handleSubmit = async () => {
    if (!form.classLevel || !form.subject) {
      toast.error("শ্রেণী ও বিষয় নির্বাচন করুন");
      return;
    }
    setLoading(true);
    try {
      // For now, just fetch random questions matching criteria
      const collectionMap: Record<string, string> = {
        MCQ: "mcq",
        "সংক্ষিপ্ত": "short",
        "সৃজনশীল": "cq",
        "বর্ণনামূলক": "descriptive",
      };
      const coll = collectionMap[form.type] || "mcq";
      const filter: Record<string, unknown> = { class: form.classLevel, subject: form.subject };
      if (form.chapter) filter.chapter = form.chapter;

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

            <div>
              <Label>শ্রেণী</Label>
              <Select value={form.classLevel} onValueChange={(v) => setForm({ ...form, classLevel: v, subject: "", chapter: "" })}>
                <SelectTrigger><SelectValue placeholder="শ্রেণী" /></SelectTrigger>
                <SelectContent>
                  {classOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>বিষয়</Label>
              <Select value={form.subject} onValueChange={(v) => setForm({ ...form, subject: v, chapter: "" })}>
                <SelectTrigger><SelectValue placeholder="বিষয়" /></SelectTrigger>
                <SelectContent>
                  {subjects.length > 0 ? subjects.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  )) : (
                    <SelectItem value="_" disabled>প্রথমে শ্রেণী নির্বাচন করুন</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>অধ্যায়</Label>
              <Select value={form.chapter} onValueChange={(v) => setForm({ ...form, chapter: v })}>
                <SelectTrigger><SelectValue placeholder="অধ্যায়" /></SelectTrigger>
                <SelectContent>
                  {chapters.length > 0 ? chapters.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  )) : (
                    <SelectItem value="_" disabled>প্রথমে বিষয় নির্বাচন করুন</SelectItem>
                  )}
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
    </div>
  );
}
