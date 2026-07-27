import { normalizeAnswerKey } from "@/lib/answerKey";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowLeft, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import LatexRenderer from "@/components/LatexRenderer";
import RichTextEditor from "@/components/RichTextEditor";
import ReferenceInput from "@/components/ReferenceInput";

const FONT = "'SolaimanLipi', sans-serif";
const typeOptions = ["mcq", "short", "cq", "descriptive"];
const typeLabelsMap: Record<string, string> = { mcq: "MCQ", short: "সংক্ষিপ্ত", cq: "সৃজনশীল", descriptive: "বর্ণনামূলক" };
const ITEMS_PER_PAGE = 20;

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
  const [meta, setMeta] = useState<{ class_id: number; subject_id: number; chapter_id: number; subject_name: string } | null>(null);
  const [qFilterType, setQFilterType] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Grouped MCQ state
  const [isGroupedMcq, setIsGroupedMcq] = useState(false);
  const [stimulusText, setStimulusText] = useState("");
  const [groupedQuestions, setGroupedQuestions] = useState<Array<{
    question: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_answer: string;
  }>>([{ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" }]);

  const [form, setForm] = useState({
    type: "mcq",
    question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", explanation: "",
    cq_stem: "", cq_q_ka: "", cq_q_kha: "", cq_q_ga: "", cq_q_gha: "",
    cq_ans_ka: "", cq_ans_kha: "", cq_ans_ga: "", cq_ans_gha: "",
    desc_q_ka: "", desc_q_kha: "", desc_ans_ka: "", desc_ans_kha: "",
    board_references: [] as Array<{ board: string; year: string }>,
    university_references: [] as Array<{ name: string; year: string }>,
  });

  const isMathSubject = /^(গণিত|উচ্চতর গণিত|math|higher math)/i.test((meta?.subject_name || "").trim());

  // Load meta (class, subject, chapter) from topic
  useEffect(() => {
    if (!topicId) return;
    (async () => {
      const { data: topic } = await supabase.from("topics").select("chapter_id").eq("id", topicId).single();
      if (!topic) return;
      const { data: chapter } = await supabase.from("chapters").select("id, subject_id").eq("id", topic.chapter_id).single();
      if (!chapter) return;
      const { data: subject } = await supabase.from("subjects").select("id, class_id, name").eq("id", chapter.subject_id).single();
      if (!subject) return;
      setMeta({ class_id: subject.class_id, subject_id: subject.id, chapter_id: chapter.id, subject_name: subject.name });
    })();
  }, [topicId]);

  const fetchQuestions = useCallback(async () => {
    if (!topicId) return;
    const { data } = await supabase.from("questions").select("*, topics(name)").eq("topic_id", topicId).order("created_at", { ascending: false });
    setQuestions(data || []);
  }, [topicId]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  // Filtering & pagination
  const typeSortOrder: Record<string, number> = { mcq: 0, short: 1, cq: 2, descriptive: 3 };
  const filteredQuestions = questions
    .filter(q => !qFilterType || q.type === qFilterType)
    .sort((a, b) => (typeSortOrder[a.type] ?? 99) - (typeSortOrder[b.type] ?? 99));

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedQuestions = filteredQuestions.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const resetForm = () => {
    setForm({
      type: "mcq", question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", explanation: "",
      cq_stem: "", cq_q_ka: "", cq_q_kha: "", cq_q_ga: "", cq_q_gha: "",
      cq_ans_ka: "", cq_ans_kha: "", cq_ans_ga: "", cq_ans_gha: "",
      desc_q_ka: "", desc_q_kha: "", desc_ans_ka: "", desc_ans_kha: "",
      board_references: [], university_references: [],
    });
    setIsGroupedMcq(false);
    setStimulusText("");
    setGroupedQuestions([{ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" }]);
  };

  const openCreate = () => { setEditItem(null); resetForm(); setDialogOpen(true); };

  const openEdit = (item: any) => {
    setEditItem(item);
    const cd = item.creative_data || {};
    setIsGroupedMcq(false);
    setStimulusText(item.stimulus_text || "");
    setForm({
      type: item.type || "mcq", question: item.question || "",
      option_a: item.option_a || "", option_b: item.option_b || "",
      option_c: item.option_c || "", option_d: item.option_d || "",
      correct_answer: normalizeAnswerKey(item.correct_answer) || "", explanation: item.explanation || "",
      cq_stem: cd.stem || "", cq_q_ka: cd.q_ka || "", cq_q_kha: cd.q_kha || "",
      cq_q_ga: cd.q_ga || "", cq_q_gha: cd.q_gha || "",
      cq_ans_ka: cd.ans_ka || "", cq_ans_kha: cd.ans_kha || "",
      cq_ans_ga: cd.ans_ga || "", cq_ans_gha: cd.ans_gha || "",
      desc_q_ka: cd.desc_q_ka || "", desc_q_kha: cd.desc_q_kha || "",
      desc_ans_ka: cd.desc_ans_ka || "", desc_ans_kha: cd.desc_ans_kha || "",
      board_references: Array.isArray(item.board_references) ? item.board_references : [],
      university_references: Array.isArray(item.university_references) ? item.university_references : [],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!meta || !user) { toast.error("মেটাডাটা লোড হয়নি"); return; }

    // Grouped MCQ
    if (form.type === "mcq" && isGroupedMcq && !editItem) {
      if (!stimulusText) { toast.error("উদ্দীপক আবশ্যক"); return; }
      const validQs = groupedQuestions.filter(gq => gq.question.trim());
      if (validQs.length === 0) { toast.error("অন্তত একটি প্রশ্ন প্রয়োজন"); return; }
      const groupId = crypto.randomUUID();
      const payloads = validQs.map((gq) => ({
        class_id: meta.class_id, subject_id: meta.subject_id, chapter_id: meta.chapter_id,
        topic_id: topicId, type: "mcq", question: gq.question,
        option_a: gq.option_a || null, option_b: gq.option_b || null,
        option_c: gq.option_c || null, option_d: gq.option_d || null,
        correct_answer: normalizeAnswerKey(gq.correct_answer), explanation: form.explanation || null,
        stimulus_group_id: groupId, stimulus_text: stimulusText,
        board_references: form.board_references.length > 0 ? form.board_references : [],
        university_references: form.university_references.length > 0 ? form.university_references : [],
        teacher_id: user.id,
      }));
      const { error } = await supabase.from("questions").insert(payloads as any);
      if (error) { toast.error("তৈরি ব্যর্থ: " + error.message); return; }
      toast.success(`${validQs.length}টি MCQ তৈরি হয়েছে`);
      setDialogOpen(false); fetchQuestions(); return;
    }

    // Validation
    if (form.type === "cq") {
      if (!form.cq_stem.trim()) { toast.error("উদ্দীপক লিখুন"); return; }
    } else if (form.type === "descriptive") {
      if (!form.desc_q_ka && !form.desc_q_kha) { toast.error("অন্তত একটি প্রশ্ন আবশ্যক"); return; }
    } else {
      if (!form.question.trim()) { toast.error("প্রশ্ন লিখুন"); return; }
    }

    const questionText = form.type === "cq"
      ? (form.cq_stem.substring(0, 100) + (form.cq_stem.length > 100 ? "..." : ""))
      : form.type === "descriptive"
      ? (form.desc_q_ka.substring(0, 100) + (form.desc_q_ka.length > 100 ? "..." : ""))
      : form.question;

    const payload: any = {
      type: form.type, question: questionText,
      option_a: form.option_a || null, option_b: form.option_b || null,
      option_c: form.option_c || null, option_d: form.option_d || null,
      correct_answer: normalizeAnswerKey(form.correct_answer), explanation: form.explanation || null,
      board_references: form.board_references.length > 0 ? form.board_references : [],
      university_references: form.university_references.length > 0 ? form.university_references : [],
      stimulus_text: form.type === "mcq" && stimulusText ? stimulusText : null,
      stimulus_group_id: null,
      topic_id: topicId, class_id: meta.class_id, subject_id: meta.subject_id, chapter_id: meta.chapter_id,
    };

    if (form.type === "cq") {
      if (isMathSubject) {
        payload.creative_data = { is_math: true, stem: form.cq_stem, q_ka: form.cq_q_ka, q_kha: form.cq_q_kha, q_ga: form.cq_q_ga, ans_ka: form.cq_ans_ka, ans_kha: form.cq_ans_kha, ans_ga: form.cq_ans_ga };
      } else {
        payload.creative_data = { is_math: false, stem: form.cq_stem, q_ka: form.cq_q_ka, q_kha: form.cq_q_kha, q_ga: form.cq_q_ga, q_gha: form.cq_q_gha, ans_ka: form.cq_ans_ka, ans_kha: form.cq_ans_kha, ans_ga: form.cq_ans_ga, ans_gha: form.cq_ans_gha };
      }
    }
    if (form.type === "descriptive") {
      payload.creative_data = { desc_q_ka: form.desc_q_ka, desc_q_kha: form.desc_q_kha, desc_ans_ka: form.desc_ans_ka, desc_ans_kha: form.desc_ans_kha };
    }

    if (editItem) {
      const { error } = await supabase.from("questions").update(payload).eq("id", editItem.id);
      if (error) { toast.error("আপডেট ব্যর্থ: " + error.message); return; }
      toast.success("আপডেট হয়েছে");
    } else {
      payload.teacher_id = user.id;
      const { error } = await supabase.from("questions").insert(payload);
      if (error) { toast.error("তৈরি ব্যর্থ: " + error.message); return; }
      toast.success("প্রশ্ন তৈরি হয়েছে");
    }
    setDialogOpen(false); fetchQuestions();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("মুছে ফেলতে চান?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) { toast.error("ডিলিট ব্যর্থ"); return; }
    toast.success("মুছে ফেলা হয়েছে"); fetchQuestions();
  };

  // === Question Form (identical to global modal) ===
  const renderQuestionForm = () => (
    <div className="space-y-3 py-2" style={{ fontFamily: FONT }}>
      {/* Pre-filled locked fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label style={{ fontFamily: FONT }}>অধ্যায়</Label>
          <div className="w-full border border-border rounded-md px-3 py-2 text-sm bg-muted/50 text-muted-foreground">{chapterName || "—"}</div>
        </div>
        <div>
          <Label style={{ fontFamily: FONT }}>টপিক</Label>
          <div className="w-full border border-border rounded-md px-3 py-2 text-sm bg-muted/50 text-muted-foreground">{topicName || "—"}</div>
        </div>
      </div>

      <div>
        <Label style={{ fontFamily: FONT }}>প্রশ্নের ধরন</Label>
        <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" style={{ fontFamily: FONT }} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          {typeOptions.map((t) => <option key={t} value={t}>{typeLabelsMap[t] || t.toUpperCase()}</option>)}
        </select>
      </div>

      {/* MCQ Form */}
      {form.type === "mcq" && (
        <>
          {!editItem && (
            <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30">
              <div>
                <Label className="font-semibold" style={{ fontFamily: FONT }}>উদ্দীপক ভিত্তিক প্রশ্ন (Grouped MCQ)</Label>
                <p className="text-xs text-muted-foreground">একটি উদ্দীপকের অধীনে একাধিক MCQ যোগ করুন</p>
              </div>
              <Switch checked={isGroupedMcq} onCheckedChange={setIsGroupedMcq} />
            </div>
          )}
          <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full" style={{ fontFamily: FONT }}>MCQ — প্রতিটি ১ নম্বর</span>

          <div>
            <Label style={{ fontFamily: FONT }}>{isGroupedMcq ? "উদ্দীপক (Stimulus) *" : "উদ্দীপক (ঐচ্ছিক)"}</Label>
            <RichTextEditor value={stimulusText} onChange={setStimulusText} placeholder="উদ্দীপকটি এখানে লিখুন..." minHeight={isGroupedMcq ? "150px" : "100px"} />
          </div>

          {!isGroupedMcq ? (
            <>
              <div><Label style={{ fontFamily: FONT }}>প্রশ্ন</Label><RichTextEditor value={form.question} onChange={(v) => setForm({ ...form, question: v })} placeholder="প্রশ্নটি এখানে লিখুন..." minHeight="180px" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="mb-1 block">ক</Label><RichTextEditor value={form.option_a} onChange={(v) => setForm({ ...form, option_a: v })} placeholder="অপশন ক" minHeight="120px" /></div>
                <div><Label className="mb-1 block">খ</Label><RichTextEditor value={form.option_b} onChange={(v) => setForm({ ...form, option_b: v })} placeholder="অপশন খ" minHeight="120px" /></div>
                <div><Label className="mb-1 block">গ</Label><RichTextEditor value={form.option_c} onChange={(v) => setForm({ ...form, option_c: v })} placeholder="অপশন গ" minHeight="120px" /></div>
                <div><Label className="mb-1 block">ঘ</Label><RichTextEditor value={form.option_d} onChange={(v) => setForm({ ...form, option_d: v })} placeholder="অপশন ঘ" minHeight="120px" /></div>
              </div>
              <div>
                <Label style={{ fontFamily: FONT }}>সঠিক উত্তর</Label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.correct_answer} onChange={(e) => setForm({ ...form, correct_answer: e.target.value })}>
                  <option value="">নির্বাচন করুন</option>
                  <option value="a">ক</option><option value="b">খ</option><option value="c">গ</option><option value="d">ঘ</option>
                </select>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <Label className="text-base font-semibold" style={{ fontFamily: FONT }}>প্রশ্নসমূহ ({groupedQuestions.length}টি)</Label>
              {groupedQuestions.map((gq, gi) => (
                <div key={gi} className="border border-border rounded-lg p-3 space-y-2 relative bg-background">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold" style={{ fontFamily: FONT }}>প্রশ্ন {gi + 1}</span>
                    {groupedQuestions.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setGroupedQuestions(prev => prev.filter((_, i) => i !== gi))}>
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <RichTextEditor value={gq.question} onChange={(v) => setGroupedQuestions(prev => prev.map((q, i) => i === gi ? { ...q, question: v } : q))} placeholder={`প্রশ্ন ${gi + 1} লিখুন...`} minHeight="100px" />
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">ক</Label><RichTextEditor value={gq.option_a} onChange={(v) => setGroupedQuestions(prev => prev.map((q, i) => i === gi ? { ...q, option_a: v } : q))} placeholder="অপশন ক" minHeight="70px" /></div>
                    <div><Label className="text-xs">খ</Label><RichTextEditor value={gq.option_b} onChange={(v) => setGroupedQuestions(prev => prev.map((q, i) => i === gi ? { ...q, option_b: v } : q))} placeholder="অপশন খ" minHeight="70px" /></div>
                    <div><Label className="text-xs">গ</Label><RichTextEditor value={gq.option_c} onChange={(v) => setGroupedQuestions(prev => prev.map((q, i) => i === gi ? { ...q, option_c: v } : q))} placeholder="অপশন গ" minHeight="70px" /></div>
                    <div><Label className="text-xs">ঘ</Label><RichTextEditor value={gq.option_d} onChange={(v) => setGroupedQuestions(prev => prev.map((q, i) => i === gi ? { ...q, option_d: v } : q))} placeholder="অপশন ঘ" minHeight="70px" /></div>
                  </div>
                  <div>
                    <Label className="text-xs">সঠিক উত্তর</Label>
                    <select className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={gq.correct_answer} onChange={(e) => setGroupedQuestions(prev => prev.map((q, i) => i === gi ? { ...q, correct_answer: e.target.value } : q))}>
                      <option value="">নির্বাচন করুন</option>
                      <option value="a">ক</option><option value="b">খ</option><option value="c">গ</option><option value="d">ঘ</option>
                    </select>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" className="w-full border-dashed border-emerald-400 text-emerald-600 hover:bg-emerald-50" onClick={() => setGroupedQuestions(prev => [...prev, { question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" }])} style={{ fontFamily: FONT }}>
                <Plus className="h-4 w-4 mr-1" /> আরও প্রশ্ন যোগ করুন
              </Button>
            </div>
          )}
          <div><Label style={{ fontFamily: FONT }}>ব্যাখ্যা (ঐচ্ছিক)</Label><RichTextEditor value={form.explanation} onChange={(v) => setForm({ ...form, explanation: v })} placeholder="ব্যাখ্যা লিখুন..." minHeight="120px" /></div>
        </>
      )}

      {/* Short */}
      {form.type === "short" && (
        <>
          <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full" style={{ fontFamily: FONT }}>সংক্ষিপ্ত প্রশ্ন — ২ মার্ক</span>
          <div><Label style={{ fontFamily: FONT }}>প্রশ্ন</Label><RichTextEditor value={form.question} onChange={(v) => setForm({ ...form, question: v })} placeholder="সংক্ষিপ্ত প্রশ্নটি এখানে লিখুন..." minHeight="140px" /></div>
          <div><Label style={{ fontFamily: FONT }}>উত্তর (ঐচ্ছিক)</Label><RichTextEditor value={form.correct_answer} onChange={(v) => setForm({ ...form, correct_answer: v })} placeholder="নমুনা উত্তর লিখুন..." minHeight="120px" /></div>
          <div><Label style={{ fontFamily: FONT }}>ব্যাখ্যা (ঐচ্ছিক)</Label><RichTextEditor value={form.explanation} onChange={(v) => setForm({ ...form, explanation: v })} placeholder="ব্যাখ্যা লিখুন..." minHeight="100px" /></div>
        </>
      )}

      {/* CQ */}
      {form.type === "cq" && (
        <div className="space-y-4">
          <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full" style={{ fontFamily: FONT }}>
            {isMathSubject ? "সৃজনশীল (গণিত) — ১০ মার্ক (ক=২, খ=৪, গ=৪)" : "সৃজনশীল — ১০ মার্ক (ক=১, খ=২, গ=৩, ঘ=৪)"}
          </span>
          <div><Label className="text-base font-semibold" style={{ fontFamily: FONT }}>উদ্দীপক (Stem/Stimulus)</Label><RichTextEditor value={form.cq_stem} onChange={(v) => setForm({ ...form, cq_stem: v })} placeholder="উদ্দীপকটি এখানে লিখুন..." minHeight="150px" /></div>
          <Label className="text-base font-semibold" style={{ fontFamily: FONT }}>উপ-প্রশ্নসমূহ</Label>
          <div><Label>ক) {isMathSubject ? "জ্ঞানমূলক (নম্বর: ২)" : "জ্ঞানমূলক (নম্বর: ১)"}</Label><RichTextEditor value={form.cq_q_ka} onChange={(v) => setForm({ ...form, cq_q_ka: v })} placeholder="প্রশ্ন ক" minHeight="80px" /></div>
          <div><Label>খ) {isMathSubject ? "অনুধাবনমূলক (নম্বর: ৪)" : "অনুধাবনমূলক (নম্বর: ২)"}</Label><RichTextEditor value={form.cq_q_kha} onChange={(v) => setForm({ ...form, cq_q_kha: v })} placeholder="প্রশ্ন খ" minHeight="80px" /></div>
          <div><Label>গ) {isMathSubject ? "প্রয়োগমূলক (নম্বর: ৪)" : "প্রয়োগমূলক (নম্বর: ৩)"}</Label><RichTextEditor value={form.cq_q_ga} onChange={(v) => setForm({ ...form, cq_q_ga: v })} placeholder="প্রশ্ন গ" minHeight="80px" /></div>
          {!isMathSubject && <div><Label>ঘ) উচ্চতর দক্ষতামূলক (নম্বর: ৪)</Label><RichTextEditor value={form.cq_q_gha} onChange={(v) => setForm({ ...form, cq_q_gha: v })} placeholder="প্রশ্ন ঘ" minHeight="80px" /></div>}
          <Label className="text-base font-semibold" style={{ fontFamily: FONT }}>নমুনা উত্তর (ঐচ্ছিক)</Label>
          <div><Label>উত্তর ক</Label><RichTextEditor value={form.cq_ans_ka} onChange={(v) => setForm({ ...form, cq_ans_ka: v })} placeholder="উত্তর ক" minHeight="80px" /></div>
          <div><Label>উত্তর খ</Label><RichTextEditor value={form.cq_ans_kha} onChange={(v) => setForm({ ...form, cq_ans_kha: v })} placeholder="উত্তর খ" minHeight="80px" /></div>
          <div><Label>উত্তর গ</Label><RichTextEditor value={form.cq_ans_ga} onChange={(v) => setForm({ ...form, cq_ans_ga: v })} placeholder="উত্তর গ" minHeight="80px" /></div>
          {!isMathSubject && <div><Label>উত্তর ঘ</Label><RichTextEditor value={form.cq_ans_gha} onChange={(v) => setForm({ ...form, cq_ans_gha: v })} placeholder="উত্তর ঘ" minHeight="80px" /></div>}
          <div><Label style={{ fontFamily: FONT }}>ব্যাখ্যা (ঐচ্ছিক)</Label><RichTextEditor value={form.explanation} onChange={(v) => setForm({ ...form, explanation: v })} placeholder="ব্যাখ্যা লিখুন..." minHeight="80px" /></div>
        </div>
      )}

      {/* Descriptive */}
      {form.type === "descriptive" && (
        <div className="space-y-4">
          <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full" style={{ fontFamily: FONT }}>বর্ণনামূলক প্রশ্ন — ১০ মার্ক (ক = ৩, খ = ৭)</span>
          <div><Label style={{ fontFamily: FONT }}>ক) প্রশ্ন (নম্বর: ৩)</Label><RichTextEditor value={form.desc_q_ka} onChange={(v) => setForm({ ...form, desc_q_ka: v })} placeholder="প্রশ্ন ক লিখুন..." minHeight="140px" /></div>
          <div><Label style={{ fontFamily: FONT }}>ক) উত্তর (ঐচ্ছিক)</Label><RichTextEditor value={form.desc_ans_ka} onChange={(v) => setForm({ ...form, desc_ans_ka: v })} placeholder="উত্তর ক লিখুন..." minHeight="100px" /></div>
          <div><Label style={{ fontFamily: FONT }}>খ) প্রশ্ন (নম্বর: ৭)</Label><RichTextEditor value={form.desc_q_kha} onChange={(v) => setForm({ ...form, desc_q_kha: v })} placeholder="প্রশ্ন খ লিখুন..." minHeight="140px" /></div>
          <div><Label style={{ fontFamily: FONT }}>খ) উত্তর (ঐচ্ছিক)</Label><RichTextEditor value={form.desc_ans_kha} onChange={(v) => setForm({ ...form, desc_ans_kha: v })} placeholder="উত্তর খ লিখুন..." minHeight="100px" /></div>
          <div><Label style={{ fontFamily: FONT }}>ব্যাখ্যা (ঐচ্ছিক)</Label><RichTextEditor value={form.explanation} onChange={(v) => setForm({ ...form, explanation: v })} placeholder="ব্যাখ্যা লিখুন..." minHeight="100px" /></div>
        </div>
      )}

      {/* References */}
      <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
        <p className="text-sm font-semibold text-muted-foreground" style={{ fontFamily: FONT }}>রেফারেন্স এবং মেটাডাটা</p>
        <ReferenceInput label="বোর্ড রেফারেন্স" nameLabel="বোর্ড" namePlaceholder="যেমন: কু. বো." nameKey="board" value={form.board_references} onChange={(refs) => setForm({ ...form, board_references: refs as any })} />
        <ReferenceInput label="বিশ্ববিদ্যালয় রেফারেন্স" nameLabel="বিশ্ববিদ্যালয়" namePlaceholder="যেমন: ঢাকা বিশ্ববিদ্যালয়" nameKey="name" value={form.university_references} onChange={(refs) => setForm({ ...form, university_references: refs as any })} />
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: FONT }}>
      <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4" /> টপিক ম্যানেজমেন্টে ফিরুন
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">প্রশ্ন ম্যানেজমেন্ট</h1>
          <p className="text-muted-foreground text-sm">অধ্যায়: {chapterName} → টপিক: {topicName}</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> নতুন প্রশ্ন যোগ করুন</Button>
      </div>

      {/* Type Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[{ value: "", label: "সকল" }, ...typeOptions.map(t => ({ value: t, label: typeLabelsMap[t] }))].map(tab => (
          <Button
            key={tab.value}
            variant={qFilterType === tab.value ? "default" : "outline"}
            size="sm"
            className={qFilterType === tab.value ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            onClick={() => { setQFilterType(tab.value); setCurrentPage(1); }}
            style={{ fontFamily: FONT }}
          >
            {tab.label}
          </Button>
        ))}
        <span className="text-sm text-muted-foreground ml-auto self-center">মোট: {filteredQuestions.length}টি</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>প্রশ্ন</TableHead>
                <TableHead className="w-24">ধরন</TableHead>
                <TableHead className="w-24 text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedQuestions.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="text-muted-foreground">{q.id}</TableCell>
                  <TableCell className="font-medium max-w-[300px]"><div className="truncate"><LatexRenderer text={q.question} /></div></TableCell>
                  <TableCell>
                    <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">{typeLabelsMap[q.type] || q.type}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(q)}><Pencil className="w-4 h-4 text-emerald-600" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredQuestions.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">কোনো প্রশ্ন নেই</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filteredQuestions.length)} / {filteredQuestions.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" disabled={safePage <= 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2).map((p, idx, arr) => {
              const items: React.ReactNode[] = [];
              if (idx > 0 && p - arr[idx - 1] > 1) items.push(<span key={`dot-${idx}`} className="px-1 text-muted-foreground">…</span>);
              items.push(<Button key={p} variant={p === safePage ? "default" : "outline"} size="icon" className={`w-8 h-8 text-xs ${p === safePage ? "bg-emerald-600" : ""}`} onClick={() => setCurrentPage(p)}>{p}</Button>);
              return items;
            })}
            <Button variant="outline" size="icon" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {/* Unified Dynamic Question Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: FONT }}>{editItem ? "প্রশ্ন সম্পাদনা" : "নতুন প্রশ্ন যোগ করুন"}</DialogTitle>
            <p className="text-sm text-muted-foreground" style={{ fontFamily: FONT }}>
              অধ্যায়: {chapterName} • টপিক: {topicName}
            </p>
          </DialogHeader>
          {renderQuestionForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} style={{ fontFamily: FONT }}>বাতিল</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} style={{ fontFamily: FONT }}>
              {form.type === "mcq" && isGroupedMcq && !editItem
                ? `${groupedQuestions.length}টি MCQ তৈরি করুন`
                : (editItem ? "আপডেট" : "তৈরি করুন")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
