import { isCorrectOption } from "@/lib/answerKey";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, MessageSquare, Search, Eye, AlertTriangle, Flag, Save, SlidersHorizontal, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate, useSearchParams } from "react-router-dom";
import LatexRenderer from "@/components/LatexRenderer";
import ReferenceBadges from "@/components/ReferenceBadges";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { planCoversSelection } from "@/lib/subscriptionMatcher";
import { sortClasses } from "@/lib/classOrder";

const typeOptions = ["mcq", "short", "cq", "descriptive", "mcq_short", "mcq_short_cq", "all"];
const typeLabels: Record<string, string> = { mcq: "MCQ", short: "সংক্ষিপ্ত", cq: "সৃজনশীল", descriptive: "বর্ণনামূলক", mcq_short: "MCQ, সংক্ষিপ্ত", mcq_short_cq: "MCQ, সংক্ষিপ্ত, সৃজনশীল", all: "সকল প্রকার" };
const typeDbValues: Record<string, string[]> = {
  mcq: ["mcq"], short: ["short"], cq: ["cq"], descriptive: ["descriptive"],
  mcq_short: ["mcq", "short"],
  mcq_short_cq: ["mcq", "short", "cq"],
  all: ["mcq", "short", "cq", "descriptive"],
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
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  correct_answer?: string | null;
  type: string;
  explanation?: string | null;
  board_references?: any;
  university_references?: any;
  topic_id?: number | null;
  chapter_id: number;
  stimulus_group_id?: string | null;
  stimulus_text?: string | null;
  creative_data?: any;
}

// Special search categories
const specialSearchOptions = [
  { id: "board", label: "রিপিটেড বোর্ড প্রশ্ন" },
  { id: "math", label: "গাণিতিক" },
  { id: "theoretical", label: "তত্ত্বীয়" },
  { id: "diagram", label: "চিত্রযুক্ত প্রশ্ন" },
  { id: "multi_completion", label: "বহুপদী সমাপ্তিসূচক" },
  { id: "assertion", label: "অভিন্ন তথ্যভিত্তিক" },
];

// Board list
const boardList = [
  "ঢাকা বোর্ড", "বরিশাল বোর্ড", "দিনাজপুর বোর্ড", "কুমিল্লা বোর্ড",
  "যশোর বোর্ড", "সিলেট বোর্ড", "রাজশাহী বোর্ড", "ময়মনসিংহ বোর্ড", "চট্টগ্রাম বোর্ড",
];


