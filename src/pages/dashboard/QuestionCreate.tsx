import { isCorrectOption } from "@/lib/answerKey";
import { toast } from "sonner";
import { useState, useEffect, useRef, useMemo } from "react";
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
import {
  CheckCircle, MessageSquare, Search, Eye, AlertTriangle, Flag, Save,
  SlidersHorizontal, ChevronLeft, ChevronRight, RotateCcw,
  BookOpen, GraduationCap, Clock, Award, FileText, CheckCheck, Layers,
  ListFilter, CheckCircle2, ArrowRight, ArrowLeft, School, HelpCircle, Filter, Scan
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate, useSearchParams } from "react-router-dom";
import LatexRenderer from "@/components/LatexRenderer";
import ReferenceBadges from "@/components/ReferenceBadges";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { planCoversSelection } from "@/lib/subscriptionMatcher";
import { useUnlimitedAccess } from "@/hooks/useUnlimitedAccess";
import { sortClasses, sortChapters } from "@/lib/classOrder";
import SubjectPicker from "@/components/dashboard/SubjectPicker";
import ClassPicker from "@/components/dashboard/ClassPicker";
import {
  filterSubjectsByVersion,
  getRelatedVersionClassIds,
  isEnglishVersionClass,
  type SubjectVersion,
} from "@/lib/subjectVersion";

const toBanglaNum = (n: number | string) => String(n).replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[+d]);

const typeOptions = ["mcq", "cq", "short", "descriptive", "all"];
const typeLabels: Record<string, string> = {
  mcq: "বহুনির্বাচনী",
  cq: "সৃজনশীল",
  short: "সংক্ষিপ্ত",
  descriptive: "বর্ণনামূলক",
  all: "সমন্বিত প্রশ্ন (সৃজঃ + বহুঃ + সংক্ষিপ্ত + অন্যান্য)",
};
const typeDbValues: Record<string, string[]> = {
  mcq: ["mcq"],
  cq: ["cq"],
  short: ["short"],
  descriptive: ["descriptive"],
  all: ["mcq", "cq", "short", "descriptive"],
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

// --- Board / year reference normalization -------------------------------
// Stored references use many shapes: "সিলেট", "সি. বো.", "সি. বো.'", "SB",
// and years in Bangla digits ("২০২১") or 2-digit short form ("২৫").
const bnDigitsToLatin = (s: string) =>
  s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));

const normalizeYear = (value: any): string => {
  const digits = bnDigitsToLatin(String(value ?? "")).replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  if (digits.length === 2) return `20${digits}`;
  return "";
};

const BOARD_ALIASES: Record<string, string> = {};
const registerBoard = (canonical: string, aliases: string[]) => {
  aliases.forEach((a) => { BOARD_ALIASES[a] = canonical; });
};
registerBoard("ঢাকা বোর্ড", ["ঢাকা", "ঢা", "db", "dhaka", "ঢাকাবোর্ড"]);
registerBoard("বরিশাল বোর্ড", ["বরিশাল", "ব", "bb", "barishal", "barisal"]);
registerBoard("দিনাজপুর বোর্ড", ["দিনাজপুর", "দি", "dib", "dinajpur"]);
registerBoard("কুমিল্লা বোর্ড", ["কুমিল্লা", "কু", "cub", "cumilla", "comilla"]);
registerBoard("যশোর বোর্ড", ["যশোর", "য", "jb", "jessore", "jashore"]);
registerBoard("সিলেট বোর্ড", ["সিলেট", "সি", "sb", "sylhet"]);
registerBoard("রাজশাহী বোর্ড", ["রাজশাহী", "রা", "rb", "rajshahi"]);
registerBoard("ময়মনসিংহ বোর্ড", ["ময়মনসিংহ", "ম", "mb", "mymensingh"]);
registerBoard("চট্টগ্রাম বোর্ড", ["চট্টগ্রাম", "চ", "ctg", "chattogram", "chittagong"]);

