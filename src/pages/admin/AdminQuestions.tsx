import { questionHasCorruptedText, corruptedQuestionFields, questionBodyHasCorruptedText, questionHasOnlyCorruptedAnswers } from "@/lib/questionEncoding";
import { PATTERN_CHAPTER_PREFIX, patternChapterName, ensurePatternChapter } from "@/lib/languagePatternChapters";
import LanguageQuestionForm from "@/components/LanguageQuestionForm";
import { ALL_TYPES, BASE_TYPES, allowedQuestionTypes, isLanguageType, questionTypeLabel, suggestedLanguageTopics, languageRules } from "@/lib/languageQuestionTypes";
import { questionHasNoAnswer, questionHasNoExplanation, questionHasIncompleteCqAnswers } from "@/lib/questionAnswers";
import { normalizeAnswerKey } from "@/lib/answerKey";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, X, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MathInput from "@/components/MathInput";
import RichTextEditor from "@/components/RichTextEditor";
import LatexRenderer, { getLatexIssueReasons } from "@/components/LatexRenderer";
import ReferenceInput from "@/components/ReferenceInput";
import ReferenceBadges from "@/components/ReferenceBadges";
import ExplanationToggle from "@/components/ExplanationToggle";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { sortClasses, sortSubjects, sortChapters } from "@/lib/classOrder";
import AdminQuestionDuplicates from "@/pages/admin/AdminQuestionDuplicates";
import BulkExplanationDialog from "@/components/admin/BulkExplanationDialog";

const typeOptions = ALL_TYPES;
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 300, 500];
const PAGE_SIZE_STORAGE_KEY = "admin_questions_page_size_v2";
const SPECIAL_FILTER_OPTIONS = [
  { id: "corrupted_question", label: "বিকৃত প্রশ্ন/অপশন — ডিলিটের জন্য" },
  { id: "corrupted_answers_only", label: "প্রশ্ন ঠিক, উত্তর/ব্যাখ্যা বিকৃত — রাখুন" },
  { id: "corrupted_text", label: "বিকৃত লেখা (Encoding সমস্যা)" },
  { id: "incomplete_cq_answers", label: "\u0985\u09b8\u09ae\u09cd\u09aa\u09c2\u09b0\u09cd\u09a3 \u0989\u09a4\u09cd\u09a4\u09b0 \u09b8\u09c3\u099c\u09a8\u09b6\u09c0\u09b2" },
  { id: "no_answer", label: "উত্তর ছাড়া প্রশ্ন" },
  { id: "no_explanation", label: "ব্যাখ্যা ছাড়া MCQ ও সংক্ষিপ্ত প্রশ্ন" },
  { id: "board", label: "রিপিটেড বোর্ড প্রশ্ন" },
  { id: "math", label: "গাণিতিক" },
  { id: "theoretical", label: "তত্ত্বীয়" },
  { id: "diagram", label: "চিত্রযুক্ত প্রশ্ন" },
  { id: "multi_completion", label: "বহুপদী সমাপ্তিসূচক" },
  { id: "assertion", label: "অভিন্ন তথ্যভিত্তিক" },
  { id: "latex_error", label: "LaTeX সমস্যাযুক্ত" },
] as const;

const questionLatexIssueDetails = (question: any) => {
  const creative = question.creative_data || {};
  const fields: Array<[string, unknown]> = [
    ["প্রশ্ন", question.question], ["অপশন ক", question.option_a], ["অপশন খ", question.option_b],
    ["অপশন গ", question.option_c], ["অপশন ঘ", question.option_d], ["উদ্দীপক", question.stimulus_text],
    ["উত্তর", question.correct_answer], ["ব্যাখ্যা", question.explanation], ["উদ্দীপক", creative.stem],
    ["প্রশ্ন ক", creative.q_ka], ["প্রশ্ন খ", creative.q_kha], ["প্রশ্ন গ", creative.q_ga], ["প্রশ্ন ঘ", creative.q_gha],
    ["উত্তর ক", creative.ans_ka], ["উত্তর খ", creative.ans_kha], ["উত্তর গ", creative.ans_ga], ["উত্তর ঘ", creative.ans_gha],
    ["প্রশ্ন ক", creative.desc_q_ka], ["প্রশ্ন খ", creative.desc_q_kha], ["উত্তর ক", creative.desc_ans_ka], ["উত্তর খ", creative.desc_ans_kha],
  ];
  return fields.flatMap(([field, value]) => typeof value === "string"
    ? getLatexIssueReasons(value).map((reason) => ({ field, reason }))
    : []);
};

const questionHasLatexIssues = (question: any) => questionLatexIssueDetails(question).length > 0;