export default function QuestionCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addToPaper = searchParams.get("add_to_paper") === "true";
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({
    programName: "",
    classId: "",
    subjectId: "",
    chapterIds: [] as string[],
    type: "mcq",
    count: "100",
  });
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; name: string }[]>([]);
  const [chapters, setChapters] = useState<{ id: number; name: string; is_free: boolean }[]>([]);
  const [topics, setTopics] = useState<{ id: number; name: string; chapter_id: number }[]>([]);
  const [warningDialog, setWarningDialog] = useState<WarningField>(null);
  const [hasSubscription, setHasSubscription] = useState<boolean>(false);

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [existingQuestionIds, setExistingQuestionIds] = useState<Set<number>>(new Set());

  // Load existing paper question IDs when in add_to_paper mode and auto-skip form
  const [autoSkipDone, setAutoSkipDone] = useState(false);
  useEffect(() => {
    if (addToPaper) {
      const raw = sessionStorage.getItem("existingPaperQuestions");
      if (raw) {
        const ids = (JSON.parse(raw) as QuestionRow[]).map(q => q.id);
        setExistingQuestionIds(new Set(ids));
      }
      // Auto-fill form from context and skip to question list
      const ctxRaw = sessionStorage.getItem("existingPaperContext");
      if (ctxRaw && !autoSkipDone) {
        const ctx = JSON.parse(ctxRaw);
        setForm(prev => ({
          ...prev,
          classId: ctx.classId || "",
          subjectId: ctx.subjectId || "",
          chapterIds: ctx.chapterIds || [],
          type: "all",
        }));
        setAutoSkipDone(true);
      }
    }
  }, [addToPaper]);

  // Auto-fetch questions when form is auto-filled in add_to_paper mode
  useEffect(() => {
    if (addToPaper && autoSkipDone && form.classId && form.subjectId && step === "form") {
      handleCreateQuestionSet();
    }
  }, [addToPaper, autoSkipDone, form.classId, form.subjectId]);

  // Filter states for sidebar
  const [filterSearch, setFilterSearch] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterChapterIds, setFilterChapterIds] = useState<Set<number>>(new Set());
  const [filterTopicIds, setFilterTopicIds] = useState<Set<number>>(new Set());
  const [filterUntopicedChapterIds, setFilterUntopicedChapterIds] = useState<Set<number>>(new Set());
  const [filterBoards, setFilterBoards] = useState<Set<string>>(new Set());
  const [filterYear, setFilterYear] = useState("");
  const [filterSpecial, setFilterSpecial] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  // Smoothly scroll the main content column to top (works in both desktop split-scroll and mobile page-scroll)
  const scrollMainToTop = () => {
    const el = mainScrollRef.current;
    if (el && el.scrollHeight > el.clientHeight) {
      el.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const ITEMS_PER_PAGE = 20;
  // Report modal states
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportQuestionId, setReportQuestionId] = useState<number | null>(null);
  const [reportErrorType, setReportErrorType] = useState("বানান ভুল");
  const [reportComment, setReportComment] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  const reportErrorTypes = ["বানান ভুল", "উত্তর ভুল", "অপশন ভুল", "প্রশ্ন অসম্পূর্ণ", "ডুপ্লিকেট প্রশ্ন", "অন্যান্য"];

  const handleReport = async () => {
    if (!user || !reportQuestionId) return;
    setReportLoading(true);
    const { error } = await supabase.from("question_reports" as any).insert({
      question_id: reportQuestionId,
      teacher_id: user.id,
      error_type: reportErrorType,
      comment: reportComment,
    } as any);
    setReportLoading(false);
    if (error) { toast.error("রিপোর্ট সাবমিট ব্যর্থ"); return; }
    toast.success("রিপোর্ট সাবমিট হয়েছে! ধন্যবাদ।");
    setReportDialogOpen(false);
    setReportComment("");
    setReportQuestionId(null);
  };
  const [institute, setInstitute] = useState<{ name: string; upazila?: string | null; district?: string | null; division?: string | null } | null>(null);

  // Fetch institute
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("institutes").select("name, upazila, district, division").eq("owner_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setInstitute(data); });
  }, [user?.id]);

  // Load classes
  useEffect(() => {
    supabase.from("classes").select("id, name").order("name")
      .then(({ data }) => setClasses(sortClasses(data || [])));
  }, []);

  // Load subjects when class changes
  useEffect(() => {
    if (!form.classId) { setSubjects([]); return; }
    supabase.from("subjects").select("id, name, subject_code").eq("class_id", Number(form.classId)).order("name")
      .then(({ data }) => setSubjects(data || []));
  }, [form.classId]);

  // Load chapters when subject changes
  useEffect(() => {
    if (!form.subjectId) { setChapters([]); setTopics([]); return; }
    supabase.from("chapters").select("id, name, is_free").eq("subject_id", Number(form.subjectId)).eq("is_active", true).order("name")
      .then(({ data }) => setChapters((data as any[]) || []));
  }, [form.subjectId]);

  // Check access: user_permissions OR active subscriptions
  useEffect(() => {
    if (!user?.id || !form.classId || !form.subjectId) { setHasSubscription(false); return; }

    let cancelled = false;

    const checkAccess = async () => {
      const [{ data: permData }, { data: subs }] = await Promise.all([
        supabase
          .from("user_permissions")
          .select("id")
          .eq("user_id", user.id)
          .eq("class_id", Number(form.classId))
          .eq("subject_id", Number(form.subjectId))
          .limit(1),
        supabase
          .from("subscriptions")
          .select("plan")
          .eq("teacher_id", user.id)
          .eq("status", "active"),
      ]);

      if (cancelled) return;

      if (permData && permData.length > 0) {
        setHasSubscription(true);
        return;
      }

      const selectedClass = classes.find(c => String(c.id) === String(form.classId));
      const selectedSubject = subjects.find(s => String(s.id) === String(form.subjectId));
      if (!selectedClass || !selectedSubject || !subs || subs.length === 0) {
        setHasSubscription(false);
        return;
      }

      const hasAccess = subs.some((sub) =>
        planCoversSelection(sub.plan || "", selectedClass.name, selectedSubject.name)
      );

      setHasSubscription(hasAccess);
    };

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, [user?.id, form.classId, form.subjectId, classes, subjects]);

  // Load topics when chapters selected
  useEffect(() => {
    if (form.chapterIds.length === 0) { setTopics([]); return; }
    supabase.from("topics").select("id, name, chapter_id")
      .in("chapter_id", form.chapterIds.map(Number)).order("name")
      .then(({ data }) => setTopics(data || []));
  }, [form.chapterIds]);

  const toggleChapter = (chapterId: string) => {
    setForm(prev => {
      const exists = prev.chapterIds.includes(chapterId);
      return {
        ...prev,
        chapterIds: exists
          ? prev.chapterIds.filter(id => id !== chapterId)
          : [...prev.chapterIds, chapterId],
      };
    });
  };

  const handleCreateQuestionSet = async () => {
    if (!form.classId || !form.subjectId) {
      toast.error("শ্রেণী ও বিষয় নির্বাচন করুন");
      return;
    }
    setLoading(true);
    try {
      // Always fetch ALL question types; client-side sidebar filter handles type filtering.
      // Paginate via .range() to avoid the default 1000-row cap and ensure NO question is missed.
      const PAGE_SIZE = 1000;
      const buildQuery = (from: number, to: number) => {
        let q = supabase.from("questions").select("*, chapters!inner(is_active)")
          .eq("class_id", Number(form.classId))
          .eq("subject_id", Number(form.subjectId))
          .eq("chapters.is_active", true);
        if (form.chapterIds.length > 0) {
          q = q.in("chapter_id", form.chapterIds.map(Number));
        }
        return q.order("id", { ascending: true }).range(from, to);
      };

      const allRows: any[] = [];
      let page = 0;
      // Loop until a page returns less than PAGE_SIZE (final page)
      // Safety cap of 50 iterations (=> max 50,000 questions) to avoid runaway loops.
      for (let i = 0; i < 50; i++) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await buildQuery(from, to);
        if (error) throw error;
        const batch = data || [];
        allRows.push(...batch);
        if (batch.length < PAGE_SIZE) break;
        page++;
      }

      // Filter out questions already in the paper
      const filtered = addToPaper
        ? allRows.filter(q => !existingQuestionIds.has(q.id))
        : allRows;
      if (filtered.length === 0) {
        toast.info("এই ফিল্টারে কোনো নতুন প্রশ্ন পাওয়া যায়নি");
        return;
      }
      const shuffled = filtered.sort(() => Math.random() - 0.5);
      setQuestions(shuffled);
      setSelectedIds(new Set());
      // Set initial sidebar filter based on form type (if not "all")
      if (form.type !== "all") {
        const dbTypes = typeDbValues[form.type] || [form.type];
        if (dbTypes.length === 1) {
          setFilterType(dbTypes[0]);
        } else {
          setFilterType(null);
        }
      } else {
        setFilterType(null);
      }
      toast.success(`${shuffled.length}টি প্রশ্ন পাওয়া গেছে!`);
      setStep(addToPaper ? "questionList" : "questionSet");
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
      const question = questions.find(q => q.id === id);
      const isAdding = !next.has(id);

      if (question?.stimulus_group_id) {
        // Auto-select/deselect all questions in the same group
        const groupQs = questions.filter(q => q.stimulus_group_id === question.stimulus_group_id);
        groupQs.forEach(gq => {
          if (isAdding) next.add(gq.id); else next.delete(gq.id);
        });
      } else {
        if (isAdding) next.add(id); else next.delete(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    const visible = getFilteredQuestions();
    if (selectedIds.size === visible.length && visible.every(q => selectedIds.has(q.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visible.map(q => q.id)));
    }
  };

  const className = classes.find(c => String(c.id) === form.classId)?.name || "";
  const selectedSubject = subjects.find(s => String(s.id) === form.subjectId);
  const subjectName = selectedSubject?.name || "";
  const subjectCode = (selectedSubject as any)?.subject_code || "";
  const selectedChapterNames = chapters
    .filter(c => form.chapterIds.includes(String(c.id)))
    .map(c => c.name);

  // Strict sorting: MCQ → Short → CQ → Descriptive
  const typeSortOrder: Record<string, number> = { mcq: 0, short: 1, cq: 2, descriptive: 3 };

  // Apply all filters
  const getFilteredQuestions = () => {
    let result = [...questions];

    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      result = result.filter(r => r.question?.toLowerCase().includes(q));
    }

    if (filterType) {
      result = result.filter(r => r.type === filterType);
    }

    if (filterChapterIds.size > 0) {
      result = result.filter(r => filterChapterIds.has(r.chapter_id));
    }

    if (filterTopicIds.size > 0 || filterUntopicedChapterIds.size > 0) {
      result = result.filter(r => {
        if (r.topic_id && filterTopicIds.has(r.topic_id)) return true;
        if (!r.topic_id && filterUntopicedChapterIds.has(r.chapter_id)) return true;
        return false;
      });
    }

    if (filterBoards.size > 0) {
      result = result.filter(r => {
        const refs = Array.isArray(r.board_references) ? r.board_references : [];
        return refs.some((ref: any) => {
          const boardMatch = filterBoards.has(ref.board);
          const yearMatch = !filterYear || ref.year === filterYear;
          return boardMatch && yearMatch;
        });
      });
    }

    // Special search filters (radio - only one active at a time)
    if (filterSpecial === "board") {
      // Repeated board questions: appeared in 2+ different boards
      result = result.filter(r => {
        const refs = Array.isArray(r.board_references) ? r.board_references : [];
        const uniqueBoards = new Set(refs.map((ref: any) => ref.board));
        return uniqueBoards.size >= 2;
      });
    } else if (filterSpecial === "math") {
      // Mathematical: contains LaTeX symbols
      result = result.filter(r => {
        const text = `${r.question || ""} ${r.option_a || ""} ${r.option_b || ""} ${r.option_c || ""} ${r.option_d || ""} ${r.stimulus_text || ""}`;
        return /\$.*?\$|\\frac|\\sqrt|\\sum|\\int|\\[|\\]|\\(|\\)|\\times|\\div|\\pm|\\leq|\\geq|\\neq|\\alpha|\\beta|\\theta|\\pi/i.test(text);
      });
    } else if (filterSpecial === "theoretical") {
      // Theoretical: does NOT contain complex math
      result = result.filter(r => {
        const text = `${r.question || ""} ${r.option_a || ""} ${r.option_b || ""} ${r.option_c || ""} ${r.option_d || ""}`;
        return !/\$.*?\$|\\frac|\\sqrt|\\sum|\\int/i.test(text);
      });
    } else if (filterSpecial === "diagram") {
      // Image-based: contains <img> tag or cloudinary URL
      result = result.filter(r => {
        const text = `${r.question || ""} ${r.option_a || ""} ${r.option_b || ""} ${r.option_c || ""} ${r.option_d || ""} ${r.stimulus_text || ""}`;
        return /<img\s/i.test(text) || /cloudinary\.com/i.test(text) || /res\.cloudinary/i.test(text);
      });
    } else if (filterSpecial === "multi_completion") {
      // বহুপদী সমাপ্তিসূচক: MCQs containing Roman numeral items (i., ii., iii.)
      result = result.filter(r => {
        if (r.type !== "mcq") return false;
        const stripped = r.question.replace(/<[^>]*>/g, "");
        return (/(?:^|[^a-zA-Z])i[.\s].*(?:^|[^a-zA-Z])ii[.\s].*(?:^|[^a-zA-Z])iii[.\s]/s.test(stripped)
          || /(?:^|[^a-zA-Z])i\).*(?:^|[^a-zA-Z])ii\).*(?:^|[^a-zA-Z])iii\)/s.test(stripped));
      });
    } else if (filterSpecial === "assertion") {
      // Uniform information-based: has board refs but only 1 unique board (same info repeated)
      result = result.filter(r => {
        const refs = Array.isArray(r.board_references) ? r.board_references : [];
        return refs.length >= 1;
      });
    }

    // Sort by type priority: MCQ → Short → CQ → Descriptive
    result.sort((a, b) => (typeSortOrder[a.type] ?? 99) - (typeSortOrder[b.type] ?? 99));

    return result;
  };

  const filteredQuestions = getFilteredQuestions();
  const totalPages = Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE);
  const paginatedQuestions = filteredQuestions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [filterSearch, filterType, filterChapterIds, filterTopicIds, filterUntopicedChapterIds, filterBoards, filterYear, filterSpecial]);

  const handleSaveAndView = () => {
    if (selectedIds.size === 0) {
      toast.error("অন্তত একটি প্রশ্ন সিলেক্ট করুন");
      return;
    }
    const selected = questions.filter(q => selectedIds.has(q.id));
    // Store in sessionStorage for the view page
    sessionStorage.setItem("viewPaperQuestions", JSON.stringify(selected));
    // Build topic names map for selected questions
    const selectedTopicIds = new Set(selected.map(q => q.topic_id).filter(Boolean));
    const topicNamesForPaper = topics.filter(t => selectedTopicIds.has(t.id)).map(t => t.name);

    sessionStorage.setItem("viewPaperMeta", JSON.stringify({
      instituteName: institute?.name || "আপনার প্রতিষ্ঠানের নাম",
      instituteUpazila: institute?.upazila || "",
      instituteDistrict: institute?.district || "",
      instituteDivision: institute?.division || "",
      institutePhone: (institute as any)?.phone || "",
      instituteSpecificAddress: (institute as any)?.specific_address || "",
      className,
      subjectName,
      subjectCode,
      chapterNames: selectedChapterNames,
      programName: form.programName,
      teacherName: user?.user_metadata?.full_name || user?.email || "",
      topicNames: topicNamesForPaper,
    }));
    toast.success(`${selectedIds.size}টি প্রশ্ন সংরক্ষিত হয়েছে!`);
  };

  const handleViewPaper = () => {
    if (selectedIds.size === 0) {
      toast.error("আগে প্রশ্ন সিলেক্ট ও সেভ করুন");
      return;
    }

    if (addToPaper) {
      // Merge new selections with existing paper questions
      const existingQsRaw = sessionStorage.getItem("existingPaperQuestions");
      const existingMetaRaw = sessionStorage.getItem("existingPaperMeta");
      const existingSettingsRaw = sessionStorage.getItem("existingPaperSettings");
      const existingPaperId = sessionStorage.getItem("existingPaperId");
      const existingQs: QuestionRow[] = existingQsRaw ? JSON.parse(existingQsRaw) : [];
      const existingIds = new Set(existingQs.map(q => q.id));

      // Add only new questions (avoid duplicates)
      const newSelected = questions.filter(q => selectedIds.has(q.id) && !existingIds.has(q.id));
      const mergedQuestions = [...existingQs, ...newSelected];

      sessionStorage.setItem("viewPaperQuestions", JSON.stringify(mergedQuestions));
      if (existingMetaRaw) sessionStorage.setItem("viewPaperMeta", existingMetaRaw);
      if (existingSettingsRaw) sessionStorage.setItem("viewPaperSettings", existingSettingsRaw);

      // Clean up
      sessionStorage.removeItem("existingPaperQuestions");
      sessionStorage.removeItem("existingPaperMeta");
      sessionStorage.removeItem("existingPaperSettings");
      sessionStorage.removeItem("existingPaperId");
      sessionStorage.removeItem("existingPaperContext");

      toast.success(`${newSelected.length}টি নতুন প্রশ্ন যুক্ত হয়েছে!`);

      // Navigate back — if there was a paper_id, update it; otherwise fresh view
      if (existingPaperId) {
        navigate(`/dashboard/view-paper?paper_id=${existingPaperId}`);
      } else {
        navigate("/dashboard/view-paper");
      }
    } else {
      handleSaveAndView();
      navigate("/dashboard/view-paper");
    }
  };

  // Group topics by chapter
  const topicsByChapter: Record<number, { chapterName: string; topics: { id: number; name: string }[] }> = {};
  form.chapterIds.forEach(cId => {
    const ch = chapters.find(c => String(c.id) === cId);
    if (ch) {
      topicsByChapter[ch.id] = {
        chapterName: ch.name,
        topics: topics.filter(t => t.chapter_id === ch.id),
      };
    }
  });

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
              {selectedChapterNames.length > 0 && (
                <p className="text-sm">{selectedChapterNames.join(", ")}</p>
              )}
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

  // ─── STEP 3: Question List with Advanced Filter Sidebar ───
  if (step === "questionList") {
    const filterSidebarContent = (
      <div className="space-y-4">
        {/* Keyword search */}
        <div className="flex gap-2">
          <Input placeholder="কিওয়ার্ড সার্চ করুন" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} className="text-sm" />
          <Button size="sm" variant="outline" onClick={() => {}}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Unique Question Box */}
        <div className="border-2 border-primary/30 bg-primary/5 rounded-lg p-3 text-center">
          <h4 className="font-heading font-bold text-primary text-sm">ইউনিক প্রশ্ন তৈরী</h4>
          <p className="text-xs text-muted-foreground mt-1">পূর্বের তৈরী কোনো একটি প্রশ্নের সকল প্রশ্ন বাদ দিয়ে নতুন প্রশ্ন তৈরী করতে পারবেন।</p>
          <p className="text-xs font-medium text-primary mt-1">একাধিক ব্যাচের জন্য গুরুত্বপূর্ণ</p>
          <p className="text-xs text-destructive mt-1">তৈরীকৃত কোনো প্রশ্ন নেই!</p>
        </div>

        {/* Special search */}
        <div className="border border-border rounded-lg p-3">
          <h4 className="font-heading font-bold text-sm mb-2">Proshno Lab স্পেশাল সার্চ</h4>
          <div className="space-y-2">
            {specialSearchOptions.map(opt => (
              <div key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer" onClick={() => setFilterSpecial(prev => prev === opt.id ? null : opt.id)}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${filterSpecial === opt.id ? 'border-primary' : 'border-muted-foreground/50'}`}>
                  {filterSpecial === opt.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                {opt.label}
              </div>
            ))}
          </div>
        </div>

        {/* Type filter */}
        <div className="border border-border rounded-lg p-3">
          <h4 className="font-heading font-bold text-sm mb-2">টাইপ</h4>
          <div className="space-y-2">
            {[
              { value: null, label: "সব" },
              { value: "mcq", label: "বহুনির্বাচনী" },
              { value: "short", label: "সংক্ষিপ্ত" },
              { value: "cq", label: "সৃজনশীল" },
              { value: "descriptive", label: "বর্ণনামূলক" },
            ].map(opt => (
              <label key={String(opt.value)} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="filterType" checked={filterType === opt.value} onChange={() => setFilterType(opt.value)} className="accent-primary" />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Chapter filter (from selected chapters) */}
        {chapters.filter(c => form.chapterIds.includes(String(c.id))).length > 0 && (() => {
          const fmtBn = (n: number) => n.toLocaleString("bn-BD");
          // Chapter counts respect type filter only (so toggling chapters stays intuitive)
          const chapterPool = filterType ? questions.filter(q => q.type === filterType) : questions;
          const chapterCount = (cid: number) => chapterPool.filter(q => q.chapter_id === cid).length;
          return (
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-heading font-bold text-sm">অধ্যায়</h4>
                {filterChapterIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterChapterIds(new Set())}
                    className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                  >
                    ক্লিয়ার
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {chapters
                  .filter(c => form.chapterIds.includes(String(c.id)))
                  .map(c => {
                    const count = chapterCount(c.id);
                    const isActive = filterChapterIds.has(c.id);
                    const disabled = count === 0;
                    return (
                      <label
                        key={c.id}
                        className={`group flex items-center gap-2 text-sm rounded-md px-2 py-1.5 transition-colors ${
                          disabled
                            ? "opacity-50 cursor-not-allowed"
                            : isActive
                              ? "bg-primary/10 cursor-pointer"
                              : "cursor-pointer hover:bg-muted/60"
                        }`}
                      >
                        <Checkbox
                          disabled={disabled}
                          checked={isActive}
                          onCheckedChange={() => {
                            if (disabled) return;
                            setFilterChapterIds(prev => {
                              const next = new Set(prev);
                              next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                              return next;
                            });
                          }}
                        />
                        <span className={`flex-1 leading-tight truncate ${isActive ? "font-medium text-foreground" : "text-foreground/90"}`}>
                          {c.name}
                        </span>
                        <span
                          className={`shrink-0 inline-flex items-center justify-center min-w-[2rem] px-2 h-[1.35rem] rounded-full text-[11.5px] font-bold tabular-nums tracking-tight border shadow-sm transition-all ${
                            isActive
                              ? "bg-primary text-primary-foreground border-primary shadow-primary/30"
                              : count === 0
                                ? "bg-muted text-muted-foreground/60 border-border shadow-none"
                                : "bg-primary/10 text-primary border-primary/25 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary"
                          }`}
                        >
                          {fmtBn(count)}
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>
          );
        })()}

        {/* Topics grouped by chapter */}
        {Object.keys(topicsByChapter).length > 0 && (() => {
          const fmtBn = (n: number) => n.toLocaleString("bn-BD");
          // Topic counts respect type + active chapter filter for accurate preview
          const topicPool = questions.filter(q => {
            if (filterType && q.type !== filterType) return false;
            if (filterChapterIds.size > 0 && !filterChapterIds.has(q.chapter_id)) return false;
            return true;
          });
          const topicCount = (tid: number) => topicPool.filter(q => q.topic_id === tid).length;
          const untopicedCount = (cid: number) =>
            topicPool.filter(q => q.chapter_id === cid && !q.topic_id).length;
          const chapterTopicTotal = (cid: number) =>
            topicPool.filter(q => q.chapter_id === cid).length;
          return (
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-heading font-bold text-sm">টপিক</h4>
                {(filterTopicIds.size > 0 || filterUntopicedChapterIds.size > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterTopicIds(new Set());
                      setFilterUntopicedChapterIds(new Set());
                    }}
                    className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                  >
                    ক্লিয়ার
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {Object.entries(topicsByChapter).map(([chId, data]) => {
                  const cidNum = Number(chId);
                  const groupTotal = chapterTopicTotal(cidNum);
                  const noneCount = untopicedCount(cidNum);
                  const noneActive = filterUntopicedChapterIds.has(cidNum);
                  const noneDisabled = noneCount === 0;
                  const hasTopics = data.topics.length > 0;
                  return (
                    <div key={chId}>
                      <div className="flex items-center justify-between mb-1.5 border-b border-border pb-1">
                        <p className="text-xs font-semibold text-muted-foreground truncate">📖 {data.chapterName}</p>
                        <span className="shrink-0 ml-2 inline-flex items-center justify-center min-w-[2rem] px-2 h-[1.3rem] rounded-full text-[11px] font-bold tabular-nums tracking-tight bg-primary/12 text-primary border border-primary/25 shadow-sm">
                          {fmtBn(groupTotal)}
                        </span>
                      </div>
                      {!hasTopics && noneCount === 0 ? (
                        <p className="text-xs text-muted-foreground/70 pl-4">কোনো টপিক নেই</p>
                      ) : (
                        <div className="space-y-1 pl-2">
                          {data.topics.map(t => {
                            const count = topicCount(t.id);
                            const isActive = filterTopicIds.has(t.id);
                            const disabled = count === 0;
                            return (
                              <label
                                key={t.id}
                                className={`group flex items-center gap-2 text-sm rounded-md px-2 py-1 transition-colors ${
                                  disabled
                                    ? "opacity-50 cursor-not-allowed"
                                    : isActive
                                      ? "bg-primary/10 cursor-pointer"
                                      : "cursor-pointer hover:bg-muted/60"
                                }`}
                              >
                                <Checkbox
                                  disabled={disabled}
                                  checked={isActive}
                                  onCheckedChange={() => {
                                    if (disabled) return;
                                    setFilterTopicIds(prev => {
                                      const next = new Set(prev);
                                      next.has(t.id) ? next.delete(t.id) : next.add(t.id);
                                      return next;
                                    });
                                  }}
                                />
                                <span className={`flex-1 leading-tight truncate ${isActive ? "font-medium text-foreground" : "text-foreground/90"}`}>
                                  {t.name}
                                </span>
                                <span
                                  className={`shrink-0 inline-flex items-center justify-center min-w-[1.85rem] px-1.5 h-[1.2rem] rounded-full text-[10.5px] font-bold tabular-nums tracking-tight border shadow-sm transition-all ${
                                    isActive
                                      ? "bg-primary text-primary-foreground border-primary shadow-primary/30"
                                      : count === 0
                                        ? "bg-muted text-muted-foreground/60 border-border shadow-none"
                                        : "bg-primary/10 text-primary border-primary/25 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary"
                                  }`}
                                >
                                  {fmtBn(count)}
                                </span>
                              </label>
                            );
                          })}
                          {noneCount > 0 && (
                            <label
                              className={`group flex items-center gap-2 text-sm rounded-md px-2 py-1 transition-colors border border-dashed ${
                                noneDisabled
                                  ? "opacity-50 cursor-not-allowed border-border"
                                  : noneActive
                                    ? "bg-primary/10 border-primary/40 cursor-pointer"
                                    : "cursor-pointer hover:bg-muted/60 border-border/70"
                              }`}
                            >
                              <Checkbox
                                disabled={noneDisabled}
                                checked={noneActive}
                                onCheckedChange={() => {
                                  if (noneDisabled) return;
                                  setFilterUntopicedChapterIds(prev => {
                                    const next = new Set(prev);
                                    next.has(cidNum) ? next.delete(cidNum) : next.add(cidNum);
                                    return next;
                                  });
                                }}
                              />
                              <span className={`flex-1 leading-tight truncate italic ${noneActive ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                                টপিকবিহীন প্রশ্ন
                              </span>
                              <span
                                className={`shrink-0 inline-flex items-center justify-center min-w-[1.85rem] px-1.5 h-[1.2rem] rounded-full text-[10.5px] font-bold tabular-nums tracking-tight border shadow-sm transition-all ${
                                  noneActive
                                    ? "bg-primary text-primary-foreground border-primary shadow-primary/30"
                                    : "bg-primary/10 text-primary border-primary/25 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary"
                                }`}
                              >
                                {fmtBn(noneCount)}
                              </span>
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Board filter */}
        <div className="border border-border rounded-lg p-3">
          <h4 className="font-heading font-bold text-sm mb-2">বোর্ড</h4>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="mb-2"><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent>
              {["2020", "2021", "2022", "2023", "2024", "2025"].map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-2">
            {boardList.map(b => (
              <label key={b} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={filterBoards.has(b)} onCheckedChange={() => { setFilterBoards(prev => { const next = new Set(prev); next.has(b) ? next.delete(b) : next.add(b); return next; }); }} />
                {b}
              </label>
            ))}
          </div>
        </div>
      </div>
    );

    return (
      <>
      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-6 lg:h-[calc(100vh-7rem)] lg:overflow-hidden">
        {/* Main content - independently scrollable on desktop */}
        <div ref={mainScrollRef} className="space-y-4 lg:overflow-y-auto lg:pr-2 lg:-mr-2 lg:scroll-smooth">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Selected: {selectedIds.size}/{questions.length}</span>
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selectedIds.size === filteredQuestions.length && filteredQuestions.length > 0 ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep("questionSet")}>← ফিরে যান</Button>
              <Button variant="outline" size="sm" onClick={handleViewPaper} disabled={selectedIds.size === 0}>
                <Eye className="h-4 w-4 mr-1" /> View
              </Button>
              <Button className="gradient-green text-primary-foreground border-0" size="sm"
                onClick={handleSaveAndView}
                disabled={selectedIds.size === 0}><Save size={16} /> Save</Button>
            </div>
          </div>

          {/* Live count badges + Reset — reflect ALL sidebar filters except type itself */}
          {(() => {
            // Apply every sidebar filter EXCEPT type, so each badge shows its own true count
            const applyNonTypeFilters = (rows: QuestionRow[]) => {
              let result = rows;

              if (filterSearch.trim()) {
                const q = filterSearch.toLowerCase();
                result = result.filter(r => r.question?.toLowerCase().includes(q));
              }

              if (filterChapterIds.size > 0) {
                result = result.filter(r => filterChapterIds.has(r.chapter_id));
              }

              if (filterTopicIds.size > 0 || filterUntopicedChapterIds.size > 0) {
                result = result.filter(r => {
                  if (r.topic_id && filterTopicIds.has(r.topic_id)) return true;
                  if (!r.topic_id && filterUntopicedChapterIds.has(r.chapter_id)) return true;
                  return false;
                });
              }

              if (filterBoards.size > 0) {
                result = result.filter(r => {
                  const refs = Array.isArray(r.board_references) ? r.board_references : [];
                  return refs.some((ref: any) => {
                    const boardMatch = filterBoards.has(ref.board);
                    const yearMatch = !filterYear || ref.year === filterYear;
                    return boardMatch && yearMatch;
                  });
                });
              } else if (filterYear) {
                // Year selected without board → still narrow by year
                result = result.filter(r => {
                  const refs = Array.isArray(r.board_references) ? r.board_references : [];
                  return refs.some((ref: any) => ref.year === filterYear);
                });
              }

              if (filterSpecial === "board") {
                result = result.filter(r => {
                  const refs = Array.isArray(r.board_references) ? r.board_references : [];
                  const uniqueBoards = new Set(refs.map((ref: any) => ref.board));
                  return uniqueBoards.size >= 2;
                });
              } else if (filterSpecial === "math") {
                result = result.filter(r => {
                  const text = `${r.question || ""} ${r.option_a || ""} ${r.option_b || ""} ${r.option_c || ""} ${r.option_d || ""} ${r.stimulus_text || ""}`;
                  return /\$.*?\$|\\frac|\\sqrt|\\sum|\\int|\\[|\\]|\\(|\\)|\\times|\\div|\\pm|\\leq|\\geq|\\neq|\\alpha|\\beta|\\theta|\\pi/i.test(text);
                });
              } else if (filterSpecial === "theoretical") {
                result = result.filter(r => {
                  const text = `${r.question || ""} ${r.option_a || ""} ${r.option_b || ""} ${r.option_c || ""} ${r.option_d || ""}`;
                  return !/\$.*?\$|\\frac|\\sqrt|\\sum|\\int/i.test(text);
                });
              } else if (filterSpecial === "diagram") {
                result = result.filter(r => {
                  const text = `${r.question || ""} ${r.option_a || ""} ${r.option_b || ""} ${r.option_c || ""} ${r.option_d || ""} ${r.stimulus_text || ""}`;
                  return /<img\s/i.test(text) || /cloudinary\.com/i.test(text) || /res\.cloudinary/i.test(text);
                });
              } else if (filterSpecial === "multi_completion") {
                result = result.filter(r => {
                  if (r.type !== "mcq") return false;
                  const stripped = r.question.replace(/<[^>]*>/g, "");
                  return (/(?:^|[^a-zA-Z])i[.\s].*(?:^|[^a-zA-Z])ii[.\s].*(?:^|[^a-zA-Z])iii[.\s]/s.test(stripped)
                    || /(?:^|[^a-zA-Z])i\).*(?:^|[^a-zA-Z])ii\).*(?:^|[^a-zA-Z])iii\)/s.test(stripped));
                });
              } else if (filterSpecial === "assertion") {
                result = result.filter(r => {
                  const refs = Array.isArray(r.board_references) ? r.board_references : [];
                  return refs.length >= 1;
                });
              }

              return result;
            };

            const base = applyNonTypeFilters(questions);
            const countByType = (t: string) => base.filter(q => q.type === t).length;
            const fmt = (n: number) => n.toLocaleString("bn-BD");
            const badges = [
              { value: null, label: "সব", count: base.length, dot: "bg-primary" },
              { value: "mcq", label: "MCQ", count: countByType("mcq"), dot: "bg-blue-500" },
              { value: "short", label: "সংক্ষিপ্ত", count: countByType("short"), dot: "bg-amber-500" },
              { value: "cq", label: "সৃজনশীল", count: countByType("cq"), dot: "bg-purple-500" },
              { value: "descriptive", label: "বর্ণনামূলক", count: countByType("descriptive"), dot: "bg-rose-500" },
            ];

            const hasAnyFilter = !!filterSearch.trim() || filterType !== null || filterChapterIds.size > 0 || filterTopicIds.size > 0
              || filterUntopicedChapterIds.size > 0 || filterBoards.size > 0 || !!filterYear || filterSpecial !== null;

            const resetAllFilters = () => {
              setFilterSearch("");
              setFilterType(null);
              setFilterChapterIds(new Set());
              setFilterTopicIds(new Set());
              setFilterUntopicedChapterIds(new Set());
              setFilterBoards(new Set());
              setFilterYear("");
              setFilterSpecial(null);
              setCurrentPage(1);
            };

            return (
              <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap w-full min-w-0">
                <div className="-mx-1 sm:mx-0 flex-1 min-w-0 overflow-x-auto sm:overflow-visible scrollbar-none">
                  <div
                    role="tablist"
                    aria-label="প্রশ্নের ধরন"
                    className="inline-flex items-center gap-0.5 p-1 rounded-xl bg-muted/60 border border-border/60 shadow-sm backdrop-blur-sm mx-1 sm:mx-0 w-max sm:w-auto"
                  >
                    {badges.map(b => {
                      const isActive = filterType === b.value;
                      const isDisabled = b.count === 0 && !isActive;
                      return (
                        <button
                          key={String(b.value)}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          disabled={isDisabled}
                          onClick={() => setFilterType(b.value)}
                          className={`relative inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg text-[12.5px] sm:text-[13px] font-semibold tracking-tight transition-all duration-200 whitespace-nowrap shrink-0 ${
                            isActive
                              ? "bg-background text-foreground shadow-sm ring-1 ring-border/80"
                              : isDisabled
                                ? "text-muted-foreground/60 cursor-not-allowed"
                                : "text-foreground/80 hover:text-foreground hover:bg-background/70"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full transition-opacity ${b.dot} ${isActive ? "opacity-100" : "opacity-80"}`} />
                          <span>{b.label}</span>
                          <span
                            className={`inline-flex items-center justify-center min-w-[1.4rem] h-[18px] px-1.5 rounded-md text-[11px] font-bold tabular-nums tracking-tight transition-colors ${
                              isActive
                                ? "bg-primary/15 text-primary"
                                : "bg-background text-foreground/80 border border-border"
                            }`}
                          >
                            {fmt(b.count)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {hasAnyFilter && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="group inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg text-[12px] sm:text-[12.5px] font-medium text-muted-foreground hover:text-destructive border border-dashed border-border hover:border-destructive/40 hover:bg-destructive/5 transition-all whitespace-nowrap shrink-0"
                    title="সব ফিল্টার রিসেট করুন"
                  >
                    <RotateCcw className="h-3.5 w-3.5 transition-transform group-hover:-rotate-180 duration-300" />
                    <span>রিসেট</span>
                  </button>
                )}
              </div>
            );
          })()}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center text-sm text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
            প্রশ্নে ভুল পেলে রিপোর্ট করে Proshno Lab কে সমৃদ্ধ করুন ।
          </div>

          {/* Mobile filter button + search */}
          <div className="lg:hidden flex gap-2">
            <Input placeholder="কিওয়ার্ড সার্চ করুন" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} className="flex-1" />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <SlidersHorizontal className="h-4 w-4 mr-1.5" /> ফিল্টার
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
                <SheetHeader>
                  <SheetTitle className="font-heading">এডভান্সড ফিল্টার মেনু</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(85vh-60px)] pr-2 mt-4">
                  {filterSidebarContent}
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>

          <div className="space-y-3">
            {paginatedQuestions.map((q, idx) => {
              const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + idx;
              const isSelected = selectedIds.has(q.id);
              const typeMeta: Record<string, { label: string; dot: string; chip: string }> = {
                mcq:         { label: "MCQ",          dot: "bg-blue-500",   chip: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/60 dark:border-blue-900" },
                short:       { label: "সংক্ষিপ্ত",   dot: "bg-amber-500",  chip: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/60 dark:border-amber-900" },
                cq:          { label: "সৃজনশীল",     dot: "bg-purple-500", chip: "text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-950/60 dark:border-purple-900" },
                descriptive: { label: "বর্ণনামূলক", dot: "bg-rose-500",   chip: "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/60 dark:border-rose-900" },
              };
              const tm = typeMeta[q.type] ?? { label: q.type, dot: "bg-muted-foreground", chip: "text-muted-foreground bg-muted border-border" };
              return (
              <Card
                key={q.id}
                onClick={() => toggleQuestion(q.id)}
                className={`group relative overflow-hidden cursor-pointer border transition-all duration-200 ease-out will-change-transform ${
                  isSelected
                    ? "border-primary/60 shadow-[0_4px_20px_-8px_hsl(var(--primary)/0.35)] bg-gradient-to-br from-primary/[0.06] to-transparent -translate-y-px"
                    : "border-border/70 hover:border-border hover:-translate-y-0.5 hover:shadow-md"
                }`}
              >
                <span
                  aria-hidden
                  className={`pointer-events-none absolute left-0 top-0 h-full w-[3px] transition-all duration-200 ${
                    isSelected ? "bg-primary opacity-100" : `${tm.dot} opacity-0 group-hover:opacity-70`
                  }`}
                />
                <CardContent className="p-4 pl-[18px]">
                  <div className="flex items-center justify-between mb-2.5 gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleQuestion(q.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-md text-[10.5px] font-bold tracking-tight border ${tm.chip}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${tm.dot}`} />
                        {tm.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ReferenceBadges
                        boardRefs={q.board_references as any}
                        uniRefs={q.university_references as any}
                      />
                      <button
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="রিপোর্ট করুন"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportQuestionId(q.id);
                          setReportErrorType("বানান ভুল");
                          setReportComment("");
                          setReportDialogOpen(true);
                        }}
                      >
                        <Flag className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const cData = (q.type === "cq" || q.type === "descriptive") && q.creative_data
                      ? (typeof q.creative_data === "string" ? JSON.parse(q.creative_data) : q.creative_data)
                      : null;
                    // For CQ, prefer creative_data.stem (full stimulus with images/tables)
                    const displayQuestion = (q.type === "cq" && cData?.stem) ? cData.stem : q.question;

                    return (
                      <>
                        {q.stimulus_text && (q.stimulus_text.replace(/<[^>]*>/g, "").trim().length > 0 || /<img\s/i.test(q.stimulus_text)) && (
                          <div className="mb-3 p-3 border-l-2 border-primary/30 bg-muted/30 rounded-r italic text-sm rich-text-content"
                            dangerouslySetInnerHTML={{ __html: q.stimulus_text }}
                          />
                        )}
                        <div className="font-medium mb-3 flex items-baseline gap-0">
                          <span className="shrink-0">{globalIdx + 1}. </span>
                          <div className="flex-1 mc-block-question"><LatexRenderer text={displayQuestion} /></div>
                        </div>
                      </>
                    );
                  })()}
                  {q.type === "mcq" && q.option_a && (
                    <div className="grid grid-cols-2 gap-2">
                      {["option_a", "option_b", "option_c", "option_d"].map((key, oi) => {
                        const val = (q as any)[key];
                        if (!val) return null;
                        const label = ["ক", "খ", "গ", "ঘ"][oi];
                        const isAnswer = isCorrectOption(q.correct_answer, oi, [q.option_a, q.option_b, q.option_c, q.option_d]);
                        return (
                          <div key={key} className={`flex items-center gap-2 p-2 rounded text-sm ${isAnswer ? "bg-green-100 text-green-800 font-semibold dark:bg-green-900 dark:text-green-200" : "bg-muted/50"}`}>
                            <span
                              className="shrink-0 inline-flex items-center justify-center rounded-full border border-current font-medium leading-none"
                              style={{ width: "1.55em", height: "1.55em" }}
                            >
                              {label}
                            </span>
                            <LatexRenderer text={val} inline />

                          </div>
                        );
                      })}
                    </div>
                  )}
                  {(q.type === "cq" || q.type === "descriptive") && q.creative_data && (() => {
                    const data = typeof q.creative_data === "string" ? JSON.parse(q.creative_data) : q.creative_data;
                    const subFields = q.type === "descriptive"
                      ? [{ key: "desc_q_ka", label: "ক" }, { key: "desc_q_kha", label: "খ" }]
                      : data?.is_math
                        ? [{ key: "q_ka", label: "ক" }, { key: "q_kha", label: "খ" }, { key: "q_ga", label: "গ" }]
                        : [{ key: "q_ka", label: "ক" }, { key: "q_kha", label: "খ" }, { key: "q_ga", label: "গ" }, { key: "q_gha", label: "ঘ" }];
                    const hasSubs = subFields.some(f => data?.[f.key]);
                    if (!hasSubs) return null;
                    return (
                      <div className="mt-3 space-y-2 pl-4 border-l-2 border-primary/20">
                        {subFields.map(f => {
                          const val = data?.[f.key];
                          if (!val) return null;
                          return (
                            <div key={f.key} className="text-sm">
                              <span className="font-semibold">({f.label}) </span>
                              <LatexRenderer text={val} inline />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
              );
            })}
            {filteredQuestions.length === 0 && (
              <p className="text-center text-muted-foreground py-8">কোনো প্রশ্ন পাওয়া যায়নি</p>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => { setCurrentPage(p => p - 1); scrollMainToTop(); }}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> আগের
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, i, arr) => {
                    const prev = arr[i - 1];
                    const showEllipsis = prev && p - prev > 1;
                    return (
                      <span key={p} className="flex items-center gap-1">
                        {showEllipsis && <span className="px-1 text-muted-foreground">...</span>}
                        <Button
                          variant={p === currentPage ? "default" : "outline"}
                          size="sm"
                          className="w-9 h-9 p-0"
                          onClick={() => { setCurrentPage(p); scrollMainToTop(); }}
                        >
                          {p}
                        </Button>
                      </span>
                    );
                  })}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => { setCurrentPage(p => p + 1); scrollMainToTop(); }}
              >
                পরের <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
          {filteredQuestions.length > 0 && (
            <p className="text-center text-xs text-muted-foreground pb-2">
              মোট {filteredQuestions.length}টি প্রশ্নের মধ্যে {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredQuestions.length)} দেখাচ্ছে
            </p>
          )}
        </div>

        {/* Right sidebar - Advanced Filter (independently scrollable on desktop) */}
        <aside className="hidden lg:block lg:overflow-y-auto lg:pr-1 lg:scroll-smooth">
          <div className="space-y-4 pb-2">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-heading font-bold text-center mb-3 border-b border-border pb-2">এডভান্সড ফিল্টার মেনু</h3>
                {filterSidebarContent}
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>

      {/* Report Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">প্রশ্ন রিপোর্ট করুন</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ভুলের ধরন</Label>
              <Select value={reportErrorType} onValueChange={setReportErrorType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {reportErrorTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>মন্তব্য (ঐচ্ছিক)</Label>
              <Textarea value={reportComment} onChange={e => setReportComment(e.target.value)} placeholder="বিস্তারিত লিখুন..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>বাতিল</Button>
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleReport} disabled={reportLoading}>
              {reportLoading ? "সাবমিট হচ্ছে..." : "রিপোর্ট সাবমিট"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
    );
  }

  // ─── STEP 1: Form ───
  return (
    <div className="max-w-2xl mx-auto">
      {addToPaper ? (
        <div className="bg-primary/10 border border-primary/30 rounded-2xl p-6 text-center mb-6">
          <h1 className="font-heading text-xl font-bold text-foreground">📝 বিদ্যমান প্রশ্নপত্রে আরও প্রশ্ন যুক্ত করুন</h1>
          <p className="text-sm text-muted-foreground mt-1">নতুন প্রশ্ন সিলেক্ট করে "প্রশ্নপত্র দেখুন" ক্লিক করলে আগের প্রশ্নের সাথে যুক্ত হবে</p>
        </div>
      ) : (
        <div className="gradient-hero rounded-2xl p-8 text-center text-white mb-6">
          <h1 className="font-heading text-2xl font-bold">&nbsp;প্রশ্ন তৈরি করতে প্রথমে স্মার্ট ফর্ম পূরণ করুন।</h1>
        </div>
      )}

      <Card>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground text-center mb-2">নিচের ইনপুট ফিল্ড গুলো ফিল্ড সিলেক্ট করে সাবমিট করুন</p>
          <div className="space-y-3">
            <div>
              <Input placeholder="প্রোগ্রাম/পরীক্ষার নাম" value={form.programName} onChange={(e) => setForm({ ...form, programName: e.target.value })} />
            </div>
            <div>
              <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v, subjectId: "", chapterIds: [] })}>
                <SelectTrigger><SelectValue placeholder="শ্রেণী সিলেক্ট করুন" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div onClick={!form.classId ? () => setWarningDialog("subject") : undefined}>
              <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v, chapterIds: [] })} disabled={!form.classId}>
                <SelectTrigger><SelectValue placeholder="বিষয় সিলেক্ট করুন" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Multi-select chapter list */}
            <div onClick={!form.subjectId ? () => setWarningDialog("chapter") : undefined}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">অধ্যায় সিলেক্ট করুন</span>
                {form.chapterIds.length > 0 && (
                  <span className="text-xs text-muted-foreground">{form.chapterIds.length}টি সিলেক্টেড</span>
                )}
              </div>
              {!form.subjectId ? (
                <div className="border border-input rounded-md p-3 text-sm text-muted-foreground bg-muted/30 cursor-not-allowed">
                  আগে বিষয় সিলেক্ট করুন
                </div>
              ) : (
                <ScrollArea className="border border-input rounded-md h-52">
                  <div className="p-2 space-y-1">
                    {chapters.map((c) => {
                      const isSelected = form.chapterIds.includes(String(c.id));
                      const isLocked = !hasSubscription && !c.is_free;
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm ${
                            isLocked
                              ? "opacity-60 cursor-not-allowed bg-muted/30"
                              : isSelected
                                ? "bg-primary/10 text-primary font-medium cursor-pointer"
                                : "hover:bg-muted/50 cursor-pointer"
                          }`}
                          onClick={(e) => {
                            if (isLocked) {
                              e.preventDefault();
                              toast.error("এই অধ্যায়ের জন্য সাবস্ক্রিপশন প্রয়োজন। প্যাকেজ কিনুন!", { id: "locked-chapter" });
                            }
                          }}
                        >
                          {isLocked ? (
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                          ) : (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleChapter(String(c.id))}
                            />
                          )}
                          <span className={isLocked ? "text-muted-foreground" : ""}>{c.name}</span>
                          {isLocked && (
                            <span className="ml-auto text-xs text-amber-500 whitespace-nowrap">সাবস্ক্রিপশন নেই</span>
                          )}
                        </label>
                      );
                    })}
                    {chapters.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">কোনো অধ্যায় পাওয়া যায়নি</p>
                    )}
                  </div>
                </ScrollArea>
              )}
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
              <Label>পূর্ণমান</Label>
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