const canonicalBoard = (value: any): string | null => {
  let key = String(value ?? "")
    .replace(/[০-৯0-9]/g, "")
    .replace(/বোর্ড/g, "")
    .replace(/বো/g, "")
    .replace(/[.\s'’‘"`,\-–—()]/g, "")
    .trim()
    .toLowerCase();
  if (!key) return null;
  return BOARD_ALIASES[key] ?? null;
};

const refMatchesBoardYear = (
  refs: any,
  boards: Set<string>,
  year: string
): boolean => {
  const list = Array.isArray(refs) ? refs : [];
  return list.some((ref: any) => {
    const canonical = canonicalBoard(ref?.board);
    if (!canonical) return false;
    const boardOk = boards.size === 0 || boards.has(canonical);
    const yearOk = !year || normalizeYear(ref?.year) === normalizeYear(year);
    return boardOk && yearOk;
  });
};

const countUniqueBoards = (refs: any): number => {
  const list = Array.isArray(refs) ? refs : [];
  const set = new Set(list.map((r: any) => canonicalBoard(r?.board) ?? String(r?.board ?? "")));
  set.delete("");
  return set.size;
};

const schoolNamesFromRefs = (refs: any): string[] => {
  const list = Array.isArray(refs) ? refs : [];
  return list
    .map((ref: any) => String(ref?.board ?? ref?.name ?? "").trim())
    .filter((name: string) =>
      name.length > 0
      && !canonicalBoard(name)
      && !/বোর্ড/i.test(name)
      && /(স্কুল|কলেজ|বিদ্যালয়|বিদ্যালয়|ক্যাডেট|একাডেমি|মাদ্রাসা|ইনস্টিটিউট)/i.test(name)
    );
};

const refMatchesSchools = (refs: any, schools: Set<string>, year = ""): boolean => {
  const list = Array.isArray(refs) ? refs : [];
  return list.some((ref: any) => {
    const name = String(ref?.board ?? ref?.name ?? "").trim();
    if (!schoolNamesFromRefs([ref]).includes(name)) return false;
    const schoolOk = schools.size === 0 || schools.has(name);
    const yearOk = !year || normalizeYear(ref?.year) === normalizeYear(year);
    return schoolOk && yearOk;
  });
};

const latestQuestionYear = (question: QuestionRow): number => {
  const refs = [
    ...(Array.isArray(question.board_references) ? question.board_references : []),
    ...(Array.isArray(question.university_references) ? question.university_references : []),
  ];
  return refs.reduce((latest: number, ref: any) => {
    const year = Number(normalizeYear(ref?.year));
    return Number.isFinite(year) ? Math.max(latest, year) : latest;
  }, 0);
};


export default function QuestionCreate({ onQuestionListChange }: { onQuestionListChange?: (open: boolean) => void }) {
  const { user } = useAuth();
  const { unlimited: unlimitedAccess } = useUnlimitedAccess();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addToPaper = searchParams.get("add_to_paper") === "true";
  const [step, setStep] = useState<Step>("form");
  useEffect(() => {
    onQuestionListChange?.(step === "questionList");
    return () => onQuestionListChange?.(false);
  }, [step, onQuestionListChange]);
  const [form, setForm] = useState({
    programName: "",
    classId: "",
    subjectId: "",
    subjectIds: [] as string[],
    chapterIds: [] as string[],
    type: "mcq",
    count: "100",
  });
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; class_id: number; name: string; subject_code?: string | null }[]>([]);
  const [chapters, setChapters] = useState<{ id: number; name: string; is_free: boolean; subject_id?: number }[]>([]);
  const [topics, setTopics] = useState<{ id: number; name: string; chapter_id: number }[]>([]);
  const [warningDialog, setWarningDialog] = useState<WarningField>(null);
  const [hasSubscription, setHasSubscription] = useState<boolean>(false);
  const [subjectVersion, setSubjectVersion] = useState<SubjectVersion>("bangla");

  const selectedSubjectIds = useMemo(() => {
    if (form.subjectIds && form.subjectIds.length > 0) return form.subjectIds;
    if (form.subjectId) return form.subjectId.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
  }, [form.subjectId, form.subjectIds]);

  const selectedSubjects = useMemo(() => {
    return subjects.filter((s) => selectedSubjectIds.includes(String(s.id)));
  }, [selectedSubjectIds, subjects]);

  const selectedSubject = selectedSubjects[0];
  const effectiveClassId = selectedSubject?.class_id || Number(form.classId || 0);
  const selectableClasses = useMemo(
    () => classes.filter((item) => !/english|eglish|version|ইংলিশ/i.test(item.name || "")),
    [classes],
  );
  const filteredSubjects = filterSubjectsByVersion(subjects, classes, subjectVersion);

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [existingQuestionIds, setExistingQuestionIds] = useState<Set<number>>(new Set());

  // ---- Draft persistence: keep step/form/selection alive across page refresh ----
  const DRAFT_KEY = "questionCreateDraft";
  const draftRestoredRef = useRef(false);
  const [restoringDraft, setRestoringDraft] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = sessionStorage.getItem("questionCreateDraft");
      if (!raw) return false;
      const d = JSON.parse(raw);
      return d?.step && d.step !== "form";
    } catch { return false; }
  });

  useEffect(() => {
    if (addToPaper) { draftRestoredRef.current = true; setRestoringDraft(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const d = JSON.parse(raw);
        if (!d?.form?.classId || !d?.form?.subjectId || !d.step || d.step === "form") return;
        setForm(d.form);
        if (d.step === "questionSet" && !Array.isArray(d.questionIds)) {
          if (!cancelled) setStep("questionSet");
          return;
        }
        const rows = await fetchQuestionRows(d.form);
        if (cancelled) return;
        const order: number[] = Array.isArray(d.questionIds) ? d.questionIds : [];
        if (order.length > 0) {
          const pos = new Map(order.map((id, i) => [id, i]));
          rows.sort((a, b) => (pos.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (pos.get(b.id) ?? Number.MAX_SAFE_INTEGER));
        }
        setQuestions(rows);
        setSelectedIds(new Set<number>(Array.isArray(d.selectedIds) ? d.selectedIds : []));
        if (d.filterType !== undefined) setFilterType(d.filterType);
        if (d.currentPage) setCurrentPage(d.currentPage);
        setStep(d.step);
      } catch {
        // ignore corrupt draft
      } finally {
        if (!cancelled) { draftRestoredRef.current = true; setRestoringDraft(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [addToPaper]);

  // Save draft whenever meaningful state changes (after restore has completed)
  useEffect(() => {
    if (addToPaper || !draftRestoredRef.current) return;
    try {
      if (step === "form") {
        sessionStorage.removeItem(DRAFT_KEY);
        return;
      }
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        step,
        form,
        questionIds: questions.map(q => q.id),
        selectedIds: Array.from(selectedIds),
        filterType,
        currentPage,
      }));
    } catch { /* storage full – ignore */ }
  });

  // Keep the draft when navigating to the paper preview so browser Back can
  // restore the manual form, filters and selected question IDs. Returning to
  // the form still clears the draft in the persistence effect above.

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
  const [filterSchools, setFilterSchools] = useState<Set<string>>(new Set());
  const [filterYear, setFilterYear] = useState("");
  const [filterSchoolYear, setFilterSchoolYear] = useState("");
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
  const [chapterModalOpen, setChapterModalOpen] = useState(false);
  const [institute, setInstitute] = useState<{ name: string; upazila?: string | null; district?: string | null; division?: string | null } | null>(null);

  // Fetch institute
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("institutes").select("name, upazila, district, division").eq("owner_id", user.id).order("id", { ascending: true }).limit(1).maybeSingle()
      .then(({ data }) => { if (data) setInstitute(data); });
  }, [user?.id]);

  // Load classes
  useEffect(() => {
    supabase.from("classes").select("id, name").order("name")
      .then(({ data }) => setClasses(sortClasses(data || [])));
  }, []);

  // English-version subjects live under parallel class records in the database,
  // but users choose the class level only once from the Bangla class list.
  useEffect(() => {
    if (!form.classId || classes.length === 0) return;
    const selectedClass = classes.find((item) => String(item.id) === form.classId);
    if (!selectedClass || !isEnglishVersionClass(selectedClass.name)) return;
    const banglaClass = classes.find((item) =>
      !isEnglishVersionClass(item.name)
      && getRelatedVersionClassIds(selectedClass.id, classes).includes(item.id),
    );
    if (!banglaClass) return;
    setSubjectVersion("english");
    setForm((previous) => ({ ...previous, classId: String(banglaClass.id) }));
  }, [classes, form.classId]);

  // Load subjects when class changes
  useEffect(() => {
    if (!form.classId) { setSubjects([]); return; }
    const relatedClassIds = getRelatedVersionClassIds(form.classId, classes);
    supabase.from("subjects").select("id, class_id, name, subject_code").in("class_id", relatedClassIds).order("name")
      .then(({ data }) => setSubjects((data as any) || []));
  }, [form.classId, classes]);

  // Load chapters when subjects change
  useEffect(() => {
    if (selectedSubjectIds.length === 0) { setChapters([]); setTopics([]); return; }
    supabase.from("chapters").select("id, name, is_free, subject_id").in("subject_id", selectedSubjectIds.map(Number)).eq("is_active", true).order("name")
      .then(({ data }) => setChapters(sortChapters((data as any[]) || [])));
  }, [selectedSubjectIds.join(",")]);

  // Check access: user_permissions OR active subscriptions
  useEffect(() => {
    if (unlimitedAccess) { setHasSubscription(true); return; }
    if (!user?.id || !effectiveClassId || selectedSubjectIds.length === 0) { setHasSubscription(false); return; }

    let cancelled = false;

    const checkAccess = async () => {
      const [{ data: permData }, { data: subs }] = await Promise.all([
        supabase
          .from("user_permissions")
          .select("id, subject_id")
          .eq("user_id", user.id)
          .eq("class_id", effectiveClassId)
          .in("subject_id", selectedSubjectIds.map(Number)),
        supabase
          .from("subscriptions")
          .select("plan")
          .eq("teacher_id", user.id)
          .eq("status", "active"),
      ]);

      if (cancelled) return;

      const permSubjectIds = new Set((permData || []).map(p => String((p as any).subject_id)));
      const selectedClass = classes.find(c => c.id === effectiveClassId);

      const allHaveAccess = selectedSubjectIds.every(subId => {
        if (permSubjectIds.has(subId)) return true;
        const sub = subjects.find(s => String(s.id) === String(subId));
        if (!selectedClass || !sub || !subs || subs.length === 0) return false;
        return subs.some(s => planCoversSelection(s.plan || "", selectedClass.name, sub.name));
      });

      setHasSubscription(allHaveAccess);
    };

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, [user?.id, effectiveClassId, selectedSubjectIds.join(","), classes, subjects, unlimitedAccess]);

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

  const toggleAllChapters = () => {
    const selectable = chapters
      .filter(c => hasSubscription || c.is_free)
      .map(c => String(c.id));
    if (selectable.length === 0) return;
    const allSelected = selectable.length > 0 && selectable.every(id => form.chapterIds.includes(id));
    setForm(prev => ({
      ...prev,
      chapterIds: allSelected ? [] : selectable,
    }));
  };

  const fetchQuestionRows = async (f: { classId: string; subjectId: string; subjectIds?: string[]; chapterIds: string[]; count?: string | number; type?: string }) => {
    const sIds = (f.subjectIds && f.subjectIds.length > 0)
      ? f.subjectIds
      : (f.subjectId ? f.subjectId.split(",").map(s => s.trim()).filter(Boolean) : []);

    const buildQuery = (from: number, to: number) => {
      const subjectClassIds = Array.from(new Set(
        sIds
          .map((subjectId) => subjects.find((subject) => String(subject.id) === String(subjectId))?.class_id)
          .filter((classId): classId is number => Boolean(classId)),
      ));
      let query = supabase.from("questions").select("*, chapters!inner(is_active)")
        .in("class_id", subjectClassIds.length > 0 ? subjectClassIds : [Number(f.classId)])
        .in("subject_id", sIds.map(Number))
        .eq("chapters.is_active", true);

      if (f.chapterIds && f.chapterIds.length > 0) {
        query = query.in("chapter_id", f.chapterIds.map(Number));
      }
      if (f.type && f.type !== "all" && typeDbValues[f.type]) {
        query = query.in("type", typeDbValues[f.type]);
      }
      return query.order("id", { ascending: true }).range(from, to);
    };

    // Show every matching database question. The 200 limit applies only when
    // the user selects questions for a paper, not while browsing/filtering.
    const allRows: QuestionRow[] = [];
    const pageSize = 1000;
    for (let from = 0; from < 50000; from += pageSize) {
      const { data, error } = await buildQuery(from, from + pageSize - 1);
      if (error) throw error;
      const batch = (data || []) as QuestionRow[];
      allRows.push(...batch);
      if (batch.length < pageSize) break;
    }
    return allRows;
  };

  const handleCreateQuestionSet = async () => {
    if (!form.classId || selectedSubjectIds.length === 0) {
      toast.error("শ্রেণী ও বিষয় নির্বাচন করুন");
      return;
    }
    const safeCount = Math.min(200, Math.max(1, parseInt(form.count || "100", 10) || 100));
    setLoading(true);
    try {
      const allRows = await fetchQuestionRows({
        ...form,
        count: safeCount,
        subjectIds: selectedSubjectIds,
      });

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
        setFilterType("mcq");
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

      if (isAdding && next.size >= 200) {
        toast.warning("সর্বোচ্চ ২০০টি প্রশ্ন নির্বাচন করা যাবে");
        return prev;
      }

      if (question?.stimulus_group_id) {
        // Auto-select/deselect all questions in the same group
        const groupQs = questions.filter(q => q.stimulus_group_id === question.stimulus_group_id);
        if (isAdding && next.size + groupQs.filter(gq => !next.has(gq.id)).length > 200) {
          toast.warning("এই গ্রুপটি নিলে ২০০ প্রশ্নের সীমা অতিক্রম করবে");
          return prev;
        }
        groupQs.forEach(gq => { if (isAdding) next.add(gq.id); else next.delete(gq.id); });
      } else {
        if (isAdding) next.add(id); else next.delete(id);
      }
      return next;
    });
  };

  const className = classes.find(c => String(c.id) === form.classId)?.name || "";
  const subjectName = selectedSubjects.map(s => s.name).join(", ");
  const subjectCode = selectedSubjects.map(s => s.subject_code).filter(Boolean).join(", ");
  const selectedChapterNames = chapters
    .filter(c => form.chapterIds.includes(String(c.id)))
    .map(c => c.name);
  const schoolList = useMemo(() => Array.from(new Set(
    questions.flatMap(q => schoolNamesFromRefs(q.board_references))
  )).sort((a, b) => a.localeCompare(b, "bn")), [questions]);
  const boardYears = useMemo(() => Array.from(new Set(
    questions.flatMap(question => {
      const refs = Array.isArray(question.board_references) ? question.board_references : [];
      return refs
        .filter((ref: any) => canonicalBoard(ref?.board))
        .map((ref: any) => normalizeYear(ref?.year))
        .filter(Boolean);
    })
  )).sort((a, b) => Number(b) - Number(a)), [questions]);
  const schoolYears = useMemo(() => Array.from(new Set(
    questions.flatMap(question => {
      const refs = Array.isArray(question.board_references) ? question.board_references : [];
      return refs
        .filter((ref: any) => schoolNamesFromRefs([ref]).length > 0)
        .map((ref: any) => normalizeYear(ref?.year))
        .filter(Boolean);
    })
  )).sort((a, b) => Number(b) - Number(a)), [questions]);
  const selectedTypeCounts = useMemo(() => {
    const counts = { mcq: 0, cq: 0, short: 0, descriptive: 0 };
    questions.forEach(question => {
      if (!selectedIds.has(question.id)) return;
      if (question.type in counts) counts[question.type as keyof typeof counts] += 1;
    });
    return counts;
  }, [questions, selectedIds]);
  const totalTypeCounts = useMemo(() => {
    const counts = { mcq: 0, cq: 0, short: 0, descriptive: 0 };
    questions.forEach(question => {
      if (question.type in counts) counts[question.type as keyof typeof counts] += 1;
    });
    return counts;
  }, [questions]);

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

    if (filterBoards.size > 0 || filterYear) {
      result = result.filter(r => refMatchesBoardYear(r.board_references, filterBoards, filterYear));
    }

    if (filterSchools.size > 0 || filterSchoolYear) {
      result = result.filter(r => refMatchesSchools(r.board_references, filterSchools, filterSchoolYear));
    }

    // Special search filters (radio - only one active at a time)
    if (filterSpecial === "board") {
      // Repeated board questions: appeared in 2+ different boards
      result = result.filter(r => countUniqueBoards(r.board_references) >= 2);
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

    // Latest referenced questions first: 2026 → 2025 → 2024 → ...
    // Questions without a reference year follow, newest database row first.
    result.sort((a, b) => {
      const yearDifference = latestQuestionYear(b) - latestQuestionYear(a);
      return yearDifference !== 0 ? yearDifference : b.id - a.id;
    });

    return result;
  };

  const filteredQuestions = getFilteredQuestions();
  const totalPages = Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE);
  const paginatedQuestions = filteredQuestions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [filterSearch, filterType, filterChapterIds, filterTopicIds, filterUntopicedChapterIds, filterBoards, filterSchools, filterYear, filterSchoolYear, filterSpecial]);

  const handleSaveAndView = () => {
    if (selectedIds.size === 0) {
      toast.error("অন্তত একটি প্রশ্ন সিলেক্ট করুন");
      return;
    }
    const selected = questions.filter(q => selectedIds.has(q.id));
    // Store in sessionStorage for the view page
    sessionStorage.setItem("viewPaperQuestions", JSON.stringify(selected));
    sessionStorage.setItem("viewPaperContext", JSON.stringify({ classId: String(effectiveClassId), subjectId: selectedSubjectIds.join(","), chapterIds: (form.chapterIds || []).map(String) }));
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

  if (restoringDraft) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center text-muted-foreground">
        আপনার প্রশ্নপত্র পুনরুদ্ধার করা হচ্ছে...
      </div>
    );
  }

  // ─── STEP 2: Question Set Header ───
  if (step === "questionSet") {
    return (
      <div className="max-w-2xl mx-auto space-y-4 py-2 sm:py-5">
        {/* Step Progress Bar */}
        <div className="bg-white rounded-[1px] p-3.5 border border-slate-300 shadow-xs">
          <div className="flex items-center justify-between max-w-lg mx-auto text-sm">
            <div className="flex items-center gap-2 text-emerald-700 font-bold cursor-pointer" onClick={() => setStep("form")}>
              <span className="w-5 h-5 rounded-[1px] bg-emerald-100 flex items-center justify-center text-xs">✓</span>
              <span>১. বিষয় ও অধ্যায়</span>
            </div>
            <div className="w-8 sm:w-12 h-0.5 bg-emerald-400" />
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <span className="w-5 h-5 rounded-[1px] bg-slate-800 text-white flex items-center justify-center text-xs">২</span>
              <span>২. প্রশ্নসেট ওভারভিউ</span>
            </div>
            <div className="w-8 sm:w-12 h-0.5 bg-slate-200" />
            <div className="flex items-center gap-2 text-slate-400 font-medium">
              <span className="w-5 h-5 rounded-[1px] bg-slate-100 flex items-center justify-center text-xs">৩</span>
              <span className="hidden sm:inline">৩. প্রশ্ন নির্বাচন</span>
            </div>
          </div>
        </div>

        {/* Official Question Paper Header Preview Card */}
        <Card className="border border-slate-300 shadow-xs bg-white rounded-[1px] overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-sm text-slate-600 font-medium">
            <span className="flex items-center gap-1.5 font-bold text-slate-800">
              <School className="w-4 h-4 text-emerald-700" /> প্রশ্নপত্রের অফিসিয়াল কাঠামো
            </span>
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-[1px] font-semibold text-xs">
              প্রস্তুতকৃত
            </span>
          </div>

          <CardContent className="p-6 sm:p-8 space-y-5">
            <div className="text-center space-y-1.5 pb-1">
              <h2 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">
                {institute?.name || "আপনার প্রতিষ্ঠানের নাম"}
              </h2>
              {form.programName && (
                <p className="text-lg font-semibold text-slate-700">
                  {form.programName}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-base text-slate-700 pt-1">
                {className && <span>শ্রেণি: <strong className="text-slate-900 font-bold">{className}</strong></span>}
                {subjectName && <span>বিষয়: <strong className="text-slate-900 font-bold">{subjectName}</strong></span>}
                {subjectCode && <span className="text-sm text-slate-500">(বিষয় কোড: {subjectCode})</span>}
              </div>

              {selectedChapterNames.length > 0 && (
                <div className="pt-2 flex flex-wrap justify-center items-center gap-1.5">
                  <span className="text-sm text-slate-500">অধ্যায়:</span>
                  {selectedChapterNames.map((name, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center text-sm bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-[1px] border border-slate-200 font-medium"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-base font-semibold text-slate-700 border-y border-dashed border-slate-300 py-2.5 px-3 bg-slate-50 rounded-[1px]">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-500" />
                সময়: ১০ মিনিট
              </span>
              <span className="flex items-center gap-1.5 text-emerald-800">
                <Award className="w-4 h-4 text-emerald-700" />
                পূর্ণমান: {toBanglaNum(form.count || 25)}
              </span>
            </div>

            <p className="text-center text-sm text-slate-500 italic">
              [ দ্রষ্টব্য: প্রশ্নপত্রে কোনো প্রকার দাগ বা চিহ্ন দেয়া যাবেনা। প্রতিটি প্রশ্নের মান সমান। ]
            </p>

            {/* Success Callout Box */}
            <div className="rounded-[1px] p-4 bg-emerald-50 border border-emerald-300 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-emerald-800">
                <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0" />
                <span className="text-lg font-bold">
                  প্রশ্নসেট সফলভাবে তৈরি হয়েছে!
                </span>
              </div>
              <p className="text-base text-slate-700 max-w-md mx-auto">
                ডেটাবেজে আপনার নির্বাচিত বিষয় ও অধ্যায়সমূহের মোট <strong className="text-emerald-800 font-bold">{toBanglaNum(questions.length)}টি</strong> প্রশ্ন প্রস্তুত রয়েছে। নিচের বাটনে ক্লিক করে পছন্দমতো প্রশ্ন বেছে নিন।
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
              <Button
                variant="outline"
                className="w-full sm:w-auto h-12 px-5 rounded-[1px] border-slate-300 text-slate-700 hover:bg-slate-100 text-base font-medium"
                onClick={() => setStep("form")}
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" /> তথ্যে পরিবর্তন করুন
              </Button>
              <Button
                className="w-full sm:w-auto h-12 px-7 rounded-[1px] bg-[#059669] hover:bg-[#047857] text-white font-bold text-base shadow-sm border-0 transition-all flex items-center justify-center gap-2"
                onClick={handleAddQuestions}
              >
                <span>প্রশ্ন পছন্দ ও বাছাই করুন</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── STEP 3: Question List with Advanced Filter Sidebar ───
  if (step === "questionList") {
    const filterSidebarContent = (
      <div className="space-y-4">
        {/* Keyword search */}
        <div className="flex gap-1.5">
          <Input
            placeholder="প্রশ্ন কিওয়ার্ড দিয়ে খুঁজুন..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="text-xs h-9 rounded-xl border-slate-200 focus:border-[#0A1E38]"
          />
          <Button size="sm" variant="outline" className="h-9 px-3 rounded-xl border-slate-200">
            <Search className="h-3.5 w-3.5 text-slate-500" />
          </Button>
        </div>

        {/* Unique Question Box */}
        <div className="border border-slate-200 bg-slate-50/80 rounded-xl p-3 text-center">
          <h4 className="font-heading font-bold text-slate-800 text-xs flex items-center justify-center gap-1">
            <Filter className="w-3.5 h-3.5 text-[#0A1E38]" /> ইউনিক প্রশ্ন ফিল্টার
          </h4>
          <p className="text-[11px] text-slate-500 mt-1">পূর্বের তৈরি কোনো প্রশ্ন বাদ দিয়ে শতভাগ নতুন প্রশ্ন সাজাতে পারবেন।</p>
        </div>

        {/* Special search */}
        <div className="border border-slate-200 bg-white rounded-xl p-3 shadow-xs">
          <div className="flex items-center gap-1.5 mb-2.5 pb-1.5 border-b border-slate-100">
            <Award className="w-3.5 h-3.5 text-[#0A1E38]" />
            <h4 className="font-heading font-bold text-xs text-[#0A1E38]">ProshnoLab স্পেশাল ফিল্টার</h4>
          </div>
          <div className="space-y-2">
            {specialSearchOptions.map(opt => {
              const active = filterSpecial === opt.id;
              return (
                <div
                  key={opt.id}
                  className={`flex items-center gap-2 text-xs cursor-pointer py-1 px-1.5 rounded-lg transition-colors ${active ? "bg-[#0A1E38]/5 text-[#0A1E38] font-semibold" : "text-slate-600 hover:text-slate-900"
                    }`}
                  onClick={() => setFilterSpecial(prev => prev === opt.id ? null : opt.id)}
                >
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${active ? 'border-[#0A1E38] bg-[#0A1E38]' : 'border-slate-300'}`}>
                    {active && <div className="w-1.5 h-1.5 rounded-full bg-[#F4C053]" />}
                  </div>
                  <span>{opt.label}</span>
                </div>
              );
            })}
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
                        className={`group flex items-center gap-2 text-sm rounded-md px-2 py-1.5 transition-colors ${disabled
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
                          className={`shrink-0 inline-flex items-center justify-center min-w-[2rem] px-2 h-[1.35rem] rounded-full text-[11.5px] font-bold tabular-nums tracking-tight border shadow-sm transition-all ${isActive
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
                                className={`group flex items-center gap-2 text-sm rounded-md px-2 py-1 transition-colors ${disabled
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
                                  className={`shrink-0 inline-flex items-center justify-center min-w-[1.85rem] px-1.5 h-[1.2rem] rounded-full text-[10.5px] font-bold tabular-nums tracking-tight border shadow-sm transition-all ${isActive
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
                              className={`group flex items-center gap-2 text-sm rounded-md px-2 py-1 transition-colors border border-dashed ${noneDisabled
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
                                className={`shrink-0 inline-flex items-center justify-center min-w-[1.85rem] px-1.5 h-[1.2rem] rounded-full text-[10.5px] font-bold tabular-nums tracking-tight border shadow-sm transition-all ${noneActive
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
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-heading font-bold text-sm">বোর্ড</h4>
            {(filterBoards.size > 0 || !!filterYear) && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => { setFilterBoards(new Set()); setFilterYear(""); }}
              >
                সাফ করুন
              </button>
            )}
          </div>
          <Select value={filterYear || "all"} onValueChange={(v) => setFilterYear(v === "all" ? "" : v)}>
            <SelectTrigger className="mb-2"><SelectValue placeholder="সব সাল" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব সাল</SelectItem>
              {boardYears.map(y => (
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

        {/* School filter */}
        {schoolList.length > 0 && (
          <div className="border border-border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-heading font-bold text-sm">স্কুল ও কলেজ</h4>
              {(filterSchools.size > 0 || !!filterSchoolYear) && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                  onClick={() => { setFilterSchools(new Set()); setFilterSchoolYear(""); }}
                >
                  সাফ করুন
                </button>
              )}
            </div>
            <Select value={filterSchoolYear || "all"} onValueChange={(v) => setFilterSchoolYear(v === "all" ? "" : v)}>
              <SelectTrigger className="mb-2"><SelectValue placeholder="সব সাল" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব সাল</SelectItem>
                {schoolYears.map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ScrollArea className="h-64 w-full" type="always">
              <div className="space-y-2 pr-2">
                {schoolList.map(school => (
                  <label key={school} className="flex items-start gap-2 text-sm cursor-pointer leading-tight">
                    <Checkbox
                      checked={filterSchools.has(school)}
                      onCheckedChange={() => setFilterSchools(prev => {
                        const next = new Set(prev);
                        next.has(school) ? next.delete(school) : next.add(school);
                        return next;
                      })}
                    />
                    <span>{school}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    );

    return (
      <>
        <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-6 lg:h-[calc(100vh-7rem)] lg:overflow-hidden">
          {/* Main content - independently scrollable on desktop */}
          <div ref={mainScrollRef} className="space-y-4 lg:overflow-y-auto lg:pr-2 lg:-mr-2 lg:scroll-smooth">
            <div className="sticky top-0 z-20 space-y-3 bg-background pb-2">
              <div className="flex items-center justify-between flex-nowrap gap-4 overflow-x-auto bg-slate-900 text-white p-3 sm:px-4 rounded-[1px] shadow-xs border border-slate-800 scrollbar-none">
                <div className="flex items-center gap-4 whitespace-nowrap text-sm font-semibold shrink-0">
                  <span className="text-slate-200 font-bold">নির্বাচিত</span>
                  <span className="text-blue-100">বহুঃ {toBanglaNum(selectedTypeCounts.mcq)} / {toBanglaNum(totalTypeCounts.mcq)}</span>
                  <span className="text-purple-100">সৃজঃ {toBanglaNum(selectedTypeCounts.cq)} / {toBanglaNum(totalTypeCounts.cq)}</span>
                  <span className="text-amber-100">সংঃ {toBanglaNum(selectedTypeCounts.short)} / {toBanglaNum(totalTypeCounts.short)}</span>
                  <span className="text-rose-100">বর্ণনাঃ {toBanglaNum(selectedTypeCounts.descriptive)} / {toBanglaNum(totalTypeCounts.descriptive)}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep("questionSet")}
                    className="h-9 rounded-[1px] bg-white/10 hover:bg-white/20 text-white border-white/20 text-sm font-medium"
                  >
                    ← বিবরণী
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleViewPaper}
                    disabled={selectedIds.size === 0}
                    className="h-9 rounded-[1px] bg-white/10 hover:bg-white/20 text-white border-white/30 text-sm font-medium"
                  >
                    <Eye className="h-4 w-4 mr-1 text-amber-300" /> প্রিভিউ
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveAndView}
                    disabled={selectedIds.size === 0}
                    className="h-9 rounded-[1px] bg-[#059669] hover:bg-[#047857] text-white font-bold text-sm shadow-xs border-0"
                  >
                    <Save className="h-4 w-4 mr-1" /> প্রশ্নপত্র সেভ করুন
                  </Button>
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

                  if (filterBoards.size > 0 || filterYear) {
                    result = result.filter(r => refMatchesBoardYear(r.board_references, filterBoards, filterYear));
                  }

                  if (filterSchools.size > 0 || filterSchoolYear) {
                    result = result.filter(r => refMatchesSchools(r.board_references, filterSchools, filterSchoolYear));
                  }

                  if (filterSpecial === "board") {
                    result = result.filter(r => countUniqueBoards(r.board_references) >= 2);
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
                  { value: "mcq", label: "MCQ", count: countByType("mcq"), dot: "bg-blue-500" },
                  { value: "short", label: "সংক্ষিপ্ত", count: countByType("short"), dot: "bg-amber-500" },
                  { value: "cq", label: "সৃজনশীল", count: countByType("cq"), dot: "bg-purple-500" },
                  { value: "descriptive", label: "বর্ণনামূলক", count: countByType("descriptive"), dot: "bg-rose-500" },
                ];

                const hasAnyFilter = !!filterSearch.trim() || filterType !== null || filterChapterIds.size > 0 || filterTopicIds.size > 0
                  || filterUntopicedChapterIds.size > 0 || filterBoards.size > 0 || filterSchools.size > 0
                  || !!filterYear || !!filterSchoolYear || filterSpecial !== null;

                const resetAllFilters = () => {
                  setFilterSearch("");
                  setFilterType("mcq");
                  setFilterChapterIds(new Set());
                  setFilterTopicIds(new Set());
                  setFilterUntopicedChapterIds(new Set());
                  setFilterBoards(new Set());
                  setFilterSchools(new Set());
                  setFilterYear("");
                  setFilterSchoolYear("");
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
                              className={`relative inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg text-[12.5px] sm:text-[13px] font-semibold tracking-tight transition-all duration-200 whitespace-nowrap shrink-0 ${isActive
                                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/80"
                                  : isDisabled
                                    ? "text-muted-foreground/60 cursor-not-allowed"
                                    : "text-foreground/80 hover:text-foreground hover:bg-background/70"
                                }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full transition-opacity ${b.dot} ${isActive ? "opacity-100" : "opacity-80"}`} />
                              <span>{b.label}</span>
                              <span
                                className={`inline-flex items-center justify-center min-w-[1.4rem] h-[18px] px-1.5 rounded-md text-[11px] font-bold tabular-nums tracking-tight transition-colors ${isActive
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
            </div>

            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl px-4 py-2 text-center text-xs text-amber-800 flex items-center justify-center gap-2">
              <Flag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>প্রশ্নে কোনো ভুল বা অসঙ্গতি পেলে ফ্ল্যাগ আইকনে ক্লিক করে রিপোর্ট করুন।</span>
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
                  mcq: { label: "MCQ", dot: "bg-blue-500", chip: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/60 dark:border-blue-900" },
                  short: { label: "সংক্ষিপ্ত", dot: "bg-amber-500", chip: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/60 dark:border-amber-900" },
                  cq: { label: "সৃজনশীল", dot: "bg-purple-500", chip: "text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-950/60 dark:border-purple-900" },
                  descriptive: { label: "বর্ণনামূলক", dot: "bg-rose-500", chip: "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/60 dark:border-rose-900" },
                };
                const tm = typeMeta[q.type] ?? { label: q.type, dot: "bg-muted-foreground", chip: "text-muted-foreground bg-muted border-border" };
                return (
                  <Card
                    key={q.id}
                    onClick={() => toggleQuestion(q.id)}
                    className={`group relative overflow-hidden cursor-pointer border rounded-[1px] transition-all duration-150 ${isSelected
                        ? "border-slate-800 shadow-xs bg-slate-50/70 ring-1 ring-slate-800"
                        : "border-slate-300 hover:border-slate-400 bg-white shadow-xs"
                      }`}
                  >
                    <span
                      aria-hidden
                      className={`pointer-events-none absolute left-0 top-0 h-full w-[3px] transition-all duration-150 ${isSelected ? "bg-emerald-600 opacity-100" : `${tm.dot} opacity-0 group-hover:opacity-60`
                        }`}
                    />
                    <CardContent className="p-4 pl-[18px]">
                      <div className="flex items-center justify-between mb-2.5 gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleQuestion(q.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-[1px] border-slate-400 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                          />
                          <span className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[1px] text-[11px] font-bold tracking-tight border ${tm.chip}`}>
                            <span className={`h-1.5 w-1.5 rounded-[1px] ${tm.dot}`} />
                            {tm.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <ReferenceBadges
                            boardRefs={q.board_references as any}
                            uniRefs={q.university_references as any}
                          />
                          <button
                            className="inline-flex items-center justify-center h-7 w-7 rounded-[1px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
                        // For CQ/descriptive, the stimulus/stem IS the question prompt (never duplicate)
                        const isCqOrDesc = q.type === "cq" || q.type === "descriptive";
                        const displayQuestion = isCqOrDesc
                          ? (cData?.stem || q.stimulus_text || q.question)
                          : q.question;

                        const hasSeparateStimulus = !isCqOrDesc && Boolean(
                          q.stimulus_text && (q.stimulus_text.replace(/<[^>]*>/g, "").trim().length > 0 || /<img\s/i.test(q.stimulus_text))
                        );

                        const isShort = q.type === "short";
                        return (
                          <div>
                            {hasSeparateStimulus && !isShort && (
                              <div
                                key={`stim-${q.id}`}
                                className="question-picker-stimulus mb-3 p-3 border-l-2 border-slate-400 bg-slate-50 rounded-[1px] italic text-base rich-text-content text-slate-800"
                              >
                                <LatexRenderer text={q.stimulus_text || ""} />
                              </div>
                            )}
                            <div className="font-medium mb-3 flex items-baseline gap-2 text-base text-slate-900 leading-relaxed">
                              <span className="shrink-0 font-bold text-slate-800 font-mono text-base">{toBanglaNum(globalIdx + 1)}. </span>
                              <div className="flex-1 mc-block-question min-w-0 text-base">
                                <LatexRenderer key={`q-${q.id}`} text={displayQuestion} />
                              </div>
                            </div>
                            {hasSeparateStimulus && isShort && (
                              <div
                                key={`stim-${q.id}`}
                                className="question-picker-stimulus mb-3 p-3 border-l-2 border-slate-400 bg-slate-50 rounded-[1px] italic text-base rich-text-content text-slate-800"
                              >
                                <LatexRenderer text={q.stimulus_text || ""} />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {q.type === "mcq" && q.option_a && (
                        <div className="grid grid-cols-2 gap-2.5">
                          {["option_a", "option_b", "option_c", "option_d"].map((key, oi) => {
                            const val = (q as any)[key];
                            if (!val) return null;
                            const label = ["ক", "খ", "গ", "ঘ"][oi];
                            const isAnswer = isCorrectOption(q.correct_answer, oi, [q.option_a, q.option_b, q.option_c, q.option_d]);
                            return (
                              <div key={key} className={`flex items-center gap-2.5 p-2.5 rounded-[1px] text-base ${isAnswer ? "bg-emerald-50 text-emerald-900 font-bold border border-emerald-300" : "bg-slate-50 text-slate-800 border border-slate-200"}`}>
                                <span
                                  className="shrink-0 inline-flex items-center justify-center rounded-[1px] border border-current font-bold leading-none text-xs"
                                  style={{ width: "1.6em", height: "1.6em" }}
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
                                <div key={f.key} className="text-sm flex items-start gap-1.5 leading-relaxed">
                                  <span className="font-semibold shrink-0 select-none">({f.label})</span>
                                  <div className="flex-1 min-w-0 cq-sub-content">
                                    <LatexRenderer text={val} inline />
                                  </div>
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

  // ─── STEP 1: Minimal Form matching Screenshot 2 ───
  return (
    <div className="max-w-xl mx-auto py-2 sm:py-5">
      {addToPaper && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-[1px] p-4 text-center">
          <h1 className="font-heading text-lg font-bold text-slate-800">
            বিদ্যমান প্রশ্নপত্রে আরও প্রশ্ন যুক্ত করুন
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            নতুন প্রশ্ন নির্বাচন করে "প্রশ্নপত্র দেখুন" বাটনে ক্লিক করলে আগের প্রশ্নগুলোর সাথে যুক্ত হবে।
          </p>
        </div>
      )}

      {/* Main Minimal Form Card */}
      <Card className="border border-slate-300 shadow-xs bg-white rounded-[1px] overflow-hidden">
        <CardContent className="p-6 sm:p-8 space-y-3.5">
          {/* 1. Exam / Program Name */}
          <div>
            <Input
              placeholder="প্রোগ্রাম/পরীক্ষার নাম লিখুন *"
              value={form.programName}
              onChange={(e) => setForm({ ...form, programName: e.target.value })}
              className="h-12 rounded-[1px] border-slate-300 focus:border-[#0A1E38] focus:ring-1 focus:ring-[#0A1E38] text-base text-slate-800 placeholder:text-slate-500 bg-white"
            />
          </div>

          {/* 2. Class Picker */}
          <div>
            <ClassPicker
              value={form.classId}
              classes={selectableClasses}
              placeholder="শ্রেণি"
              triggerClassName="h-12 rounded-[1px] border-slate-300 focus:border-[#0A1E38] focus:ring-1 focus:ring-[#0A1E38] text-base text-slate-800 bg-white"
              onChange={(v) => {
                setSubjectVersion("bangla");
                setForm({ ...form, classId: v, subjectId: "", subjectIds: [], chapterIds: [] });
              }}
            />
          </div>

          {/* 3. Subject Picker */}
          <div onClick={!form.classId ? () => setWarningDialog("subject") : undefined}>
            <SubjectPicker
              value={form.subjectId}
              values={form.subjectIds}
              subjects={filteredSubjects}
              classes={classes}
              version={subjectVersion}
              disabled={!form.classId}
              placeholder="বিষয়"
              triggerIcon="scan"
              triggerClassName="h-12 rounded-[1px] border-slate-300 focus:border-[#0A1E38] text-base text-slate-800 bg-white"
              onVersionChange={(version) => {
                setSubjectVersion(version);
                setForm({ ...form, subjectId: "", subjectIds: [], chapterIds: [] });
              }}
              onChange={(nextSubjectId, nextSubjectIds) => {
                setForm({ ...form, subjectId: nextSubjectIds.join(", "), subjectIds: nextSubjectIds, chapterIds: [] });
              }}
            />
          </div>

          {/* 4. Chapter Picker */}
          <div
            onClick={() => {
              if (selectedSubjectIds.length === 0) {
                setWarningDialog("chapter");
              } else {
                setChapterModalOpen(true);
              }
            }}
          >
            <div
              role="button"
              tabIndex={0}
              className={`flex h-12 w-full items-center justify-between rounded-[1px] border border-slate-300 bg-white px-3.5 py-1 text-base cursor-pointer transition-colors text-slate-800 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0A1E38] ${selectedSubjectIds.length === 0 ? "opacity-60 bg-slate-50" : ""
                }`}
            >
              <span className="truncate font-medium flex-1 min-w-0 py-1 px-0.5 leading-normal">
                {selectedSubjectIds.length === 0 ? (
                  <span className="text-slate-500">অধ্যায়</span>
                ) : form.chapterIds.length === 0 ? (
                  <span className="text-slate-500">অধ্যায়</span>
                ) : form.chapterIds.length === chapters.length ? (
                  <span className="text-slate-800 font-semibold">সকল অধ্যায় ({toBanglaNum(chapters.length)}টি)</span>
                ) : (
                  <span className="text-slate-800 font-semibold">অধ্যায় ({toBanglaNum(form.chapterIds.length)}টি নির্বাচিত)</span>
                )}
              </span>
              <Scan className="h-4 w-4 shrink-0 text-slate-500 ml-2" />
            </div>
          </div>

          {/* 5. Type & Marks (Two-Column Grid) */}
          <div className="grid grid-cols-2 gap-3 pt-0.5">
            <div>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="h-12 rounded-[1px] border-slate-300 focus:border-[#0A1E38] text-base text-slate-800 bg-white">
                  <SelectValue placeholder="টাইপ" />
                </SelectTrigger>
                <SelectContent className="rounded-[1px] border-slate-300">
                  {typeOptions.map((t) => (
                    <SelectItem key={t} value={t} className="text-base py-2">
                      {typeLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={form.count}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setForm({ ...form, count: "" });
                      return;
                    }
                    const num = parseInt(raw, 10);
                    if (isNaN(num)) return;
                    if (num > 200) {
                      toast.warning("একবারে সর্বোচ্চ ২০০টি প্রশ্ন নির্বাচন করতে পারবেন");
                      setForm({ ...form, count: "200" });
                      return;
                    }
                    if (num < 1) {
                      setForm({ ...form, count: "1" });
                      return;
                    }
                    setForm({ ...form, count: String(num) });
                  }}
                  onBlur={() => {
                    const num = parseInt(form.count, 10);
                    if (!num || num < 1) {
                      setForm({ ...form, count: "100" });
                    } else if (num > 200) {
                      setForm({ ...form, count: "200" });
                    }
                  }}
                  placeholder="১০০"
                  className="h-12 rounded-[1px] border-slate-300 focus:border-[#0A1E38] text-base text-slate-800 placeholder:text-slate-500 bg-white pr-20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none select-none">
                  সর্বোচ্চ ২০০
                </span>
              </div>
            </div>
          </div>

          {/* 6. Submit Action Button */}
          <div className="pt-2">
            <Button
              className="w-full h-12 rounded-[1px] bg-[#0A1E38] hover:bg-[#122B4D] text-white font-bold text-lg shadow-xs border border-[#0A1E38] transition-colors flex items-center justify-center cursor-pointer"
              onClick={handleCreateQuestionSet}
              disabled={loading}
            >
              <span>{loading ? "অপেক্ষা করুন..." : "প্রশ্ন তৈরি করুন"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chapter Selection Dialog */}
      <Dialog open={chapterModalOpen} onOpenChange={setChapterModalOpen}>
        <DialogContent className="max-w-lg rounded-[1px] border-slate-300 p-0 overflow-hidden bg-white">
          <div className="flex items-center justify-between pl-5 pr-14 py-3.5 bg-slate-100 border-b border-slate-200">
            <div className="text-base font-bold text-slate-800">অধ্যায় নির্বাচন করুন</div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-300 px-2 py-1 rounded-[1px]">
                {toBanglaNum(form.chapterIds.length)} / {toBanglaNum(chapters.length)} টি সিলেক্টেড
              </span>
              <button
                type="button"
                onClick={toggleAllChapters}
                className="text-xs font-bold text-[#0A1E38] hover:bg-slate-200 bg-white border border-slate-300 px-2.5 py-1 rounded-[1px] transition-colors cursor-pointer"
              >
                {form.chapterIds.length === chapters.filter(c => hasSubscription || c.is_free).length && chapters.length > 0
                  ? "সব আনসিলেক্ট"
                  : "সব সিলেক্ট"}
              </button>
            </div>
          </div>
          <div className="p-4">
            <ScrollArea className="h-72 border border-slate-200 rounded-[1px]">
              <div className="p-2 space-y-1">
                {chapters.map((c) => {
                  const isSelected = form.chapterIds.includes(String(c.id));
                  const isLocked = !hasSubscription && !c.is_free;
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[1px] transition-colors text-base select-none ${isLocked
                          ? "opacity-60 cursor-not-allowed bg-slate-100"
                          : isSelected
                            ? "bg-[#0A1E38]/5 text-[#0A1E38] font-semibold cursor-pointer border border-[#0A1E38]/25"
                            : "hover:bg-slate-50 text-slate-800 cursor-pointer"
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
                          className="rounded-[1px] border-slate-400 data-[state=checked]:bg-[#0A1E38] data-[state=checked]:border-[#0A1E38]"
                        />
                      )}
                      <span className={isLocked ? "text-slate-400" : ""}>{c.name}</span>
                      {isLocked && (
                        <span className="ml-auto text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-[1px] font-semibold">
                          প্যাকেজ প্রয়োজন
                        </span>
                      )}
                    </label>
                  );
                })}
                {chapters.length === 0 && (
                  <p className="text-center text-slate-400 py-8 text-base">কোনো অধ্যায় পাওয়া যায়নি</p>
                )}
              </div>
            </ScrollArea>
          </div>
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setChapterModalOpen(false)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-base px-5 h-11 rounded-[1px] border border-slate-300 cursor-pointer"
            >
              বন্ধ করুন
            </Button>
            <Button
              type="button"
              onClick={() => setChapterModalOpen(false)}
              className="bg-[#0A1E38] hover:bg-[#122B4D] text-white font-bold text-base px-6 h-11 rounded-[1px] cursor-pointer border border-[#0A1E38]"
            >
              নিশ্চিত করুন
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!warningDialog} onOpenChange={() => setWarningDialog(null)}>
        <DialogContent className="max-w-md rounded-[1px] border-slate-300">
          <DialogHeader>
            <DialogTitle className="text-center text-lg">{warningDialog && warningMessages[warningDialog].title}</DialogTitle>
          </DialogHeader>
          <p className="text-center text-base text-slate-600 py-2">{warningDialog && warningMessages[warningDialog].prerequisite}</p>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" className="flex-1 bg-slate-100 hover:bg-slate-200 rounded-[1px] text-base" onClick={() => setWarningDialog(null)}>সিলেক্ট করুন</Button>
            <Button variant="outline" className="flex-1 bg-destructive/10 hover:bg-destructive/20 border-destructive/30 rounded-[1px] text-base" onClick={() => setWarningDialog(null)}>বন্ধ করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
