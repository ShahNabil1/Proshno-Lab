import QuestionBorderLoading from "@/components/dashboard/QuestionBorderLoading";
import QuestionLoading from "@/components/dashboard/QuestionLoading";
import { analytics } from "@/lib/analytics";
import { getCachedBrowserPage, fetchBrowserPage, fetchBrowserGroups, mergePageWithSelection, type BrowserScope, type BrowserPage, type BrowserFilters } from "@/lib/questionBrowser";
import { fetchQuestionPages } from "@/lib/fetchQuestionPages";
import { getQuestionDuplicateSignature } from "@/lib/questionDuplicates";
import { addToPaperForm } from "@/lib/addToPaperContext";
import { createPortal } from "react-dom";
import { getEnglishBlocks } from '@/lib/englishFirstPattern';
import EnglishFirstPaperBuilder from '@/components/dashboard/EnglishFirstPaperBuilder';
import { ALL_TYPES, allowedQuestionTypes, isLanguageType, questionTypeLabel, usesEnglishFirstTemplate } from "@/lib/languageQuestionTypes";
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
  CheckCircle, MessageSquare, Search, Eye, AlertTriangle, Lock, Flag, Save,
  SlidersHorizontal, ChevronLeft, ChevronRight, RotateCcw,
  BookOpen, GraduationCap, Clock, Award, FileText, CheckCheck, Layers,
  ListFilter, CheckCircle2, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, School, HelpCircle, Filter, Scan
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate, useSearchParams } from "react-router-dom";
import LatexRenderer from "@/components/LatexRenderer";
import AutoFitQuestionGrid from "@/components/AutoFitQuestionGrid";
import ReferenceBadges from "@/components/ReferenceBadges";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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

const typeOptions = [...ALL_TYPES, "all"];
const EXAM_NAME_OPTIONS = ["ক্লাস টেস্ট", "অধ্যায়ভিত্তিক পরীক্ষা", "সাপ্তাহিক পরীক্ষা", "মাসিক পরীক্ষা"];
const DEFAULT_EXAM_NAME = "ক্লাস টেস্ট";
const typeLabels: Record<string, string> = {
  mcq: "বহুনির্বাচনী",
  cq: "সৃজনশীল",
  short: "সংক্ষিপ্ত",
  descriptive: "বর্ণনামূলক",
  all: "সব ধরনের প্রশ্ন",
};
const typeDbValues: Record<string, string[]> = {
  mcq: ["mcq"],
  cq: ["cq"],
  short: ["short"],
  descriptive: ["descriptive"],
  ...Object.fromEntries(ALL_TYPES.map(t=>[t,[t]])),
  all: ALL_TYPES,
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
      && /(স্কুল|কলেজ|বিদ্যালয়|বিদ্যালয়|ক্যাডেট|একাডেমি|মাদ্রাসা|ইনস্টিটিউট|school|college|academy|institute|madras)/i.test(name)
    );
};

