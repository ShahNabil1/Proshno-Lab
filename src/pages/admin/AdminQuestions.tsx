import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, X, ArrowLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MathInput from "@/components/MathInput";
import RichTextEditor from "@/components/RichTextEditor";
import LatexRenderer from "@/components/LatexRenderer";
import ReferenceInput from "@/components/ReferenceInput";
import ReferenceBadges from "@/components/ReferenceBadges";
import ExplanationToggle from "@/components/ExplanationToggle";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";

const typeOptions = ["mcq", "short", "cq", "descriptive"];

export default function AdminQuestions() {
  const [items, setItems] = useState<any[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fullPageCreate, setFullPageCreate] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterChapterId, setFilterChapterId] = useState("");
  const [filterTopicId, setFilterTopicId] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterChapters, setFilterChapters] = useState<any[]>([]);
  const [filterTopics, setFilterTopics] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const { filterClasses, filterSubjects, hasFullAccess, isSubjectAllowed, loading: permLoading } = useAdminPermissions();
  const [isGroupedMcq, setIsGroupedMcq] = useState(false);
  const [groupedQuestions, setGroupedQuestions] = useState<Array<{
    question: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_answer: string;
  }>>([{ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" }]);
  const [stimulusText, setStimulusText] = useState("");

  const [form, setForm] = useState({
    class_id: "", subject_id: "", chapter_id: "", topic_id: "", category_id: "", type: "mcq",
    question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", explanation: "",
    cq_stem: "", cq_q_ka: "", cq_q_kha: "", cq_q_ga: "", cq_q_gha: "",
    cq_ans_ka: "", cq_ans_kha: "", cq_ans_ga: "", cq_ans_gha: "",
    desc_q_ka: "", desc_q_kha: "", desc_ans_ka: "", desc_ans_kha: "",
    board_references: [] as Array<{ board: string; year: string }>,
    university_references: [] as Array<{ name: string; year: string }>,
  });

  // Determine if selected subject is math-type (3-part CQ) or other (4-part CQ)
  const selectedSubjectName = subjects.find(s => String(s.id) === form.subject_id)?.name || allSubjects.find(s => String(s.id) === form.subject_id)?.name || "";
  const isMathSubject = /^(গণিত|উচ্চতর গণিত|math|higher math)/i.test(selectedSubjectName.trim());

  const classes = filterClasses(allClasses);
  const filterSubjectsList = filterSubjectId ? [] : allSubjects.filter(s => filterClassId ? String(s.class_id) === filterClassId : true);

  // Load chapters for filter
  useEffect(() => {
    if (!filterSubjectId) { setFilterChapters([]); setFilterTopics([]); return; }
    supabase.from("chapters").select("id, name").eq("subject_id", Number(filterSubjectId)).order("name")
      .then(({ data }) => setFilterChapters(data || []));
  }, [filterSubjectId]);

  // Load topics for filter
  useEffect(() => {
    if (!filterChapterId) { setFilterTopics([]); setFilterTopicId(""); return; }
    supabase.from("topics").select("id, name").eq("chapter_id", Number(filterChapterId)).order("name")
      .then(({ data }) => setFilterTopics(data || []));
  }, [filterChapterId]);

  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  // Server-side filtered + paginated; `items` already represents the current page
  const paginatedItems = items;

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterClassId, filterSubjectId, filterChapterId, filterTopicId, filterType]);

  const fetchItems = async () => {
    // Build server-side filtered query with count + range pagination to avoid the 1000-row default limit
    let query = supabase.from("questions")
      .select("*, classes(name), subjects(name), chapters(name), teachers(full_name)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (filterClassId) query = query.eq("class_id", Number(filterClassId));
    if (filterSubjectId) query = query.eq("subject_id", Number(filterSubjectId));
    if (filterChapterId) query = query.eq("chapter_id", Number(filterChapterId));
    if (filterTopicId) query = query.eq("topic_id", Number(filterTopicId));
    if (filterType) query = query.eq("type", filterType);
    if (searchTerm.trim()) query = query.ilike("question", `%${searchTerm.trim()}%`);

    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    query = query.range(from, to);

    const { data, count } = await query;
    const rows = data || [];
    if (hasFullAccess) {
      setItems(rows);
      setTotalCount(count || 0);
    } else {
      // Fallback: when limited admin permissions are in play, restrict in-page rows.
      // Note: count may be slightly off here because allowed-subject filtering is client-side,
      // but limited admins typically only see one class/subject anyway via filterClasses/filterSubjects.
      const filtered = rows.filter((q: any) => isSubjectAllowed(q.class_id, q.subject_id));
      setItems(filtered);
      setTotalCount(count || 0);
    }
  };

  useEffect(() => {
    supabase.from("classes").select("id, name").order("name").then(({ data }) => setAllClasses(data || []));
    supabase.from("subjects").select("id, name, class_id").order("name").then(({ data }) => setAllSubjects(data || []));
    supabase.from("question_categories").select("id, name").order("name").then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => {
    if (!permLoading) fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permLoading, currentPage, searchTerm, filterClassId, filterSubjectId, filterChapterId, filterTopicId, filterType]);

  useEffect(() => {
    if (!form.class_id) return;
    const filtered = filterSubjects(allSubjects.filter(s => String(s.class_id) === form.class_id) as any);
    setSubjects(filtered);
  }, [form.class_id, allSubjects, permLoading]);

  useEffect(() => {
    if (!form.subject_id) return;
    supabase.from("chapters").select("id, name").eq("subject_id", Number(form.subject_id)).order("name")
      .then(({ data }) => setChapters(data || []));
  }, [form.subject_id]);

  // Load topics when chapter changes
  useEffect(() => {
    if (!form.chapter_id) { setTopics([]); return; }
    setLoadingTopics(true);
    supabase.from("topics").select("id, name").eq("chapter_id", Number(form.chapter_id)).order("name")
      .then(({ data }) => { setTopics(data || []); setLoadingTopics(false); });
  }, [form.chapter_id]);

  const openCreate = () => {
    setEditItem(null);
    setIsGroupedMcq(false);
    setStimulusText("");
    setGroupedQuestions([{ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" }]);
    setForm({ class_id: "", subject_id: "", chapter_id: "", topic_id: "", category_id: "", type: "mcq", question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", explanation: "", cq_stem: "", cq_q_ka: "", cq_q_kha: "", cq_q_ga: "", cq_q_gha: "", cq_ans_ka: "", cq_ans_kha: "", cq_ans_ga: "", cq_ans_gha: "", desc_q_ka: "", desc_q_kha: "", desc_ans_ka: "", desc_ans_kha: "", board_references: [], university_references: [] });
    setFullPageCreate(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    const cd = item.creative_data || {};
    // Detect grouped MCQ
    if (item.type === "mcq" && item.stimulus_group_id) {
      setIsGroupedMcq(true);
      setStimulusText(item.stimulus_text || "");
      // We'll load grouped questions from DB
      supabase.from("questions").select("*").eq("stimulus_group_id", item.stimulus_group_id).order("id")
        .then(({ data }) => {
          if (data && data.length > 0) {
            setGroupedQuestions(data.map((q: any) => ({
              question: q.question || "", option_a: q.option_a || "", option_b: q.option_b || "",
              option_c: q.option_c || "", option_d: q.option_d || "", correct_answer: q.correct_answer || "",
            })));
          }
        });
    } else {
      setIsGroupedMcq(false);
      setStimulusText(item.stimulus_text || "");
      setGroupedQuestions([{ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" }]);
    }
    setForm({
      class_id: String(item.class_id), subject_id: String(item.subject_id),
      chapter_id: String(item.chapter_id), topic_id: item.topic_id ? String(item.topic_id) : "", category_id: item.category_id ? String(item.category_id) : "",
      type: item.type, question: item.question, option_a: item.option_a || "", option_b: item.option_b || "",
      option_c: item.option_c || "", option_d: item.option_d || "", correct_answer: item.correct_answer || "",
      explanation: item.explanation || "",
      cq_stem: cd.stem || "", cq_q_ka: cd.q_ka || "", cq_q_kha: cd.q_kha || "", cq_q_ga: cd.q_ga || "", cq_q_gha: cd.q_gha || "",
      cq_ans_ka: cd.ans_ka || "", cq_ans_kha: cd.ans_kha || "", cq_ans_ga: cd.ans_ga || "", cq_ans_gha: cd.ans_gha || "",
      desc_q_ka: cd.desc_q_ka || "", desc_q_kha: cd.desc_q_kha || "",
      desc_ans_ka: cd.desc_ans_ka || "", desc_ans_kha: cd.desc_ans_kha || "",
      board_references: Array.isArray(item.board_references) ? item.board_references : [],
      university_references: Array.isArray(item.university_references) ? item.university_references : [],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    // Grouped MCQ save logic
    if (form.type === "mcq" && isGroupedMcq) {
      if (!stimulusText || !form.class_id || !form.subject_id || !form.chapter_id) {
        toast.error("উদ্দীপক, শ্রেণী, বিষয় ও অধ্যায় আবশ্যক");
        return;
      }
      const validQs = groupedQuestions.filter(gq => gq.question.trim());
      if (validQs.length === 0) {
        toast.error("অন্তত একটি প্রশ্ন প্রয়োজন");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const groupId = editItem?.stimulus_group_id || crypto.randomUUID();

      // If editing, delete old group questions first
      if (editItem?.stimulus_group_id) {
        await supabase.from("questions").delete().eq("stimulus_group_id", editItem.stimulus_group_id);
      }

      const payloads = validQs.map((gq) => ({
        class_id: Number(form.class_id),
        subject_id: Number(form.subject_id),
        chapter_id: Number(form.chapter_id),
        topic_id: form.topic_id ? Number(form.topic_id) : null,
        category_id: form.category_id ? Number(form.category_id) : null,
        type: "mcq",
        question: gq.question,
        option_a: gq.option_a || null,
        option_b: gq.option_b || null,
        option_c: gq.option_c || null,
        option_d: gq.option_d || null,
        correct_answer: gq.correct_answer || null,
        explanation: form.explanation || null,
        stimulus_group_id: groupId,
        stimulus_text: stimulusText,
        board_references: form.board_references.length > 0 ? form.board_references : [],
        university_references: form.university_references.length > 0 ? form.university_references : [],
        teacher_id: user?.id,
      }));

      const { error } = await supabase.from("questions").insert(payloads as any);
      if (error) { toast.error("তৈরি ব্যর্থ: " + error.message); return; }
      toast.success(editItem ? "গ্রুপ আপডেট হয়েছে" : "গ্রুপ তৈরি হয়েছে");
      setFullPageCreate(false);
      fetchItems();
      return;
    }

    if (form.type === "cq") {
      if (!form.cq_stem || !form.class_id || !form.subject_id || !form.chapter_id) {
        toast.error("উদ্দীপক, শ্রেণী, বিষয় ও অধ্যায় আবশ্যক");
        return;
      }
    } else if (form.type === "descriptive") {
      if ((!form.desc_q_ka && !form.desc_q_kha) || !form.class_id || !form.subject_id || !form.chapter_id) {
        toast.error("অন্তত একটি প্রশ্ন, শ্রেণী, বিষয় ও অধ্যায় আবশ্যক");
        return;
      }
    } else {
      if (!form.question || !form.class_id || !form.subject_id || !form.chapter_id) {
        toast.error("প্রশ্ন, শ্রেণী, বিষয় ও অধ্যায় আবশ্যক");
        return;
      }
    }

    // For descriptive, use first sub-question as summary for the question column
    const questionText = form.type === "cq"
      ? (form.cq_stem.substring(0, 100) + (form.cq_stem.length > 100 ? "..." : ""))
      : form.type === "descriptive"
      ? (form.desc_q_ka.substring(0, 100) + (form.desc_q_ka.length > 100 ? "..." : ""))
      : form.question;

    const payload: any = {
      class_id: Number(form.class_id), subject_id: Number(form.subject_id), chapter_id: Number(form.chapter_id),
      topic_id: form.topic_id ? Number(form.topic_id) : null,
      type: form.type,
      question: questionText,
      option_a: form.option_a || null, option_b: form.option_b || null,
      option_c: form.option_c || null, option_d: form.option_d || null, correct_answer: form.correct_answer || null,
      explanation: form.explanation || null,
      board_references: form.board_references.length > 0 ? form.board_references : [],
      university_references: form.university_references.length > 0 ? form.university_references : [],
      // For single MCQ with optional stimulus
      stimulus_text: form.type === "mcq" && stimulusText ? stimulusText : null,
      stimulus_group_id: null,
    };

    if (form.type === "cq") {
      const saveSub = subjects.find(s => String(s.id) === form.subject_id) || allSubjects.find(s => String(s.id) === form.subject_id);
      const saveMath = /^(গণিত|উচ্চতর গণিত|math|higher math)/i.test((saveSub?.name || "").trim());
      if (saveMath) {
        payload.creative_data = {
          is_math: true, stem: form.cq_stem,
          q_ka: form.cq_q_ka, q_kha: form.cq_q_kha, q_ga: form.cq_q_ga,
          ans_ka: form.cq_ans_ka, ans_kha: form.cq_ans_kha, ans_ga: form.cq_ans_ga,
        };
      } else {
        payload.creative_data = {
          is_math: false, stem: form.cq_stem,
          q_ka: form.cq_q_ka, q_kha: form.cq_q_kha, q_ga: form.cq_q_ga, q_gha: form.cq_q_gha,
          ans_ka: form.cq_ans_ka, ans_kha: form.cq_ans_kha, ans_ga: form.cq_ans_ga, ans_gha: form.cq_ans_gha,
        };
      }
    }

    if (form.type === "descriptive") {
      payload.creative_data = {
        desc_q_ka: form.desc_q_ka, desc_q_kha: form.desc_q_kha,
        desc_ans_ka: form.desc_ans_ka, desc_ans_kha: form.desc_ans_kha,
      };
    }

    if (form.category_id) payload.category_id = Number(form.category_id);

    if (editItem) {
      const { error } = await supabase.from("questions").update(payload).eq("id", editItem.id);
      if (error) { toast.error("আপডেট ব্যর্থ: " + error.message); return; }
      toast.success("আপডেট হয়েছে");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      payload.teacher_id = user?.id;
      const { error } = await supabase.from("questions").insert(payload);
      if (error) { toast.error("তৈরি ব্যর্থ: " + error.message); return; }
      toast.success("তৈরি হয়েছে");
    }
    if (editItem) {
      setDialogOpen(false);
    } else {
      setFullPageCreate(false);
    }
    fetchItems();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("মুছে ফেলতে চান?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) { toast.error("ডিলিট ব্যর্থ"); return; }
    toast.success("মুছে ফেলা হয়েছে");
    fetchItems();
  };

  // === Full Page Create View ===
  if (fullPageCreate) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setFullPageCreate(false)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">নতুন প্রশ্ন তৈরি করুন</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>শ্রেণী</Label>
                  <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value, subject_id: "", chapter_id: "", topic_id: "" })}>
                    <option value="">নির্বাচন করুন</option>
                    {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>বিষয়</Label>
                  <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value, chapter_id: "", topic_id: "" })}>
                    <option value="">নির্বাচন করুন</option>
                    {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>অধ্যায়</Label>
                  <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.chapter_id} onChange={(e) => setForm({ ...form, chapter_id: e.target.value, topic_id: "" })}>
                    <option value="">নির্বাচন করুন</option>
                    {chapters.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>টপিক {loadingTopics && <span className="text-xs text-muted-foreground">(লোড হচ্ছে...)</span>}</Label>
                  <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.topic_id} onChange={(e) => setForm({ ...form, topic_id: e.target.value })} disabled={!form.chapter_id}>
                    <option value="">নির্বাচন করুন</option>
                    {topics.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>টাইপ</Label>
                  <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {typeOptions.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              {/* Reuse the same form content from dialog below - rendered inline */}
              {form.type === "cq" ? (
                <div className="space-y-4">
                  <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">
                    {isMathSubject ? "সৃজনশীল (গণিত) — ১০ মার্ক (ক=২, খ=৪, গ=৪)" : "সৃজনশীল — ১০ মার্ক (ক=১, খ=২, গ=৩, ঘ=৪)"}
                  </span>
                  <div><Label className="text-base font-semibold">উদ্দীপক (Stem/Stimulus)</Label><RichTextEditor value={form.cq_stem} onChange={(v) => setForm({ ...form, cq_stem: v })} placeholder="উদ্দীপকটি এখানে লিখুন..." minHeight="150px" /></div>
                  <Label className="text-base font-semibold">উপ-প্রশ্নসমূহ</Label>
                  <div><Label>ক) {isMathSubject ? "জ্ঞানমূলক (নম্বর: ২)" : "জ্ঞানমূলক (নম্বর: ১)"}</Label><RichTextEditor value={form.cq_q_ka} onChange={(v) => setForm({ ...form, cq_q_ka: v })} placeholder="প্রশ্ন ক" minHeight="80px" /></div>
                  <div><Label>খ) {isMathSubject ? "অনুধাবনমূলক (নম্বর: ৪)" : "অনুধাবনমূলক (নম্বর: ২)"}</Label><RichTextEditor value={form.cq_q_kha} onChange={(v) => setForm({ ...form, cq_q_kha: v })} placeholder="প্রশ্ন খ" minHeight="80px" /></div>
                  <div><Label>গ) {isMathSubject ? "প্রয়োগমূলক (নম্বর: ৪)" : "প্রয়োগমূলক (নম্বর: ৩)"}</Label><RichTextEditor value={form.cq_q_ga} onChange={(v) => setForm({ ...form, cq_q_ga: v })} placeholder="প্রশ্ন গ" minHeight="80px" /></div>
                  {!isMathSubject && <div><Label>ঘ) উচ্চতর দক্ষতামূলক (নম্বর: ৪)</Label><RichTextEditor value={form.cq_q_gha} onChange={(v) => setForm({ ...form, cq_q_gha: v })} placeholder="প্রশ্ন ঘ" minHeight="80px" /></div>}
                  <Label className="text-base font-semibold">নমুনা উত্তর (ঐচ্ছিক)</Label>
                  <div><Label>উত্তর ক</Label><RichTextEditor value={form.cq_ans_ka} onChange={(v) => setForm({ ...form, cq_ans_ka: v })} placeholder="উত্তর ক" minHeight="80px" /></div>
                  <div><Label>উত্তর খ</Label><RichTextEditor value={form.cq_ans_kha} onChange={(v) => setForm({ ...form, cq_ans_kha: v })} placeholder="উত্তর খ" minHeight="80px" /></div>
                  <div><Label>উত্তর গ</Label><RichTextEditor value={form.cq_ans_ga} onChange={(v) => setForm({ ...form, cq_ans_ga: v })} placeholder="উত্তর গ" minHeight="80px" /></div>
                  {!isMathSubject && <div><Label>উত্তর ঘ</Label><RichTextEditor value={form.cq_ans_gha} onChange={(v) => setForm({ ...form, cq_ans_gha: v })} placeholder="উত্তর ঘ" minHeight="80px" /></div>}
                  <div><Label>ব্যাখ্যা (ঐচ্ছিক)</Label><RichTextEditor value={form.explanation} onChange={(v) => setForm({ ...form, explanation: v })} placeholder="ব্যাখ্যা লিখুন..." minHeight="80px" /></div>
                </div>
              ) : (
                <>
                  {form.type === "mcq" && (
                    <>
                      <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30">
                        <div>
                          <Label className="font-semibold">উদ্দীপক ভিত্তিক প্রশ্ন (Grouped MCQ)</Label>
                          <p className="text-xs text-muted-foreground">একটি উদ্দীপকের অধীনে একাধিক MCQ যোগ করুন</p>
                        </div>
                        <Switch checked={isGroupedMcq} onCheckedChange={setIsGroupedMcq} />
                      </div>
                      <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">MCQ — প্রতিটি ১ নম্বর</span>
                      <div><Label>{isGroupedMcq ? "উদ্দীপক (Stimulus) *" : "উদ্দীপক (ঐচ্ছিক)"}</Label><RichTextEditor value={stimulusText} onChange={setStimulusText} placeholder="উদ্দীপকটি এখানে লিখুন..." minHeight={isGroupedMcq ? "150px" : "100px"} /></div>
                      {!isGroupedMcq ? (
                        <>
                          <div><Label>প্রশ্ন</Label><RichTextEditor value={form.question} onChange={(v) => setForm({ ...form, question: v })} placeholder="প্রশ্নটি এখানে লিখুন..." minHeight="180px" /></div>
                          <div className="grid grid-cols-2 gap-3">
                            <div><Label className="mb-1 block">ক</Label><RichTextEditor value={form.option_a} onChange={(v) => setForm({ ...form, option_a: v })} placeholder="অপশন ক" minHeight="120px" /></div>
                            <div><Label className="mb-1 block">খ</Label><RichTextEditor value={form.option_b} onChange={(v) => setForm({ ...form, option_b: v })} placeholder="অপশন খ" minHeight="120px" /></div>
                            <div><Label className="mb-1 block">গ</Label><RichTextEditor value={form.option_c} onChange={(v) => setForm({ ...form, option_c: v })} placeholder="অপশন গ" minHeight="120px" /></div>
                            <div><Label className="mb-1 block">ঘ</Label><RichTextEditor value={form.option_d} onChange={(v) => setForm({ ...form, option_d: v })} placeholder="অপশন ঘ" minHeight="120px" /></div>
                          </div>
                          <div>
                            <Label>সঠিক উত্তর</Label>
                            <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.correct_answer} onChange={(e) => setForm({ ...form, correct_answer: e.target.value })}>
                              <option value="">নির্বাচন করুন</option>
                              <option value="ক">ক</option><option value="খ">খ</option><option value="গ">গ</option><option value="ঘ">ঘ</option>
                            </select>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-4">
                          <Label className="text-base font-semibold">প্রশ্নসমূহ ({groupedQuestions.length}টি)</Label>
                          {groupedQuestions.map((gq, gi) => (
                            <div key={gi} className="border border-border rounded-lg p-3 space-y-2 relative bg-background">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold">প্রশ্ন {gi + 1}</span>
                                {groupedQuestions.length > 1 && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setGroupedQuestions(prev => prev.filter((_, i) => i !== gi))}><X className="h-3.5 w-3.5 text-destructive" /></Button>}
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
                          <Button type="button" variant="outline" className="w-full border-dashed border-emerald-400 text-emerald-600 hover:bg-emerald-50" onClick={() => setGroupedQuestions(prev => [...prev, { question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" }])}>
                            <Plus className="h-4 w-4 mr-1" /> আরও প্রশ্ন যোগ করুন
                          </Button>
                        </div>
                      )}
                      <div><Label>ব্যাখ্যা (ঐচ্ছিক)</Label><RichTextEditor value={form.explanation} onChange={(v) => setForm({ ...form, explanation: v })} placeholder="ব্যাখ্যা লিখুন..." minHeight="120px" /></div>
                    </>
                  )}
                  {form.type === "short" && (
                    <>
                      <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">সংক্ষিপ্ত প্রশ্ন — ২ মার্ক</span>
                      <div><Label>প্রশ্ন</Label><RichTextEditor value={form.question} onChange={(v) => setForm({ ...form, question: v })} placeholder="সংক্ষিপ্ত প্রশ্নটি এখানে লিখুন..." minHeight="140px" /></div>
                      <div><Label>উত্তর (ঐচ্ছিক)</Label><RichTextEditor value={form.correct_answer} onChange={(v) => setForm({ ...form, correct_answer: v })} placeholder="নমুনা উত্তর লিখুন..." minHeight="120px" /></div>
                      <div><Label>ব্যাখ্যা (ঐচ্ছিক)</Label><RichTextEditor value={form.explanation} onChange={(v) => setForm({ ...form, explanation: v })} placeholder="ব্যাখ্যা লিখুন..." minHeight="100px" /></div>
                    </>
                  )}
                  {form.type === "descriptive" && (
                    <div className="space-y-4">
                      <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">বর্ণনামূলক প্রশ্ন — ১০ মার্ক (ক = ৩, খ = ৭)</span>
                      <div><Label>ক) প্রশ্ন (নম্বর: ৩)</Label><RichTextEditor value={form.desc_q_ka} onChange={(v) => setForm({ ...form, desc_q_ka: v })} placeholder="প্রশ্ন ক লিখুন..." minHeight="140px" /></div>
                      <div><Label>ক) উত্তর (ঐচ্ছিক)</Label><RichTextEditor value={form.desc_ans_ka} onChange={(v) => setForm({ ...form, desc_ans_ka: v })} placeholder="উত্তর ক লিখুন..." minHeight="100px" /></div>
                      <div><Label>খ) প্রশ্ন (নম্বর: ৭)</Label><RichTextEditor value={form.desc_q_kha} onChange={(v) => setForm({ ...form, desc_q_kha: v })} placeholder="প্রশ্ন খ লিখুন..." minHeight="140px" /></div>
                      <div><Label>খ) উত্তর (ঐচ্ছিক)</Label><RichTextEditor value={form.desc_ans_kha} onChange={(v) => setForm({ ...form, desc_ans_kha: v })} placeholder="উত্তর খ লিখুন..." minHeight="100px" /></div>
                      <div><Label>ব্যাখ্যা (ঐচ্ছিক)</Label><RichTextEditor value={form.explanation} onChange={(v) => setForm({ ...form, explanation: v })} placeholder="ব্যাখ্যা লিখুন..." minHeight="100px" /></div>
                    </div>
                  )}
                </>
              )}
              {/* References */}
              <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
                <p className="text-sm font-semibold text-muted-foreground">রেফারেন্স এবং মেটাডাটা</p>
                <ReferenceInput label="বোর্ড রেফারেন্স" nameLabel="বোর্ড" namePlaceholder="যেমন: কু. বো." nameKey="board" value={form.board_references} onChange={(refs) => setForm({ ...form, board_references: refs as any })} />
                <ReferenceInput label="বিশ্ববিদ্যালয় রেফারেন্স" nameLabel="বিশ্ববিদ্যালয়" namePlaceholder="যেমন: ঢাকা বিশ্ববিদ্যালয়" nameKey="name" value={form.university_references} onChange={(refs) => setForm({ ...form, university_references: refs as any })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => setFullPageCreate(false)}>বাতিল</Button>
              <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
                {form.type === "mcq" && isGroupedMcq ? `${groupedQuestions.length}টি MCQ তৈরি করুন` : "তৈরি করুন"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">প্রশ্ন ম্যানেজমেন্ট</h1>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> নতুন প্রশ্ন</Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="প্রশ্ন অনুসন্ধান করুন..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filterClassId} onValueChange={(v) => { setFilterClassId(v === "all" ? "" : v); setFilterSubjectId(""); setFilterChapterId(""); }}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="শ্রেণী" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সকল শ্রেণী</SelectItem>
            {classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSubjectId} onValueChange={(v) => { setFilterSubjectId(v === "all" ? "" : v); setFilterChapterId(""); setFilterTopicId(""); }} disabled={!filterClassId}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="বিষয়" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সকল বিষয়</SelectItem>
            {allSubjects.filter(s => String(s.class_id) === filterClassId).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterChapterId} onValueChange={(v) => { setFilterChapterId(v === "all" ? "" : v); setFilterTopicId(""); }} disabled={!filterSubjectId}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="অধ্যায়" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সকল অধ্যায়</SelectItem>
            {filterChapters.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTopicId} onValueChange={(v) => setFilterTopicId(v === "all" ? "" : v)} disabled={!filterChapterId || filterTopics.length === 0}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="টপিক" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সকল টপিক</SelectItem>
            {filterTopics.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={(v) => setFilterType(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="টাইপ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সকল টাইপ</SelectItem>
            {typeOptions.map((t) => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>প্রশ্ন</TableHead>
                <TableHead>টাইপ</TableHead>
                <TableHead>শ্রেণী</TableHead>
                <TableHead>বিষয়</TableHead>
                <TableHead>শিক্ষক</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.id}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    <LatexRenderer text={item.question} />
                  </TableCell>
                  <TableCell className="uppercase">{item.type}</TableCell>
                  <TableCell>{item.classes?.name}</TableCell>
                  <TableCell>{item.subjects?.name}</TableCell>
                  <TableCell>{item.teachers?.full_name || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {paginatedItems.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">কোনো প্রশ্ন নেই</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            মোট {totalCount}টি প্রশ্নের মধ্যে {(safeCurrentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safeCurrentPage * ITEMS_PER_PAGE, totalCount)} দেখানো হচ্ছে
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 2)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push(-1);
                acc.push(p);
                return acc;
              }, [] as number[])
              .map((p, idx) =>
                p === -1 ? (
                  <span key={`dot-${idx}`} className="px-1 text-muted-foreground">…</span>
                ) : (
                  <Button key={p} variant={p === safeCurrentPage ? "default" : "outline"} size="icon" className="w-8 h-8 text-xs" onClick={() => setCurrentPage(p)}>
                    {p}
                  </Button>
                )
              )}
            <Button variant="outline" size="icon" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? "প্রশ্ন সম্পাদনা" : "নতুন প্রশ্ন"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>শ্রেণী</Label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value, subject_id: "", chapter_id: "", topic_id: "" })}>
                  <option value="">নির্বাচন করুন</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>বিষয়</Label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value, chapter_id: "", topic_id: "" })}>
                  <option value="">নির্বাচন করুন</option>
                  {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <Label>অধ্যায়</Label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.chapter_id} onChange={(e) => setForm({ ...form, chapter_id: e.target.value, topic_id: "" })}>
                  <option value="">নির্বাচন করুন</option>
                  {chapters.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>টপিক {loadingTopics && <span className="text-xs text-muted-foreground">(লোড হচ্ছে...)</span>}</Label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.topic_id} onChange={(e) => setForm({ ...form, topic_id: e.target.value })} disabled={!form.chapter_id}>
                  <option value="">নির্বাচন করুন</option>
                  {topics.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <Label>টাইপ</Label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {typeOptions.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
              </div>
            </div>
            {/* === CQ Form === */}
            {form.type === "cq" ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full" style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>
                    {isMathSubject
                      ? "সৃজনশীল (গণিত) — ১০ মার্ক (ক=২, খ=৪, গ=৪)"
                      : "সৃজনশীল — ১০ মার্ক (ক=১, খ=২, গ=৩, ঘ=৪)"}
                  </span>
                  {!form.subject_id && <span className="text-xs text-muted-foreground">(বিষয় নির্বাচন করলে মার্ক নির্ধারিত হবে)</span>}
                </div>
                <div>
                  <Label className="text-base font-semibold">উদ্দীপক (Stem/Stimulus)</Label>
                  <RichTextEditor value={form.cq_stem} onChange={(v) => setForm({ ...form, cq_stem: v })} placeholder="উদ্দীপকটি এখানে লিখুন..." minHeight="150px" />
                </div>
                <div className="space-y-3">
                  <Label className="text-base font-semibold">উপ-প্রশ্নসমূহ</Label>
                  <div>
                    <Label>ক) {isMathSubject ? "জ্ঞানমূলক (নম্বর: ২)" : "জ্ঞানমূলক (নম্বর: ১)"}</Label>
                    <RichTextEditor value={form.cq_q_ka} onChange={(v) => setForm({ ...form, cq_q_ka: v })} placeholder="প্রশ্ন ক" minHeight="80px" />
                  </div>
                  <div>
                    <Label>খ) {isMathSubject ? "অনুধাবনমূলক (নম্বর: ৪)" : "অনুধাবনমূলক (নম্বর: ২)"}</Label>
                    <RichTextEditor value={form.cq_q_kha} onChange={(v) => setForm({ ...form, cq_q_kha: v })} placeholder="প্রশ্ন খ" minHeight="80px" />
                  </div>
                  <div>
                    <Label>গ) {isMathSubject ? "প্রয়োগমূলক (নম্বর: ৪)" : "প্রয়োগমূলক (নম্বর: ৩)"}</Label>
                    <RichTextEditor value={form.cq_q_ga} onChange={(v) => setForm({ ...form, cq_q_ga: v })} placeholder="প্রশ্ন গ" minHeight="80px" />
                  </div>
                  {!isMathSubject && (
                    <div>
                      <Label>ঘ) উচ্চতর দক্ষতামূলক (নম্বর: ৪)</Label>
                      <RichTextEditor value={form.cq_q_gha} onChange={(v) => setForm({ ...form, cq_q_gha: v })} placeholder="প্রশ্ন ঘ" minHeight="80px" />
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <Label className="text-base font-semibold">নমুনা উত্তর (ঐচ্ছিক)</Label>
                  <div><Label>উত্তর ক</Label><RichTextEditor value={form.cq_ans_ka} onChange={(v) => setForm({ ...form, cq_ans_ka: v })} placeholder="উত্তর ক" minHeight="80px" /></div>
                  <div><Label>উত্তর খ</Label><RichTextEditor value={form.cq_ans_kha} onChange={(v) => setForm({ ...form, cq_ans_kha: v })} placeholder="উত্তর খ" minHeight="80px" /></div>
                  <div><Label>উত্তর গ</Label><RichTextEditor value={form.cq_ans_ga} onChange={(v) => setForm({ ...form, cq_ans_ga: v })} placeholder="উত্তর গ" minHeight="80px" /></div>
                  {!isMathSubject && (
                    <div><Label>উত্তর ঘ</Label><RichTextEditor value={form.cq_ans_gha} onChange={(v) => setForm({ ...form, cq_ans_gha: v })} placeholder="উত্তর ঘ" minHeight="80px" /></div>
                  )}
                </div>
                <div>
                  <Label>ব্যাখ্যা (ঐচ্ছিক)</Label>
                  <RichTextEditor value={form.explanation} onChange={(v) => setForm({ ...form, explanation: v })} placeholder="ব্যাখ্যা লিখুন..." minHeight="80px" />
                </div>
              </div>
            ) : (
              <>
                {/* === MCQ Form === */}
                {form.type === "mcq" && (
                  <>
                    {/* Grouped MCQ Toggle */}
                    <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30">
                      <div>
                        <Label className="font-semibold" style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>উদ্দীপক ভিত্তিক প্রশ্ন (Grouped MCQ)</Label>
                        <p className="text-xs text-muted-foreground">একটি উদ্দীপকের অধীনে একাধিক MCQ যোগ করুন</p>
                      </div>
                      <Switch checked={isGroupedMcq} onCheckedChange={setIsGroupedMcq} />
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full" style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>
                        MCQ — প্রতিটি ১ নম্বর
                      </span>
                    </div>

                    {/* Optional Stimulus field (shown for both modes) */}
                    {(isGroupedMcq || !isGroupedMcq) && (
                      <div>
                        <Label style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>
                          {isGroupedMcq ? "উদ্দীপক (Stimulus) *" : "উদ্দীপক (ঐচ্ছিক)"}
                        </Label>
                        <RichTextEditor
                          value={stimulusText}
                          onChange={setStimulusText}
                          placeholder="উদ্দীপকটি এখানে লিখুন..."
                          minHeight={isGroupedMcq ? "150px" : "100px"}
                        />
                      </div>
                    )}

                    {!isGroupedMcq ? (
                      <>
                        {/* Single MCQ */}
                        <div>
                          <Label>প্রশ্ন</Label>
                          <RichTextEditor value={form.question} onChange={(v) => setForm({ ...form, question: v })} placeholder="প্রশ্নটি এখানে লিখুন..." minHeight="180px" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label className="mb-1 block">ক</Label><RichTextEditor value={form.option_a} onChange={(v) => setForm({ ...form, option_a: v })} placeholder="অপশন ক" minHeight="120px" /></div>
                          <div><Label className="mb-1 block">খ</Label><RichTextEditor value={form.option_b} onChange={(v) => setForm({ ...form, option_b: v })} placeholder="অপশন খ" minHeight="120px" /></div>
                          <div><Label className="mb-1 block">গ</Label><RichTextEditor value={form.option_c} onChange={(v) => setForm({ ...form, option_c: v })} placeholder="অপশন গ" minHeight="120px" /></div>
                          <div><Label className="mb-1 block">ঘ</Label><RichTextEditor value={form.option_d} onChange={(v) => setForm({ ...form, option_d: v })} placeholder="অপশন ঘ" minHeight="120px" /></div>
                        </div>
                        <div>
                          <Label>সঠিক উত্তর</Label>
                          <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.correct_answer} onChange={(e) => setForm({ ...form, correct_answer: e.target.value })}>
                            <option value="">নির্বাচন করুন</option>
                            <option value="ক">ক</option><option value="খ">খ</option><option value="গ">গ</option><option value="ঘ">ঘ</option>
                          </select>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Grouped MCQ - Dynamic Question List */}
                        <div className="space-y-4">
                          <Label className="text-base font-semibold" style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>
                            প্রশ্নসমূহ ({groupedQuestions.length}টি)
                          </Label>
                          {groupedQuestions.map((gq, gi) => (
                            <div key={gi} className="border border-border rounded-lg p-3 space-y-2 relative bg-background">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold" style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>
                                  প্রশ্ন {gi + 1}
                                </span>
                                {groupedQuestions.length > 1 && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setGroupedQuestions(prev => prev.filter((_, i) => i !== gi))}>
                                    <X className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                )}
                              </div>
                              <RichTextEditor
                                value={gq.question}
                                onChange={(v) => setGroupedQuestions(prev => prev.map((q, i) => i === gi ? { ...q, question: v } : q))}
                                placeholder={`প্রশ্ন ${gi + 1} লিখুন...`}
                                minHeight="100px"
                              />
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
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full border-dashed border-emerald-400 text-emerald-600 hover:bg-emerald-50"
                            onClick={() => setGroupedQuestions(prev => [...prev, { question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" }])}
                            style={{ fontFamily: "'SolaimanLipi', sans-serif" }}
                          >
                            <Plus className="h-4 w-4 mr-1" /> আরও প্রশ্ন যোগ করুন
                          </Button>
                        </div>
                      </>
                    )}

                    <div>
                      <Label>ব্যাখ্যা (ঐচ্ছিক)</Label>
                      <RichTextEditor value={form.explanation} onChange={(v) => setForm({ ...form, explanation: v })} placeholder="ব্যাখ্যা লিখুন..." minHeight="120px" />
                    </div>
                  </>
                )}

                {/* === SHORT Question Form === */}
                {form.type === "short" && (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full" style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>
                        সংক্ষিপ্ত প্রশ্ন — ২ মার্ক
                      </span>
                    </div>
                    <div>
                      <Label style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>প্রশ্ন</Label>
                      <RichTextEditor value={form.question} onChange={(v) => setForm({ ...form, question: v })} placeholder="সংক্ষিপ্ত প্রশ্নটি এখানে লিখুন..." minHeight="140px" />
                    </div>
                    <div>
                      <Label style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>উত্তর (ঐচ্ছিক)</Label>
                      <RichTextEditor value={form.correct_answer} onChange={(v) => setForm({ ...form, correct_answer: v })} placeholder="নমুনা উত্তর লিখুন..." minHeight="120px" />
                    </div>
                    <div>
                      <Label style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>ব্যাখ্যা (ঐচ্ছিক)</Label>
                      <RichTextEditor value={form.explanation} onChange={(v) => setForm({ ...form, explanation: v })} placeholder="ব্যাখ্যা লিখুন..." minHeight="100px" />
                    </div>
                  </>
                )}

                {/* === DESCRIPTIVE Question Form === */}
                {form.type === "descriptive" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full" style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>
                        বর্ণনামূলক প্রশ্ন — ১০ মার্ক (ক = ৩, খ = ৭)
                      </span>
                    </div>
                    <div>
                      <Label style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>ক) প্রশ্ন (নম্বর: ৩)</Label>
                      <RichTextEditor value={form.desc_q_ka} onChange={(v) => setForm({ ...form, desc_q_ka: v })} placeholder="প্রশ্ন ক লিখুন..." minHeight="140px" />
                    </div>
                    <div>
                      <Label style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>ক) উত্তর (ঐচ্ছিক)</Label>
                      <RichTextEditor value={form.desc_ans_ka} onChange={(v) => setForm({ ...form, desc_ans_ka: v })} placeholder="উত্তর ক লিখুন..." minHeight="100px" />
                    </div>
                    <div>
                      <Label style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>খ) প্রশ্ন (নম্বর: ৭)</Label>
                      <RichTextEditor value={form.desc_q_kha} onChange={(v) => setForm({ ...form, desc_q_kha: v })} placeholder="প্রশ্ন খ লিখুন..." minHeight="140px" />
                    </div>
                    <div>
                      <Label style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>খ) উত্তর (ঐচ্ছিক)</Label>
                      <RichTextEditor value={form.desc_ans_kha} onChange={(v) => setForm({ ...form, desc_ans_kha: v })} placeholder="উত্তর খ লিখুন..." minHeight="100px" />
                    </div>
                    <div>
                      <Label style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>ব্যাখ্যা (ঐচ্ছিক)</Label>
                      <RichTextEditor value={form.explanation} onChange={(v) => setForm({ ...form, explanation: v })} placeholder="ব্যাখ্যা লিখুন..." minHeight="100px" />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* References & Metadata Section */}
            <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
              <p className="text-sm font-semibold text-muted-foreground">রেফারেন্স এবং মেটাডাটা</p>
              <ReferenceInput
                label="বোর্ড রেফারেন্স"
                nameLabel="বোর্ড"
                namePlaceholder="যেমন: কু. বো."
                nameKey="board"
                value={form.board_references}
                onChange={(refs) => setForm({ ...form, board_references: refs as any })}
              />
              <ReferenceInput
                label="বিশ্ববিদ্যালয় রেফারেন্স"
                nameLabel="বিশ্ববিদ্যালয়"
                namePlaceholder="যেমন: ঢাকা বিশ্ববিদ্যালয়"
                nameKey="name"
                value={form.university_references}
                onChange={(refs) => setForm({ ...form, university_references: refs as any })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>বাতিল</Button>
            <Button onClick={handleSave} className={(form.type === "short" || form.type === "descriptive" || form.type === "cq" || (form.type === "mcq" && isGroupedMcq)) ? "bg-emerald-600 hover:bg-emerald-700" : ""}>
              {form.type === "mcq" && isGroupedMcq
                ? (editItem ? "গ্রুপ আপডেট" : `${groupedQuestions.length}টি MCQ তৈরি করুন`)
                : (editItem ? "আপডেট" : "তৈরি করুন")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
