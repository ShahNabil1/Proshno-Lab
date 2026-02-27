import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import ReferenceInput from "@/components/ReferenceInput";

const SUB_QUESTIONS = [
  { label: "ক", marks: 2 },
  { label: "খ", marks: 4 },
  { label: "গ", marks: 4 },
];

const specialSearchOptions = [
  { id: "board", label: "রিপিটেড বোর্ড প্রশ্ন" },
  { id: "math", label: "গাণিতিক" },
  { id: "theoretical", label: "তত্ত্বীয়" },
  { id: "diagram", label: "চিত্রযুক্ত প্রশ্ন" },
  { id: "multi_completion", label: "বহুপদী সমাপ্তিসূচক" },
  { id: "assertion", label: "অভিন্ন তথ্যভিত্তিক" },
];

export default function CQCreate() {
  const { user } = useAuth();

  // Cascading selectors
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId] = useState("");

  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; name: string }[]>([]);
  const [chapters, setChapters] = useState<{ id: number; name: string }[]>([]);
  const [topics, setTopics] = useState<{ id: number; name: string }[]>([]);

  // CQ content
  const [stem, setStem] = useState("");
  const [subQs, setSubQs] = useState(["", "", ""]);
  const [answers, setAnswers] = useState(["", "", ""]);
  const [explanation, setExplanation] = useState("");

  // References
  const [boardRefs, setBoardRefs] = useState<{ board: string; year: string }[]>([]);
  const [specialSearch, setSpecialSearch] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);

  // Load cascading data
  useEffect(() => {
    supabase.from("classes").select("id, name").order("name")
      .then(({ data }) => setClasses(data || []));
  }, []);

  useEffect(() => {
    if (!classId) { setSubjects([]); return; }
    supabase.from("subjects").select("id, name").eq("class_id", Number(classId)).order("name")
      .then(({ data }) => setSubjects(data || []));
    setSubjectId(""); setChapterId(""); setTopicId("");
  }, [classId]);

  useEffect(() => {
    if (!subjectId) { setChapters([]); return; }
    supabase.from("chapters").select("id, name").eq("subject_id", Number(subjectId)).order("name")
      .then(({ data }) => setChapters(data || []));
    setChapterId(""); setTopicId("");
  }, [subjectId]);

  useEffect(() => {
    if (!chapterId) { setTopics([]); return; }
    supabase.from("topics").select("id, name").eq("chapter_id", Number(chapterId)).order("name")
      .then(({ data }) => setTopics(data || []));
    setTopicId("");
  }, [chapterId]);

  const updateSubQ = (idx: number, val: string) => {
    setSubQs(prev => { const n = [...prev]; n[idx] = val; return n; });
  };
  const updateAnswer = (idx: number, val: string) => {
    setAnswers(prev => { const n = [...prev]; n[idx] = val; return n; });
  };

  const handleSave = async () => {
    if (!user?.id) { toast.error("লগইন করুন"); return; }
    if (!classId || !subjectId || !chapterId) {
      toast.error("শ্রেণী, বিষয় ও অধ্যায় সিলেক্ট করুন");
      return;
    }
    if (!stem.trim()) { toast.error("উদ্দীপক লিখুন"); return; }
    if (subQs.some(q => !q.trim())) { toast.error("সকল উপ-প্রশ্ন পূরণ করুন"); return; }

    setSaving(true);
    try {
      const creativeData = {
        stem,
        parts: SUB_QUESTIONS.map((sq, i) => ({
          label: sq.label,
          question: subQs[i],
          marks: sq.marks,
          answer: answers[i] || "",
        })),
      };

      const { error } = await supabase.from("questions").insert({
        teacher_id: user.id,
        class_id: Number(classId),
        subject_id: Number(subjectId),
        chapter_id: Number(chapterId),
        topic_id: topicId ? Number(topicId) : null,
        type: "cq",
        question: stem,
        creative_data: creativeData,
        explanation: explanation || null,
        board_references: boardRefs.length > 0 ? boardRefs : null,
      });

      if (error) throw error;
      toast.success("সৃজনশীল প্রশ্ন সংরক্ষিত হয়েছে!");
      // Reset form
      setStem(""); setSubQs(["", "", ""]); setAnswers(["", "", ""]); setExplanation("");
      setBoardRefs([]); setSpecialSearch(new Set());
    } catch (err: any) {
      toast.error("সংরক্ষণ ব্যর্থ: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const toBengaliNum = (n: number) => String(n).replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[parseInt(d)]);

  return (
    <div className="max-w-4xl mx-auto pb-28 space-y-6">
      {/* Header */}
      <div className="gradient-hero rounded-2xl p-6 text-center text-white">
        <h1 className="font-heading text-2xl font-bold">সৃজনশীল প্রশ্ন (CQ) তৈরী করুন</h1>
        <p className="text-white/70 text-sm mt-1">মোট নম্বর: ১০ (ক = ২, খ = ৪, গ = ৪)</p>
      </div>

      {/* Cascading Selectors */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs mb-1">শ্রেণী</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="শ্রেণী" /></SelectTrigger>
              <SelectContent>
                {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1">বিষয়</Label>
            <Select value={subjectId} onValueChange={setSubjectId} disabled={!classId}>
              <SelectTrigger><SelectValue placeholder="বিষয়" /></SelectTrigger>
              <SelectContent>
                {subjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1">অধ্যায়</Label>
            <Select value={chapterId} onValueChange={setChapterId} disabled={!subjectId}>
              <SelectTrigger><SelectValue placeholder="অধ্যায়" /></SelectTrigger>
              <SelectContent>
                {chapters.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1">টপিক</Label>
            <Select value={topicId} onValueChange={setTopicId} disabled={!chapterId}>
              <SelectTrigger><SelectValue placeholder="টপিক" /></SelectTrigger>
              <SelectContent>
                {topics.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stem Editor */}
      <div>
        <Label className="text-sm font-bold font-heading mb-2 block">উদ্দীপক (Stem)</Label>
        <RichTextEditor
          value={stem}
          onChange={setStem}
          placeholder="উদ্দীপক / পরিস্থিতি এখানে লিখুন..."
          minHeight="200px"
        />
      </div>

      {/* Sub-questions: ক, খ, গ with answers */}
      <div className="space-y-6">
        {SUB_QUESTIONS.map((sq, idx) => (
          <div key={sq.label} className="border border-border rounded-xl p-4 bg-card">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-heading font-bold text-lg">
                {sq.label}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                নম্বর: {toBengaliNum(sq.marks)}
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs mb-1 block">প্রশ্ন {sq.label}</Label>
                <RichTextEditor
                  value={subQs[idx]}
                  onChange={(v) => updateSubQ(idx, v)}
                  placeholder={`প্রশ্ন ${sq.label} এখানে লিখুন...`}
                  minHeight="120px"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">উত্তর {sq.label} <span className="text-muted-foreground">(ঐচ্ছিক)</span></Label>
                <RichTextEditor
                  value={answers[idx]}
                  onChange={(v) => updateAnswer(idx, v)}
                  placeholder="উত্তর এখানে লিখুন..."
                  minHeight="120px"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Explanation (Optional) */}
      <div>
        <Label className="text-sm font-bold font-heading mb-2 block">ব্যাখ্যা <span className="text-muted-foreground font-normal text-xs">(ঐচ্ছিক)</span></Label>
        <RichTextEditor
          value={explanation}
          onChange={setExplanation}
          placeholder="ব্যাখ্যা এখানে লিখুন..."
          minHeight="120px"
        />
      </div>

      {/* Bottom Section: Special Search, Topic Select, Board Reference */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Special Search */}
            <div className="border border-border rounded-lg p-3">
              <Label className="text-sm font-bold font-heading mb-2 block">eExamapp স্পেশাল সার্চ</Label>
              <div className="space-y-2">
                {specialSearchOptions.map(opt => (
                  <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={specialSearch.has(opt.id)}
                      onCheckedChange={() => {
                        setSpecialSearch(prev => {
                          const next = new Set(prev);
                          next.has(opt.id) ? next.delete(opt.id) : next.add(opt.id);
                          return next;
                        });
                      }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Topic Select */}
            <div className="border border-border rounded-lg p-3">
              <Label className="text-sm font-bold font-heading mb-2 block">Topic Select</Label>
              <Select value={topicId} onValueChange={setTopicId} disabled={!chapterId}>
                <SelectTrigger><SelectValue placeholder="টপিক সিলেক্ট করুন" /></SelectTrigger>
                <SelectContent>
                  {topics.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Board References */}
          <ReferenceInput
            label="বোর্ড রেফারেন্স"
            nameLabel="বোর্ড"
            namePlaceholder="যেমন: কু. বো."
            value={boardRefs}
            onChange={setBoardRefs}
            nameKey="board"
          />
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        className="w-full h-14 text-lg font-heading font-bold rounded-full gradient-green text-primary-foreground border-0 shadow-lg hover:shadow-xl transition-shadow"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "সংরক্ষণ হচ্ছে..." : "SAVE CQ"}
      </Button>
    </div>
  );
}