const schoolQuestionRefs = (question: QuestionRow): any[] => [
  ...(Array.isArray(question.board_references) ? question.board_references : []),
  ...(Array.isArray(question.university_references) ? question.university_references : []),
];
const referenceYear = (ref: any): string => {
  const explicit = normalizeYear(ref?.year);
  if (explicit) return explicit;
  const name = bnDigitsToLatin(String(ref?.board ?? ref?.name ?? ""));
  const match = name.match(/(?:19|20)\d{2}\b|['’]\s*(\d{2})\b/);
  return match ? normalizeYear(match[1] || match[0]) : "";
};

const refMatchesSchools = (refs: any, schools: Set<string>, year = ""): boolean => {
  const list = Array.isArray(refs) ? refs : [];
  return list.some((ref: any) => {
    const name = String(ref?.board ?? ref?.name ?? "").trim();
    if (!schoolNamesFromRefs([ref]).includes(name)) return false;
    const schoolOk = schools.size === 0 || schools.has(name);
    const yearOk = !year || referenceYear(ref) === normalizeYear(year);
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
  const { unlimited: unlimitedAccess, loading: accessLoading, noPackagePreview } = useUnlimitedAccess();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addToPaper = searchParams.get("add_to_paper") === "true";
  const draftKey = `questionCreateDraft:v2:${addToPaper ? "add" : "manual"}`;
  const [draft] = useState<any>(() => {
    // Add mode always starts from the current paper, never an older add-session draft.
    if (addToPaper) return null;
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey) || "null");
      return saved && (!user || saved.owner === user.id) ? saved : null;
    } catch { return null; }
  });
  const [remoteScope, setRemoteScope] = useState<BrowserScope | null>(draft?.remoteScope || null);
  const [remotePage, setRemotePage] = useState<BrowserPage<QuestionRow> | null>(draft?.remotePage || null);
  const [pageLoading, setPageLoading] = useState(false);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [pageError, setPageError] = useState(false);
  const [pageRetry, setPageRetry] = useState(0);
  const remoteQueryRef = useRef("");
  const selectedIdsRef = useRef<Set<number>>(new Set(draft?.selectedIds || []));
  const [toolbarTarget, setToolbarTarget] = useState<HTMLElement | null>(null);
  const [mobileToolbarTarget, setMobileToolbarTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const updateTarget = () => {
      const target = document.getElementById("question-picker-header-slot");
      setToolbarTarget(media.matches ? target : null);
      setMobileToolbarTarget(!media.matches ? target : null);
    };
    updateTarget();
    media.addEventListener("change", updateTarget);
    return () => media.removeEventListener("change", updateTarget);
  }, []);
  const restoringDraft = false;
  const [englishSections, setEnglishSections] = useState<number[]>(draft?.englishSections || [0,1,2,3,4,5,6,7,8]);
  const [englishPreviewRows, setEnglishPreviewRows] = useState<QuestionRow[] | null>(draft?.englishPreviewRows || null);
  const [step, setStep] = useState<Step>(draft?.step || "form");
  useEffect(() => {
    onQuestionListChange?.(step !== "form");
    return () => onQuestionListChange?.(false);
  }, [step, onQuestionListChange]);
  const [form, setForm] = useState(() => ({
    programName: "",
    classId: "",
    subjectId: "",
    subjectIds: [] as string[],
    chapterIds: [] as string[],
    type: "",
    count: "100",
    ...draft?.form,
    ...(draft?.step === "form" ? { programName: "", type: "" } : {}),
  }));
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [customExamName, setCustomExamName] = useState(draft?.customExamName || false);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; class_id: number; name: string; subject_code?: string | null }[]>([]);
  const [chapters, setChapters] = useState<{ id: number; name: string; is_free: boolean; subject_id?: number }[]>([]);
  const [topics, setTopics] = useState<{ id: number; name: string; chapter_id: number }[]>([]);
  const [warningDialog, setWarningDialog] = useState<WarningField>(null);
  const [hasSubscription, setHasSubscription] = useState<boolean>(false);
  const [subjectVersion, setSubjectVersion] = useState<SubjectVersion>(draft?.subjectVersion || "bangla");

  const selectedSubjectIds = useMemo(() => {
    if (form.subjectIds && form.subjectIds.length > 0) return form.subjectIds;
    if (form.subjectId) return form.subjectId.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
  }, [form.subjectId, form.subjectIds]);

  const selectedSubjects = useMemo(() => {
    return subjects.filter((s) => selectedSubjectIds.includes(String(s.id)));
  }, [selectedSubjectIds, subjects]);

  const selectedSubject = selectedSubjects[0];
  const englishClassName = classes.find(c => String(c.id) === form.classId)?.name || '';
  const englishBlocks = getEnglishBlocks(englishClassName);
  const previousEnglishClass = useRef(form.classId);
  useEffect(() => {
    const classChanged = previousEnglishClass.current !== form.classId;
    setEnglishSections(previous => classChanged ? englishBlocks.map((_, i) => i) : previous.filter(i => i < englishBlocks.length));
    previousEnglishClass.current = form.classId;
  }, [form.classId, englishBlocks]);
  const showEnglishBuilder = !addToPaper && selectedSubjects.length === 1 && usesEnglishFirstTemplate(classes.find(c => String(c.id) === form.classId)?.name || '', selectedSubject?.name || '');
  useEffect(() => {
    if (showEnglishBuilder && chapters.length) {
      setForm(previous => ({ ...previous, chapterIds: chapters.filter(c => hasSubscription || c.is_free).map(c => String(c.id)) }));
    }
  }, [showEnglishBuilder, chapters, hasSubscription]);
  const scopedTypeOptions = ["all", ...new Set(selectedSubjects.flatMap(sub=> {
    const cls=classes.find(c=>c.id===sub.class_id)?.name || "";
    const chosen=chapters.filter(c=>form.chapterIds.includes(String(c.id)) && c.subject_id===sub.id);
    return chosen.length?chosen.flatMap(c=>allowedQuestionTypes(cls,sub.name,c.name)):allowedQuestionTypes(cls,sub.name);
  }))];
  useEffect(()=> {if(selectedSubjects.length && form.type && !scopedTypeOptions.includes(form.type)) setForm(f=>({...f,type:""}));},[form.classId,selectedSubjects,form.chapterIds,chapters]);
  const effectiveClassId = selectedSubject?.class_id || Number(form.classId || 0);
  const selectableClasses = useMemo(
    () => classes.filter((item) => !/english|eglish|version|ইংলিশ/i.test(item.name || "")),
    [classes],
  );
  const filteredSubjects = filterSubjectsByVersion(subjects, classes, subjectVersion);

  const [questionRows, setQuestions] = useState<QuestionRow[]>(draft?.questions || []);
  const questions = useMemo(() => {
    if (remoteScope) return questionRows;
    const existing: QuestionRow[] = addToPaper
      ? JSON.parse(sessionStorage.getItem("existingPaperQuestions") || "[]") : [];
    const seen = new Set(existing.map(getQuestionDuplicateSignature).filter(Boolean));
    const existingIds = new Set(existing.map(q => q.id));
    const years = new Map(questionRows.map(q => [q.id, latestQuestionYear(q)]));
    return [...questionRows]
      .sort((a, b) => (years.get(b.id) || 0) - (years.get(a.id) || 0) || b.id - a.id)
      .filter(q => {
        if (existingIds.has(q.id)) return false;
        const key = getQuestionDuplicateSignature(q);
        if (key && seen.has(key)) return false;
        if (key) seen.add(key);
        return true;
      });
  }, [questionRows, addToPaper, remoteScope]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(draft?.selectedIds || []));
  selectedIdsRef.current = selectedIds;
  const [existingQuestionIds, setExistingQuestionIds] = useState<Set<number>>(new Set());
  useEffect(() => {
    const allowedIds = new Set(questions.map(q => q.id));
    setSelectedIds(previous => {
      const next = new Set([...previous].filter(id => allowedIds.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [questions]);



  // Load existing paper question IDs when in add_to_paper mode and auto-skip form
  const [autoSkipDone, setAutoSkipDone] = useState(false);
  useEffect(() => {
    if (addToPaper) {
      const raw = sessionStorage.getItem("existingPaperQuestions");
      const parsedExisting=raw ? JSON.parse(raw) : [];
      const existing=Array.isArray(parsedExisting)?parsedExisting:[];
      if (Array.isArray(existing)) {
        const ids = (existing as QuestionRow[]).map(q => q.id);
        setExistingQuestionIds(new Set(ids));
      }
      // Auto-fill form from context and skip to question list
      const ctxRaw = sessionStorage.getItem("existingPaperContext");
      if ((ctxRaw || existing.length) && !autoSkipDone) {
        const ctx = (ctxRaw ? JSON.parse(ctxRaw) : null) || {};
        const meta = JSON.parse(sessionStorage.getItem("existingPaperMeta") || "{}") || {};
        setForm(prev => ({
          ...prev,
          ...addToPaperForm(ctx,meta,existing),
        }));
        setStep("form");
        setRemoteScope(null);setRemotePage(null);setQuestions([]);setSelectedIds(new Set());
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
  const [filterSearch, setFilterSearch] = useState<string>(draft?.filterSearch || "");
  const [filterType, setFilterType] = useState<string | null>(draft?.filterType || null);
  const [filterChapterIds, setFilterChapterIds] = useState<Set<number>>(new Set((draft?.filterChapterIds?.length ? draft.filterChapterIds : draft?.remoteScope?.chapterIds || []).slice(0, 1)));
  const [filterTopicIds, setFilterTopicIds] = useState<Set<number>>(new Set(draft?.filterTopicIds || []));
  const [filterUntopicedChapterIds, setFilterUntopicedChapterIds] = useState<Set<number>>(new Set(draft?.filterUntopicedChapterIds || []));
  const [filterBoards, setFilterBoards] = useState<Set<string>>(new Set(draft?.filterBoards || []));
  const [filterSchools, setFilterSchools] = useState<Set<string>>(new Set(draft?.filterSchools || []));
  const [filterYear, setFilterYear] = useState<string>(draft?.filterYear || "");
  const [filterSchoolYear, setFilterSchoolYear] = useState<string>(draft?.filterSchoolYear || "");
  const [filterSpecial, setFilterSpecial] = useState<string | null>(draft?.filterSpecial || null);
  const [currentPage, setCurrentPage] = useState<number>(draft?.currentPage || 1);
  const [debouncedSearch, setDebouncedSearch] = useState(filterSearch);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filterSearch), 250);
    return () => window.clearTimeout(timer);
  }, [filterSearch]);
  const remoteFilters = useMemo<BrowserFilters>(() => ({
    search: debouncedSearch.trim(), type: filterType || remoteScope?.types[0] || "mcq", chapterIds: remoteScope ? [([...filterChapterIds].find(id => remoteScope.chapterIds.includes(id)) ?? remoteScope.chapterIds[0])].filter(id => id !== undefined) : [...filterChapterIds],
    topicIds: [...filterTopicIds], untopicedChapterIds: [...filterUntopicedChapterIds],
    boards: [...filterBoards], year: filterYear, schools: [...filterSchools],
    schoolYear: filterSchoolYear, special: filterSpecial,
  }), [debouncedSearch, filterType, filterChapterIds, filterTopicIds, filterUntopicedChapterIds,
    filterBoards, filterYear, filterSchools, filterSchoolYear, filterSpecial, remoteScope]);
  useEffect(() => {
    if (!remoteScope?.chapterIds.length) return;
    const chapter = [...filterChapterIds].find(id => remoteScope.chapterIds.includes(id)) ?? remoteScope.chapterIds[0];
    if (filterChapterIds.size !== 1 || !filterChapterIds.has(chapter)) {
      setFilterChapterIds(new Set([chapter]));
      setFilterTopicIds(new Set()); setFilterUntopicedChapterIds(new Set());
      setCurrentPage(1);
    }
  }, [remoteScope, filterChapterIds]);
  const remoteQueryKey = JSON.stringify([remoteScope, remoteFilters, currentPage, pageRetry]);
  const browserActive = step === "questionSet" || step === "questionList";
  useEffect(() => {
    if (!showEnglishBuilder && !filterType) {
      setFilterType(remoteScope?.types[0] || "mcq");
      setCurrentPage(1);
    }
  }, [showEnglishBuilder, filterType, remoteScope]);
  useEffect(() => {
    if (!browserActive || !remoteScope || remoteQueryRef.current === remoteQueryKey) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const cached = getCachedBrowserPage<QuestionRow>(remoteScope, remoteFilters, currentPage, user?.id || "");
      setPageLoading(!cached); setPageError(false);
      try {
        const data = cached || await fetchBrowserPage<QuestionRow>(remoteScope, remoteFilters, currentPage, user?.id || "");
        if (cancelled) return;
        remoteQueryRef.current = remoteQueryKey;
        setRemotePage(data);
        setQuestions(previous => mergePageWithSelection(previous, data.rows, selectedIdsRef.current));
        if (currentPage > Math.max(1, Math.ceil(data.total / 20))) setCurrentPage(1);
      } catch {
        if (!cancelled) setPageError(true);
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [browserActive, remoteQueryKey, remoteScope, remoteFilters, currentPage, user?.id]);
  useEffect(() => {
    if (!browserActive || !remoteScope || !remotePage || pageLoading || pageError || !user?.id
      || currentPage * 20 >= remotePage.total) return;
    // Warm one successor only, and share pending requests with a Next click.
    void fetchBrowserPage<QuestionRow>(remoteScope, remoteFilters, currentPage + 1, user.id)
      .catch(() => { /* Speculative failures must not disturb the visible page. */ });
  }, [browserActive, remoteScope, remotePage, remoteFilters, currentPage, pageLoading, pageError, user?.id]);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!user) return;
    const saveDraft = () => {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify({
          owner: user.id, form, step, questions, remoteScope, remotePage, selectedIds: [...selectedIds],
          customExamName, subjectVersion, englishSections, englishPreviewRows,
          filterSearch, filterType, filterChapterIds: [...filterChapterIds],
          filterTopicIds: [...filterTopicIds], filterUntopicedChapterIds: [...filterUntopicedChapterIds],
          filterBoards: [...filterBoards], filterSchools: [...filterSchools],
          filterYear, filterSchoolYear, filterSpecial, currentPage,
        }));
      } catch { /* Storage may be unavailable; keep the current work in memory. */ }
    };
    const timer = window.setTimeout(saveDraft, 150);
    window.addEventListener("pagehide", saveDraft);
    return () => { window.clearTimeout(timer); window.removeEventListener("pagehide", saveDraft); };
  }, [user, draftKey, form, step, questions, remoteScope, remotePage, selectedIds, customExamName, subjectVersion,
    englishSections, englishPreviewRows, filterSearch, filterType, filterChapterIds,
    filterTopicIds, filterUntopicedChapterIds, filterBoards, filterSchools,
    filterYear, filterSchoolYear, filterSpecial, currentPage]);
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
  const scrollMainToBottom = () => {
    const el = mainScrollRef.current;
    if (el && window.getComputedStyle(el).overflowY === "auto") {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  };
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
    let query = supabase.from("chapters").select("id, name, is_free, subject_id").in("subject_id", selectedSubjectIds.map(Number));
    if (!unlimitedAccess) query = query.eq("is_active", true);
    query.order("name")
      .then(({ data }) => setChapters(sortChapters((data as any[]) || [])));
  }, [selectedSubjectIds.join(","), unlimitedAccess]);

  // Check access: user_permissions OR active subscriptions
  useEffect(() => {
    if (noPackagePreview) { setHasSubscription(false); return; }
    if (unlimitedAccess) { setHasSubscription(true); return; }
    if (!user?.id || !effectiveClassId || selectedSubjectIds.length === 0) { setHasSubscription(false); return; }

    let cancelled = false;

    const checkAccess = async () => {
      const results = await Promise.all(selectedSubjectIds.map(async id => {
        const subject = subjects.find(s => String(s.id) === String(id));
        if (!subject) return false;
        const { data, error } = await supabase.rpc("can_read_question", { _class_id: subject.class_id, _subject_id: subject.id });
        return !error && data === true;
      }));
      if (!cancelled) setHasSubscription(results.every(Boolean));
    };

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, [user?.id, effectiveClassId, selectedSubjectIds.join(","), classes, subjects, unlimitedAccess, noPackagePreview]);

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

    const buildQuery = (from: number, to: number, withCount: boolean) => {
      const subjectClassIds = Array.from(new Set(
        sIds
          .map((subjectId) => subjects.find((subject) => String(subject.id) === String(subjectId))?.class_id)
          .filter((classId): classId is number => Boolean(classId)),
      ));
      let query = supabase.from("questions").select("*, chapters!inner(is_active)", withCount ? { count: "exact" } : {})
        .in("class_id", subjectClassIds.length > 0 ? subjectClassIds : [Number(f.classId)])
        .in("subject_id", sIds.map(Number));
      if (!unlimitedAccess) query = query.eq("chapters.is_active", true);

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
    const allRows = await fetchQuestionPages<QuestionRow>(async (from, to, withCount) => {
      const { data, error, count } = await buildQuery(from, to, withCount);
      if (error) throw error;
      return { rows: (data || []) as QuestionRow[], count };
    });
    if (showEnglishBuilder) {
      const types = new Set<string>(englishSections.flatMap(i => {
        const block = englishBlocks[i];
        return block ? [...block.needs.map(n => n[0]), ...(block.passage ? [block.passage] : [])] : [];
      }));
      return allRows.filter(q => types.has(q.type));
    }
    return allRows;
  };

  const handleCreateQuestionSet = async () => {
    if (!addToPaper && !form.programName.trim()) {
      toast.error("পরীক্ষার ধরন নির্বাচন করুন");
      setExamModalOpen(true);
      return;
    }
    if (!form.type) {
      toast.error("প্রশ্নের টাইপ নির্বাচন করুন");
      setTypeModalOpen(true);
      return;
    }
    if (!form.classId) {
      toast.error("শ্রেণী নির্বাচন করুন");
      return;
    }
    if (selectedSubjectIds.length === 0) {
      toast.error("বিষয় নির্বাচন করুন");
      return;
    }
    if (form.chapterIds.length === 0) {
      toast.error("অন্তত একটি অধ্যায় নির্বাচন করুন");
      return;
    }
    if (showEnglishBuilder && !englishSections.length) {
      toast.warning("প্রশ্ন তৈরি করতে অন্তত একটি ইংরেজি প্রশ্নের বিভাগ নির্বাচন করুন");
      return;
    }
    const safeCount = Math.min(200, Math.max(1, parseInt(form.count || "100", 10) || 100));
    setLoading(true);
    try {
      if (!addToPaper && !showEnglishBuilder) {
        const scope: BrowserScope = {
          classIds: [...new Set(selectedSubjects.map(subject => subject.class_id))],
          subjectIds: selectedSubjectIds.map(Number), chapterIds: form.chapterIds.map(Number),
          types: form.type === "all" ? [] : (typeDbValues[form.type] || [form.type]),
          includeInactive: unlimitedAccess,
        };
        const initialFilters: BrowserFilters = {
          search: "", type: scope.types[0] || "mcq",
          chapterIds: [scope.chapterIds[0]], topicIds: [], untopicedChapterIds: [], boards: [], year: "",
          schools: [], schoolYear: "", special: null,
        };
        setSelectedIds(new Set());
        setFilterSearch(""); setDebouncedSearch(""); setFilterType(initialFilters.type);
        setFilterChapterIds(new Set(initialFilters.chapterIds)); setFilterTopicIds(new Set());
        setFilterUntopicedChapterIds(new Set()); setFilterBoards(new Set()); setFilterYear("");
        setFilterSchools(new Set()); setFilterSchoolYear(""); setFilterSpecial(null);
        setCurrentPage(1); setPageRetry(0);
        remoteQueryRef.current = "";
        setPageLoading(false); setPageError(false);
        setRemoteScope(scope); setRemotePage(null); setQuestions([]);
        setStep("questionSet");
        return;
      }
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
      // The list is displayed by reference year, so random sorting is redundant.
      setQuestions(filtered);
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
      setStep(addToPaper ? "questionList" : "questionSet");
    } catch {
      toast.error("প্রশ্ন আনতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestions = () => {
    if (remoteScope && !remotePage) setPageLoading(true);
    setStep("questionList");
  };

  const toggleQuestion = async (id: number) => {
    if (selectionLoading || pageLoading) return;
    let selectionPool = questions;
    const target = questions.find(q => q.id === id);
    if (remoteScope && target?.stimulus_group_id && !selectedIdsRef.current.has(id)) {
      setSelectionLoading(true);
      try {
        const group = await fetchBrowserGroups<QuestionRow>(remoteScope, [target.stimulus_group_id]);
        if (group.length > 200) { toast.warning("এই উদ্দীপকের সব প্রশ্ন নিলে ২০০ প্রশ্নের সীমা অতিক্রম করবে।"); return; }
        const signatures = new Set<string>();
        const rows = group.filter(q => {
          const signature = getQuestionDuplicateSignature(q);
          if (signatures.has(signature)) return false;
          signatures.add(signature); return true;
        });
        selectionPool = mergePageWithSelection(questions, [...(remotePage?.rows || []), ...rows], selectedIdsRef.current);
        setQuestions(selectionPool);
      } catch {
        toast.error("একই উদ্দীপকের প্রশ্ন আনতে সমস্যা হয়েছে। আবার চেষ্টা করুন।"); return;
      } finally { setSelectionLoading(false); }
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const question = questions.find(q => q.id === id);
      const isAdding = !next.has(id);

      if (!showEnglishBuilder && isAdding && next.size >= 200) {
        toast.warning("সর্বোচ্চ ২০০টি প্রশ্ন নির্বাচন করা যাবে");
        return prev;
      }

      if (!showEnglishBuilder && question?.stimulus_group_id) {
        // Auto-select/deselect all questions in the same group
        const groupQs = selectionPool.filter(q => q.stimulus_group_id === question.stimulus_group_id);
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
  const schoolList = useMemo(() => remotePage ? remotePage.schools : Array.from(new Set(
    questions.flatMap(q => schoolNamesFromRefs(schoolQuestionRefs(q)))
  )).sort((a, b) => a.localeCompare(b, "bn")), [questions, remotePage]);
  const boardYears = useMemo(() => remotePage ? remotePage.boardYears : Array.from(new Set(
    questions.flatMap(question => {
      const refs = Array.isArray(question.board_references) ? question.board_references : [];
      return refs
        .filter((ref: any) => canonicalBoard(ref?.board))
        .map((ref: any) => normalizeYear(ref?.year))
        .filter(Boolean);
    })
  )).sort((a, b) => Number(b) - Number(a)), [questions, remotePage]);
  const schoolYears = useMemo(() => remotePage ? remotePage.schoolYears : Array.from(new Set(
    questions.flatMap(question => {
      const refs = schoolQuestionRefs(question);
      return refs
        .filter((ref: any) => schoolNamesFromRefs([ref]).length > 0)
        .map(referenceYear)
        .filter(Boolean);
    })
  )).sort((a, b) => Number(b) - Number(a)), [questions, remotePage]);
  const selectedTypeCounts = useMemo(() => {
    const counts = { mcq: 0, cq: 0, short: 0, descriptive: 0 };
    questions.forEach(question => {
      if (!selectedIds.has(question.id)) return;
      if (question.type in counts) counts[question.type as keyof typeof counts] += 1;
    });
    return counts;
  }, [questions, selectedIds]);
  const totalTypeCounts = useMemo(() => {
    if (remotePage) return { mcq: remotePage.types.mcq || 0, cq: remotePage.types.cq || 0,
      short: remotePage.types.short || 0, descriptive: remotePage.types.descriptive || 0 };
    const counts = { mcq: 0, cq: 0, short: 0, descriptive: 0 };
    questions.forEach(question => {
      if (question.type in counts) counts[question.type as keyof typeof counts] += 1;
    });
    return counts;
  }, [questions, remotePage]);

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
      result = result.filter(r => refMatchesSchools(schoolQuestionRefs(r), filterSchools, filterSchoolYear));
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

  const filteredQuestions = useMemo(() => remoteScope ? (remotePage?.rows || []) : englishPreviewRows ? englishPreviewRows.filter(q => questions.some(item => item.id === q.id)) : getFilteredQuestions(), [remoteScope, remotePage, englishPreviewRows, questions, filterSearch, filterType, filterChapterIds, filterTopicIds, filterUntopicedChapterIds, filterBoards, filterYear, filterSchools, filterSchoolYear, filterSpecial]);
  const totalPages = Math.ceil((remoteScope ? remotePage?.total || 0 : filteredQuestions.length) / ITEMS_PER_PAGE);
  const paginatedQuestions = remoteScope ? filteredQuestions : filteredQuestions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const selectablePageQuestions = paginatedQuestions.filter(q => !showEnglishBuilder || !/^(seen_passage|unseen_passage)/.test(q.type));
  const pageSelectedCount = selectablePageQuestions.filter(q => selectedIds.has(q.id)).length;
  const togglePageSelection = async (checked: boolean) => {
    if (selectionLoading || pageLoading) return;
    let selectionPool = questions;
    if (remoteScope) {
      const groups = [...new Set(selectablePageQuestions.map(q => q.stimulus_group_id).filter(Boolean))];
      if (checked && groups.length) {
        setSelectionLoading(true);
        try {
          const rows = await fetchBrowserGroups<QuestionRow>(remoteScope, groups);
          if (rows.length > 200) { toast.warning("সর্বোচ্চ ২০০টি প্রশ্ন নির্বাচন করা যাবে।"); return; }
          selectionPool = mergePageWithSelection(questions, [...(remotePage?.rows || []), ...rows], selectedIdsRef.current);
          setQuestions(selectionPool);
        } catch {
          toast.error("একই উদ্দীপকের প্রশ্ন আনতে সমস্যা হয়েছে। আবার চেষ্টা করুন।"); return;
        } finally { setSelectionLoading(false); }
      }
    }
    const ids = new Set(selectablePageQuestions.map(q => q.id));
    if (!showEnglishBuilder) {
      const groups = new Set(selectablePageQuestions.map(q => q.stimulus_group_id).filter(Boolean));
      selectionPool.forEach(q => { if (q.stimulus_group_id && groups.has(q.stimulus_group_id)) ids.add(q.id); });
    }
    const next = new Set(selectedIdsRef.current);
    ids.forEach(id => { if (checked) next.add(id); else next.delete(id); });
    if (!showEnglishBuilder && next.size > 200) {
      toast.warning("এই পেজের সব প্রশ্ন নিলে ২০০ প্রশ্নের সীমা অতিক্রম করবে");
      return;
    }
    setSelectedIds(next);
  };

  // Reset page when filters change
  const firstFilterRender = useRef(true);
  useEffect(() => { if (firstFilterRender.current) { firstFilterRender.current = false; return; } setCurrentPage(1); }, [filterSearch, filterType, filterChapterIds, filterTopicIds, filterUntopicedChapterIds, filterBoards, filterSchools, filterYear, filterSchoolYear, filterSpecial]);

  const savePaperDraft = () => {
    // A new paper must not inherit another paper's personal edits or settings.
    sessionStorage.removeItem("viewPaperSettings");
    const selectedQuestions = questions.filter(q => selectedIds.has(q.id) && (!showEnglishBuilder || !/^(seen_passage|unseen_passage)/.test(q.type)));
    const normalizePassage = (text: string) => text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const selected = showEnglishBuilder ? questions.filter(q => selectedQuestions.includes(q) || (
      /^(seen_passage|unseen_passage)/.test(q.type) && selectedQuestions.some(item => item.chapter_id === q.chapter_id && (
        (item.stimulus_text && normalizePassage(item.stimulus_text) === normalizePassage(q.question)) ||
        (item.stimulus_group_id && item.stimulus_group_id === q.stimulus_group_id)
      ))
    )) : selectedQuestions;
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
      programName: form.programName.trim() || DEFAULT_EXAM_NAME,
      teacherName: user?.user_metadata?.full_name || user?.email || "",
      topicNames: topicNamesForPaper,
    }));
  };

  useEffect(() => {
    if (step !== "questionList" || addToPaper) return;
    savePaperDraft();
  }, [step, addToPaper, selectedIds, questions, showEnglishBuilder, topics, institute,
    effectiveClassId, selectedSubjectIds, form.chapterIds, form.programName,
    className, subjectName, subjectCode, selectedChapterNames, user]);

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
      analytics.paperGenerate(String(form.classId), String(form.subjectId));
      savePaperDraft();
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
    const minutes = Number(form.count) || 100;
    return <div className="question-set-enter max-w-[874px] mx-auto py-8 sm:py-12">
      <div className="relative overflow-hidden bg-white border border-slate-200 shadow-sm min-h-[630px] px-5 sm:px-6 py-8 flex flex-col">
        {remoteScope && <QuestionBorderLoading ready={!!remotePage && !pageLoading} failed={pageError} />}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold">{institute?.name || 'Institute'}</h2>
          <p>{form.programName.trim() || DEFAULT_EXAM_NAME}</p>
          <p>{className}</p><p>{subjectName}</p>
        </div>
        <div className="flex justify-between mt-2 border-b border-slate-200 pb-1">
          <span>সময়: {Math.floor(minutes / 60) > 0 ? `${toBanglaNum(Math.floor(minutes / 60))} ঘণ্টা ` : ''}{toBanglaNum(minutes % 60)} মিনিট</span><span>পূর্ণমান: {toBanglaNum(form.count || 100)}</span>
        </div>
        <p className="text-center mt-3">প্রশ্নপত্রে কোনো প্রকার দাগ/চিহ্ন দেওয়া যাবে না।</p>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-16">
          <div className="flex items-center gap-2 text-xl"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><span>প্রশ্নসেট তৈরি হয়েছে!</span></div>
          <p className="text-slate-600">নিচের বাটনে ক্লিক করে ডেটাবেজ থেকে প্রশ্ন যুক্ত করুন</p>
          <Button onClick={() => { setSelectedIds(new Set()); setEnglishPreviewRows(null); handleAddQuestions(); }} className="rounded-lg bg-[#0A1E38] hover:bg-[#102E56] px-8 h-10">প্রশ্ন যুক্ত করুন</Button>
        </div>
      </div>
    </div>;
  }

  // ─── STEP 3: Question List with Advanced Filter Sidebar ───
  if (step === "questionList") {
    const englishSelectionContent = showEnglishBuilder ? <EnglishFirstPaperBuilder
      key={`${form.subjectId}:${form.chapterIds.join(',')}`}
      enabledBlocks={englishSections}
      className={englishClassName}
      chapters={chapters}
      topics={topics}
      onPreview={rows => {
        setEnglishPreviewRows(rows); setCurrentPage(1);
        setQuestions(previous => [...previous, ...rows.filter(q => !previous.some(r => r.id === q.id))]);
        scrollMainToTop();
      }}
      initialQuestions={questions}
    /> : null;
    const filterSidebarContent = (
      <div className="question-filter-panel space-y-4">
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
        <div className="question-filter-section border border-slate-200 bg-slate-50/80 rounded-xl p-3 text-center">
          <h4 className="font-heading font-bold text-slate-800 text-xs flex items-center justify-center gap-1">
            <Filter className="w-3.5 h-3.5 text-[#0A1E38]" /> ইউনিক প্রশ্ন ফিল্টার
          </h4>
          <p className="text-[11px] text-slate-500 mt-1">পূর্বের তৈরি কোনো প্রশ্ন বাদ দিয়ে শতভাগ নতুন প্রশ্ন সাজাতে পারবেন।</p>
        </div>

        {/* Special search */}
        <div className="question-filter-special question-filter-section border border-slate-200 bg-white rounded-xl p-3 shadow-xs">
          <div className="question-filter-heading flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-[#0A1E38]" />
            <h4 className="font-heading font-bold text-xs text-[#0A1E38]">ProshnoLab স্পেশাল ফিল্টার</h4>
          </div>
          <div className="space-y-2">
            {specialSearchOptions.map(opt => {
              const active = filterSpecial === opt.id;
              return (
                <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={active} onCheckedChange={() => setFilterSpecial(prev => prev === opt.id ? null : opt.id)} />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Type filter */}
        <div className="question-filter-section border border-border rounded-lg p-3">
          <h4 className="question-filter-heading font-heading font-bold text-sm mb-2">টাইপ</h4>
          <div className="space-y-2">
            {scopedTypeOptions.filter(t=>t!=="all").map(value=>({value,label:questionTypeLabel(value)})).map(opt => (
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
          const chapterCount = (cid: number) => remotePage ? remotePage.chapters[cid] || 0 : chapterPool.filter(q => q.chapter_id === cid).length;
          return (
            <div className="question-filter-section border border-border rounded-lg p-3">
              <div className="question-filter-heading flex items-center justify-between mb-3">
                <h4 className="font-heading font-bold text-sm">অধ্যায়</h4>

              </div>
              <div className="space-y-1">
                {chapters
                  .filter(c => form.chapterIds.includes(String(c.id)))
                  .map(c => {
                    const count = chapterCount(c.id);
                    const isActive = filterChapterIds.has(c.id);
                    const disabled = false;
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
                        <input type="radio" name="questionChapter" className="accent-[#00B4BC]"
                          checked={isActive} disabled={disabled}
                          onChange={() => {
                            setFilterChapterIds(new Set([c.id]));
                            setFilterTopicIds(new Set()); setFilterUntopicedChapterIds(new Set());
                            setCurrentPage(1);
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
          const topicCount = (tid: number) => remotePage ? remotePage.topics[tid] || 0 : topicPool.filter(q => q.topic_id === tid).length;
          const untopicedCount = (cid: number) =>
            remotePage ? remotePage.untopiced[cid] || 0 : topicPool.filter(q => q.chapter_id === cid && !q.topic_id).length;
          const chapterTopicTotal = (cid: number) =>
            remotePage ? remotePage.topicChapters[cid] || 0 : topicPool.filter(q => q.chapter_id === cid).length;
          return (
            <div className="question-filter-section border border-border rounded-lg p-3">
              <div className="question-filter-heading flex items-center justify-between mb-3">
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
        <div className="question-filter-section border border-border rounded-lg p-3">
          <div className="question-filter-heading flex items-center justify-between mb-2">
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
          <div className="question-filter-section border border-border rounded-lg p-3">
            <div className="question-filter-heading flex items-center justify-between mb-2">
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

    const toolbarFilterContent = (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" aria-label="ফিল্টার" title="ফিল্টার" className="h-11 shrink-0 bg-white/10 hover:bg-white/20 text-white border-white/20">
                    <SlidersHorizontal className="h-5 w-5" /><span className="question-toolbar-action-label">ফিল্টার</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
                  <SheetHeader>
                    <SheetTitle className="font-heading">এডভান্সড ফিল্টার মেনু</SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(85vh-60px)] pr-2 mt-4">
                    {englishSelectionContent || filterSidebarContent}
                  </ScrollArea>
                </SheetContent>
              </Sheet>
    );
    const toolbarTopContent = (
              <div className="question-picker-toolbar-top flex items-center justify-between flex-nowrap gap-4 overflow-x-auto bg-[#0A1E38] text-white p-3 sm:px-4 scrollbar-none">
                <div className="selected-question-summary" aria-label="ধরন অনুযায়ী নির্বাচিত প্রশ্ন" aria-live="polite" aria-atomic="true">
                  <span className="selected-question-summary__label"><CheckCheck className="h-4 w-4" /> নির্বাচিত</span>
                  {([
                    ["mcq", "MCQ"], ["cq", "CQ"], ["short", "SQ"],
                  ] as const).map(([type, label]) => {
                    const typeInitial = { mcq: "M", cq: "C", short: "S" }[type];
                    return (
                    <span key={type} title={label} aria-label={`${label}: ${toBanglaNum(selectedTypeCounts[type])}টি নির্বাচিত`} className={`selected-question-count selected-question-count--${type}`} data-active={selectedTypeCounts[type] > 0}>
                      <span aria-hidden="true" className="selected-question-type-icon text-sm font-bold leading-none">{typeInitial}</span>
                      <span className="selected-question-type-name">{label}</span>
                      <strong key={selectedTypeCounts[type]}>{toBanglaNum(selectedTypeCounts[type])}</strong>
                    </span>
                  ); })}
                </div>

                <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep("questionSet")}
                    aria-label="বিবরণীতে ফিরে যান"
                    title="বিবরণী"
                    className="h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white border-white/20 text-sm font-medium"
                  >
                    <ArrowLeft className="h-5 w-5" /><span className="question-toolbar-action-label">বিবরণী</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleViewPaper}
                    aria-label="প্রশ্নপত্র প্রিভিউ"
                    title="প্রিভিউ"
                    disabled={selectionLoading || selectedIds.size === 0}
                    className="question-preview-button"
                  >
                    <Eye className="h-5 w-5 shrink-0" /><span className="question-toolbar-action-label">প্রিভিউ</span>
                  </Button>
                  {toolbarFilterContent}

                </div>
              </div>
    );
    const toolbarContent = (
      <div className="question-picker-toolbar sticky top-0 z-20">
        {mobileToolbarTarget ? createPortal(toolbarTopContent, mobileToolbarTarget) : toolbarTopContent}
              <div className="question-picker-toolbar-bottom flex items-center gap-3 px-3 py-2">
                <label className="page-select-control flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800" title="এই পেজে দেখানো প্রশ্নগুলো একসঙ্গে নির্বাচন করুন">
                  <Checkbox
                    aria-label="এই পেজের সব প্রশ্ন নির্বাচন"
                    disabled={selectionLoading || pageLoading || selectablePageQuestions.length === 0}
                    checked={selectablePageQuestions.length > 0 && pageSelectedCount === selectablePageQuestions.length ? true : pageSelectedCount > 0 ? "indeterminate" : false}
                    onCheckedChange={checked => togglePageSelection(checked === true)}
                  />
                  <span>{pageSelectedCount === selectablePageQuestions.length && selectablePageQuestions.length > 0
                    ? "এই পেজের নির্বাচন বাতিল"
                    : `এই পেজের ${toBanglaNum(selectablePageQuestions.length)}টি প্রশ্ন নিন`}</span>
                </label>
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
                    result = result.filter(r => refMatchesSchools(schoolQuestionRefs(r), filterSchools, filterSchoolYear));
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
                const countByType = (t: string) => remotePage ? (remotePage.filterTypes || remotePage.types)[t] || 0 : base.filter(q => q.type === t).length;
                const fmt = (n: number) => n.toLocaleString("bn-BD");
                const badges = [
                  { value: "mcq", label: "MCQ", count: countByType("mcq"), dot: "bg-[#00B4BC]" },
                  { value: "cq", label: "CQ", count: countByType("cq"), dot: "bg-[#00B4BC]" },
                  { value: "short", label: "SQ", count: countByType("short"), dot: "bg-[#00B4BC]" },

                ];

                const hasAnyFilter = !!filterSearch.trim() || filterType !== null || filterChapterIds.size > 0 || filterTopicIds.size > 0
                  || filterUntopicedChapterIds.size > 0 || filterBoards.size > 0 || filterSchools.size > 0
                  || !!filterYear || !!filterSchoolYear || filterSpecial !== null;

                const resetAllFilters = () => {
                  setSelectedIds(new Set());
                  setEnglishPreviewRows(null);
                  setFilterSearch("");
                  setDebouncedSearch("");
                  setFilterType(remoteScope?.types[0] || "mcq");
                  setFilterChapterIds(new Set(remoteScope ? [remoteScope.chapterIds[0]] : form.chapterIds.slice(0, 1).map(Number)));
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
                  <div className="question-picker-type-filters flex items-center gap-2 min-w-0 flex-1">
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
                                  ? "bg-[#0A1E38] text-white shadow-none"
                                  : isDisabled
                                    ? "text-muted-foreground/60 cursor-not-allowed"
                                    : "text-foreground/80 hover:text-foreground hover:bg-background/70"
                                }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full transition-opacity ${b.dot} ${isActive ? "opacity-100" : "opacity-80"}`} />
                              <span>{b.label}</span>
                              <span
                                className={`inline-flex items-center justify-center min-w-[1.4rem] h-[18px] px-1.5 rounded-md text-[11px] font-bold tabular-nums tracking-tight transition-colors ${isActive
                                    ? "bg-white/15 text-white"
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
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={scrollMainToTop} aria-label="প্রশ্ন তালিকার উপরে যান" className="h-8 gap-1 bg-white"><ArrowUp className="h-3.5 w-3.5" /> উপরে</Button>
                  <Button variant="outline" size="sm" onClick={scrollMainToBottom} aria-label="প্রশ্ন তালিকার নিচে যান" className="h-8 gap-1 bg-white"><ArrowDown className="h-3.5 w-3.5" /> নিচে</Button>
                </div>
              </div>
            </div>
    );

    return (
      <>
        <div className="question-builder question-set-enter lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:h-[calc(100vh-7rem)] lg:overflow-hidden">
          {/* Main content - independently scrollable on desktop */}
          <div ref={mainScrollRef} className="space-y-4 lg:overflow-y-auto lg:pr-2 lg:-mr-2">
            {toolbarTarget ? createPortal(toolbarContent, toolbarTarget) : toolbarContent}

            <div className="hidden sm:flex bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-center text-xs text-slate-600 items-center justify-center gap-2">
              <Flag className="w-3.5 h-3.5 text-[#00858C] shrink-0" />
              <span>প্রশ্নে কোনো ভুল বা অসঙ্গতি পেলে ফ্ল্যাগ আইকনে ক্লিক করে রিপোর্ট করুন।</span>
            </div>

            {/* Mobile filter button + search */}
            <div className="lg:hidden flex gap-2">
              <Input aria-label="প্রশ্ন খুঁজুন" placeholder="কিওয়ার্ড সার্চ করুন" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} className="flex-1 min-w-0 h-11 text-base" />

            </div>

            <div className="relative min-h-[240px] space-y-3" aria-busy={pageLoading}>
              {pageLoading && <QuestionLoading />}
              {pageError && <div role="alert" className="p-6 text-center">
                <p>প্রশ্ন আনতে সমস্যা হয়েছে।</p>
                <Button variant="outline" onClick={() => setPageRetry(value => value + 1)}>আবার চেষ্টা করুন</Button>
              </div>}
              {paginatedQuestions.map((q, idx) => {
                if (showEnglishBuilder && /^(seen_passage|unseen_passage)/.test(q.type)) {
                  return <div key={q.id} className="rounded-lg border border-[#00B4BC]/20 border-l-4 border-l-[#00B4BC] bg-[#00B4BC]/5 p-4" data-passage-preview>
                    <div className="mb-2 text-sm font-bold text-[#0A1E38]">{questionTypeLabel(q.type)}</div>
                    <div className="text-base leading-relaxed text-slate-900"><LatexRenderer italicMathVariables text={q.question} /></div>
                  </div>;
                }
                const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + idx;
                const isSelected = selectedIds.has(q.id);
                const typeMeta: Record<string, { label: string; dot: string; chip: string }> = {
                  mcq: { label: "MCQ", dot: "bg-[#00B4BC]", chip: "text-[#00858C] bg-[#00B4BC]/5 border-[#00B4BC]/20" },
                  short: { label: "সংক্ষিপ্ত", dot: "bg-[#00B4BC]", chip: "text-[#00858C] bg-[#00B4BC]/5 border-[#00B4BC]/20" },
                  cq: { label: "সৃজনশীল", dot: "bg-[#00B4BC]", chip: "text-[#00858C] bg-[#00B4BC]/5 border-[#00B4BC]/20" },
                  descriptive: { label: "বর্ণনামূলক", dot: "bg-[#00B4BC]", chip: "text-[#00858C] bg-[#00B4BC]/5 border-[#00B4BC]/20" },
                };
                const tm = typeMeta[q.type] ?? { label: questionTypeLabel(q.type), dot: "bg-muted-foreground", chip: "text-muted-foreground bg-muted border-border" };
                return (
                  <Card
                    key={q.id}
                    onClick={() => toggleQuestion(q.id)}
                    data-selected={isSelected}
                    data-question-type={q.type}
                    className={`question-select-card group relative overflow-hidden cursor-pointer border rounded-lg transition-all duration-150 ${isSelected
                        ? "border-[#00B4BC] shadow-none bg-[#00B4BC]/[0.03] ring-1 ring-[#00B4BC]/20"
                        : "border-slate-200 bg-white shadow-none"
                      }`}
                  >
                    <span
                      aria-hidden
                      className={`pointer-events-none absolute left-0 top-0 h-full w-[3px] transition-all duration-150 ${isSelected ? "bg-[#00B4BC] opacity-100" : `${tm.dot} opacity-0`
                        }`}
                    />
                    <CardContent className="p-4 pl-[18px]">
                      <div className="question-card-heading flex flex-wrap items-center justify-between mb-2.5 gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Checkbox
                            checked={isSelected}
                            disabled={selectionLoading || pageLoading}
                            onCheckedChange={() => toggleQuestion(q.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-lg border-slate-400 data-[state=checked]:bg-[#0A1E38] data-[state=checked]:border-[#0A1E38]"
                          />
                          <span className={`question-type-badge inline-flex items-center gap-1.5 h-[22px] px-2 rounded-lg text-[11px] font-bold tracking-tight border ${tm.chip}`}>
                            {tm.label}
                          </span>
                          {isSelected && <span className="question-selected-label"><CheckCircle2 className="h-3.5 w-3.5" /> নির্বাচিত</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <ReferenceBadges
                            boardRefs={q.board_references as any}
                            uniRefs={q.university_references as any}
                          />
                          <button
                            className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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

                        const hasSeparateStimulus = !showEnglishBuilder && q.type === "mcq" && Boolean(
                          q.stimulus_text && (q.stimulus_text.replace(/<[^>]*>/g, "").trim().length > 0 || /<img\s/i.test(q.stimulus_text))
                        );

                        const isShort = (q.type === "short" || isLanguageType(q.type));
                        return (
                          <div>
                            {hasSeparateStimulus && !isShort && (
                              <div
                                key={`stim-${q.id}`}
                                className="question-picker-stimulus mb-3 p-3 border-l-2 border-slate-400 bg-slate-50 rounded-lg italic text-base rich-text-content text-slate-800"
                              >
                                <LatexRenderer italicMathVariables text={q.stimulus_text || ""} />
                              </div>
                            )}
                            <div className="question-select-prompt font-medium mb-3 flex items-baseline gap-2 text-base text-slate-900 leading-relaxed">
                              <span className="shrink-0 font-bold text-slate-800 font-mono text-base">{toBanglaNum(globalIdx + 1)}. </span>
                              <div className="flex-1 mc-block-question min-w-0 text-base">
                                <LatexRenderer italicMathVariables key={`q-${q.id}`} text={displayQuestion} />
                              </div>
                            </div>
                            {hasSeparateStimulus && isShort && (
                              <div
                                key={`stim-${q.id}`}
                                className="question-picker-stimulus mb-3 p-3 border-l-2 border-slate-400 bg-slate-50 rounded-lg italic text-base rich-text-content text-slate-800"
                              >
                                <LatexRenderer italicMathVariables text={q.stimulus_text || ""} />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {q.type === "mcq" && q.option_a && (
                        <AutoFitQuestionGrid measurementKey={JSON.stringify([q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer])} maxColumns={2} gap={10} className="question-select-options gap-y-2.5">
                          {["option_a", "option_b", "option_c", "option_d"].map((key, oi) => {
                            const val = (q as any)[key];
                            if (!val) return null;
                            const label = ["ক", "খ", "গ", "ঘ"][oi];
                            const isAnswer = isCorrectOption(q.correct_answer, oi, [q.option_a, q.option_b, q.option_c, q.option_d]);
                            return (
                              <div key={key} data-correct={isAnswer} aria-label={isAnswer ? `${label}: সঠিক উত্তর` : undefined} className={`question-select-option flex items-center gap-2.5 p-2.5 rounded-lg text-base ${isAnswer ? "bg-[#00B4BC]/[0.07] text-[#006A70] font-bold border border-[#00B4BC]/30" : "bg-slate-50 text-slate-800 border border-slate-200"}`}>
                                <span
                                  className="shrink-0 inline-flex items-center justify-center rounded-lg border border-current font-bold leading-none text-xs"
                                  style={{ width: "1.6em", height: "1.6em" }}
                                >
                                  {label}
                                </span>
                                <span className="question-option-value"><LatexRenderer italicMathVariables text={val} inline /></span>
                                {isAnswer && <CheckCircle2 className="question-answer-check" aria-label="সঠিক উত্তর" />}
                              </div>
                            );
                          })}
                        </AutoFitQuestionGrid>
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
                          <div className="mt-3 space-y-2 pl-4">
                            {subFields.map(f => {
                              const val = data?.[f.key];
                              if (!val) return null;
                              return (
                                <div key={f.key} className="text-sm flex items-start gap-1.5 leading-relaxed">
                                  <span className="font-semibold shrink-0 select-none">({f.label})</span>
                                  <div className="flex-1 min-w-0 cq-sub-content">
                                    <LatexRenderer italicMathVariables text={val} inline />
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
              {(!remoteScope || (!pageLoading && !pageError)) && filteredQuestions.length === 0 && (
                <p className="text-center text-muted-foreground py-8">কোনো প্রশ্ন পাওয়া যায়নি</p>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-4" aria-label="Question pages">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageLoading || currentPage === 1}
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
                            className="question-page-number w-9 h-9 p-0"
                            aria-current={p === currentPage ? "page" : undefined}
                            onClick={() => { setCurrentPage(p); scrollMainToTop(); }}
                          >
                            <span>{String(p)}</span>
                          </Button>
                        </span>
                      );
                    })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageLoading || currentPage >= totalPages}
                  onClick={() => { setCurrentPage(p => p + 1); scrollMainToTop(); }}
                >
                  পরের <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </div>

          {/* Right sidebar - Advanced Filter (independently scrollable on desktop) */}
          <aside className="question-filter-sidebar hidden lg:block lg:overflow-y-auto lg:pr-1">
            <div className="space-y-4 pb-2">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-heading font-bold text-[#0A1E38] text-left mb-4 border-b border-border pb-3">{showEnglishBuilder ? 'English প্রশ্নপত্র বাছাই' : 'এডভান্সড ফিল্টার মেনু'}</h3>
                  {englishSelectionContent || filterSidebarContent}
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
    <div className="manual-create-form max-w-5xl mx-auto py-0 sm:py-4">
      {addToPaper && (
        <div className="mb-4 bg-[#00B4BC]/5 border border-[#00B4BC]/20 rounded-lg p-4 text-center">
          <h1 className="font-heading text-lg font-bold text-slate-800">
            বিদ্যমান প্রশ্নপত্রে আরও প্রশ্ন যুক্ত করুন
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            নতুন প্রশ্ন নির্বাচন করে "প্রশ্নপত্র দেখুন" বাটনে ক্লিক করলে আগের প্রশ্নগুলোর সাথে যুক্ত হবে।
          </p>
        </div>
      )}

      {/* Main Minimal Form Card */}
      <Card className="border border-slate-200 shadow-[0_6px_28px_-16px_#0a1e3830] bg-white rounded-2xl overflow-hidden">
        <CardContent className="manual-form-fields p-3 sm:p-7 grid grid-cols-1 gap-3">
          {/* 1. Exam / Program Name */}
          <div className="space-y-2" data-field-complete={!!form.programName.trim()}>
            <Button variant="outline" className="w-full h-12 justify-between rounded-lg border-slate-200 text-base font-normal bg-white" onClick={() => setExamModalOpen(true)}>
              <span className="truncate">{form.programName || "পরীক্ষার ধরন নির্বাচন করুন"}</span>
              <Scan className="h-4 w-4 shrink-0 text-slate-500" />
            </Button>

          </div>

          {/* 2. Class Picker */}
          <div data-field-complete={!!form.classId}>
            <ClassPicker
              value={form.classId}
              classes={selectableClasses}
              placeholder="শ্রেণি"
              triggerClassName="h-12 rounded-lg border-slate-200 focus:border-[#0A1E38] focus:ring-1 focus:ring-[#0A1E38] text-base text-slate-800 bg-white"
              onChange={(v) => {
                setSubjectVersion("bangla");
                setForm({ ...form, classId: v, subjectId: "", subjectIds: [], chapterIds: [] });
              }}
            />
          </div>

          {/* 3. Subject Picker */}
          <div data-field-complete={selectedSubjectIds.length > 0} onClick={!form.classId ? () => setWarningDialog("subject") : undefined}>
            <SubjectPicker
              value={form.subjectId}
              values={form.subjectIds}
              subjects={filteredSubjects}
              classes={classes}
              version={subjectVersion}
              disabled={!form.classId}
              placeholder="বিষয় *"
              triggerIcon="scan"
              triggerClassName="h-12 rounded-lg border-slate-200 focus:border-[#0A1E38] text-base text-slate-800 bg-white"
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
          {showEnglishBuilder ? <Button variant="outline" className="w-full h-12 justify-between rounded-lg border-slate-200 text-base font-normal" onClick={() => setChapterModalOpen(true)}>
            <span>প্রশ্নের ধরন</span><span className="text-sm">{toBanglaNum(englishSections.length)}টি নির্বাচিত</span><Scan className="h-4 w-4 text-slate-500" />
          </Button> : <>
          <div
            className=""
            data-field-complete={form.chapterIds.length > 0}
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
              className={`flex h-12 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 py-1 text-base cursor-pointer transition-colors text-slate-800 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0A1E38] ${selectedSubjectIds.length === 0 ? "opacity-60 bg-slate-50" : ""
                }`}
            >
              <span className="truncate font-medium flex-1 min-w-0 py-1 px-0.5 leading-normal">
                {selectedSubjectIds.length === 0 ? (
                  <span className="text-slate-500">অধ্যায় *</span>
                ) : form.chapterIds.length === 0 ? (
                  <span className="text-slate-500">অধ্যায় *</span>
                ) : form.chapterIds.length === chapters.length ? (
                  <span className="text-slate-800 font-semibold">সকল অধ্যায় ({toBanglaNum(chapters.length)}টি)</span>
                ) : (
                  <span className="text-slate-800 font-semibold">অধ্যায় ({toBanglaNum(form.chapterIds.length)}টি নির্বাচিত)</span>
                )}
              </span>
              <Scan className="h-4 w-4 shrink-0 text-slate-500 ml-2" />
            </div>
          </div>

          </>}

          <>
          {/* 5. Type & Marks (Two-Column Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
            <div className="min-w-0" data-field-complete={selectedSubjectIds.length > 0 && !!form.type}>
                <Button variant="outline" className="w-full h-12 justify-between rounded-lg border-slate-200 text-base font-normal bg-white" onClick={() => setTypeModalOpen(true)}>
                  <span className="truncate">{!form.type ? "প্রশ্নের টাইপ নির্বাচন করুন" : form.type === "all" ? "সমন্বিত প্রশ্ন (সৃজঃ + বহু + সংক্ষিপ্ত + অন্যান্য)" : typeLabels[form.type] || questionTypeLabel(form.type)}</span>
                  <Scan className="h-4 w-4 shrink-0 text-slate-500" />
                </Button>
            </div>

            <div>
              <div className="relative" data-field-complete={Number(form.count) >= 1 && Number(form.count) <= 200}>
                <Input
                  type="number"
                  aria-label="প্রশ্নের সংখ্যা"
                  inputMode="numeric"
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
                  className="h-12 rounded-lg border-slate-200 focus:border-[#0A1E38] text-base text-slate-800 placeholder:text-slate-500 bg-white pr-36 sm:pr-20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none select-none">
                  <span className="sm:hidden">প্রশ্ন · </span>সর্বোচ্চ ২০০
                </span>
              </div>
            </div>
          </div>

          {/* 6. Submit Action Button */}
          <div className="pt-2 sm:pt-4 border-t border-slate-100">
            <Button
              className="w-full h-12 rounded-lg bg-[#0A1E38] hover:bg-[#122B4D] text-white font-bold text-lg shadow-xs border border-[#0A1E38] transition-colors flex items-center justify-center cursor-pointer"
              onClick={handleCreateQuestionSet}
              disabled={loading || !form.programName.trim() || !form.classId || !form.type || selectedSubjectIds.length === 0 || form.chapterIds.length === 0 || !Number.isInteger(Number(form.count)) || Number(form.count) < 1 || Number(form.count) > 200 || (showEnglishBuilder && !englishSections.length)}
              title={selectedSubjectIds.length === 0 ? "প্রথমে বিষয় নির্বাচন করুন" : form.chapterIds.length === 0 ? "অন্তত একটি অধ্যায় নির্বাচন করুন" : undefined}
            >
              <span>{loading ? "অপেক্ষা করুন..." : "প্রশ্ন তৈরি করুন"}</span>
            </Button>
          </div>
          </>
        </CardContent>
      </Card>

      <Dialog open={examModalOpen} onOpenChange={setExamModalOpen}>
        <DialogContent className="max-w-lg rounded-[6px] sm:rounded-[6px] border-[#b8c7d6] p-0 gap-0 overflow-hidden bg-[#f6f8fa]">
          <DialogHeader className="bg-[#e3eaf0] border-b border-[#b8c7d6] px-5 py-4"><DialogTitle className="text-base font-bold text-[#0A1E38]">পরীক্ষার নাম নির্বাচন করুন</DialogTitle></DialogHeader>
          <div className="p-3 space-y-1">
            {[...EXAM_NAME_OPTIONS, "custom"].map(name => {
              const selected = name === "custom" ? customExamName : !customExamName && form.programName === name;
              return <button type="button" key={name} onClick={() => { setCustomExamName(name === "custom"); setForm(previous => ({ ...previous, programName: name === "custom" ? "" : name })); }} className={`w-full flex items-center gap-3 rounded-[4px] px-3 py-3 text-left text-base ${name === "custom" ? `!mt-3 border-2 font-bold shadow-sm ${selected ? "border-[#00858C] bg-teal-100 text-teal-950 ring-2 ring-teal-500/15" : "border-teal-300 bg-teal-50 text-teal-900 hover:border-teal-500 hover:bg-teal-100"}` : selected ? "bg-[#0A1E38]/5 text-[#0A1E38] font-bold" : "hover:bg-slate-100 text-slate-700"}`}>
                <span className={`h-4 w-4 shrink-0 rounded-[3px] border flex items-center justify-center ${selected ? "bg-black border-black text-white" : "bg-white border-slate-400"}`}>{selected && <CheckCheck className="h-3 w-3" />}</span>
                {name === "custom" ? "নিজে পরীক্ষার নাম লিখুন" : name}
              </button>;
            })}
            {customExamName && <div className="px-3 pb-3 pt-1">
              <Input
                autoFocus
                id="manual-exam-name"
                placeholder="পরীক্ষার নাম লিখুন"
                aria-label="পরীক্ষার নাম"
                value={form.programName}
                onChange={(e) => setForm(previous => ({ ...previous, programName: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter" && form.programName.trim()) { e.preventDefault(); setExamModalOpen(false); } }}
                className="h-12 rounded-[2px] border-slate-200 text-base bg-white"
              />
            </div>}
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 px-4 py-3 border-t border-[#b8c7d6]">
            <Button variant="outline" className="rounded-[4px] bg-slate-100 border-[#b8c7d6]" onClick={() => setExamModalOpen(false)}>বন্ধ করুন</Button>
            <Button className="rounded-[4px] bg-[#0A1E38] hover:bg-[#122B4D]" disabled={!form.programName.trim()} onClick={() => setExamModalOpen(false)}>নিশ্চিত করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={typeModalOpen} onOpenChange={setTypeModalOpen}>
        <DialogContent className="max-w-lg rounded-[6px] sm:rounded-[6px] border-[#b8c7d6] p-0 gap-0 overflow-hidden bg-[#f6f8fa]">
          <DialogHeader className="bg-[#e3eaf0] border-b border-[#b8c7d6] px-5 py-4"><DialogTitle className="text-base font-bold text-[#0A1E38]">প্রশ্নের ধরন নির্বাচন করুন</DialogTitle></DialogHeader>
          <div className="p-3 space-y-1">
            {(showEnglishBuilder ? ["all"] : scopedTypeOptions.filter(t => !["short", "descriptive"].includes(t))).map(t => <button type="button" key={t} onClick={() => setForm(previous => ({ ...previous, type: t }))} className={`w-full flex items-center gap-3 rounded-[4px] px-3 py-3 text-left text-base ${form.type === t ? "bg-[#0A1E38]/5 text-[#0A1E38] font-bold" : "hover:bg-slate-100 text-slate-700"}`}>
              <span className={`h-4 w-4 shrink-0 rounded-[3px] border flex items-center justify-center ${form.type === t ? "bg-black border-black text-white" : "bg-white border-slate-400"}`}>{form.type === t && <CheckCheck className="h-3 w-3" />}</span>
              {t === "all" ? "সমন্বিত প্রশ্ন (সৃজঃ + বহু + সংক্ষিপ্ত + অন্যান্য)" : typeLabels[t] || questionTypeLabel(t)}
            </button>)}
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 px-4 py-3 border-t border-[#b8c7d6]">
            <Button variant="outline" className="rounded-[4px] bg-slate-100 border-[#b8c7d6]" onClick={() => setTypeModalOpen(false)}>বন্ধ করুন</Button>
            <Button className="rounded-[4px] bg-[#0A1E38] hover:bg-[#122B4D]" onClick={() => setTypeModalOpen(false)}>নিশ্চিত করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chapter Selection Dialog */}
      <Dialog open={chapterModalOpen} onOpenChange={setChapterModalOpen}>
        <DialogContent className="chapter-selection-dialog max-w-lg rounded-[6px] sm:rounded-[6px] border-[#b8c7d6] p-0 overflow-hidden bg-[#f6f8fa]">
          <div className="flex items-center justify-between pl-5 pr-14 py-3.5 bg-[#e3eaf0] border-b border-[#b8c7d6]">
            <div className="text-base font-bold text-slate-800">{showEnglishBuilder ? 'প্রশ্নের ধরন নির্বাচন করুন' : 'অধ্যায় নির্বাচন করুন'}</div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 bg-white border border-[#b8c7d6] px-2 py-1 rounded-[4px]">
                {toBanglaNum(showEnglishBuilder ? englishSections.length : form.chapterIds.length)} / {toBanglaNum(showEnglishBuilder ? englishBlocks.length : chapters.length)} টি সিলেক্টেড
              </span>
              <button
                type="button"
                onClick={showEnglishBuilder ? () => setEnglishSections(previous => previous.length === englishBlocks.length ? [] : englishBlocks.map((_, i) => i)) : toggleAllChapters}
                className="text-xs font-bold text-[#0A1E38] hover:bg-slate-200 bg-white border border-[#b8c7d6] px-2.5 py-1 rounded-[4px] transition-colors cursor-pointer"
              >
                {(showEnglishBuilder ? englishSections.length === englishBlocks.length : form.chapterIds.length === chapters.filter(c => hasSubscription || c.is_free).length && chapters.length > 0)
                  ? "সব আনসিলেক্ট"
                  : "সব সিলেক্ট"}
              </button>
            </div>
          </div>
          <div className="p-4">
            <ScrollArea className="h-72 border border-[#b8c7d6] rounded-[4px]">
              <div className="p-2 space-y-1">
                {showEnglishBuilder ? englishBlocks.map((block, index) => <label key={block.title} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[4px] text-base cursor-pointer ${englishSections.includes(index) ? 'bg-[#0A1E38]/5 border border-[#0A1E38]/25 font-semibold' : 'hover:bg-slate-50'}`}>
                  <Checkbox checked={englishSections.includes(index)} onCheckedChange={checked => setEnglishSections(previous => checked ? [...previous, index] : previous.filter(i => i !== index))} />
                  <span>{block.title.split(' (')[0]} {index < 3 ? [' - Q1 + Q2', ' - Q3 + Q4', ' - Q5 + Q6 + Q7'][index] : ''}</span>
                </label>) : chapters.map((c) => {
                  const isSelected = form.chapterIds.includes(String(c.id));
                  const isLocked = !hasSubscription && !c.is_free;
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[4px] transition-colors text-base select-none ${isLocked
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
                        <Lock aria-label="লক করা অধ্যায়" className="w-4 h-4 text-slate-500 shrink-0" />
                      ) : (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleChapter(String(c.id))}
                          className="rounded-[4px] border-slate-400 data-[state=checked]:bg-[#0A1E38] data-[state=checked]:border-[#0A1E38]"
                        />
                      )}
                      <span className={isLocked ? "text-slate-500" : ""}>{c.name}</span>
                      {isLocked && (
                        <span className="ml-auto text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-[4px] font-semibold">
                          প্যাকেজ প্রয়োজন
                        </span>
                      )}
                    </label>
                  );
                })}
                {chapters.length === 0 && (
                  <p className="text-center text-slate-500 py-8 text-base">কোনো অধ্যায় পাওয়া যায়নি</p>
                )}
              </div>
            </ScrollArea>
          </div>
          <div className="px-5 py-3 bg-slate-50 border-t border-[#b8c7d6] flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setChapterModalOpen(false)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-base px-5 h-11 rounded-[4px] border border-[#b8c7d6] cursor-pointer"
            >
              বন্ধ করুন
            </Button>
            <Button
              type="button"
              onClick={() => setChapterModalOpen(false)}
              className="bg-[#0A1E38] hover:bg-[#122B4D] text-white font-bold text-base px-6 h-11 rounded-[4px] cursor-pointer border border-[#0A1E38]"
            >
              নিশ্চিত করুন
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!warningDialog} onOpenChange={() => setWarningDialog(null)}>
        <DialogContent className="max-w-md rounded-[6px] sm:rounded-[6px] border-[#b8c7d6] bg-[#f6f8fa] p-0 gap-0 overflow-hidden">
          <DialogHeader className="bg-[#e3eaf0] border-b border-[#b8c7d6] px-5 py-4">
            <DialogTitle className="text-left text-base font-bold text-[#0A1E38]">{warningDialog && warningMessages[warningDialog].title}</DialogTitle>
          </DialogHeader>
          <p className="text-left text-base text-slate-600 px-5 py-6">{warningDialog && warningMessages[warningDialog].prerequisite}</p>
          <DialogFooter className="grid grid-cols-2 gap-2 border-t border-[#b8c7d6] px-4 py-3 bg-[#f1f5f9]">
            <Button variant="outline" className="h-10 bg-[#0A1E38] hover:bg-[#122B4D] border-[#0A1E38] text-white hover:text-white rounded-[4px] text-base font-bold" onClick={() => setWarningDialog(null)}>সিলেক্ট করুন</Button>
            <Button variant="outline" className="h-10 bg-slate-100 hover:bg-slate-200 border-[#b8c7d6] rounded-[4px] text-base text-slate-700" onClick={() => setWarningDialog(null)}>বন্ধ করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