const specialFilterMatches = (question: any, filter: string) => {
  if (filter === "corrupted_question") return questionBodyHasCorruptedText(question);
  if (filter === "corrupted_answers_only") return questionHasOnlyCorruptedAnswers(question);
  if (filter === "corrupted_text") return questionHasCorruptedText(question);
  if (filter === "incomplete_cq_answers") return questionHasIncompleteCqAnswers(question);
  const text = `${question.question || ""} ${question.option_a || ""} ${question.option_b || ""} ${question.option_c || ""} ${question.option_d || ""} ${question.stimulus_text || ""}`;
  const mathPattern = /\$.*?\$|\\frac|\\sqrt|\\sum|\\int|\\\[|\\\]|\\\(|\\\)|\\times|\\div|\\pm|\\leq|\\geq|\\neq|\\alpha|\\beta|\\theta|\\pi/i;
  if (filter === "board") {
    const refs = Array.isArray(question.board_references) ? question.board_references : [];
    const boards = new Set(refs.map((ref: any) => String(ref?.board || "").replace(/[০-৯0-9.'’‘"`,\-–—()\s]|বোর্ড|বো/g, "").toLowerCase()).filter(Boolean));
    return boards.size >= 2;
  }
  if (filter === "math") return mathPattern.test(text);
  if (filter === "theoretical") return !mathPattern.test(text);
  if (filter === "diagram") return /<img\s/i.test(text) || /cloudinary\.com|res\.cloudinary/i.test(text);
  if (filter === "multi_completion") {
    if (question.type !== "mcq") return false;
    const stripped = String(question.question || "").replace(/<[^>]*>/g, "");
    return /(?:^|[^a-zA-Z])i[.\s].*(?:^|[^a-zA-Z])ii[.\s].*(?:^|[^a-zA-Z])iii[.\s]/s.test(stripped)
      || /(?:^|[^a-zA-Z])i\).*(?:^|[^a-zA-Z])ii\).*(?:^|[^a-zA-Z])iii\)/s.test(stripped);
  }
  if (filter === "assertion") return Array.isArray(question.board_references) && question.board_references.length > 0;
  if (filter === "no_answer") return questionHasNoAnswer(question);
  if (filter === "no_explanation") return questionHasNoExplanation(question);
  if (filter === "latex_error") return questionHasLatexIssues(question);
  return true;
};

export default function AdminQuestions() {
  const queryClient = useQueryClient();
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [duplicateModeOpen, setDuplicateModeOpen] = useState(false);
  const [fullPageCreate, setFullPageCreate] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterChapterId, setFilterChapterId] = useState("");
  const [filterTopicId, setFilterTopicId] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSpecial, setFilterSpecial] = useState("");
  const [expandedAnswers, setExpandedAnswers] = useState<Set<number>>(new Set());
  const [filterChapters, setFilterChapters] = useState<any[]>([]);
  const [filterTopics, setFilterTopics] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window === "undefined") return 20;
    const stored = Number(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
    return PAGE_SIZE_OPTIONS.includes(stored) ? stored : 20;
  });
  useEffect(() => {
    try { window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize)); } catch {}
  }, [pageSize]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
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
  const selectedClassName = allClasses.find(c => String(c.id) === form.class_id)?.name || "";
  const selectedChapterName = patternChapterName(form.chapter_id,chapters);
  const formTypes = allowedQuestionTypes(selectedClassName, selectedSubjectName, selectedChapterName);
  const filterTypes = filterSubjectId ? allowedQuestionTypes(allClasses.find(c=>String(c.id)===filterClassId)?.name || "", allSubjects.find(s=>String(s.id)===filterSubjectId)?.name || "", filterChapters.find(c=>String(c.id)===filterChapterId)?.name || "") : ALL_TYPES;
  const suggestedChapters: string[] = [];
  const countTypes = filterSubjectId ? filterTypes : BASE_TYPES;
  const keepLegacyType = Boolean(editItem && form.class_id === String(editItem.class_id) && form.subject_id === String(editItem.subject_id) && form.chapter_id === String(editItem.chapter_id));
  const [languageMarks, setLanguageMarks] = useState(0);
  const [newTopicName, setNewTopicName] = useState("");
  useEffect(() => {
    if (!keepLegacyType && !formTypes.includes(form.type)) setForm(f=>({...f,type:formTypes[0] || "mcq"}));
  }, [form.class_id, form.subject_id, form.chapter_id, selectedClassName, selectedSubjectName, selectedChapterName, editItem]);
  useEffect(() => { if (filterType && !filterTypes.includes(filterType)) setFilterType(""); }, [filterClassId,filterSubjectId,filterChapterId]);
  useEffect(() => { setLanguageMarks(Number(editItem?.creative_data?.marks) || 0); setNewTopicName(""); }, [editItem, fullPageCreate]);
  useEffect(() => { setNewTopicName(""); }, [form.chapter_id]);
  const languageEditor = isLanguageType(form.type) ? <LanguageQuestionForm type={form.type} question={form.question} answer={form.correct_answer} stimulus={stimulusText} marks={languageMarks} onChange={(field,value)=> {
    if(field === "marks") setLanguageMarks(Number(value));
    else if(field === "stimulus") setStimulusText(String(value));
    else setForm(f=>({...f,[field]:String(value)}));
  }} /> : null;
  const suggestedTopics = suggestedLanguageTopics(selectedClassName,selectedSubjectName,selectedChapterName);
  const languageTopicInput = form.chapter_id && languageRules(selectedClassName,selectedSubjectName) ? <div><Label>নতুন টপিক (ঐচ্ছিক)</Label><Input list="language-topic-suggestions" value={newTopicName} onChange={e=>{setNewTopicName(e.target.value);setForm(f=>({...f,topic_id:""}));}} placeholder="টপিক লিখুন বা তালিকা থেকে নিন" /><datalist id="language-topic-suggestions">{suggestedTopics.map(t=><option key={t} value={t} />)}</datalist></div> : null;
  const isMathSubject = /^(গণিত|উচ্চতর গণিত|math|higher math)/i.test(selectedSubjectName.trim());

  const classes = filterClasses(allClasses);
  const filterSubjectsList = filterSubjectId ? [] : allSubjects.filter(s => filterClassId ? String(s.class_id) === filterClassId : true);

  // Load chapters for filter
  useEffect(() => {
    if (!filterSubjectId) { setFilterChapters([]); setFilterTopics([]); return; }
    supabase.from("chapters").select("id, name").eq("subject_id", Number(filterSubjectId)).order("name")
      .then(({ data }) => setFilterChapters(sortChapters(data || [])));
  }, [filterSubjectId]);

  // Load topics for filter
  useEffect(() => {
    if (!filterChapterId) { setFilterTopics([]); setFilterTopicId(""); return; }
    supabase.from("topics").select("id, name").eq("chapter_id", Number(filterChapterId)).order("name")
      .then(({ data }) => setFilterTopics(data || []));
  }, [filterChapterId]);




  // Reset page & selection when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [searchTerm, filterClassId, filterSubjectId, filterChapterId, filterTopicId, filterType, filterSpecial, pageSize]);

  // ---- React Query: paginated items with server-side filtering + caching ----
  const listQueryKey = [
    "admin-questions",
    { searchTerm: searchTerm.trim(), filterClassId, filterSubjectId, filterChapterId, filterTopicId, filterType, currentPage, pageSize, hasFullAccess },
  ] as const;

  const specialPoolQuery = useQuery({
    queryKey: ["admin-questions-special-pool", { searchTerm: searchTerm.trim(), filterClassId, filterSubjectId, filterChapterId, filterTopicId, filterSpecial, hasFullAccess }],
    enabled: !permLoading && !!filterSpecial,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const collected: any[] = [];
      const batchSize = 1000;
      let offset = 0;
      let exactCount: number | null = null;
      do {
        let query = supabase.from("questions")
          .select("*, classes(name), subjects(name), chapters(name), teachers(full_name)", { count: offset === 0 ? "exact" : undefined })
          .order("created_at", { ascending: false });
        if (filterSpecial === "incomplete_cq_answers") query = query.eq("type", "cq");
        if (filterClassId) query = query.eq("class_id", Number(filterClassId));
        if (filterSubjectId) query = query.eq("subject_id", Number(filterSubjectId));
        if (filterChapterId) query = query.eq("chapter_id", Number(filterChapterId));
        if (filterTopicId) query = query.eq("topic_id", Number(filterTopicId));
        if (searchTerm.trim()) query = query.ilike("question", `%${searchTerm.trim()}%`);
        const { data, count, error } = await query.range(offset, offset + batchSize - 1);
        if (error) throw error;
        const batch = data || [];
        collected.push(...batch);
        if (offset === 0) exactCount = count ?? batch.length;
        offset += batch.length;
        if (batch.length < batchSize) break;
      } while (exactCount === null || offset < exactCount);
      const permitted = hasFullAccess ? collected : collected.filter((q: any) => isSubjectAllowed(q.class_id, q.subject_id));
      return permitted.filter((q: any) => specialFilterMatches(q, filterSpecial));
    },
  });

  const listQuery = useQuery({
    queryKey: listQueryKey,
    enabled: !permLoading && !filterSpecial,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      let query = supabase.from("questions")
        .select("*, classes(name), subjects(name), chapters(name), teachers(full_name)", { count: "exact" })
        .order("created_at", { ascending: false });
      if (filterClassId) query = query.eq("class_id", Number(filterClassId));
      if (filterSubjectId) query = query.eq("subject_id", Number(filterSubjectId));
      if (filterChapterId) query = query.eq("chapter_id", Number(filterChapterId));
      if (filterTopicId) query = query.eq("topic_id", Number(filterTopicId));
      if (filterType) query = query.eq("type", filterType);
      if (searchTerm.trim()) query = query.ilike("question", `%${searchTerm.trim()}%`);
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
      const { data, count, error } = await query;
      if (error) throw error;
      const rows = data || [];
      const visible = hasFullAccess ? rows : rows.filter((q: any) => isSubjectAllowed(q.class_id, q.subject_id));
      return { rows: visible, total: count || 0 };
    },
  });

  const specialTypeRows = filterSpecial
    ? (specialPoolQuery.data || []).filter((q: any) => !filterType || q.type === filterType)
    : [];
  const items = filterSpecial ? specialTypeRows : (listQuery.data?.rows ?? []);
  const totalCount = filterSpecial ? specialTypeRows.length : (listQuery.data?.total ?? 0);
  const paginatedItems = filterSpecial
    ? items.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : items;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const typeCountsQuery = useQuery({
    queryKey: ["admin-questions-type-counts", countTypes.join(","), { searchTerm: searchTerm.trim(), filterClassId, filterSubjectId, filterChapterId, filterTopicId }],
    enabled: !permLoading && !filterSpecial,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const types = countTypes;
      const results = await Promise.all(types.map(async (t) => {
        let q = supabase.from("questions").select("id", { count: "exact", head: true }).eq("type", t);
        if (filterClassId) q = q.eq("class_id", Number(filterClassId));
        if (filterSubjectId) q = q.eq("subject_id", Number(filterSubjectId));
        if (filterChapterId) q = q.eq("chapter_id", Number(filterChapterId));
        if (filterTopicId) q = q.eq("topic_id", Number(filterTopicId));
        if (searchTerm.trim()) q = q.ilike("question", `%${searchTerm.trim()}%`);
        const { count } = await q;
        return [t, count || 0] as const;
      }));
      return Object.fromEntries(results) as Record<string, number>;
    },
  });
  const specialTypeCounts = filterSpecial ? (specialPoolQuery.data || []).reduce((counts: Record<string, number>, q: any) => {
    counts[q.type] = (counts[q.type] || 0) + 1;
    return counts;
  }, { mcq: 0, short: 0, cq: 0, descriptive: 0 }) : null;
  const typeCounts = specialTypeCounts ?? typeCountsQuery.data ?? { mcq: 0, short: 0, cq: 0, descriptive: 0 };
  const questionsLoading = filterSpecial ? specialPoolQuery.isFetching : listQuery.isFetching;

  const invalidateQuestions = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-questions-special-pool"] });
    queryClient.invalidateQueries({ queryKey: ["admin-questions"] });
    queryClient.invalidateQueries({ queryKey: ["admin-questions-type-counts"] });
  };
  const fetchItems = () => invalidateQuestions();

  useEffect(() => {
    supabase.from("classes").select("id, name").order("name").then(({ data }) => setAllClasses(sortClasses(data || [])));
    supabase.from("subjects").select("id, name, class_id").order("name").then(({ data }) => setAllSubjects(sortSubjects(data || [])));
    supabase.from("question_categories").select("id, name").order("name").then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => {
    if (!form.class_id) return;
    const filtered = filterSubjects(allSubjects.filter(s => String(s.class_id) === form.class_id) as any);
    setSubjects(filtered);
  }, [form.class_id, allSubjects, permLoading]);

  useEffect(() => {
    if (!form.subject_id) return;
    supabase.from("chapters").select("id, name").eq("subject_id", Number(form.subject_id)).order("name")
      .then(({ data }) => setChapters(sortChapters(data || [])));
  }, [form.subject_id]);

  // Load topics when chapter changes
  useEffect(() => {
    if (!form.chapter_id || form.chapter_id.startsWith(PATTERN_CHAPTER_PREFIX)) { setTopics([]); setLoadingTopics(false); return; }
    setLoadingTopics(true);
    supabase.from("topics").select("id, name").eq("chapter_id", Number(form.chapter_id)).order("name")
      .then(({ data }) => { setTopics(data || []); setLoadingTopics(false); });
  }, [form.chapter_id]);

  const openCreate = () => {
    setEditItem(null);
    setIsGroupedMcq(false);
    setStimulusText("");
    setGroupedQuestions([{ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" }]);
    setForm((prev) => ({ class_id: prev.class_id || "", subject_id: prev.subject_id || "", chapter_id: prev.chapter_id || "", topic_id: prev.topic_id || "", category_id: prev.category_id || "", type: prev.type || "mcq", question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", explanation: "", cq_stem: "", cq_q_ka: "", cq_q_kha: "", cq_q_ga: "", cq_q_gha: "", cq_ans_ka: "", cq_ans_kha: "", cq_ans_ga: "", cq_ans_gha: "", desc_q_ka: "", desc_q_kha: "", desc_ans_ka: "", desc_ans_kha: "", board_references: [], university_references: [] }));
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
              option_c: q.option_c || "", option_d: q.option_d || "", correct_answer: (q.type === "mcq" ? normalizeAnswerKey(q.correct_answer) : q.correct_answer) || "",
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
      option_c: item.option_c || "", option_d: item.option_d || "", correct_answer: (item.type === "mcq" ? normalizeAnswerKey(item.correct_answer) : item.correct_answer) || "",
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
    const resolveChapter = async () => {
      try {
        const id=await ensurePatternChapter(form.chapter_id,Number(form.subject_id));
        if(form.chapter_id.startsWith(PATTERN_CHAPTER_PREFIX)) {
          setChapters(cs=>cs.some(c=>c.id===id)?cs:[...cs,{id,name:selectedChapterName}]);
          setForm(f=>({...f,chapter_id:String(id)}));
        }
        return id;
      } catch(error:any) {toast.error(error.message);return null;}
    };
    const resolveTopic = async (chapterId:number) => {
      if(!newTopicName.trim()) return form.topic_id ? Number(form.topic_id) : null;
      const existing = topics.find(t=>t.name.trim().toLowerCase()===newTopicName.trim().toLowerCase());
      if(existing) return existing.id;
      const {data,error}=await supabase.from("topics").insert({name:newTopicName.trim(),chapter_id:chapterId}).select("id,name").single();
      if(error || !data) throw error || new Error("Topic could not be created");
      setTopics(ts=>[...ts,data]);setForm(f=>({...f,topic_id:String(data.id)}));setNewTopicName("");return data.id;
    };
    const safeResolveTopic = async (chapterId:number) => {
      try {return {id:await resolveTopic(chapterId)};} catch(error:any) {toast.error(error.message);return null;}
    };
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

      const resolvedChapterId = await resolveChapter();
      if(!resolvedChapterId) return;
      const resolvedTopic = await safeResolveTopic(resolvedChapterId);
      if(!resolvedTopic) return;
      const { data: { user } } = await supabase.auth.getUser();
      const groupId = editItem?.stimulus_group_id || crypto.randomUUID();

      // If editing, delete old group questions first
      if (editItem?.stimulus_group_id) {
        await supabase.from("questions").delete().eq("stimulus_group_id", editItem.stimulus_group_id);
      }

      const payloads = validQs.map((gq) => ({
        class_id: Number(form.class_id),
        subject_id: Number(form.subject_id),
        chapter_id: resolvedChapterId,
        topic_id: resolvedTopic.id,
        category_id: form.category_id ? Number(form.category_id) : null,
        type: "mcq",
        question: gq.question,
        option_a: gq.option_a || null,
        option_b: gq.option_b || null,
        option_c: gq.option_c || null,
        option_d: gq.option_d || null,
        correct_answer: normalizeAnswerKey(gq.correct_answer),
        explanation: form.explanation || null,
        stimulus_group_id: groupId,
        stimulus_text: stimulusText,
        board_references: form.board_references.length > 0 ? form.board_references : [],
        university_references: form.university_references.length > 0 ? form.university_references : [],
        teacher_id: user?.id,
      }));

      const { error } = await supabase.from("questions").insert(payloads as any);
      if (error) { toast.error("তৈরি ব্যর্থ: " + error.message); return; }
      toast.success(editItem ? "গ্রুপ আপডেট হয়েছে" : `${validQs.length}টি MCQ তৈরি হয়েছে`);
      if (editItem) {
        setFullPageCreate(false);
      } else {
        // Keep context, clear question content for next entry
        setStimulusText("");
        setGroupedQuestions([{ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" }]);
        setForm((f) => ({ ...f, question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", explanation: "", board_references: [], university_references: [] }));
      }
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

    const resolvedChapterId=await resolveChapter();
    if(!resolvedChapterId) return;
    const resolvedTopic = await safeResolveTopic(resolvedChapterId);
    if(!resolvedTopic) return;
    const payload: any = {
      class_id: Number(form.class_id), subject_id: Number(form.subject_id), chapter_id: resolvedChapterId,
      topic_id: resolvedTopic.id,
      type: form.type,
      question: questionText,
      option_a: form.option_a || null, option_b: form.option_b || null,
      option_c: form.option_c || null, option_d: form.option_d || null, correct_answer: form.type === "mcq" ? normalizeAnswerKey(form.correct_answer) : form.correct_answer || null,
      explanation: form.explanation || null,
      board_references: form.board_references.length > 0 ? form.board_references : [],
      university_references: form.university_references.length > 0 ? form.university_references : [],
      // For single MCQ with optional stimulus
      stimulus_text: (form.type === "mcq" || isLanguageType(form.type)) && stimulusText ? stimulusText : null,
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

    if (isLanguageType(form.type)) payload.creative_data = { marks: languageMarks };
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
      // Stay on create page; keep class/subject/chapter/topic/category/type, clear only question content
      setStimulusText("");
      setGroupedQuestions([{ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" }]);
      setForm((f) => ({
        ...f,
        question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", explanation: "",
        cq_stem: "", cq_q_ka: "", cq_q_kha: "", cq_q_ga: "", cq_q_gha: "",
        cq_ans_ka: "", cq_ans_kha: "", cq_ans_ga: "", cq_ans_gha: "",
        desc_q_ka: "", desc_q_kha: "", desc_ans_ka: "", desc_ans_kha: "",
        board_references: [], university_references: [],
      }));
    }
    fetchItems();
  };

  const handleDelete = (id: number) => setSingleDeleteId(id);

  const confirmSingleDelete = async () => {
    if (singleDeleteId == null) return;
    setIsDeleting(true);
    const { error } = await supabase.from("questions").delete().eq("id", singleDeleteId);
    setIsDeleting(false);
    if (error) { toast.error("ডিলিট ব্যর্থ"); return; }
    toast.success("মুছে ফেলা হয়েছে");
    setSingleDeleteId(null);
    setSelectedIds(prev => { const n = new Set(prev); n.delete(singleDeleteId); return n; });
    invalidateQuestions();
  };

  const confirmBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsDeleting(true);
    const { error } = await supabase.from("questions").delete().in("id", ids);
    setIsDeleting(false);
    if (error) { toast.error("বাল্ক ডিলিট ব্যর্থ: " + error.message); return; }
    toast.success(`${ids.length.toLocaleString("bn-BD")}টি প্রশ্ন মুছে ফেলা হয়েছে`);
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    invalidateQuestions();
  };

  const pageIds = paginatedItems.map((i: any) => i.id as number);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
  const someOnPageSelected = pageIds.some(id => selectedIds.has(id));
  const toggleSelectAllOnPage = (checked: boolean) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (checked) pageIds.forEach(id => n.add(id));
      else pageIds.forEach(id => n.delete(id));
      return n;
    });
  };
  const toggleRow = (id: number, checked: boolean) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (checked) n.add(id); else n.delete(id);
      return n;
    });
  };

  const toggleAnswer = (id: number) => {
    setExpandedAnswers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const typeLabel = questionTypeLabel;

  const answerLetter = (answer: string | null | undefined) => ({
    a: "ক", b: "খ", c: "গ", d: "ঘ",
  }[normalizeAnswerKey(answer || "")] || answer || "");

  const richBlock = (text: string | null | undefined, className = "") => text ? (
    <div className={className}><LatexRenderer text={text} /></div>
  ) : null;

  const renderQuestionBody = (item: any) => {
    const creative = item.creative_data || {};
    if (item.type === "cq") {
      return (
        <div className="space-y-3">
          {richBlock(creative.stem || item.question, "rounded-lg bg-muted/40 p-4")}
          <div className="space-y-2">
            {creative.q_ka && <div className="flex gap-2"><span className="font-bold shrink-0">ক)</span>{richBlock(creative.q_ka)}</div>}
            {creative.q_kha && <div className="flex gap-2"><span className="font-bold shrink-0">খ)</span>{richBlock(creative.q_kha)}</div>}
            {creative.q_ga && <div className="flex gap-2"><span className="font-bold shrink-0">গ)</span>{richBlock(creative.q_ga)}</div>}
            {creative.q_gha && <div className="flex gap-2"><span className="font-bold shrink-0">ঘ)</span>{richBlock(creative.q_gha)}</div>}
          </div>
        </div>
      );
    }
    if (item.type === "descriptive") {
      return (
        <div className="space-y-2">
          {creative.desc_q_ka && <div className="flex gap-2"><span className="font-bold shrink-0">ক)</span>{richBlock(creative.desc_q_ka)}</div>}
          {creative.desc_q_kha && <div className="flex gap-2"><span className="font-bold shrink-0">খ)</span>{richBlock(creative.desc_q_kha)}</div>}
          {!creative.desc_q_ka && !creative.desc_q_kha && richBlock(item.question)}
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {item.stimulus_text && richBlock(item.stimulus_text, "rounded-lg bg-muted/40 p-4")}
        {richBlock(item.question, "text-base font-medium")}
        {item.type === "mcq" && (
          <div className="grid gap-2 sm:grid-cols-2">
            {[["ক", item.option_a], ["খ", item.option_b], ["গ", item.option_c], ["ঘ", item.option_d]].map(([label, value]) => value ? (
              <div key={label} className="flex gap-2 rounded-md border bg-background px-3 py-2">
                <span className="font-bold text-primary shrink-0">{label}.</span>
                {richBlock(value)}
              </div>
            ) : null)}
          </div>
        )}
      </div>
    );
  };

  const renderAnswerBody = (item: any) => {
    const creative = item.creative_data || {};
    const answers = item.type === "cq"
      ? [["ক", creative.ans_ka], ["খ", creative.ans_kha], ["গ", creative.ans_ga], ["ঘ", creative.ans_gha]]
      : item.type === "descriptive"
      ? [["ক", creative.desc_ans_ka], ["খ", creative.desc_ans_kha]]
      : [];
    const hasStructuredAnswer = answers.some(([, value]) => !!value);
    return (
      <div className="space-y-3">
        {item.type === "mcq" && (
          item.correct_answer
            ? <p className="font-semibold text-emerald-800">সঠিক উত্তর: {answerLetter(item.correct_answer)}</p>
            : <p className="text-muted-foreground">সঠিক উত্তর যোগ করা হয়নি।</p>
        )}
        {(item.type === "short" || isLanguageType(item.type)) && (item.correct_answer
          ? richBlock(item.correct_answer)
          : <p className="text-muted-foreground">উত্তর যোগ করা হয়নি।</p>)}
        {(item.type === "cq" || item.type === "descriptive") && (hasStructuredAnswer
          ? <div className="space-y-2">{answers.map(([label, value]) => value ? <div key={label} className="flex gap-2"><span className="font-bold shrink-0">{label})</span>{richBlock(value)}</div> : null)}</div>
          : <p className="text-muted-foreground">নমুনা উত্তর যোগ করা হয়নি।</p>)}
        {item.explanation && <div className="border-t border-emerald-200 pt-3"><p className="mb-1 text-xs font-semibold text-emerald-800">ব্যাখ্যা</p>{richBlock(item.explanation)}</div>}
      </div>
    );
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
                    {suggestedChapters.map(name=><option key={name} value={PATTERN_CHAPTER_PREFIX+name}>{name}</option>)}
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
                    {[...new Set([...formTypes, ...(keepLegacyType ? [form.type] : [])])].map((t) => <option key={t} value={t}>{questionTypeLabel(t)}</option>)}
                  </select>
                </div>
              </div>
              {form.chapter_id.startsWith(PATTERN_CHAPTER_PREFIX) && <p className="text-sm text-muted-foreground">নতুন বিভাগটি প্রশ্ন সেভ করার সময় তৈরি হবে। Lesson-এর নাম নতুন টপিক হিসেবে লিখতে পারেন।</p>}
              {languageTopicInput}
              {languageEditor}
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
                              <option value="a">ক</option><option value="b">খ</option><option value="c">গ</option><option value="d">ঘ</option>
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
                                  <option value="a">ক</option><option value="b">খ</option><option value="c">গ</option><option value="d">ঘ</option>
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
        <div className="flex items-center gap-2 flex-wrap">
          <BulkExplanationDialog isSubjectAllowed={isSubjectAllowed} onSaved={invalidateQuestions} />
          <BulkExplanationDialog answerMode isSubjectAllowed={isSubjectAllowed} onSaved={invalidateQuestions} />
          <Button variant="outline" onClick={() => setDuplicateModeOpen(true)} className="gap-2 border-amber-300 text-amber-800 hover:bg-amber-50">
            <Trash2 className="w-4 h-4" /> Duplicate Cleanup
          </Button>
          <Button variant="outline" onClick={() => window.location.assign("/admin/questions/bulk")} className="gap-2">
            <Plus className="w-4 h-4" /> বাল্ক আপলোড
          </Button>
          <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> নতুন প্রশ্ন</Button>
        </div>
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
            {filterTypes.map((t) => <SelectItem key={t} value={t}>{questionTypeLabel(t)}</SelectItem>)}
          </SelectContent>
        </Select>
        {(searchTerm || filterClassId || filterSubjectId || filterChapterId || filterTopicId || filterType || filterSpecial) && (
          <Button
            variant="ghost"
            className="gap-2"
            onClick={() => {
              setSearchTerm("");
              setFilterClassId("");
              setFilterSubjectId("");
              setFilterChapterId("");
              setFilterTopicId("");
              setFilterType("");
              setFilterSpecial("");
            }}
          >
            <X className="h-4 w-4" /> ফিল্টার মুছুন
          </Button>
        )}
      </div>

      {/* ProshnoLab special filters */}
      <div className="mb-4">
        <div className="rounded-xl border bg-card p-3">
          <h2 className="mb-3 border-b pb-2 text-sm font-bold text-slate-800">ProshnoLab স্পেশাল ফিল্টার</h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {SPECIAL_FILTER_OPTIONS.map((option) => {
              const active = filterSpecial === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilterSpecial(active ? "" : option.id)}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${active ? "bg-slate-100 font-semibold text-slate-950" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${active ? "border-slate-900 bg-slate-900" : "border-slate-300"}`}>
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />}
                  </span>
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {filterSpecial.startsWith("corrupted_") && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
        <p className="text-sm text-amber-950">প্রশ্ন/উদ্দীপক/অপশন বিকৃত থাকলেই ডিলিটের তালিকায় যাবে। প্রশ্ন ঠিক থাকলে শুধু উত্তর বা ব্যাখ্যার সমস্যার জন্য মুছবে না। নির্বাচিত শ্রেণি, বিষয় ও টাইপের সব পেজ অন্তর্ভুক্ত।</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" disabled={questionsLoading || isDeleting || !specialTypeRows.some(questionBodyHasCorruptedText)} onClick={() => { setSelectedIds(new Set(specialTypeRows.filter(questionBodyHasCorruptedText).map((q: any) => q.id))); setBulkDeleteOpen(true); }}>বিকৃত প্রশ্নগুলো ডিলিট করুন ({specialTypeRows.filter(questionBodyHasCorruptedText).length.toLocaleString("bn-BD")})</Button>
          <Button variant="outline" onClick={() => {setSelectedIds(new Set()); setFilterSpecial("corrupted_answers_only");}}>প্রশ্ন ঠিক — রেখে দিন / দেখুন</Button>
        </div>
      </div>}

      {/* Total + Type-wise breakdown badges */}
      <div className="flex flex-wrap items-center gap-2 mb-4" style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>
        <div
          className="flex items-center gap-2 h-9 px-3 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700"
          title="বর্তমান ফিল্টার অনুযায়ী মোট প্রশ্ন"
        >
          <span className="text-xs font-medium">মোট প্রশ্ন:</span>
          <span className="text-sm font-bold tabular-nums">{totalCount.toLocaleString("bn-BD")}</span>
        </div>
        {countTypes.map(key=>({key,label:questionTypeLabel(key),color:"border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"})).map((t) => {
          const active = filterType === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilterType(active ? "" : t.key)}
              className={`flex items-center gap-2 h-9 px-3 rounded-md border transition-colors ${t.color} ${active ? "ring-2 ring-offset-1 ring-emerald-400" : ""}`}
              title={active ? "ক্লিক করে ফিল্টার সরান" : `${t.label} ফিল্টার করুন`}
            >
              <span className="text-xs font-medium">{t.label}:</span>
              <span className="text-sm font-bold tabular-nums">{(typeCounts[t.key] || 0).toLocaleString("bn-BD")}</span>
            </button>
          );
        })}
      </div>

      {/* Bulk actions + page size */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3" style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                <span className="font-bold text-foreground">{selectedIds.size.toLocaleString("bn-BD")}</span>টি নির্বাচিত
              </span>
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>নির্বাচন সরান</Button>
              <Button variant="destructive" size="sm" className="gap-2" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="w-4 h-4" /> নির্বাচিত ডিলিট
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">প্রতি পেজে:</span>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map(n => <SelectItem key={n} value={String(n)}>{n.toLocaleString("bn-BD")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-lg border bg-muted/20 px-4 py-3">
        <Checkbox
          checked={allOnPageSelected ? true : (someOnPageSelected ? "indeterminate" : false)}
          onCheckedChange={(c) => toggleSelectAllOnPage(!!c)}
          aria-label="এই পেজের সব প্রশ্ন নির্বাচন"
        />
        <span className="text-sm font-medium">এই পেজের সব প্রশ্ন নির্বাচন</span>
        <span className="ml-auto text-xs text-muted-foreground">পূর্ণ প্রশ্ন, অপশন ও উদ্দীপক দেখানো হচ্ছে</span>
      </div>

      <div className="space-y-4">
        {paginatedItems.map((item) => {
          const answerOpen = expandedAnswers.has(item.id);
          const latexIssues = questionLatexIssueDetails(item);
          return (
            <Card key={item.id} className={selectedIds.has(item.id) ? "border-primary ring-1 ring-primary/30" : ""}>
              <CardContent className="p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-start gap-2 border-b pb-3">
                  <Checkbox
                    className="mt-1"
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={(c) => toggleRow(item.id, !!c)}
                    aria-label={`প্রশ্ন ${item.id} নির্বাচন`}
                  />
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">#{item.id}</span>
                  {filterSpecial.startsWith("corrupted_") && <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">বিকৃত লেখা: {corruptedQuestionFields(item).join(", ")}</span>}
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{typeLabel(item.type)}</span>
                  {item.classes?.name && <span className="rounded-full bg-muted px-2.5 py-1 text-xs">{item.classes.name}</span>}
                  {item.subjects?.name && <span className="rounded-full bg-muted px-2.5 py-1 text-xs">{item.subjects.name}</span>}
                  {item.chapters?.name && <span className="rounded-full bg-muted px-2.5 py-1 text-xs">{item.chapters.name}</span>}
                  {latexIssues.length > 0 && (
                    <span className="rounded-full border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700" title="এই প্রশ্নে সংশোধনযোগ্য LaTeX আছে">
                      ⚠ {latexIssues.length.toLocaleString("bn-BD")}টি LaTeX সমস্যা
                    </span>
                  )}
                  <span className="ml-auto pt-1 text-xs text-muted-foreground">{item.teachers?.full_name || "শিক্ষক অজানা"}</span>
                </div>

                {latexIssues.length > 0 && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    <p className="mb-1 font-bold">যেখানে সমস্যা:</p>
                    <ul className="list-disc space-y-0.5 pl-5">
                      {latexIssues.map((issue, index) => <li key={`${issue.field}-${issue.reason}-${index}`}><strong>{issue.field}:</strong> {issue.reason}</li>)}
                    </ul>
                  </div>
                )}

                <div className="text-[15px] leading-7">{renderQuestionBody(item)}</div>

                {answerOpen && (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 text-[15px] leading-7" aria-live="polite">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-800">উত্তর</p>
                    {renderAnswerBody(item)}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => toggleAnswer(item.id)}>
                    {answerOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {answerOpen ? "উত্তর লুকান" : "উত্তর দেখুন"}
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => openEdit(item)}>
                    <Pencil className="h-4 w-4" /> সম্পাদনা
                  </Button>
                  <Button variant="ghost" size="sm" className="ml-auto gap-2 text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="h-4 w-4" /> ডিলিট
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {paginatedItems.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            {questionsLoading ? "লোড হচ্ছে..." : "এই ফিল্টারে কোনো প্রশ্ন পাওয়া যায়নি"}
          </CardContent></Card>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            মোট {totalCount}টি প্রশ্নের মধ্যে {(safeCurrentPage - 1) * pageSize + 1}–{Math.min(safeCurrentPage * pageSize, totalCount)} দেখানো হচ্ছে
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

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>
          <AlertDialogHeader>
            <AlertDialogTitle>নির্বাচিত প্রশ্নসমূহ ডিলিট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              আপনি <span className="font-bold text-foreground">{selectedIds.size.toLocaleString("bn-BD")}</span>টি প্রশ্ন চিরতরে মুছে ফেলতে চলেছেন। এই কাজটি ফেরানো যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmBulkDelete(); }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "ডিলিট হচ্ছে..." : `হ্যাঁ, ${selectedIds.size.toLocaleString("bn-BD")}টি ডিলিট করুন`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single delete confirmation */}
      <AlertDialog open={singleDeleteId != null} onOpenChange={(o) => !o && setSingleDeleteId(null)}>
        <AlertDialogContent style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>
          <AlertDialogHeader>
            <AlertDialogTitle>প্রশ্নটি ডিলিট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>এই কাজটি ফেরানো যাবে না।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmSingleDelete(); }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "ডিলিট হচ্ছে..." : "হ্যাঁ, ডিলিট করুন"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={duplicateModeOpen} onOpenChange={setDuplicateModeOpen}>
        <DialogContent className="max-w-[96vw] w-[1500px] h-[94vh] overflow-y-auto p-5">
          <AdminQuestionDuplicates embedded onClose={() => setDuplicateModeOpen(false)} />
        </DialogContent>
      </Dialog>

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
                    {suggestedChapters.map(name=><option key={name} value={PATTERN_CHAPTER_PREFIX+name}>{name}</option>)}
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
                  {[...new Set([...formTypes, ...(keepLegacyType ? [form.type] : [])])].map((t) => <option key={t} value={t}>{questionTypeLabel(t)}</option>)}
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
                            <option value="a">ক</option><option value="b">খ</option><option value="c">গ</option><option value="d">ঘ</option>
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
                                  <option value="a">ক</option><option value="b">খ</option><option value="c">গ</option><option value="d">ঘ</option>
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

            {form.chapter_id.startsWith(PATTERN_CHAPTER_PREFIX) && <p className="text-sm text-muted-foreground">নতুন বিভাগটি প্রশ্ন সেভ করার সময় তৈরি হবে। Lesson-এর নাম নতুন টপিক হিসেবে লিখতে পারেন।</p>}
            {languageTopicInput}
            {languageEditor}
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
