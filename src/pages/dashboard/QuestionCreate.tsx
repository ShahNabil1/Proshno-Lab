import { useState, useEffect } from "react";
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
import { CheckCircle, MessageSquare, Search, Eye, AlertTriangle, Flag, Save, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate, useSearchParams } from "react-router-dom";
import LatexRenderer from "@/components/LatexRenderer";
import ReferenceBadges from "@/components/ReferenceBadges";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

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

  // Load existing paper question IDs when in add_to_paper mode
  useEffect(() => {
    if (addToPaper) {
      const raw = sessionStorage.getItem("existingPaperQuestions");
      if (raw) {
        const ids = (JSON.parse(raw) as QuestionRow[]).map(q => q.id);
        setExistingQuestionIds(new Set(ids));
      }
    }
  }, [addToPaper]);

  // Filter states for sidebar
  const [filterSearch, setFilterSearch] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterTopicIds, setFilterTopicIds] = useState<Set<number>>(new Set());
  const [filterBoards, setFilterBoards] = useState<Set<string>>(new Set());
  const [filterYear, setFilterYear] = useState("");
  const [filterSpecial, setFilterSpecial] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
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
      .then(({ data }) => setClasses(data || []));
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
    supabase.from("chapters").select("id, name, is_free").eq("subject_id", Number(form.subjectId)).order("name")
      .then(({ data }) => setChapters((data as any[]) || []));
  }, [form.subjectId]);

  // Check user_permissions for specific class + subject access
  useEffect(() => {
    if (!user?.id || !form.classId || !form.subjectId) { setHasSubscription(false); return; }
    supabase
      .from("user_permissions")
      .select("id")
      .eq("user_id", user.id)
      .eq("class_id", Number(form.classId))
      .eq("subject_id", Number(form.subjectId))
      .limit(1)
      .then(({ data }) => setHasSubscription(!!(data && data.length > 0)));
  }, [user?.id, form.classId, form.subjectId]);

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
      const dbTypes = typeDbValues[form.type] || [form.type];
      let query = supabase.from("questions").select("*")
        .eq("class_id", Number(form.classId))
        .eq("subject_id", Number(form.subjectId))
        .in("type", dbTypes);
      if (form.chapterIds.length > 0) {
        query = query.in("chapter_id", form.chapterIds.map(Number));
      }
      query = query.limit(parseInt(form.count) || 10);

      const { data, error } = await query;
      if (error) throw error;
      // Filter out questions already in the paper
      const filtered = addToPaper
        ? (data || []).filter(q => !existingQuestionIds.has(q.id))
        : data || [];
      if (filtered.length === 0) {
        toast.info("এই ফিল্টারে কোনো নতুন প্রশ্ন পাওয়া যায়নি");
        return;
      }
      const shuffled = filtered.sort(() => Math.random() - 0.5);
      setQuestions(shuffled);
      setSelectedIds(new Set());
      toast.success(`${shuffled.length}টি প্রশ্ন পাওয়া গেছে!`);
      setStep("questionSet");
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

    if (filterTopicIds.size > 0) {
      result = result.filter(r => r.topic_id && filterTopicIds.has(r.topic_id));
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
  useEffect(() => { setCurrentPage(1); }, [filterSearch, filterType, filterTopicIds, filterBoards, filterYear, filterSpecial]);

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
          <h4 className="font-heading font-bold text-sm mb-2">eExamapp স্পেশাল সার্চ</h4>
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

        {/* Topics grouped by chapter */}
        {Object.keys(topicsByChapter).length > 0 && (
          <div className="border border-border rounded-lg p-3">
            <h4 className="font-heading font-bold text-sm mb-3">টপিক</h4>
            <div className="space-y-3">
              {Object.entries(topicsByChapter).map(([chId, data]) => (
                <div key={chId}>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5 border-b border-border pb-1">📖 {data.chapterName}</p>
                  {data.topics.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70 pl-4">কোনো টপিক নেই</p>
                  ) : (
                    <div className="space-y-1.5 pl-4">
                      {data.topics.map(t => (
                        <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={filterTopicIds.has(t.id)} onCheckedChange={() => { setFilterTopicIds(prev => { const next = new Set(prev); next.has(t.id) ? next.delete(t.id) : next.add(t.id); return next; }); }} />
                          {t.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-6">
        {/* Main content */}
        <div className="space-y-4">
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

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center text-sm text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
            প্রশ্নে ভুল পেলে রিপোর্ট করে eExamapp কে সমৃদ্ধ করুন ।
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

          <div className="space-y-4">
            {filteredQuestions.map((q, idx) => (
              <Card key={q.id} className={`transition-colors cursor-pointer ${selectedIds.has(q.id) ? "border-primary/50 bg-primary/5" : ""}`} onClick={() => toggleQuestion(q.id)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Checkbox checked={selectedIds.has(q.id)} onCheckedChange={() => toggleQuestion(q.id)} onClick={(e) => e.stopPropagation()} />
                    <div className="flex items-center gap-2">
                      <ReferenceBadges
                        boardRefs={q.board_references as any}
                        uniRefs={q.university_references as any}
                      />
                      <button
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="রিপোর্ট করুন"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportQuestionId(q.id);
                          setReportErrorType("বানান ভুল");
                          setReportComment("");
                          setReportDialogOpen(true);
                        }}
                      >
                        <Flag className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {/* For descriptive, don't show q.question as it duplicates desc_q_ka */}
                  {q.type !== "descriptive" && (
                    <div className="font-medium mb-3 flex items-baseline gap-0">
                      <span className="shrink-0">{idx + 1}. </span>
                      <div className="flex-1"><LatexRenderer text={q.question} /></div>
                    </div>
                  )}
                  {q.type === "descriptive" && (
                    <span className="font-medium">{idx + 1}. </span>
                  )}
                  {/* MCQ options */}
                  {q.type === "mcq" && q.option_a && (
                    <div className="grid grid-cols-2 gap-2">
                      {["option_a", "option_b", "option_c", "option_d"].map((key, oi) => {
                        const val = (q as any)[key];
                        if (!val) return null;
                        const label = ["ক", "খ", "গ", "ঘ"][oi];
                        const isAnswer = q.correct_answer === val || q.correct_answer === label;
                        return (
                          <div key={key} className={`flex items-center gap-2 p-2 rounded text-sm ${isAnswer ? "bg-green-100 text-green-800 font-semibold dark:bg-green-900 dark:text-green-200" : "bg-muted/50"}`}>
                            <span className="font-medium">{label})</span> <LatexRenderer text={val} inline />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* CQ / Descriptive sub-questions */}
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
            ))}
            {filteredQuestions.length === 0 && (
              <p className="text-center text-muted-foreground py-8">কোনো প্রশ্ন পাওয়া যায়নি</p>
            )}
          </div>
        </div>

        {/* Right sidebar - Advanced Filter */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
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
          <h1 className="font-heading text-2xl font-bold">✨ প্রশ্ন তৈরি করতে প্রথমে স্মার্ট ফর্ম পূরণ করুন।</h1>
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
