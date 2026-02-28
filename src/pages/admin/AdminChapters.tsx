import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Filter, MoreVertical, Eye, ArrowLeft, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import LatexRenderer from "@/components/LatexRenderer";
import RichTextEditor from "@/components/RichTextEditor";
import ReferenceInput from "@/components/ReferenceInput";

const FONT = "'SolaimanLipi', sans-serif";
const typeOptions = ["mcq", "short", "cq", "descriptive"];
const typeLabelsMap: Record<string, string> = { mcq: "MCQ", short: "সংক্ষিপ্ত", cq: "সৃজনশীল", descriptive: "বর্ণনামূলক" };
const ITEMS_PER_PAGE = 20;

interface ClassItem { id: number; name: string; }
interface SubjectItem { id: number; name: string; class_id: number; }
interface ChapterItem {
  id: number; name: string; subject_id: number; is_free: boolean; is_active: boolean; created_at: string;
  subjects?: { name: string; class_id: number; classes?: { name: string } };
}

export default function AdminChapters() {
  const { hasFullAccess, isSubjectAllowed, loading: permLoading } = useAdminPermissions();

  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [chapterQuestionCounts, setChapterQuestionCounts] = useState<Record<number, number>>({});
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectItem[]>([]);

  // Filters
  const [filterClassId, setFilterClassId] = useState("");
  const [filterSubjectId, setFilterSubjectId] = useState("");

  // Chapter Create/Edit Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<ChapterItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formClassId, setFormClassId] = useState("");
  const [formSubjectId, setFormSubjectId] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ChapterItem | null>(null);

  // "See All Questions" view
  const [questionsView, setQuestionsView] = useState<{ chapter: ChapterItem; classId: number; subjectId: number } | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [qFilterType, setQFilterType] = useState("");
  const [qCurrentPage, setQCurrentPage] = useState(1);

  // "Add Question" modal
  const [addQDialogOpen, setAddQDialogOpen] = useState(false); // kept for edit dialog compatibility
  const [addQFullPage, setAddQFullPage] = useState<{ chapter: ChapterItem; returnTo: "main" | "questions" } | null>(null);
  const [addQChapter, setAddQChapter] = useState<ChapterItem | null>(null);
  const [addQTopics, setAddQTopics] = useState<any[]>([]);
  const [addQLoadingTopics, setAddQLoadingTopics] = useState(false);
  const [addQCategories, setAddQCategories] = useState<any[]>([]);
  const [isGroupedMcq, setIsGroupedMcq] = useState(false);
  const [stimulusText, setStimulusText] = useState("");
  const [groupedQuestions, setGroupedQuestions] = useState<Array<{
    question: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_answer: string;
  }>>([{ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" }]);

  // Edit question modal
  const [editQDialogOpen, setEditQDialogOpen] = useState(false);
  const [editQItem, setEditQItem] = useState<any>(null);

  const [qForm, setQForm] = useState({
    topic_id: "", category_id: "", type: "mcq",
    question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", explanation: "",
    cq_stem: "", cq_q_ka: "", cq_q_kha: "", cq_q_ga: "", cq_q_gha: "",
    cq_ans_ka: "", cq_ans_kha: "", cq_ans_ga: "", cq_ans_gha: "",
    desc_q_ka: "", desc_q_kha: "", desc_ans_ka: "", desc_ans_kha: "",
    board_references: [] as Array<{ board: string; year: string }>,
    university_references: [] as Array<{ name: string; year: string }>,
  });

  // Determine if subject is math-type
  const getSubjectName = useCallback(() => {
    if (addQChapter) {
      return allSubjects.find(s => s.id === addQChapter.subject_id)?.name || "";
    }
    if (editQItem) {
      return allSubjects.find(s => s.id === editQItem.subject_id)?.name || "";
    }
    return "";
  }, [addQChapter, editQItem, allSubjects]);

  const isMathSubject = /^(গণিত|উচ্চতর গণিত|math|higher math)/i.test(getSubjectName().trim());

  useEffect(() => {
    if (permLoading) return;
    supabase.from("classes").select("id, name").order("name").then(({ data }) => setClasses(data || []));
    supabase.from("subjects").select("id, name, class_id").order("name").then(({ data }) => {
      setSubjects(data || []);
      setAllSubjects(data || []);
    });
    supabase.from("question_categories").select("id, name").order("name").then(({ data }) => setAddQCategories(data || []));
    fetchChapters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permLoading]);

  const fetchChapters = async () => {
    const { data } = await supabase
      .from("chapters")
      .select("*, subjects(name, class_id, classes(name))")
      .order("created_at", { ascending: false });
    let filtered = data || [];
    if (!hasFullAccess) {
      filtered = filtered.filter((ch: any) =>
        isSubjectAllowed(ch.subjects?.class_id, ch.subject_id)
      );
    }
    setChapters(filtered as ChapterItem[]);

    // Fetch question counts per chapter
    const chapterIds = filtered.map((ch: any) => ch.id);
    if (chapterIds.length > 0) {
      const { data: qData } = await supabase
        .from("questions")
        .select("chapter_id")
        .in("chapter_id", chapterIds);
      const counts: Record<number, number> = {};
      (qData || []).forEach((q: any) => {
        counts[q.chapter_id] = (counts[q.chapter_id] || 0) + 1;
      });
      setChapterQuestionCounts(counts);
    }
  };

  // Filtered display
  const displayChapters = chapters.filter((ch) => {
    const classId = (ch as any).subjects?.class_id;
    if (filterClassId && String(classId) !== filterClassId) return false;
    if (filterSubjectId && String(ch.subject_id) !== filterSubjectId) return false;
    return true;
  });

  const filteredSubjectsForFilter = filterClassId
    ? subjects.filter((s) => String(s.class_id) === filterClassId)
    : subjects;

  const filteredSubjectsForForm = formClassId
    ? subjects.filter((s) => String(s.class_id) === formClassId)
    : [];

  const openCreate = () => {
    setEditItem(null); setFormName(""); setFormClassId(""); setFormSubjectId("");
    setDialogOpen(true);
  };

  const openEdit = (item: ChapterItem) => {
    setEditItem(item); setFormName(item.name);
    const classId = (item as any).subjects?.class_id;
    setFormClassId(classId ? String(classId) : "");
    setFormSubjectId(String(item.subject_id));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error("নাম লিখুন"); return; }
    if (!formSubjectId) { toast.error("বিষয় নির্বাচন করুন"); return; }
    const { data: existing } = await supabase.from("chapters").select("id").eq("name", formName.trim()).eq("subject_id", Number(formSubjectId));
    if (existing && existing.length > 0) {
      if (!editItem || existing.some((e) => e.id !== editItem.id)) {
        toast.error("এই বিষয়ে একই নামের অধ্যায় আগে থেকে আছে!"); return;
      }
    }
    const payload = { name: formName.trim(), subject_id: Number(formSubjectId) };
    if (editItem) {
      const { error } = await supabase.from("chapters").update(payload).eq("id", editItem.id);
      if (error) { toast.error("আপডেট ব্যর্থ"); return; }
      toast.success("আপডেট হয়েছে");
    } else {
      const { error } = await supabase.from("chapters").insert(payload);
      if (error) { toast.error("তৈরি ব্যর্থ: " + error.message); return; }
      toast.success("তৈরি হয়েছে");
    }
    setDialogOpen(false); fetchChapters();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    // Check if chapter has questions
    const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("chapter_id", deleteTarget.id);
    if (count && count > 0) {
      toast.error(`এই অধ্যায়ে ${count}টি প্রশ্ন আছে। আগে প্রশ্নগুলো মুছুন, তারপর অধ্যায় মুছতে পারবেন।`);
      setDeleteTarget(null);
      return;
    }
    const { error } = await supabase.from("chapters").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("ডিলিট ব্যর্থ: " + error.message); return; }
    toast.success("মুছে ফেলা হয়েছে");
    setDeleteTarget(null); fetchChapters();
  };

  // === See All Questions ===
  const openQuestionsView = async (chapter: ChapterItem) => {
    const classId = (chapter as any).subjects?.class_id;
    setQuestionsView({ chapter, classId, subjectId: chapter.subject_id });
    setQFilterType(""); setQCurrentPage(1);
    setQuestionsLoading(true);
    const { data } = await supabase.from("questions")
      .select("*, topics(name)")
      .eq("chapter_id", chapter.id)
      .order("created_at", { ascending: false });
    setQuestions(data || []);
    setQuestionsLoading(false);
  };

  const typeSortOrder: Record<string, number> = { mcq: 0, short: 1, cq: 2, descriptive: 3 };
  const filteredQuestions = questions
    .filter(q => !qFilterType || q.type === qFilterType)
    .sort((a, b) => (typeSortOrder[a.type] ?? 99) - (typeSortOrder[b.type] ?? 99));

  const qTotalPages = Math.max(1, Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE));
  const qSafePage = Math.min(qCurrentPage, qTotalPages);
  const paginatedQuestions = filteredQuestions.slice((qSafePage - 1) * ITEMS_PER_PAGE, qSafePage * ITEMS_PER_PAGE);

  // === Add Question Modal ===
  const openAddQuestion = (chapter: ChapterItem) => {
    setAddQChapter(chapter);
    setIsGroupedMcq(false); setStimulusText("");
    setGroupedQuestions([{ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" }]);
    setQForm({
      topic_id: "", category_id: "", type: "mcq",
      question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", explanation: "",
      cq_stem: "", cq_q_ka: "", cq_q_kha: "", cq_q_ga: "", cq_q_gha: "",
      cq_ans_ka: "", cq_ans_kha: "", cq_ans_ga: "", cq_ans_gha: "",
      desc_q_ka: "", desc_q_kha: "", desc_ans_ka: "", desc_ans_kha: "",
      board_references: [], university_references: [],
    });
    setAddQDialogOpen(true);
    // Load topics for this chapter
    setAddQLoadingTopics(true);
    supabase.from("topics").select("id, name").eq("chapter_id", chapter.id).order("name")
      .then(({ data }) => { setAddQTopics(data || []); setAddQLoadingTopics(false); });
  };

  // Open edit question
  const openEditQuestion = (item: any) => {
    setEditQItem(item);
    const cd = item.creative_data || {};
    setIsGroupedMcq(false); setStimulusText(item.stimulus_text || "");
    setQForm({
      topic_id: item.topic_id ? String(item.topic_id) : "",
      category_id: item.category_id ? String(item.category_id) : "",
      type: item.type,
      question: item.question || "", option_a: item.option_a || "", option_b: item.option_b || "",
      option_c: item.option_c || "", option_d: item.option_d || "", correct_answer: item.correct_answer || "",
      explanation: item.explanation || "",
      cq_stem: cd.stem || "", cq_q_ka: cd.q_ka || "", cq_q_kha: cd.q_kha || "", cq_q_ga: cd.q_ga || "", cq_q_gha: cd.q_gha || "",
      cq_ans_ka: cd.ans_ka || "", cq_ans_kha: cd.ans_kha || "", cq_ans_ga: cd.ans_ga || "", cq_ans_gha: cd.ans_gha || "",
      desc_q_ka: cd.desc_q_ka || "", desc_q_kha: cd.desc_q_kha || "",
      desc_ans_ka: cd.desc_ans_ka || "", desc_ans_kha: cd.desc_ans_kha || "",
      board_references: Array.isArray(item.board_references) ? item.board_references : [],
      university_references: Array.isArray(item.university_references) ? item.university_references : [],
    });
    setEditQDialogOpen(true);
    // Load topics for this chapter
    setAddQLoadingTopics(true);
    supabase.from("topics").select("id, name").eq("chapter_id", item.chapter_id).order("name")
      .then(({ data }) => { setAddQTopics(data || []); setAddQLoadingTopics(false); });
  };

  const handleSaveQuestion = async (isEdit: boolean) => {
    const chapter = isEdit ? null : addQChapter;
    const classId = isEdit ? editQItem.class_id : (chapter as any)?.subjects?.class_id;
    const subjectId = isEdit ? editQItem.subject_id : chapter?.subject_id;
    const chapterId = isEdit ? editQItem.chapter_id : chapter?.id;

    if (!classId || !subjectId || !chapterId) { toast.error("অধ্যায় তথ্য অসম্পূর্ণ"); return; }

    // Grouped MCQ
    if (qForm.type === "mcq" && isGroupedMcq && !isEdit) {
      if (!stimulusText) { toast.error("উদ্দীপক আবশ্যক"); return; }
      const validQs = groupedQuestions.filter(gq => gq.question.trim());
      if (validQs.length === 0) { toast.error("অন্তত একটি প্রশ্ন প্রয়োজন"); return; }
      const { data: { user } } = await supabase.auth.getUser();
      const groupId = crypto.randomUUID();
      const payloads = validQs.map((gq) => ({
        class_id: Number(classId), subject_id: Number(subjectId), chapter_id: Number(chapterId),
        topic_id: qForm.topic_id ? Number(qForm.topic_id) : null,
        category_id: qForm.category_id ? Number(qForm.category_id) : null,
        type: "mcq", question: gq.question,
        option_a: gq.option_a || null, option_b: gq.option_b || null,
        option_c: gq.option_c || null, option_d: gq.option_d || null,
        correct_answer: gq.correct_answer || null, explanation: qForm.explanation || null,
        stimulus_group_id: groupId, stimulus_text: stimulusText,
        board_references: qForm.board_references.length > 0 ? qForm.board_references : [],
        university_references: qForm.university_references.length > 0 ? qForm.university_references : [],
        teacher_id: user?.id,
      }));
      const { error } = await supabase.from("questions").insert(payloads as any);
      if (error) { toast.error("তৈরি ব্যর্থ: " + error.message); return; }
      toast.success(`${validQs.length}টি MCQ তৈরি হয়েছে`);
      setAddQDialogOpen(false);
      if (questionsView) openQuestionsView(questionsView.chapter);
      return;
    }

    // Validation
    if (qForm.type === "cq") {
      if (!qForm.cq_stem) { toast.error("উদ্দীপক আবশ্যক"); return; }
    } else if (qForm.type === "descriptive") {
      if (!qForm.desc_q_ka && !qForm.desc_q_kha) { toast.error("অন্তত একটি প্রশ্ন আবশ্যক"); return; }
    } else {
      if (!qForm.question) { toast.error("প্রশ্ন আবশ্যক"); return; }
    }

    const questionText = qForm.type === "cq"
      ? (qForm.cq_stem.substring(0, 100) + (qForm.cq_stem.length > 100 ? "..." : ""))
      : qForm.type === "descriptive"
      ? (qForm.desc_q_ka.substring(0, 100) + (qForm.desc_q_ka.length > 100 ? "..." : ""))
      : qForm.question;

    const payload: any = {
      class_id: Number(classId), subject_id: Number(subjectId), chapter_id: Number(chapterId),
      topic_id: qForm.topic_id ? Number(qForm.topic_id) : null,
      type: qForm.type, question: questionText,
      option_a: qForm.option_a || null, option_b: qForm.option_b || null,
      option_c: qForm.option_c || null, option_d: qForm.option_d || null,
      correct_answer: qForm.correct_answer || null, explanation: qForm.explanation || null,
      board_references: qForm.board_references.length > 0 ? qForm.board_references : [],
      university_references: qForm.university_references.length > 0 ? qForm.university_references : [],
      stimulus_text: qForm.type === "mcq" && stimulusText ? stimulusText : null,
      stimulus_group_id: null,
    };

    if (qForm.type === "cq") {
      if (isMathSubject) {
        payload.creative_data = { is_math: true, stem: qForm.cq_stem, q_ka: qForm.cq_q_ka, q_kha: qForm.cq_q_kha, q_ga: qForm.cq_q_ga, ans_ka: qForm.cq_ans_ka, ans_kha: qForm.cq_ans_kha, ans_ga: qForm.cq_ans_ga };
      } else {
        payload.creative_data = { is_math: false, stem: qForm.cq_stem, q_ka: qForm.cq_q_ka, q_kha: qForm.cq_q_kha, q_ga: qForm.cq_q_ga, q_gha: qForm.cq_q_gha, ans_ka: qForm.cq_ans_ka, ans_kha: qForm.cq_ans_kha, ans_ga: qForm.cq_ans_ga, ans_gha: qForm.cq_ans_gha };
      }
    }
    if (qForm.type === "descriptive") {
      payload.creative_data = { desc_q_ka: qForm.desc_q_ka, desc_q_kha: qForm.desc_q_kha, desc_ans_ka: qForm.desc_ans_ka, desc_ans_kha: qForm.desc_ans_kha };
    }
    if (qForm.category_id) payload.category_id = Number(qForm.category_id);

    if (isEdit) {
      const { error } = await supabase.from("questions").update(payload).eq("id", editQItem.id);
      if (error) { toast.error("আপডেট ব্যর্থ: " + error.message); return; }
      toast.success("আপডেট হয়েছে");
      setEditQDialogOpen(false);
      if (questionsView) openQuestionsView(questionsView.chapter);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      payload.teacher_id = user?.id;
      const { error } = await supabase.from("questions").insert(payload);
      if (error) { toast.error("তৈরি ব্যর্থ: " + error.message); return; }
      toast.success("তৈরি হয়েছে");
      setAddQDialogOpen(false);
      if (questionsView) openQuestionsView(questionsView.chapter);
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!confirm("মুছে ফেলতে চান?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) { toast.error("ডিলিট ব্যর্থ"); return; }
    toast.success("মুছে ফেলা হয়েছে");
    if (questionsView) openQuestionsView(questionsView.chapter);
  };

  // === Question Form Renderer ===
  const renderQuestionForm = () => (
    <div className="space-y-3 py-2" style={{ fontFamily: FONT }}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label style={{ fontFamily: FONT }}>টপিক {addQLoadingTopics && <span className="text-xs text-muted-foreground">(লোড হচ্ছে...)</span>}</Label>
          <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" style={{ fontFamily: FONT }} value={qForm.topic_id} onChange={(e) => setQForm({ ...qForm, topic_id: e.target.value })}>
            <option value="">নির্বাচন করুন</option>
            {addQTopics.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <Label style={{ fontFamily: FONT }}>টাইপ</Label>
          <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" style={{ fontFamily: FONT }} value={qForm.type} onChange={(e) => setQForm({ ...qForm, type: e.target.value })}>
            {typeOptions.map((t) => <option key={t} value={t}>{typeLabelsMap[t] || t.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      {/* MCQ Form */}
      {qForm.type === "mcq" && (
        <>
          {!(editQDialogOpen && editQItem) && (
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
              <div><Label style={{ fontFamily: FONT }}>প্রশ্ন</Label><RichTextEditor value={qForm.question} onChange={(v) => setQForm({ ...qForm, question: v })} placeholder="প্রশ্নটি এখানে লিখুন..." minHeight="180px" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="mb-1 block">ক</Label><RichTextEditor value={qForm.option_a} onChange={(v) => setQForm({ ...qForm, option_a: v })} placeholder="অপশন ক" minHeight="120px" /></div>
                <div><Label className="mb-1 block">খ</Label><RichTextEditor value={qForm.option_b} onChange={(v) => setQForm({ ...qForm, option_b: v })} placeholder="অপশন খ" minHeight="120px" /></div>
                <div><Label className="mb-1 block">গ</Label><RichTextEditor value={qForm.option_c} onChange={(v) => setQForm({ ...qForm, option_c: v })} placeholder="অপশন গ" minHeight="120px" /></div>
                <div><Label className="mb-1 block">ঘ</Label><RichTextEditor value={qForm.option_d} onChange={(v) => setQForm({ ...qForm, option_d: v })} placeholder="অপশন ঘ" minHeight="120px" /></div>
              </div>
              <div>
                <Label style={{ fontFamily: FONT }}>সঠিক উত্তর</Label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={qForm.correct_answer} onChange={(e) => setQForm({ ...qForm, correct_answer: e.target.value })}>
                  <option value="">নির্বাচন করুন</option>
                  <option value="ক">ক</option><option value="খ">খ</option><option value="গ">গ</option><option value="ঘ">ঘ</option>
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
                      <option value="ক">ক</option><option value="খ">খ</option><option value="গ">গ</option><option value="ঘ">ঘ</option>
                    </select>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" className="w-full border-dashed border-emerald-400 text-emerald-600 hover:bg-emerald-50" onClick={() => setGroupedQuestions(prev => [...prev, { question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" }])} style={{ fontFamily: FONT }}>
                <Plus className="h-4 w-4 mr-1" /> আরও প্রশ্ন যোগ করুন
              </Button>
            </div>
          )}
          <div><Label style={{ fontFamily: FONT }}>ব্যাখ্যা (ঐচ্ছিক)</Label><RichTextEditor value={qForm.explanation} onChange={(v) => setQForm({ ...qForm, explanation: v })} placeholder="ব্যাখ্যা লিখুন..." minHeight="120px" /></div>
        </>
      )}

      {/* Short */}
      {qForm.type === "short" && (
        <>
          <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full" style={{ fontFamily: FONT }}>সংক্ষিপ্ত প্রশ্ন — ২ মার্ক</span>
          <div><Label style={{ fontFamily: FONT }}>প্রশ্ন</Label><RichTextEditor value={qForm.question} onChange={(v) => setQForm({ ...qForm, question: v })} placeholder="সংক্ষিপ্ত প্রশ্নটি এখানে লিখুন..." minHeight="140px" /></div>
          <div><Label style={{ fontFamily: FONT }}>উত্তর (ঐচ্ছিক)</Label><RichTextEditor value={qForm.correct_answer} onChange={(v) => setQForm({ ...qForm, correct_answer: v })} placeholder="নমুনা উত্তর লিখুন..." minHeight="120px" /></div>
          <div><Label style={{ fontFamily: FONT }}>ব্যাখ্যা (ঐচ্ছিক)</Label><RichTextEditor value={qForm.explanation} onChange={(v) => setQForm({ ...qForm, explanation: v })} placeholder="ব্যাখ্যা লিখুন..." minHeight="100px" /></div>
        </>
      )}

      {/* CQ */}
      {qForm.type === "cq" && (
        <div className="space-y-4">
          <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full" style={{ fontFamily: FONT }}>
            {isMathSubject ? "সৃজনশীল (গণিত) — ১০ মার্ক (ক=২, খ=৪, গ=৪)" : "সৃজনশীল — ১০ মার্ক (ক=১, খ=২, গ=৩, ঘ=৪)"}
          </span>
          <div><Label className="text-base font-semibold" style={{ fontFamily: FONT }}>উদ্দীপক (Stem/Stimulus)</Label><RichTextEditor value={qForm.cq_stem} onChange={(v) => setQForm({ ...qForm, cq_stem: v })} placeholder="উদ্দীপকটি এখানে লিখুন..." minHeight="150px" /></div>
          <Label className="text-base font-semibold" style={{ fontFamily: FONT }}>উপ-প্রশ্নসমূহ</Label>
          <div><Label>ক) {isMathSubject ? "জ্ঞানমূলক (নম্বর: ২)" : "জ্ঞানমূলক (নম্বর: ১)"}</Label><RichTextEditor value={qForm.cq_q_ka} onChange={(v) => setQForm({ ...qForm, cq_q_ka: v })} placeholder="প্রশ্ন ক" minHeight="80px" /></div>
          <div><Label>খ) {isMathSubject ? "অনুধাবনমূলক (নম্বর: ৪)" : "অনুধাবনমূলক (নম্বর: ২)"}</Label><RichTextEditor value={qForm.cq_q_kha} onChange={(v) => setQForm({ ...qForm, cq_q_kha: v })} placeholder="প্রশ্ন খ" minHeight="80px" /></div>
          <div><Label>গ) {isMathSubject ? "প্রয়োগমূলক (নম্বর: ৪)" : "প্রয়োগমূলক (নম্বর: ৩)"}</Label><RichTextEditor value={qForm.cq_q_ga} onChange={(v) => setQForm({ ...qForm, cq_q_ga: v })} placeholder="প্রশ্ন গ" minHeight="80px" /></div>
          {!isMathSubject && <div><Label>ঘ) উচ্চতর দক্ষতামূলক (নম্বর: ৪)</Label><RichTextEditor value={qForm.cq_q_gha} onChange={(v) => setQForm({ ...qForm, cq_q_gha: v })} placeholder="প্রশ্ন ঘ" minHeight="80px" /></div>}
          <Label className="text-base font-semibold" style={{ fontFamily: FONT }}>নমুনা উত্তর (ঐচ্ছিক)</Label>
          <div><Label>উত্তর ক</Label><RichTextEditor value={qForm.cq_ans_ka} onChange={(v) => setQForm({ ...qForm, cq_ans_ka: v })} placeholder="উত্তর ক" minHeight="80px" /></div>
          <div><Label>উত্তর খ</Label><RichTextEditor value={qForm.cq_ans_kha} onChange={(v) => setQForm({ ...qForm, cq_ans_kha: v })} placeholder="উত্তর খ" minHeight="80px" /></div>
          <div><Label>উত্তর গ</Label><RichTextEditor value={qForm.cq_ans_ga} onChange={(v) => setQForm({ ...qForm, cq_ans_ga: v })} placeholder="উত্তর গ" minHeight="80px" /></div>
          {!isMathSubject && <div><Label>উত্তর ঘ</Label><RichTextEditor value={qForm.cq_ans_gha} onChange={(v) => setQForm({ ...qForm, cq_ans_gha: v })} placeholder="উত্তর ঘ" minHeight="80px" /></div>}
          <div><Label style={{ fontFamily: FONT }}>ব্যাখ্যা (ঐচ্ছিক)</Label><RichTextEditor value={qForm.explanation} onChange={(v) => setQForm({ ...qForm, explanation: v })} placeholder="ব্যাখ্যা লিখুন..." minHeight="80px" /></div>
        </div>
      )}

      {/* Descriptive */}
      {qForm.type === "descriptive" && (
        <div className="space-y-4">
          <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full" style={{ fontFamily: FONT }}>বর্ণনামূলক প্রশ্ন — ১০ মার্ক (ক = ৩, খ = ৭)</span>
          <div><Label style={{ fontFamily: FONT }}>ক) প্রশ্ন (নম্বর: ৩)</Label><RichTextEditor value={qForm.desc_q_ka} onChange={(v) => setQForm({ ...qForm, desc_q_ka: v })} placeholder="প্রশ্ন ক লিখুন..." minHeight="140px" /></div>
          <div><Label style={{ fontFamily: FONT }}>ক) উত্তর (ঐচ্ছিক)</Label><RichTextEditor value={qForm.desc_ans_ka} onChange={(v) => setQForm({ ...qForm, desc_ans_ka: v })} placeholder="উত্তর ক লিখুন..." minHeight="100px" /></div>
          <div><Label style={{ fontFamily: FONT }}>খ) প্রশ্ন (নম্বর: ৭)</Label><RichTextEditor value={qForm.desc_q_kha} onChange={(v) => setQForm({ ...qForm, desc_q_kha: v })} placeholder="প্রশ্ন খ লিখুন..." minHeight="140px" /></div>
          <div><Label style={{ fontFamily: FONT }}>খ) উত্তর (ঐচ্ছিক)</Label><RichTextEditor value={qForm.desc_ans_kha} onChange={(v) => setQForm({ ...qForm, desc_ans_kha: v })} placeholder="উত্তর খ লিখুন..." minHeight="100px" /></div>
          <div><Label style={{ fontFamily: FONT }}>ব্যাখ্যা (ঐচ্ছিক)</Label><RichTextEditor value={qForm.explanation} onChange={(v) => setQForm({ ...qForm, explanation: v })} placeholder="ব্যাখ্যা লিখুন..." minHeight="100px" /></div>
        </div>
      )}

      {/* References */}
      <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
        <p className="text-sm font-semibold text-muted-foreground" style={{ fontFamily: FONT }}>রেফারেন্স এবং মেটাডাটা</p>
        <ReferenceInput label="বোর্ড রেফারেন্স" nameLabel="বোর্ড" namePlaceholder="যেমন: কু. বো." nameKey="board" value={qForm.board_references} onChange={(refs) => setQForm({ ...qForm, board_references: refs as any })} />
        <ReferenceInput label="বিশ্ববিদ্যালয় রেফারেন্স" nameLabel="বিশ্ববিদ্যালয়" namePlaceholder="যেমন: ঢাকা বিশ্ববিদ্যালয়" nameKey="name" value={qForm.university_references} onChange={(refs) => setQForm({ ...qForm, university_references: refs as any })} />
      </div>
    </div>
  );

  // === "See All Questions" View ===
  if (questionsView) {
    const ch = questionsView.chapter;
    const className = (ch as any).subjects?.classes?.name || "—";
    const subjectName = (ch as any).subjects?.name || "—";

    return (
      <div style={{ fontFamily: FONT }}>
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setQuestionsView(null)}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-xl font-bold">{ch.name} — সকল প্রশ্ন</h1>
            <p className="text-sm text-muted-foreground">{className} • {subjectName}</p>
          </div>
          <Button className="ml-auto gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => openAddQuestion(ch)}>
            <Plus className="w-4 h-4" /> নতুন প্রশ্ন যুক্ত করুন
          </Button>
        </div>

        {/* Type Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[{ value: "", label: "সকল" }, ...typeOptions.map(t => ({ value: t, label: typeLabelsMap[t] }))].map(tab => (
            <Button
              key={tab.value}
              variant={qFilterType === tab.value ? "default" : "outline"}
              size="sm"
              className={qFilterType === tab.value ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              onClick={() => { setQFilterType(tab.value); setQCurrentPage(1); }}
              style={{ fontFamily: FONT }}
            >
              {tab.label}
            </Button>
          ))}
          <span className="text-sm text-muted-foreground ml-auto self-center">মোট: {filteredQuestions.length}টি</span>
        </div>

        {questionsLoading ? (
          <div className="text-center py-12 text-muted-foreground">লোড হচ্ছে...</div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>প্রশ্ন</TableHead>
                    <TableHead className="w-24">টাইপ</TableHead>
                    <TableHead className="w-32">টপিক</TableHead>
                    <TableHead className="w-24 text-right">অ্যাকশন</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedQuestions.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="text-muted-foreground align-top">{q.id}</TableCell>
                      <TableCell className="max-w-[400px]">
                        <div className="space-y-1">
                          <div><LatexRenderer text={q.question} /></div>
                          {q.type === "mcq" && (q.option_a || q.option_b || q.option_c || q.option_d) && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-1 pl-1">
                              {q.option_a && <div><span className="font-semibold text-foreground">ক)</span> <LatexRenderer text={q.option_a} /></div>}
                              {q.option_b && <div><span className="font-semibold text-foreground">খ)</span> <LatexRenderer text={q.option_b} /></div>}
                              {q.option_c && <div><span className="font-semibold text-foreground">গ)</span> <LatexRenderer text={q.option_c} /></div>}
                              {q.option_d && <div><span className="font-semibold text-foreground">ঘ)</span> <LatexRenderer text={q.option_d} /></div>}
                              {q.correct_answer && <div className="col-span-2 text-emerald-600 font-semibold">সঠিক উত্তর: {q.correct_answer}</div>}
                            </div>
                          )}
                          {q.type === "cq" && q.creative_data && (
                            <div className="space-y-1 text-xs text-muted-foreground mt-1 pl-1 border-l-2 border-emerald-200 ml-1">
                              {q.creative_data.q_ka && <div className="pl-2"><span className="font-semibold text-foreground">ক)</span> <LatexRenderer text={q.creative_data.q_ka} /></div>}
                              {q.creative_data.q_kha && <div className="pl-2"><span className="font-semibold text-foreground">খ)</span> <LatexRenderer text={q.creative_data.q_kha} /></div>}
                              {q.creative_data.q_ga && <div className="pl-2"><span className="font-semibold text-foreground">গ)</span> <LatexRenderer text={q.creative_data.q_ga} /></div>}
                              {q.creative_data.q_gha && <div className="pl-2"><span className="font-semibold text-foreground">ঘ)</span> <LatexRenderer text={q.creative_data.q_gha} /></div>}
                            </div>
                          )}
                          {q.type === "descriptive" && q.creative_data && (
                            <div className="space-y-1 text-xs text-muted-foreground mt-1 pl-1 border-l-2 border-emerald-200 ml-1">
                              {q.creative_data.desc_q_ka && <div className="pl-2"><span className="font-semibold text-foreground">ক)</span> <LatexRenderer text={q.creative_data.desc_q_ka} /></div>}
                              {q.creative_data.desc_q_kha && <div className="pl-2"><span className="font-semibold text-foreground">খ)</span> <LatexRenderer text={q.creative_data.desc_q_kha} /></div>}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">{typeLabelsMap[q.type] || q.type}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground align-top">{q.topics?.name || "—"}</TableCell>
                      <TableCell className="text-right align-top">
                        <Button variant="ghost" size="icon" onClick={() => openEditQuestion(q)}><Pencil className="w-4 h-4 text-emerald-600" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteQuestion(q.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredQuestions.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">কোনো প্রশ্ন নেই</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {qTotalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              {(qSafePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(qSafePage * ITEMS_PER_PAGE, filteredQuestions.length)} / {filteredQuestions.length}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" disabled={qSafePage <= 1} onClick={() => setQCurrentPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              {Array.from({ length: qTotalPages }, (_, i) => i + 1).filter(p => p === 1 || p === qTotalPages || Math.abs(p - qSafePage) <= 2).map((p, idx, arr) => {
                const items: React.ReactNode[] = [];
                if (idx > 0 && p - arr[idx - 1] > 1) items.push(<span key={`dot-${idx}`} className="px-1 text-muted-foreground">…</span>);
                items.push(<Button key={p} variant={p === qSafePage ? "default" : "outline"} size="icon" className={`w-8 h-8 text-xs ${p === qSafePage ? "bg-emerald-600" : ""}`} onClick={() => setQCurrentPage(p)}>{p}</Button>);
                return items;
              })}
              <Button variant="outline" size="icon" disabled={qSafePage >= qTotalPages} onClick={() => setQCurrentPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        )}

        {/* Add Question Dialog */}
        <Dialog open={addQDialogOpen} onOpenChange={setAddQDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: FONT }}>নতুন প্রশ্ন যুক্ত করুন</DialogTitle>
              <p className="text-sm text-muted-foreground" style={{ fontFamily: FONT }}>
                {className} • {subjectName} • {ch.name}
              </p>
            </DialogHeader>
            {renderQuestionForm()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddQDialogOpen(false)} style={{ fontFamily: FONT }}>বাতিল</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleSaveQuestion(false)} style={{ fontFamily: FONT }}>
                {qForm.type === "mcq" && isGroupedMcq ? `${groupedQuestions.length}টি MCQ তৈরি করুন` : "তৈরি করুন"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Question Dialog */}
        <Dialog open={editQDialogOpen} onOpenChange={setEditQDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle style={{ fontFamily: FONT }}>প্রশ্ন সম্পাদনা</DialogTitle></DialogHeader>
            {renderQuestionForm()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditQDialogOpen(false)} style={{ fontFamily: FONT }}>বাতিল</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleSaveQuestion(true)} style={{ fontFamily: FONT }}>আপডেট</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // === Main Chapter Table ===
  return (
    <div style={{ fontFamily: FONT }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">অধ্যায় ম্যানেজমেন্ট</h1>
        <Button onClick={openCreate} className="gap-2 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> নতুন যোগ করুন</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <select className="border border-border rounded-md px-3 py-2 text-sm bg-background" style={{ fontFamily: FONT }} value={filterClassId} onChange={(e) => { setFilterClassId(e.target.value); setFilterSubjectId(""); }}>
          <option value="">সকল শ্রেণী</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={`border border-border rounded-md px-3 py-2 text-sm bg-background ${!filterClassId ? "opacity-50 cursor-not-allowed" : ""}`} style={{ fontFamily: FONT }} value={filterSubjectId} onChange={(e) => setFilterSubjectId(e.target.value)} disabled={!filterClassId}>
          <option value="">{filterClassId ? "সকল বিষয়" : "আগে শ্রেণী নির্বাচন করুন"}</option>
          {filteredSubjectsForFilter.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {(filterClassId || filterSubjectId) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterClassId(""); setFilterSubjectId(""); }}>ফিল্টার রিসেট</Button>
        )}
        <span className="text-sm text-muted-foreground ml-auto">মোট: {displayChapters.length}টি অধ্যায়</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>নাম</TableHead>
                <TableHead>শ্রেণী</TableHead>
                <TableHead>বিষয়</TableHead>
                <TableHead className="text-center">স্ট্যাটাস</TableHead>
                <TableHead className="text-center">ফ্রি/ডেমো</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayChapters.map((item) => (
                <TableRow key={item.id} className={!item.is_active ? "opacity-60" : ""}>
                  <TableCell>{item.id}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{(item as any).subjects?.classes?.name || "—"}</TableCell>
                  <TableCell>{(item as any).subjects?.name || "—"}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Switch
                        checked={item.is_active}
                        onCheckedChange={async (checked) => {
                          await supabase.from("chapters").update({ is_active: checked } as any).eq("id", item.id);
                          setChapters(prev => prev.map(ch => ch.id === item.id ? { ...ch, is_active: checked } : ch));
                          toast.success(checked ? "সক্রিয় করা হয়েছে" : "নিষ্ক্রিয় করা হয়েছে");
                        }}
                      />
                      <span className={`text-xs font-medium ${item.is_active ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {item.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={item.is_free}
                      onCheckedChange={async (checked) => {
                        await supabase.from("chapters").update({ is_free: checked } as any).eq("id", item.id);
                        setChapters(prev => prev.map(ch => ch.id === item.id ? { ...ch, is_free: checked } : ch));
                        toast.success(checked ? "ফ্রি/ডেমো সক্রিয়" : "ফ্রি/ডেমো নিষ্ক্রিয়");
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" style={{ fontFamily: FONT }}>
                          <DropdownMenuItem onClick={() => openQuestionsView(item)} className="gap-2">
                            <Eye className="w-4 h-4 text-emerald-600" /> সকল প্রশ্ন দেখুন
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAddQuestion(item)} className="gap-2">
                            <Plus className="w-4 h-4 text-emerald-600" /> নতুন প্রশ্ন যুক্ত করুন
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteTarget(item)} className="gap-2 text-destructive">
                            <Trash2 className="w-4 h-4" /> মুছে ফেলুন
                            {(chapterQuestionCounts[item.id] || 0) > 0 && (
                              <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-4 bg-destructive/10 text-destructive border-destructive/20">
                                {chapterQuestionCounts[item.id]}টি প্রশ্ন
                              </Badge>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {displayChapters.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">কোনো ডাটা নেই</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Chapter Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle style={{ fontFamily: FONT }}>{editItem ? "সম্পাদনা" : "নতুন অধ্যায় যোগ করুন"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="অধ্যায়ের নাম" value={formName} onChange={(e) => setFormName(e.target.value)} style={{ fontFamily: FONT }} />
            <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" style={{ fontFamily: FONT }} value={formClassId} onChange={(e) => { setFormClassId(e.target.value); setFormSubjectId(""); }}>
              <option value="">শ্রেণী নির্বাচন করুন</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" style={{ fontFamily: FONT }} value={formSubjectId} onChange={(e) => setFormSubjectId(e.target.value)} disabled={!formClassId}>
              <option value="">{formClassId ? "বিষয় নির্বাচন করুন" : "আগে শ্রেণী নির্বাচন করুন"}</option>
              {filteredSubjectsForForm.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} style={{ fontFamily: FONT }}>বাতিল</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700" style={{ fontFamily: FONT }}>{editItem ? "আপডেট" : "তৈরি করুন"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: FONT }}>অধ্যায় মুছে ফেলুন</AlertDialogTitle>
            <AlertDialogDescription style={{ fontFamily: FONT }}>
              আপনি কি নিশ্চিত যে "<strong>{deleteTarget?.name}</strong>" অধ্যায়টি মুছে ফেলতে চান? এই অধ্যায়ের সকল প্রশ্নও মুছে যাবে। এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ fontFamily: FONT }}>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" style={{ fontFamily: FONT }}>মুছে ফেলুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Question Dialog (from main table) */}
      <Dialog open={addQDialogOpen && !questionsView} onOpenChange={setAddQDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: FONT }}>নতুন প্রশ্ন যুক্ত করুন</DialogTitle>
            {addQChapter && (
              <p className="text-sm text-muted-foreground" style={{ fontFamily: FONT }}>
                {(addQChapter as any).subjects?.classes?.name} • {(addQChapter as any).subjects?.name} • {addQChapter.name}
              </p>
            )}
          </DialogHeader>
          {renderQuestionForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddQDialogOpen(false)} style={{ fontFamily: FONT }}>বাতিল</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleSaveQuestion(false)} style={{ fontFamily: FONT }}>
              {qForm.type === "mcq" && isGroupedMcq ? `${groupedQuestions.length}টি MCQ তৈরি করুন` : "তৈরি করুন"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
