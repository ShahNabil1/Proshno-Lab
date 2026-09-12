import { isCorrectOption } from "@/lib/answerKey";
import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Download, Settings, Plus, Minus, Save, Pencil, Upload, SlidersHorizontal } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import LatexRenderer from "@/components/LatexRenderer";
import FloatingToolbar from "@/components/FloatingToolbar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCloudBackup } from "@/hooks/useCloudBackup";
import { findRepeatedStimuli, hasRenderableStimulus, normalizeStimulusKey } from "@/lib/stimulusGroups";

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
  board_references?: any[] | null;
  university_references?: any[] | null;
  creative_data?: any | null;
  stimulus_group_id?: string | null;
  stimulus_text?: string | null;
  class_id?: number;
  subject_id?: number;
  chapter_id?: number;
}

interface PaperMeta {
  instituteName: string;
  instituteUpazila?: string;
  instituteDistrict?: string;
  instituteDivision?: string;
  institutePhone?: string;
  instituteSpecificAddress?: string;
  className: string;
  subjectName: string;
  chapterNames: string[];
  programName: string;
  subjectCode?: string;
  teacherName?: string;
  topicNames?: string[];
}

type PaperSize = "A4" | "Letter" | "Legal" | "A5";
type OptionStyle = "none" | "bracket" | "dot" | "paren";
type ColumnCount = 1 | 2 | 3;
type TextAlign = "left" | "center" | "right" | "justify";

// Match eproshnobank's subtle, print-friendly question-column separator.
const COLUMN_DIVIDER_STYLE = "0.5px solid #b8b8b8";
const PREVIEW_FONT_SCALE = 16 / 14;

/* Convert index to Bangla numeral */
const toBanglaNum = (n: number): string => {
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(n).split("").map(d => digits[parseInt(d)] ?? d).join("");
};

/* Strip wrapping <p> tags from option values, preserving line breaks */
const stripPTags = (html: string): string => {
  // Convert </p><p> boundaries to <br> to preserve line breaks
  let cleaned = html
    .replace(/<\/p>\s*<p[^>]*>/gi, "<br/>")
    .replace(/^<p[^>]*>/i, "")
    .replace(/<\/p>$/i, "")
    .trim();
  return cleaned;
};

/**
 * Answers come from two sources:
 *  - Rich text editor (manual single add) -> already valid HTML, keep as-is.
 *  - Bulk upload / paste -> plain text, often a single squashed line.
 * For plain text we smartly split into lines (newlines, and common Bangla
 * math step markers outside math delimiters) so the output stays organized.
 */
const STEP_MARKERS = /(?:বা,|অর্থাৎ,|সুতরাং,|অতএব,|এখানে,|আবার,|∴|⇒)/;

const formatAnswerContent = (raw: string): string => {
  if (!raw) return "";
  if (/<(p|br|div|ul|ol|li|table|img|h[1-6])\b/i.test(raw)) return raw;

  let text = raw.replace(/\r\n/g, "\n").trim();

  if (!text.includes("\n")) {
    // Split before step markers, but never inside $...$ / \(...\) / \[...\] math
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g);
    text = parts
      .map((seg, i) =>
        i % 2 === 1
          ? seg
          : seg.replace(new RegExp(`\\s*(${STEP_MARKERS.source})`, "g"), "\n$1")
      )
      .join("");
  }

  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${l}</p>`)
    .join("");
};

// Organized answer body (keeps RTE formatting, structures bulk plain text)
const AnswerContent = ({ text, className = "" }: { text: string; className?: string }) => (
  <div className={`answer-content ${className}`}>
    <LatexRenderer text={formatAnswerContent(text)} />
  </div>
);

// Renders the explanation (ব্যাখ্যা) of an MCQ inside the answer sheet
const McqExplanation = ({ text, isEnglishVersion = false }: { text: string; isEnglishVersion?: boolean }) => (
  <div style={{ marginTop: "4px", padding: "4px 8px", borderLeft: "3px solid #047857", backgroundColor: "rgba(4,120,87,0.06)", fontSize: "0.88em", borderRadius: "0 4px 4px 0", breakInside: "avoid" }}>
    <span style={{ fontWeight: 700, color: "#047857", marginRight: "4px" }}>{isEnglishVersion ? "Explanation:" : "ব্যাখ্যা:"}</span>
    <AnswerContent text={text} className="answer-content--inline-start" />
  </div>
);


export default function QuestionPaperView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const paperRef = useRef<HTMLDivElement>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [meta, setMeta] = useState<PaperMeta | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentPaperId, setCurrentPaperId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [pageNumberOpen, setPageNumberOpen] = useState(false);

  // Inline editing state
  const [activeEditEl, setActiveEditEl] = useState<HTMLElement | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null);
  const [editingMode, setEditingMode] = useState(false);

  // Settings
  const [settings, setSettings] = useState({
    showAnswerSheet: false,
    showImportantQ: false,
    showQuestionInfo: false,
    showStudentInfo: false,
    showMarksBox: true,
    showSubjectCode: true,
    showClassName: true,
    showSubjectName: true,
    showChapterName: true,
    showSetCode: true,
    showProgramName: true,
    showInstruction: true,
    paperSize: "A4" as PaperSize,
    showPageNumbers: false,
    pageMarginTop: 0,
    pageMarginBottom: 0,
    pageMarginLeft: 0,
    pageMarginRight: 0,
    optionStyle: "none" as OptionStyle,
    fontLang: "bangla",
    fontSize: 14,
    columns: 2 as ColumnCount,
    columnDivider: true,
    questionGap: 6,
    columnGap: 5,
    textAlign: "justify" as TextAlign,
    showDuplicateMarker: false,
    showSheet: false,
    sheetInstructorName: true,
    sheetInstructorProfile: false,
    sheetInstructorProfileText: "",
    sheetLectureNumber: false,
    sheetLectureNumberText: "",
    sheetTopic: false,
    sheetDate: false,
    sheetColoredBg: false,
    sheetBgColor: "#dc2626",
    sheetTextColor: "#ffffff",
    showShuffle: false,
    showAddress: false,
    showAddressSpecific: true,
    showAddressUpazila: true,
    showAddressDistrict: true,
    showAddressDivision: false,
    addressText: "",
    showWatermark: false,
    watermarkOpacity: 40,
    watermarkSize: 30,
    watermarkText: "",
    watermarkLogoUrl: "",
    watermarkType: "text" as "text" | "logo",
    watermarkRotation: -35 as number,
    cqToAnswer: 0, // 0 means auto (all)
    shortToAnswer: 0,
    descToAnswer: 0,
  });

  // Cloud backup hook
  const { cloudBackupEnabled } = useCloudBackup();

  // Auto-save helper
  const autoSavePaper = useCallback(async (paperMeta: PaperMeta, paperQuestions: QuestionRow[], paperSettings: typeof settings) => {
    if (!cloudBackupEnabled) return; // Skip if cloud backup disabled
    if (!user || !paperMeta || paperQuestions.length === 0) return;
    try {
      const paperData = {
        teacher_id: user.id,
        institution_name: paperMeta.instituteName || "",
        exam_name: paperMeta.programName || "",
        class_name: paperMeta.className || "",
        subject_name: paperMeta.subjectName || "",
        chapter_names: paperMeta.chapterNames || [],
        question_ids: paperQuestions.map(q => q.id),
        meta: paperMeta as any,
        settings: paperSettings as any,
      };
      const { data, error } = await supabase.from("saved_papers").insert(paperData as any).select("id").single();
      if (error) throw error;
      setCurrentPaperId(data.id);
      // Update URL with paper_id so refresh works
      const newParams = new URLSearchParams(window.location.search);
      newParams.set("paper_id", data.id);
      window.history.replaceState({}, "", `${window.location.pathname}?${newParams.toString()}`);
    } catch (err) {
      console.error("Auto-save failed:", err);
    }
  }, [user, cloudBackupEnabled]);

  useEffect(() => {
    const paperId = searchParams.get("paper_id");
    const qData = sessionStorage.getItem("viewPaperQuestions");
    const mData = sessionStorage.getItem("viewPaperMeta");
    const savedSettings = sessionStorage.getItem("viewPaperSettings");

    if (qData && mData) {
      // Prioritize sessionStorage (fresh generation or returning from "add more")
      const parsedQuestions = JSON.parse(qData);
      const parsedMeta = JSON.parse(mData);
      setQuestions(parsedQuestions);
      setMeta(parsedMeta);
      if (savedSettings) {
        setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
        sessionStorage.removeItem("viewPaperSettings");
      }

      if (paperId && cloudBackupEnabled) {
        // Returning to existing paper with new questions — update it
        setCurrentPaperId(paperId);
        const paperData = {
          question_ids: parsedQuestions.map((q: any) => q.id),
          meta: parsedMeta as any,
        };
        supabase.from("saved_papers").update(paperData as any).eq("id", paperId).then(() => {});
      } else if (cloudBackupEnabled) {
        // Auto-save new paper
        autoSavePaper(parsedMeta, parsedQuestions, settings);
      }
      // Don't remove sessionStorage here — keep for page refresh
      // It will be cleared on unmount (navigation away)
    } else if (paperId) {
      // Load saved paper from DB
      setCurrentPaperId(paperId);
      supabase.from("saved_papers").select("*").eq("id", paperId).maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          setMeta(data.meta as any);
          if (data.settings) setSettings(prev => ({ ...prev, ...(data.settings as any) }));
          const ids = data.question_ids as number[];
          if (ids.length > 0) {
            supabase.from("questions").select("*").in("id", ids)
              .then(({ data: qData }) => {
                if (qData) {
                  const qMap = new Map(qData.map(q => [q.id, q]));
                  setQuestions(ids.map(id => qMap.get(id)).filter(Boolean) as QuestionRow[]);
                }
              });
          }
        });
    }
  }, [searchParams]);

  // Keep paper data in sessionStorage across navigation & refresh.
  // It is only replaced when a new paper is generated, so returning
  // from any other page restores the exact same paper.


  const handleEditableClick = useCallback((e: React.MouseEvent<HTMLElement>, questionId?: number) => {
    if (!editingMode) return;
    e.stopPropagation();
    const el = e.currentTarget;
    el.contentEditable = "true";
    el.focus();
    setActiveEditEl(el);
    setActiveQuestionId(questionId ?? null);
  }, [editingMode]);

  const handleCloseToolbar = useCallback(() => {
    if (activeEditEl) {
      activeEditEl.contentEditable = "false";
    }
    setActiveEditEl(null);
    setActiveQuestionId(null);
  }, [activeEditEl]);

  const handleDeleteQuestion = useCallback(() => {
    if (activeQuestionId !== null) {
      setQuestions(prev => prev.filter(q => q.id !== activeQuestionId));
      handleCloseToolbar();
      toast.success("প্রশ্ন মুছে ফেলা হয়েছে");
    }
  }, [activeQuestionId, handleCloseToolbar]);

  const handleExchangeQuestion = useCallback(() => {
    toast.info("প্রশ্ন বদলাতে '+ আরও প্রশ্ন যুক্ত করুন' থেকে নতুন প্রশ্ন যোগ করুন।");
    handleCloseToolbar();
  }, [handleCloseToolbar]);

  // Content protection: disable right-click, copy, cut, print-screen shortcuts on paper area
  useEffect(() => {
    const paperEl = paperRef.current;
    if (!paperEl) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      toast.error("কপি করা নিষেধ");
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.error("কপি করা নিষেধ");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        ["c", "v", "x", "u", "s", "p"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        toast.error("কপি করা নিষেধ");
      }
      if (e.key === "PrintScreen") {
        e.preventDefault();
      }
    };

    paperEl.addEventListener("contextmenu", handleContextMenu);
    paperEl.addEventListener("copy", handleCopy);
    paperEl.addEventListener("cut", handleCopy);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      paperEl.removeEventListener("contextmenu", handleContextMenu);
      paperEl.removeEventListener("copy", handleCopy);
      paperEl.removeEventListener("cut", handleCopy);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleDownload = () => {
    if (!paperRef.current) return;

    // Close any editing state
    paperRef.current.querySelectorAll("[contenteditable]").forEach(el => {
      (el as HTMLElement).contentEditable = "false";
    });
    handleCloseToolbar();

    // Set dynamic page size via data attribute on <html>
    const pageSizeMap: Record<PaperSize, string> = {
      A4: "210mm 297mm",
      Letter: "8.5in 11in",
      Legal: "8.5in 14in",
      A5: "148mm 210mm",
    };
    document.documentElement.setAttribute("data-print-size", pageSizeMap[settings.paperSize]);

    // Wait for images/LaTeX to finish rendering
    const images = paperRef.current.querySelectorAll("img");
    const imagePromises = Array.from(images).map(img =>
      img.complete ? Promise.resolve() : new Promise<void>(resolve => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      })
    );

    Promise.all(imagePromises).then(() => {
      // Small delay for KaTeX rendering
      setTimeout(() => {
        window.print();
      }, 300);
    });
  };

  const handleSavePaper = async () => {
    if (!user || !meta || questions.length === 0) {
      toast.error("সেভ করার জন্য প্রশ্ন ও মেটাডাটা প্রয়োজন");
      return;
    }
    setSaving(true);
    try {
      const paperData = {
        teacher_id: user.id,
        institution_name: meta.instituteName || "",
        exam_name: meta.programName || "",
        class_name: meta.className || "",
        subject_name: meta.subjectName || "",
        chapter_names: meta.chapterNames || [],
        question_ids: questions.map(q => q.id),
        meta: meta as any,
        settings: settings as any,
      };

      if (currentPaperId) {
        // Update existing - but we don't have UPDATE policy, so delete + insert
        await supabase.from("saved_papers").delete().eq("id", currentPaperId);
        const { data, error } = await supabase.from("saved_papers").insert({ ...paperData, id: currentPaperId } as any).select("id").single();
        if (error) throw error;
        toast.success("প্রশ্নপত্র আপডেট হয়েছে!");
      } else {
        const { data, error } = await supabase.from("saved_papers").insert(paperData as any).select("id").single();
        if (error) throw error;
        setCurrentPaperId(data.id);
        // Update URL with paper_id so refresh works
        const newParams = new URLSearchParams(window.location.search);
        newParams.set("paper_id", data.id);
        window.history.replaceState({}, "", `${window.location.pathname}?${newParams.toString()}`);
        toast.success("প্রশ্নপত্র সেভ হয়েছে!");
      }
    } catch (err: any) {
      toast.error("সেভ করতে সমস্যা হয়েছে");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  /* Sort questions by type priority: MCQ(1) → Short(2) → CQ(3) → Descriptive(4) */
  const typePriority: Record<string, number> = { mcq: 1, short: 2, cq: 3, descriptive: 4 };
  const sortedQuestions = [...questions].sort(
    (a, b) => (typePriority[a.type] ?? 5) - (typePriority[b.type] ?? 5)
  );

  const mcqQuestions = sortedQuestions.filter(q => q.type === "mcq");
  const cqQuestions = sortedQuestions.filter(q => q.type === "cq");
  const shortQuestions = sortedQuestions.filter(q => q.type === "short");
  const descriptiveQuestions = sortedQuestions.filter(q => q.type === "descriptive");

  const isEnglishVersion = Boolean(meta && /english|eglish|ইংলিশ/i.test(meta.className || ""));
  const paperNumber = (n: number): string => isEnglishVersion ? String(n) : toBanglaNum(n);
  const padPaperNumber = (n: number): string => {
    const value = paperNumber(n);
    return value.length < 2 ? `${isEnglishVersion ? "0" : "০"}${value}` : value;
  };
  const optionLabels = isEnglishVersion ? ["a", "b", "c", "d"] : ["ক", "খ", "গ", "ঘ"];

  const formatEnglishClassName = (name: string): string => {
    const numberWords: Record<string, string> = {
      "3": "Three", "4": "Four", "5": "Five", "6": "Six", "7": "Seven",
      "8": "Eight", "9": "Nine", "10": "Ten", "11": "Eleven", "12": "Twelve",
    };
    const levels = name.match(/\d+/g) || [];
    if (levels.length > 0) {
      return levels.slice(0, 2).map(level => numberWords[level] || level).join("/");
    }
    return name
      .replace(/\(?\s*e(?:n)?glish\s+version\s*\)?/ig, "")
      .replace(/^class\s*:?[\s-]*/i, "")
      .trim();
  };

  const formatEnglishSubjectName = (name: string): string =>
    /^mathemathis$/i.test(name.trim()) ? "Mathematics" : name;

  const formatEnglishChapterName = (name: string, index: number): string => {
    if (/^chapter\s*\d+/i.test(name)) return name;
    const normalized = /^real number$/i.test(name.trim()) ? "Real Numbers" : name;
    return `Chapter ${index + 1} - ${normalized}`;
  };

  const cqToAnswerForTotal = settings.cqToAnswer > 0 ? Math.min(settings.cqToAnswer, cqQuestions.length) : cqQuestions.length;
  const shortToAnswerForTotal = settings.shortToAnswer > 0 ? Math.min(settings.shortToAnswer, shortQuestions.length) : shortQuestions.length;
  const descToAnswerForTotal = settings.descToAnswer > 0 ? Math.min(settings.descToAnswer, descriptiveQuestions.length) : descriptiveQuestions.length;
  const totalMarks = mcqQuestions.length + shortToAnswerForTotal * 2 + cqToAnswerForTotal * 10 + descToAnswerForTotal * 10;

  // Calculate total time: MCQ=1min, CQ=10min, Short=2min, Descriptive=10min
  const totalTimeMinutes = (isEnglishVersion ? Math.ceil(mcqQuestions.length * 1.5) : mcqQuestions.length) + cqToAnswerForTotal * 10 + shortToAnswerForTotal * 2 + descToAnswerForTotal * 10;
  const formatTime = (mins: number): string => {
    if (isEnglishVersion) {
      const hours = Math.floor(mins / 60);
      const rem = mins % 60;
      if (hours === 0) return `Time— ${rem} min`;
      if (rem === 0) return `Time— ${hours} ${hours === 1 ? "hour" : "hours"}`;
      return `Time— ${hours} ${hours === 1 ? "hour" : "hours"} ${rem} min`;
    }
    if (mins === 0) return "সময়— ০ মিনিট";
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hours === 0) return `সময়— ${toBanglaNum(rem)} মিনিট`;
    if (rem === 0) return `সময়— ${toBanglaNum(hours)} ঘন্টা`;
    return `সময়— ${toBanglaNum(hours)} ঘন্টা ${toBanglaNum(rem)} মিনিট`;
  };

  const stackCacheRef = useRef(new Map<string, boolean>());
  const shouldStackOptions = (q: QuestionRow) => {
    const cacheKey = `${q.id}|${settings.columns || 1}`;
    const cached = stackCacheRef.current.get(cacheKey);
    if (cached !== undefined) return cached;
    const result = computeStackOptions(q);
    stackCacheRef.current.set(cacheKey, result);
    return result;
  };

  const computeStackOptions = (q: QuestionRow) => {
    const rawOpts = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean) as string[];
    if (rawOpts.length === 0) return false;


    // 1) Block-level / rich content: any option containing img / table / block-math / svg / figure / pre / hr
    //    => always stack (these never fit nicely side-by-side)
    const richTagRe = /<(img|table|svg|figure|pre|hr|video|iframe)\b/i;
    const blockMathRe = /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\begin\{(align|equation|matrix|cases|array|pmatrix|bmatrix|vmatrix)/i;
    if (rawOpts.some(o => richTagRe.test(o) || blockMathRe.test(o))) return true;

    // 2) Compute a "visual length" per option:
    //    - strip HTML tags
    //    - count inline LaTeX as ~its source length (LaTeX usually renders wider per char)
    //    - count CJK / Bangla compound clusters as ~1.2x
    const visualLen = (html: string): number => {
      const text = stripPTags(html || "")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      // Estimate the RENDERED width of inline LaTeX instead of its source length:
      // `$0.\overset{.}{6}$` is only ~4 chars wide once KaTeX renders it.
      const renderedLatexLen = (src: string): number => {
        const body = src
          .replace(/^\$|\$$/g, "")
          .replace(/^\\\(|\\\)$/g, "")
          // fraction renders as the wider of numerator/denominator
          .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_m, a, b) => (a.length > b.length ? a : b))
          // \text{...} / \mathrm{...} etc. render as their inner text
          .replace(/\\(text|textrm|mathrm|mathbf|mathit|operatorname)\s*\{([^{}]*)\}/g, (_m, _c, inner) => inner)
          // blackboard/caligraphic letters render as a single glyph
          .replace(/\\(mathbb|mathcal|mathfrak)\s*\{[^{}]*\}/g, "N")
          // sizing / spacing commands render as nothing
          .replace(/\\(left|right|,|;|!|:|quad|qquad|displaystyle|limits)\b/g, "")
          // any remaining command (\in, \le, \subset, \alpha, \sqrt, \overset ...) is one glyph
          .replace(/\\[a-zA-Z]+/g, "x")
          .replace(/[{}^_$\\]/g, "")
          .replace(/\s+/g, "");
        return body.length * 1.15;
      };
      let plain = text;
      let latexLen = 0;
      plain = plain.replace(/\$[^$]+\$|\\\([\s\S]*?\\\)/g, (m) => {
        latexLen += renderedLatexLen(m);
        return "";
      });
      return plain.length + latexLen;
    };


    const lengths = rawOpts.map(visualLen);
    const maxLen = Math.max(...lengths);
    const totalLen = lengths.reduce((a, b) => a + b, 0);
    const longCount = lengths.filter(l => l > 25).length;

    // 3) Threshold adapts to column count of the paper
    //    1 col → wide page, allow longer side-by-side
    //    2 col → moderate
    //    3 col → narrow, stack earlier
    const cols = settings.columns || 1;
    const maxThreshold = cols >= 3 ? 18 : cols === 2 ? 26 : 34;
    const totalThreshold = cols >= 3 ? 50 : cols === 2 ? 75 : 110;

    // 4) Multi-line content (explicit <br> or newline) → stack
    if (rawOpts.some(o => /<br\s*\/?>|\n/i.test(o))) return true;

    // 5) Decision: stack if the longest option is too long, OR total content too dense,
    //    OR 2+ options are individually long (would overflow the half-column)
    return maxLen > maxThreshold || totalLen > totalThreshold || longCount >= 2;
  };

  const getOptionLabel = (label: string): React.ReactNode => {
    switch (settings.optionStyle) {
      case "bracket": return `(${label})`;
      case "paren": return `${label})`;
      case "dot": return `${label}.`;
      case "none": return (
        <span className="mcq-option-label-circle">
          <span className="mcq-option-label-glyph">{label}</span>
        </span>
      );
      default: return label;
    }
  };

  const updateSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  /* Format board references as badge string */
  const formatRefs = (q: QuestionRow): string => {
    const refs: string[] = [];
    if (q.board_references && Array.isArray(q.board_references)) {
      q.board_references.forEach((r: any) => {
        if (r.board && r.year) refs.push(`${r.board} '${r.year}`);
      });
    }
    if (q.university_references && Array.isArray(q.university_references)) {
      q.university_references.forEach((r: any) => {
        if ((r.name || r.university) && r.year) refs.push(`${r.name || r.university} '${r.year}`);
      });
    }
    return refs.length > 0 ? `[${refs.join(", ")}]` : "";
  };

  const editableClass = editingMode ? "outline-none cursor-text" : "outline-none cursor-default";

  /* Paper size widths for preview */
  const paperPreviewWidths: Record<PaperSize, string> = {
    A4: "794px", Letter: "816px", Legal: "816px", A5: "560px",
  };

  /* Detect duplicate questions */
  const duplicateIds = new Set<number>();
  if (settings.showDuplicateMarker) {
    const seen = new Map<string, number[]>();
    questions.forEach(q => {
      const key = q.question.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(q.id);
    });
    seen.forEach(ids => { if (ids.length > 1) ids.forEach(id => duplicateIds.add(id)); });
  }

  /* Shuffle questions for set code */
  const handleShuffle = useCallback(() => {
    setQuestions(prev => {
      const mcq = prev.filter(q => q.type === "mcq");
      const rest = prev.filter(q => q.type !== "mcq");
      // Fisher-Yates shuffle
      const shuffled = [...mcq];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return [...shuffled, ...rest];
    });
    updateSetting("showSetCode", true);
    toast.success("প্রশ্ন শাফল করা হয়েছে — নতুন সেট তৈরী!");
  }, []);

  if (!meta) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">কোনো প্রশ্নপত্র পাওয়া যায়নি</p>
        <Button onClick={() => navigate("/dashboard/create")}>← প্রশ্ন তৈরীতে ফিরে যান</Button>
      </div>
    );
  }

  /* CQ marks line - dynamic based on toAnswer */
  const cqToAnswer = settings.cqToAnswer > 0 ? Math.min(settings.cqToAnswer, cqQuestions.length) : cqQuestions.length;
  const cqTotalMarks = cqToAnswer * 10;
  const cqMarksLine = cqQuestions.length > 0
    ? `${paperNumber(10)} × ${paperNumber(cqToAnswer)} = ${paperNumber(cqTotalMarks)}`
    : "";

  /* CQ dynamic instruction */
  const cqInstruction = cqQuestions.length > 0
    ? (cqQuestions.length === cqToAnswer
      ? (isEnglishVersion ? "Answer all questions:" : "সবগুলো প্রশ্নের উত্তর দাও :")
      : (isEnglishVersion ? `Answer any ${cqToAnswer} questions:` : `যেকোনো ${toBanglaNum(cqToAnswer)}টি প্রশ্নের উত্তর দাও :`))
    : "";

  /* Detect if subject is Math/Higher Math for CQ marks distribution */
  const isMathSubject = meta?.subjectName ? /গণিত|math|higher\s*math|উচ্চতর\s*গণিত/i.test(meta.subjectName) : false;

  const settingsContent = (
    <>
      {/* প্রশ্নে সংযুক্তি */}
      <div className="border-b border-border pb-3 mb-3">
        <h4 className="font-heading font-bold text-sm mb-2">প্রশ্নে সংযুক্তি</h4>
        <div className="space-y-2">
          {([
            { key: "showAnswerSheet" as const, label: "উত্তরপত্র" },
            { key: "showImportantQ" as const, label: "গুরুত্বপূর্ণ প্রশ্ন" },
            { key: "showQuestionInfo" as const, label: "প্রশ্নের তথ্য" },
            { key: "showStudentInfo" as const, label: "শিক্ষার্থীর তথ্য" },
            { key: "showMarksBox" as const, label: "প্রাপ্ত নম্বর ঘর" },
            { key: "showSubjectCode" as const, label: "বিষয় কোড" },
          ]).map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <span className="text-sm">{item.label}</span>
              <Switch checked={settings[item.key]} onCheckedChange={(v) => updateSetting(item.key, v)} />
            </div>
          ))}
        </div>
      </div>

      {/* সৃজনশীল প্রশ্ন সেটিংস */}
      {cqQuestions.length > 0 && (
        <div className="border-b border-border pb-3 mb-3">
          <h4 className="font-heading font-bold text-sm mb-2">সৃজনশীল প্রশ্ন</h4>
          <div className="space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">কতটি প্রশ্নের উত্তর দিতে হবে?</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  min={1}
                  max={cqQuestions.length}
                  className="h-8 text-sm w-20"
                  value={settings.cqToAnswer || cqQuestions.length}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 0;
                    updateSetting("cqToAnswer", v);
                  }}
                />
                <span className="text-xs text-muted-foreground">/ {toBanglaNum(cqQuestions.length)}টি</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* সংক্ষিপ্ত প্রশ্ন সেটিংস */}
      {shortQuestions.length > 0 && (
        <div className="border-b border-border pb-3 mb-3">
          <h4 className="font-heading font-bold text-sm mb-2">সংক্ষিপ্ত প্রশ্ন</h4>
          <div className="space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">কতটি প্রশ্নের উত্তর দিতে হবে?</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  min={1}
                  max={shortQuestions.length}
                  className="h-8 text-sm w-20"
                  value={settings.shortToAnswer || shortQuestions.length}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 0;
                    updateSetting("shortToAnswer", v);
                  }}
                />
                <span className="text-xs text-muted-foreground">/ {toBanglaNum(shortQuestions.length)}টি</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* বর্ণনামূলক প্রশ্ন সেটিংস */}
      {descriptiveQuestions.length > 0 && (
        <div className="border-b border-border pb-3 mb-3">
          <h4 className="font-heading font-bold text-sm mb-2">বর্ণনামূলক প্রশ্ন</h4>
          <div className="space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">কতটি প্রশ্নের উত্তর দিতে হবে?</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  min={1}
                  max={descriptiveQuestions.length}
                  className="h-8 text-sm w-20"
                  value={settings.descToAnswer || descriptiveQuestions.length}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 0;
                    updateSetting("descToAnswer", v);
                  }}
                />
                <span className="text-xs text-muted-foreground">/ {toBanglaNum(descriptiveQuestions.length)}টি</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* প্রশ্নের মেটাডাটা */}
      <div className="border-b border-border pb-3 mb-3">
        <h4 className="font-heading font-bold text-sm mb-2">প্রশ্নের মেটাডাটা (হেডার)</h4>
        <div className="space-y-2">
          {([
            { key: "showClassName" as const, label: "শ্রেণির নাম" },
            { key: "showSubjectName" as const, label: "বিষয়ের নাম" },
            { key: "showChapterName" as const, label: "অধ্যায়ের নাম" },
            { key: "showSetCode" as const, label: "সেট কোড" },
            { key: "showProgramName" as const, label: "প্রোগ্রাম/পরীক্ষার নাম" },
            { key: "showInstruction" as const, label: "নির্দেশনা" },
          ]).map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <span className="text-sm">{item.label}</span>
              <Switch checked={settings[item.key]} onCheckedChange={(v) => updateSetting(item.key, v)} />
            </div>
          ))}
        </div>
      </div>

      {/* ডকুমেন্ট কাস্টমাইজেশন */}
      <div className="border-b border-border pb-3 mb-3">
        <h4 className="font-heading font-bold text-sm mb-2">ডকুমেন্ট কাস্টমাইজেশন</h4>

        <div className="mb-3">
          <Label className="text-xs text-muted-foreground">টেক্সট এলাইনমেন্ট</Label>
          <div className="text-align-selector mt-1">
            {(["left", "center", "right", "justify"] as TextAlign[]).map(a => {
              const AlignmentIcon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : a === "right" ? AlignRight : AlignJustify;
              return (
              <Button key={a} size="sm" variant="outline" className="text-align-control" data-active={settings.textAlign === a} aria-label={`${a} alignment`} title={`${a} alignment`} onClick={() => updateSetting("textAlign", a)}>
                <AlignmentIcon aria-hidden="true" />
              </Button>
              );
            })}
          </div>
        </div>

        <div className="mb-3">
          <Label className="text-xs text-muted-foreground">পেপার সাইজ</Label>
          <div className="paper-size-selector mt-1">
            {(["A4", "Letter", "Legal", "A5"] as PaperSize[]).map(s => (
              <Button key={s} variant="outline" className="paper-size-control" data-active={settings.paperSize === s} onClick={() => updateSetting("paperSize", s)}>
                <span className="paper-size-sheet" data-paper-size={s.toLowerCase()} aria-hidden="true" />
                <span>{s}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="mb-1 space-y-1">
          <div className="flex items-center justify-between rounded-md bg-muted/70 p-2">
            <span className="text-sm">Page Setup</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 bg-background shadow-sm hover:bg-accent"
              aria-label="Page Setup খুলুন"
              onClick={() => setPageSetupOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/70 p-2">
            <span className="text-sm">পৃষ্ঠা নম্বর</span>
            <div className="flex items-center gap-2">
              <Switch
                aria-label="পৃষ্ঠা নম্বর"
                checked={settings.showPageNumbers}
                onCheckedChange={(value) => updateSetting("showPageNumbers", value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 bg-background shadow-sm hover:bg-accent"
                aria-label="পৃষ্ঠা নম্বর সেটিংস খুলুন"
                onClick={() => setPageNumberOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-3">
          <Label className="text-xs text-muted-foreground">অপশন স্টাইল</Label>
          <div className="option-style-selector mt-1">
            {([
              { v: "none" as OptionStyle, l: "○", name: "বৃত্ত" },
              { v: "bracket" as OptionStyle, l: "( )", name: "বন্ধনী" },
              { v: "dot" as OptionStyle, l: ".", name: "ডট" },
              { v: "paren" as OptionStyle, l: ")", name: "শেষ বন্ধনী" },
            ]).map(s => (
              <Button
                key={s.v}
                size="sm"
                variant={settings.optionStyle === s.v ? "default" : "outline"}
                className="option-style-control"
                data-active={settings.optionStyle === s.v}
                aria-label={`${s.name} অপশন স্টাইল`}
                title={s.name}
                onClick={() => updateSetting("optionStyle", s.v)}
              >
                {s.v === "none" ? <span className="option-style-circle-preview" aria-hidden="true" /> : s.l}
              </Button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <Label className="text-xs text-muted-foreground">ফন্ট পরিবর্তন</Label>
          <Select value={settings.fontLang} onValueChange={(v) => updateSetting("fontLang", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bangla">সোলাইমান লিপি</SelectItem>
              <SelectItem value="omicronbangla">Bangla — OmicronLab</SelectItem>
              <SelectItem value="kalpurush">কালপুরুষ</SelectItem>
              <SelectItem value="timesnewroman">Times New Roman</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm flex items-center gap-1.5">
              <Pencil className="h-3.5 w-3.5 text-primary" /> এডিটিং মোড
            </span>
            <Switch checked={editingMode} onCheckedChange={(v) => {
              setEditingMode(v);
              if (!v) handleCloseToolbar();
              if (v) toast.info("এডিটিং মোড অন হয়েছে");
            }} />
          </div>
        </div>

        <div className="mb-3">
          <Label className="text-xs text-muted-foreground">ফন্ট সাইজ</Label>
          <div className="flex items-center gap-2 mt-1">
            <Button size="sm" variant="outline" onClick={() => updateSetting("fontSize", Math.max(10, settings.fontSize - 1))}>
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-sm font-medium w-8 text-center">{settings.fontSize}</span>
            <Button size="sm" variant="outline" onClick={() => updateSetting("fontSize", Math.min(24, settings.fontSize + 1))}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="mb-3">
          <Label className="text-xs text-muted-foreground">কলাম (MCQ)</Label>
          <div className="flex gap-1 mt-1">
            {([1, 2, 3] as ColumnCount[]).map(c => (
              <Button key={c} size="sm" variant={settings.columns === c ? "default" : "outline"} className="flex-1 text-xs" onClick={() => updateSetting("columns", c)}>
                {c === 1 ? "█" : c === 2 ? "█ █" : "█ █ █"}
              </Button>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs">কলাম ডিভাইডার</span>
            <Switch checked={settings.columnDivider} onCheckedChange={(v) => updateSetting("columnDivider", v)} />
          </div>
          <div className="mt-2 space-y-4 rounded-md border border-border p-3">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span>প্রশ্নের নিচে গ্যাপ</span>
                <span>{settings.questionGap}px</span>
              </div>
              <Slider
                aria-label="প্রশ্নের নিচে গ্যাপ"
                value={[settings.questionGap]}
                min={0}
                max={20}
                step={1}
                onValueChange={([value]) => updateSetting("questionGap", value)}
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span>কলামের গ্যাপ</span>
                <span>{settings.columnGap}px</span>
              </div>
              <Slider
                aria-label="কলামের গ্যাপ"
                value={[settings.columnGap]}
                min={0}
                max={30}
                step={1}
                disabled={settings.columns === 1}
                onValueChange={([value]) => updateSetting("columnGap", value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* সহায়ক টুলস */}
      <div className="border-b border-border pb-3 mb-3">
        <h4 className="font-heading font-bold text-sm mb-2">সহায়ক টুলস</h4>
        <div className="space-y-2">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm">পুনরাবৃত্ত প্রশ্ন শনাক্ত</span>
              <Switch checked={settings.showDuplicateMarker} onCheckedChange={(v) => updateSetting("showDuplicateMarker", v)} />
            </div>
            <p className="paper-setting-help text-[10px] text-muted-foreground">একই প্রশ্ন একাধিকবার নির্বাচিত হলে সহজে শনাক্ত ও পরিবর্তন করা যাবে।</p>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm">শীট</span>
              <Switch checked={settings.showSheet} onCheckedChange={(v) => updateSetting("showSheet", v)} />
            </div>
          </div>
          {settings.showSheet && (
            <div className="ml-1 space-y-2 border rounded-md p-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs">ইন্সট্রাক্টর নেম</span>
                <Switch checked={settings.sheetInstructorName} onCheckedChange={(v) => updateSetting("sheetInstructorName", v)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">ইন্সট্রাক্টর প্রোফাইল</span>
                <Switch checked={settings.sheetInstructorProfile} onCheckedChange={(v) => updateSetting("sheetInstructorProfile", v)} />
              </div>
              {settings.sheetInstructorProfile && (
                <Input
                  className="text-xs h-7"
                  placeholder="প্রোফাইল লিখুন (e.g. Teacher)"
                  value={settings.sheetInstructorProfileText}
                  onChange={(e) => updateSetting("sheetInstructorProfileText", e.target.value)}
                />
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs">লেকচার নম্বর</span>
                <Switch checked={settings.sheetLectureNumber} onCheckedChange={(v) => updateSetting("sheetLectureNumber", v)} />
              </div>
              {settings.sheetLectureNumber && (
                <Input
                  className="text-xs h-7"
                  placeholder="লেকচার নম্বর লিখুন"
                  value={settings.sheetLectureNumberText}
                  onChange={(e) => updateSetting("sheetLectureNumberText", e.target.value)}
                />
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs">লেকচার টপিক</span>
                <Switch checked={settings.sheetTopic} onCheckedChange={(v) => updateSetting("sheetTopic", v)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">তারিখ</span>
                <Switch checked={settings.sheetDate} onCheckedChange={(v) => updateSetting("sheetDate", v)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">রঙিন ব্যাকগ্রাউন্ড</span>
                <Switch checked={settings.sheetColoredBg} onCheckedChange={(v) => updateSetting("sheetColoredBg", v)} />
              </div>
              {settings.sheetColoredBg && (
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">ব্যাকগ্রাউন্ড কালার পছন্দ করুন ↕</label>
                    <input type="color" value={settings.sheetBgColor} onChange={(e) => updateSetting("sheetBgColor", e.target.value)} className="w-full h-8 rounded cursor-pointer border-0" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">টেক্সট কালার পছন্দ করুন ↕</label>
                    <input type="color" value={settings.sheetTextColor} onChange={(e) => updateSetting("sheetTextColor", e.target.value)} className="w-full h-8 rounded cursor-pointer border-0" />
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm">শাফল (সেট কোড তৈরী)</span>
            <Button size="sm" variant="outline" className="h-9 w-9 p-0 text-lg font-bold" onClick={handleShuffle}>⇆</Button>
          </div>
        </div>
      </div>

      {/* ব্র্যান্ডিং */}
      <div>
        <h4 className="font-heading font-bold text-sm mb-2">ব্র্যান্ডিং</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">ঠিকানা</span>
            <Switch checked={settings.showAddress} onCheckedChange={(v) => updateSetting("showAddress", v)} />
          </div>
          {settings.showAddress && (
            <div className="ml-1 space-y-2 border rounded-md p-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs">স্পেসিফিক ঠিকানা</span>
                <Switch checked={settings.showAddressSpecific} onCheckedChange={(v) => updateSetting("showAddressSpecific", v)} />
              </div>
              {settings.showAddressSpecific && (
                <Input className="text-xs h-7" placeholder="স্পেসিফিক ঠিকানা লিখুন" value={settings.addressText} onChange={(e) => updateSetting("addressText", e.target.value)} />
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs">উপজেলা</span>
                <Switch checked={settings.showAddressUpazila} onCheckedChange={(v) => updateSetting("showAddressUpazila", v)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">জেলা</span>
                <Switch checked={settings.showAddressDistrict} onCheckedChange={(v) => updateSetting("showAddressDistrict", v)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">বিভাগ</span>
                <Switch checked={settings.showAddressDivision} onCheckedChange={(v) => updateSetting("showAddressDivision", v)} />
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm">জলছাপ</span>
            <Switch checked={settings.showWatermark} onCheckedChange={(v) => updateSetting("showWatermark", v)} />
          </div>
          {settings.showWatermark && (
            <div className="ml-1 space-y-2 border rounded-md p-2 bg-muted/30">
              <div className="flex gap-1 mb-1">
                <Button size="sm" variant={settings.watermarkType === "text" ? "default" : "outline"} className="h-6 text-[10px] px-2" onClick={() => updateSetting("watermarkType", "text")}>টেক্সট</Button>
                <Button size="sm" variant={settings.watermarkType === "logo" ? "default" : "outline"} className="h-6 text-[10px] px-2" onClick={() => updateSetting("watermarkType", "logo")}>লোগো</Button>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Opacity</span>
                  <span className="text-xs font-medium">{settings.watermarkOpacity}</span>
                </div>
                <Slider value={[settings.watermarkOpacity]} min={5} max={100} step={5} onValueChange={([v]) => updateSetting("watermarkOpacity", v)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Size</span>
                  <span className="text-xs font-medium">{settings.watermarkSize}{settings.watermarkType === "logo" ? "%" : ""}</span>
                </div>
                <Slider value={[settings.watermarkSize]} min={settings.watermarkType === "logo" ? 5 : 12} max={settings.watermarkType === "logo" ? 100 : 80} step={settings.watermarkType === "logo" ? 5 : 2} onValueChange={([v]) => updateSetting("watermarkSize", v)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Rotation</span>
                  <span className="text-xs font-medium">{settings.watermarkRotation ?? -35}°</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {[-45, -35, 0, 35, 45, 90].map((deg) => (
                    <Button
                      key={deg}
                      size="sm"
                      variant={(settings.watermarkRotation ?? -35) === deg ? "default" : "outline"}
                      className="h-6 text-[10px] px-2 flex-1 min-w-[44px]"
                      onClick={() => updateSetting("watermarkRotation", deg)}
                    >
                      {deg}°
                    </Button>
                  ))}
                </div>
              </div>
              {settings.watermarkType === "text" ? (
                <Input className="text-xs h-8" placeholder={meta?.instituteName || "জলছাপ টেক্সট লিখুন"} value={settings.watermarkText} onChange={(e) => updateSetting("watermarkText", e.target.value)} />
              ) : (
                <div className="space-y-1">
                  {settings.watermarkLogoUrl && (
                    <div className="flex items-center gap-2">
                      <img src={settings.watermarkLogoUrl} alt="Logo" className="h-8 w-8 object-contain rounded border" />
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => updateSetting("watermarkLogoUrl", "")}>সরান</Button>
                    </div>
                  )}
                  <label className="flex items-center gap-1 cursor-pointer text-xs text-primary hover:underline">
                    <Upload size={12} />
                    <span>{settings.watermarkLogoUrl ? "পরিবর্তন করুন" : "লোগো আপলোড করুন"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        updateSetting("watermarkLogoUrl", ev.target?.result as string);
                        if (settings.watermarkSize < 5 || settings.watermarkSize > 100) updateSetting("watermarkSize", 50);
                      };
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div
      className="paper-builder-shell xl:grid -m-4 md:-m-6 relative bg-[#eef1f4]"
      style={{ gridTemplateColumns: "minmax(0, 1fr) 256px", gap: "20px", padding: "16px 16px 0" }}
    >
      {/* Floating Toolbar */}
      <FloatingToolbar
        targetEl={activeEditEl}
        onDelete={activeQuestionId !== null ? handleDeleteQuestion : undefined}
        onExchange={activeQuestionId !== null ? handleExchangeQuestion : undefined}
        onClose={handleCloseToolbar}
      />

      {/* Mobile top toolbar */}
      {isMobile && (
        <div className="flex items-center gap-2 p-2 border-b border-border bg-background sticky top-0 z-30">
          <Button variant="outline" size="sm" className="flex-1 font-heading text-xs" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-3.5 w-3.5 mr-1" /> সেটিংস
          </Button>
          {settings.showAnswerSheet && (
            <Button variant="outline" size="sm" className="flex-1 font-heading text-xs" onClick={() => updateSetting("showAnswerSheet", !settings.showAnswerSheet)}>
              📝 উত্তরমালা
            </Button>
          )}
          <Button size="sm" className="flex-1 gradient-green text-primary-foreground border-0 font-heading text-xs" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5 mr-1" /> ডাউনলোড
          </Button>
        </div>
      )}

      {/* Paper preview */}
      <style>{`
        @media print {
          @page {
            margin-top: calc(10mm + ${settings.pageMarginTop}px);
            margin-right: calc(10mm + ${settings.pageMarginRight}px);
            margin-bottom: calc(10mm + ${settings.pageMarginBottom}px);
            margin-left: calc(10mm + ${settings.pageMarginLeft}px);
            ${settings.showPageNumbers ? `
            @bottom-center {
              content: counter(page);
              font-family: Arial, sans-serif;
              font-size: 11px;
              color: #000;
            }` : ""}
          }
        }
      `}</style>
      <div className="paper-preview-scroll overflow-y-auto xl:h-[calc(100vh-80px)] bg-[#eef1f4]">
        {!isMobile && (
          <div className="paper-quick-settings mb-4 mx-auto" style={{ maxWidth: paperPreviewWidths[settings.paperSize] }}>
            <div className="paper-quick-settings-title">কুইক সেটিংস</div>
            <Button className="paper-quick-settings-action flex mx-auto bg-[#059669] hover:bg-[#047857] text-white shadow-none" size="sm" onClick={() => {
              sessionStorage.setItem("existingPaperQuestions", JSON.stringify(questions));
              sessionStorage.setItem("existingPaperMeta", JSON.stringify(meta));
              if (currentPaperId) sessionStorage.setItem("existingPaperId", currentPaperId);
              sessionStorage.setItem("existingPaperSettings", JSON.stringify(settings));
              // Store context IDs so create page can skip form
              if (questions.length > 0) {
                const savedCtx = (() => {
                  try { return JSON.parse(sessionStorage.getItem("viewPaperContext") || "null"); } catch { return null; }
                })();
                const classId = String(questions[0].class_id || savedCtx?.classId || "");
                const subjectId = String(questions[0].subject_id || savedCtx?.subjectId || "");
                const fromQs = [...new Set(questions.map(q => String(q.chapter_id || "")))].filter(Boolean);
                const chapterIds = [...new Set([...(savedCtx?.chapterIds || []).map(String), ...fromQs])];
                sessionStorage.setItem("existingPaperContext", JSON.stringify({ classId, subjectId, chapterIds }));
              }
              navigate("/dashboard/create?add_to_paper=true");
            }}>
              <Plus className="h-4 w-4 mr-1" /> আরও প্রশ্ন যুক্ত করুন
            </Button>
          </div>
        )}
        {isMobile && (
          <div className="mb-3 flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => {
              sessionStorage.setItem("existingPaperQuestions", JSON.stringify(questions));
              sessionStorage.setItem("existingPaperMeta", JSON.stringify(meta));
              if (currentPaperId) sessionStorage.setItem("existingPaperId", currentPaperId);
              sessionStorage.setItem("existingPaperSettings", JSON.stringify(settings));
              if (questions.length > 0) {
                const savedCtx = (() => {
                  try { return JSON.parse(sessionStorage.getItem("viewPaperContext") || "null"); } catch { return null; }
                })();
                const classId = String(questions[0].class_id || savedCtx?.classId || "");
                const subjectId = String(questions[0].subject_id || savedCtx?.subjectId || "");
                const fromQs = [...new Set(questions.map(q => String(q.chapter_id || "")))].filter(Boolean);
                const chapterIds = [...new Set([...(savedCtx?.chapterIds || []).map(String), ...fromQs])];
                sessionStorage.setItem("existingPaperContext", JSON.stringify({ classId, subjectId, chapterIds }));
              }
              navigate("/dashboard/create?add_to_paper=true");
            }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> আরও প্রশ্ন যুক্ত করুন
            </Button>
          </div>
        )}

        {editingMode && (
          <Alert className="mb-4 border-emerald-300 bg-emerald-50 text-emerald-900">
            <Pencil className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-xs" style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>
              এডিটিং মোড অন করা হয়েছে। আপনি এখন সরাসরি প্রশ্নে ক্লিক করে যেকোনো লেখা পরিবর্তন করতে পারবেন। মনে রাখবেন, এই পরিবর্তনগুলো ডাটাবেসে সেভ হবে না। তাই এডিট শেষ করে প্রশ্নটি অবশ্যই ডাউনলোড করে নিন।
            </AlertDescription>
          </Alert>
        )}

        {/* Responsive preview: paper and quick settings share the same fluid width. */}
        <div className="mx-auto" data-print-scale-wrapper style={{
          width: '100%',
          maxWidth: paperPreviewWidths[settings.paperSize],
        }}>
        <div
          className={`font-paper${isEnglishVersion ? " paper-english-version" : ""}`}
          ref={paperRef}
          data-print-paper
          data-paper-version={isEnglishVersion ? "english" : "bangla"}
          data-content-align={settings.textAlign}
          style={{
            "--paper-question-gap": `${settings.questionGap}px`,
            "--paper-print-font-size": `${settings.fontSize}px`,
            width: '100%',
            // Screen-only magnification: default 14px looks like the former
            // 16px preview, while print/PDF restores the real selected size.
            fontSize: `${settings.fontSize * PREVIEW_FONT_SCALE}px`,
            lineHeight: isEnglishVersion ? 1.25 : 1.45,
            userSelect: "none",
            WebkitUserSelect: "none",
            paddingTop: `${(isMobile ? 12 : 38) + settings.pageMarginTop}px`,
            paddingRight: `${(isMobile ? 10 : 38) + settings.pageMarginRight}px`,
            paddingBottom: `${(isMobile ? 12 : 38) + settings.pageMarginBottom}px`,
            paddingLeft: `${(isMobile ? 10 : 38) + settings.pageMarginLeft}px`,
            color: "#000",
            background: "#fff",
            border: "1px solid #e0e4e9",
            boxShadow: "0 4px 18px rgba(30, 41, 59, 0.07)",
            fontFamily: isEnglishVersion && settings.fontLang === "bangla"
              ? "'Times New Roman', Times, serif"
              : settings.fontLang === "solaimanlipi"
              ? "'SolaimanLipi', 'Arial', sans-serif"
              : settings.fontLang === "omicronbangla"
              ? "'OmicronBangla', 'SolaimanLipi', 'Arial', sans-serif"
              : settings.fontLang === "kalpurush"
              ? "'Kalpurush', 'Arial', sans-serif"
              : settings.fontLang === "timesnewroman"
              ? "'Times New Roman', 'Georgia', serif"
              : "'SolaimanLipi', 'Arial', sans-serif",
            textAlign: settings.textAlign,
            position: "relative",
            overflow: "visible",
          } as CSSProperties}
        >
          {/* ===== WATERMARK =====
              Two layers so the watermark appears on EVERY page:
              1) Screen layer: tiled absolutely-positioned copies down the full paper height.
              2) Print layer: position:fixed element — browsers repeat fixed elements on each printed page. */}
          {settings.showWatermark && (settings.watermarkType === "logo" ? !!settings.watermarkLogoUrl : !!(settings.watermarkText || meta.instituteName)) && (() => {
            const opacity = (settings.watermarkOpacity || 40) / 100;
            const isLogo = settings.watermarkType === "logo" && !!settings.watermarkLogoUrl;
            // Logo size is % of paper width; text size is px.
            const logoSizePct = settings.watermarkSize || 15;
            const textSizePx = settings.watermarkSize || 30;
            const textValue = settings.watermarkText || meta.instituteName || "";

            const rotation = typeof settings.watermarkRotation === "number" ? settings.watermarkRotation : -35;

            const renderMark = (key: string | number) => (
              <div key={key} style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}>
                {isLogo ? (
                  <img
                    src={settings.watermarkLogoUrl}
                    alt="Watermark"
                    data-watermark-img
                    style={{
                      width: `${logoSizePct}%`,
                      maxWidth: "none",
                      maxHeight: "none",
                      height: "auto",
                      objectFit: "contain",
                      display: "block",
                      transform: `rotate(${rotation}deg)`,
                    }}
                  />
                ) : (
                  <span style={{
                    fontSize: `${textSizePx}px`,
                    fontWeight: 900,
                    whiteSpace: "nowrap",
                    color: "#000",
                    transform: `rotate(${rotation}deg)`,
                    display: "inline-block",
                  }}>
                    {textValue}
                  </span>
                )}
              </div>
            );

            // Estimate page height in screen pixels for tiling on screen view.
            // Paper preview width matches a real paper aspect ratio, so derive height per page.
            const aspect: Record<string, number> = {
              a4: 297 / 210,
              letter: 11 / 8.5,
              legal: 14 / 8.5,
              a5: 210 / 148,
            };
            const previewWidth = parseInt(String(paperPreviewWidths[settings.paperSize] || "794").replace("px", ""), 10) || 794;
            const pageHeightPx = Math.round(previewWidth * (aspect[settings.paperSize] || aspect.a4));

            return (
              <>
                {/* Screen tiled watermark (hidden in print) */}
                <div
                  data-watermark-screen
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    opacity,
                    pointerEvents: "none",
                    zIndex: 0,
                    overflow: "hidden",
                  }}
                >
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-around",
                    alignItems: "center",
                    gap: `${Math.max(80, Math.round(pageHeightPx * 0.4))}px`,
                    paddingTop: `${Math.round(pageHeightPx * 0.45)}px`,
                  }}>
                    {Array.from({ length: 30 }).map((_, i) => renderMark(i))}
                  </div>
                </div>

                {/* Print watermark — position:fixed makes browsers repeat it on every printed page */}
                <div
                  data-watermark-print
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    opacity,
                    pointerEvents: "none",
                    zIndex: 0,
                    width: "100%",
                    display: "none",
                  }}
                >
                  {renderMark("print")}
                </div>
              </>
            );
          })()}

          {/* ===== PROFESSIONAL PAPER HEADER ===== */}
          <header className="paper-document-header">
            <div className="paper-document-heading">
              <div
                className="paper-document-heading-center"
                style={settings.showSheet && settings.sheetColoredBg ? {
                  backgroundColor: settings.sheetBgColor,
                  color: settings.sheetTextColor,
                } : undefined}
              >
                <h1
                  className={editableClass}
                  data-editable="institute"
                  onClick={handleEditableClick}
                  suppressContentEditableWarning
                >
                  {meta.instituteName}
                </h1>

                {settings.showAddress && (() => {
                  const parts: string[] = [];
                  if (settings.showAddressSpecific && (settings.addressText || meta.instituteSpecificAddress)) parts.push(settings.addressText || meta.instituteSpecificAddress || "");
                  if (settings.showAddressUpazila && meta.instituteUpazila) parts.push(meta.instituteUpazila);
                  if (settings.showAddressDistrict && meta.instituteDistrict) parts.push(meta.instituteDistrict);
                  if (settings.showAddressDivision && meta.instituteDivision) parts.push(meta.instituteDivision);
                  const address = parts.join(", ");
                  return address ? (
                    <p className={`${editableClass} paper-header-address`} data-editable="address" onClick={handleEditableClick} suppressContentEditableWarning>
                      {address}
                    </p>
                  ) : null;
                })()}

                {settings.showProgramName && meta.programName && (
                  <p className={`${editableClass} paper-header-program`} data-editable="program" onClick={handleEditableClick} suppressContentEditableWarning>
                    {meta.programName}
                  </p>
                )}
                {settings.showClassName && (
                  <p className={`${editableClass} paper-header-class`} data-editable="class" onClick={handleEditableClick} suppressContentEditableWarning>
                    {isEnglishVersion ? `Class : ${formatEnglishClassName(meta.className)}` : meta.className}
                  </p>
                )}
                {settings.showSubjectName && (
                  <p className={`${editableClass} paper-header-subject`} data-editable="subject" onClick={handleEditableClick} suppressContentEditableWarning>
                    {isEnglishVersion ? formatEnglishSubjectName(meta.subjectName) : meta.subjectName}
                  </p>
                )}
                {settings.showChapterName && meta.chapterNames.length > 0 && (
                  <p className={`${editableClass} paper-header-chapter`} data-editable="chapters" onClick={handleEditableClick} suppressContentEditableWarning>
                    {isEnglishVersion
                      ? meta.chapterNames.map(formatEnglishChapterName).join(", ")
                      : meta.chapterNames.join(", ")}
                  </p>
                )}

                {settings.showSheet && settings.sheetInstructorName && meta.teacherName && (
                  <p className={`${editableClass} paper-header-sheet-title`} onClick={handleEditableClick} suppressContentEditableWarning>
                    ইন্সট্রাক্টর: {meta.teacherName}
                  </p>
                )}
                {settings.showSheet && settings.sheetInstructorProfile && (
                  <p
                    className={`${editableClass} paper-header-sheet-detail`}
                    style={{ color: settings.sheetColoredBg ? settings.sheetTextColor : "#0066cc" }}
                    data-editable="instructor-profile"
                    onClick={handleEditableClick}
                    suppressContentEditableWarning
                  >
                    {settings.sheetInstructorProfileText || "+ Write Your Profile Here"}
                  </p>
                )}
                {settings.showSheet && settings.sheetTopic && meta.topicNames && meta.topicNames.length > 0 && (
                  <p className={`${editableClass} paper-header-sheet-detail`} onClick={handleEditableClick} suppressContentEditableWarning>
                    লেকচার টপিক: {meta.topicNames.join(", ")}
                  </p>
                )}
              </div>

              {settings.showMarksBox && (
                <div className="paper-header-marks-box">
                  <span className={`${editableClass} paper-header-marks-label`} onClick={handleEditableClick} suppressContentEditableWarning>
                    <svg className="paper-header-marks-label-fill" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="100" height="100" fill="#000" />
                    </svg>
                    <span>{isEnglishVersion ? "Obtained Marks" : "প্রাপ্ত নম্বর"}</span>
                  </span>
                  <span aria-hidden="true">&nbsp;</span>
                </div>
              )}

              {settings.showSubjectCode && (
                <div className={`${editableClass} paper-header-subject-code`} onClick={handleEditableClick} suppressContentEditableWarning>
                  <span>{isEnglishVersion ? "Subject Code :" : "বিষয় কোড :"}</span>
                  <span className="paper-header-code-cells">
                    {(meta.subjectCode || "১৭৮").split("").map((digit, index) => (
                      <span key={`${digit}-${index}`}>{digit}</span>
                    ))}
                  </span>
                </div>
              )}

              {settings.showSetCode && (
                <div className={`${editableClass} paper-header-set-code`} data-editable="setCode" onClick={handleEditableClick} suppressContentEditableWarning>
                  <span>{isEnglishVersion ? "Set Code:" : "সেট কোড:"}</span>
                  <span>{isEnglishVersion ? "A" : "ক"}</span>
                </div>
              )}

              {settings.showSheet && (settings.sheetLectureNumber || settings.sheetDate) && (
                <div className="paper-header-lecture-row">
                  {settings.sheetLectureNumber && (
                    <span className={editableClass} onClick={handleEditableClick} suppressContentEditableWarning>
                      লেকচার নম্বরঃ {settings.sheetLectureNumberText || "১"}
                    </span>
                  )}
                  {settings.sheetDate && (
                    <span className={editableClass} onClick={handleEditableClick} suppressContentEditableWarning>
                      Date: {new Date().toLocaleDateString("en-US", { timeZone: "Asia/Dhaka", month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </div>
              )}

              <div className={`paper-header-time-marks${settings.showStudentInfo ? "" : " paper-header-divider"}`}>
                <span className={editableClass} data-editable="time" onClick={handleEditableClick} suppressContentEditableWarning>
                  {formatTime(totalTimeMinutes)}
                </span>
                <span className={editableClass} data-editable="marks" onClick={handleEditableClick} suppressContentEditableWarning>
                  {isEnglishVersion ? `Marks— ${totalMarks}` : `পূর্ণমান— ${toBanglaNum(totalMarks)}`}
                </span>
              </div>
            </div>

            {settings.showStudentInfo && (
              <div className="paper-header-student-info paper-header-divider">
                <div className={`${editableClass} paper-header-student-field paper-header-student-name`} onClick={handleEditableClick} suppressContentEditableWarning>
                  <span>{isEnglishVersion ? "Student Name:" : "শিক্ষার্থীর নাম:"}</span>
                  <span className="paper-header-student-line" aria-hidden="true" />
                </div>
                <div className={`${editableClass} paper-header-student-field paper-header-student-branch`} onClick={handleEditableClick} suppressContentEditableWarning>
                  <span>{isEnglishVersion ? "Section:" : "শাখা:"}</span>
                  <span className="paper-header-student-line" aria-hidden="true" />
                </div>
                <div className={`${editableClass} paper-header-student-field paper-header-student-roll`} onClick={handleEditableClick} suppressContentEditableWarning>
                  <span>{isEnglishVersion ? "Roll:" : "রোল:"}</span>
                  <span className="paper-header-student-line" aria-hidden="true" />
                </div>
              </div>
            )}

            {settings.showInstruction && (
              <div className="paper-header-instructions">
                {mcqQuestions.length > 0 && (
                  <p className={editableClass} data-editable="instruction" onClick={handleEditableClick} suppressContentEditableWarning>
                    <i><strong>{isEnglishVersion ? "Note:" : "দ্রষ্টব্য:"}</strong>{" "}{isEnglishVersion
                      ? "In the provided MCQ answer sheet, fill the circle corresponding to the correct answer for each question"
                      : "সরবরাহকৃত বহুনির্বাচনি অভীক্ষার উত্তরপত্রে প্রশ্নের ক্রমিক নম্বরের বিপরীতে প্রদত্ত বর্ণসম্বলিত বৃত্তসমূহ হতে সঠিক উত্তরের বৃত্তটি"}</i>{" "}
                    <span className="paper-instruction-answer-marker" aria-label="ভরাট বৃত্ত">
                      <span aria-hidden="true">(</span>
                      <span className="paper-instruction-filled-circle" aria-hidden="true" />
                      <span aria-hidden="true">)</span>
                    </span>{" "}
                    <i>{isEnglishVersion
                      ? "completely using a ballpoint pen. Each question carries 1 mark."
                      : "বল পয়েন্ট কলম দ্বারা সম্পূর্ণ ভরাট করো। প্রতিটি প্রশ্নের মান ১।"}</i>
                  </p>
                )}
                <p className="paper-header-no-mark">
                  {isEnglishVersion
                    ? "No marks, signs, or symbols are allowed on the question paper."
                    : "প্রশ্নপত্রে কোনো প্রকার দাগ/চিহ্ন দেয়া যাবে না।"}
                </p>
              </div>
            )}
          </header>

          {/* ===== MCQ SECTION ===== */}
          {mcqQuestions.length > 0 && (() => {
            // Note: isMultiCompletionQ detection removed — all MCQs treated uniformly

            // Group MCQs by their stored group ID. Older bulk uploads did not
            // save that ID, so identical repeated stimuli are grouped as a
            // backwards-compatible fallback.
            const repeatedStimuli = findRepeatedStimuli(mcqQuestions, q => q.stimulus_text);
            const stimulusGroupKey = (q: QuestionRow): string | null => {
              const normalizedStimulus = normalizeStimulusKey(q.stimulus_text);
              return q.stimulus_group_id
                ? `id:${q.stimulus_group_id}`
                : repeatedStimuli.has(normalizedStimulus)
                  ? `stimulus:${normalizedStimulus}`
                  : null;
            };
            // All MCQs must share one column-flow container. Splitting them
            // into standalone/group containers makes the visible sequence jump.
            const standalone = mcqQuestions;
            const grouped = new Map<string, QuestionRow[]>();

            // Number questions continuously in their rendered order.
            let mcqNumber = 0;

            return (
            <div style={{ marginTop: "6px", marginBottom: "8px" }}>
              {/* Regular standalone MCQs */}
              {standalone.length > 0 && (() => {
                const cols = settings.columns;
                const rowCount = Math.ceil(standalone.length / cols);
                const standaloneBaseNumber = mcqNumber;
                mcqNumber += standalone.length;
                const rows: (QuestionRow | null)[][] = [];
                for (let r = 0; r < rowCount; r++) {
                  const row: (QuestionRow | null)[] = [];
                  for (let c = 0; c < cols; c++) {
                    const qi = c * rowCount + r;
                    row.push(qi < standalone.length ? standalone[qi] : null);
                  }
                  rows.push(row);
                }
                const printColumnStyle = {
                  display: "none",
                  columnCount: cols,
                  columnGap: cols > 1 ? `${settings.columnGap}px` : "0",
                  columnRule: cols > 1 && settings.columnDivider ? COLUMN_DIVIDER_STYLE : undefined,
                  columnFill: "auto" as const,
                };

                const screenColumnStyle = {
                  columnCount: cols,
                  columnGap: cols > 1 ? `${settings.columnGap}px` : "0",
                  columnRule: cols > 1 && settings.columnDivider ? COLUMN_DIVIDER_STYLE : undefined,
                  columnFill: "balance" as const,
                };
                const screenShownStimuli = new Set<string>();
                const printShownStimuli = new Set<string>();
                return (
                <>
                  <div className="mcq-screen-layout mcq-print-columns" style={screenColumnStyle}>
                    {standalone.map((q, itemIdx) => {
                      const idx = standaloneBaseNumber + itemIdx + 1;
                      const isDuplicate = duplicateIds.has(q.id);
                      const refStr = formatRefs(q);
                      const groupKey = stimulusGroupKey(q);
                      const showStimulus = hasRenderableStimulus(q.stimulus_text) && (!groupKey || !screenShownStimuli.has(groupKey));
                      if (groupKey && showStimulus) screenShownStimuli.add(groupKey);
                      return (
                        <div key={q.id} className={`${editableClass} mcq-print-item`} style={{ background: isDuplicate ? "rgba(255,200,0,0.15)" : undefined, marginBottom: `${settings.questionGap}px` }} data-editable={`mcq-${q.id}`} onClick={(e) => handleEditableClick(e, q.id)} suppressContentEditableWarning>
                          {showStimulus && (
                            <div className="mcq-stimulus" style={{ marginBottom: "4px", fontStyle: "italic", padding: "4px 0" }}>
                              {groupKey && <div style={{ fontWeight: 500 }}>{isEnglishVersion ? "Read the following stimulus and answer the questions:" : "নিচের উদ্দীপকটি পড়ে পরবর্তী প্রশ্নগুলোর উত্তর দাও:"}</div>}
                              <LatexRenderer text={q.stimulus_text || ""} />
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "baseline", gap: "0" }}>
                            <span style={{ width: "1.8rem", flexShrink: 0, fontWeight: 400 }}>{padPaperNumber(idx)}{isEnglishVersion ? "." : "।"}</span>
                            <div style={{ flex: 1 }}>
                              <div className="mc-block-question" style={{ display: "block" }}>
                                <LatexRenderer inline text={q.question} />
                                {settings.showQuestionInfo && refStr && <span className="paper-question-info"><mark>{refStr}</mark></span>}
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: shouldStackOptions(q) ? "1fr" : "1fr 1fr", gap: "0", rowGap: "0.35em", fontSize: "0.96em", lineHeight: 1.25, marginTop: "0" }}>
                                {(["option_a", "option_b", "option_c", "option_d"] as const).map((key, oi) => {
                                  const val = q[key]; if (!val) return null;
                                  const cleaned = stripPTags(val);
                                  const label = optionLabels[oi];
                                  const isCorrect = settings.showAnswerSheet && isCorrectOption(q.correct_answer, oi, [q.option_a, q.option_b, q.option_c, q.option_d]);
                                  return (<span key={key} className="mcq-option-choice" style={{ ...(isCorrect ? { fontWeight: 700, color: "#047857" } : {}) }}><span>{getOptionLabel(label)}</span><LatexRenderer text={cleaned} />{isCorrect && <span style={{ marginLeft: "1px", fontWeight: 900 }}>✔</span>}</span>);
                                })}
                              </div>
                              {settings.showAnswerSheet && q.explanation && (<McqExplanation text={q.explanation} isEnglishVersion={isEnglishVersion} />)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mcq-print-layout mcq-print-columns" style={printColumnStyle}>
                    {standalone.map((q, itemIdx) => {
                      const idx = standaloneBaseNumber + itemIdx + 1;
                      const isDuplicate = duplicateIds.has(q.id);
                      const refStr = formatRefs(q);
                      const groupKey = stimulusGroupKey(q);
                      const showStimulus = hasRenderableStimulus(q.stimulus_text) && (!groupKey || !printShownStimuli.has(groupKey));
                      if (groupKey && showStimulus) printShownStimuli.add(groupKey);
                      return (
                        <div key={`print-${q.id}`} className="mcq-print-item" style={{ background: isDuplicate ? "rgba(255,200,0,0.15)" : undefined, marginBottom: `${settings.questionGap}px` }}>
                          {showStimulus && (
                            <div className="mcq-stimulus" style={{ marginBottom: "4px", fontStyle: "italic", padding: "4px 0" }}>
                              {groupKey && <div style={{ fontWeight: 500 }}>{isEnglishVersion ? "Read the following stimulus and answer the questions:" : "নিচের উদ্দীপকটি পড়ে পরবর্তী প্রশ্নগুলোর উত্তর দাও:"}</div>}
                              <LatexRenderer text={q.stimulus_text || ""} />
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "baseline", gap: "0" }}>
                            <span style={{ width: "1.8rem", flexShrink: 0, fontWeight: 400 }}>{padPaperNumber(idx)}{isEnglishVersion ? "." : "।"}</span>
                            <div style={{ flex: 1 }}>
                              <div className="mc-block-question" style={{ display: "block" }}>
                                <LatexRenderer inline text={q.question} />
                                {settings.showQuestionInfo && refStr && <span className="paper-question-info"><mark>{refStr}</mark></span>}
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: shouldStackOptions(q) ? "1fr" : "1fr 1fr", gap: "0", rowGap: "0.35em", fontSize: "0.96em", lineHeight: 1.25, marginTop: "0" }}>
                                {(["option_a", "option_b", "option_c", "option_d"] as const).map((key, oi) => {
                                  const val = q[key]; if (!val) return null;
                                  const cleaned = stripPTags(val);
                                  const label = optionLabels[oi];
                                  const isCorrect = settings.showAnswerSheet && isCorrectOption(q.correct_answer, oi, [q.option_a, q.option_b, q.option_c, q.option_d]);
                                  return (<span key={key} className="mcq-option-choice" style={{ ...(isCorrect ? { fontWeight: 700, color: "#047857" } : {}) }}><span>{getOptionLabel(label)}</span><LatexRenderer text={cleaned} />{isCorrect && <span style={{ marginLeft: "1px", fontWeight: 900 }}>✔</span>}</span>);
                                })}
                              </div>
                              {settings.showAnswerSheet && q.explanation && (<McqExplanation text={q.explanation} isEnglishVersion={isEnglishVersion} />)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
                );
              })()}

              {/* Grouped MCQs with shared stimulus */}
              {Array.from(grouped.entries()).map(([groupId, groupQs]) => {
                const stimulusHtml = groupQs[0]?.stimulus_text || "";
                const cols = settings.columns;
                const groupBaseNum = mcqNumber;
                mcqNumber += groupQs.length;
                const groupRowCount = Math.ceil(groupQs.length / cols);
                const rows: (QuestionRow | null)[][] = [];
                for (let r = 0; r < groupRowCount; r++) {
                  const row: (QuestionRow | null)[] = [];
                  for (let c = 0; c < cols; c++) {
                    const qi = c * groupRowCount + r;
                    row.push(qi < groupQs.length ? groupQs[qi] : null);
                  }
                  rows.push(row);
                }
                const printColumnStyle = {
                  display: "none",
                  columnCount: cols,
                  columnGap: cols > 1 ? `${settings.columnGap}px` : "0",
                  columnRule: cols > 1 && settings.columnDivider ? COLUMN_DIVIDER_STYLE : undefined,
                  columnFill: "auto" as const,
                };

                return (
                  <div key={groupId} style={{ marginTop: "8px" }}>
                    <p className={editableClass} style={{ fontStyle: "italic", marginBottom: "4px", fontWeight: 500 }} onClick={handleEditableClick} suppressContentEditableWarning>
                      {isEnglishVersion ? "Read the following stimulus and answer the questions:" : "নিচের উদ্দীপকটি পড়ে পরবর্তী প্রশ্নগুলোর উত্তর দাও:"}
                    </p>
                    {stimulusHtml && (
                      <div style={{ marginBottom: "6px", padding: "4px 8px", borderLeft: "2px solid #000" }}>
                        <LatexRenderer text={stimulusHtml} />
                      </div>
                    )}

                    <div
                      className="mcq-screen-layout"
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                        columnGap: cols > 1 ? `${settings.columnGap}px` : "0",
                        alignItems: "start",
                      }}
                    >
                      {Array.from({ length: cols }).map((_, colIdx) => (
                        <div
                          key={`screen-col-${groupId}-${colIdx}`}
                          style={{
                            minWidth: 0,
                            borderLeft: colIdx > 0 && settings.columnDivider ? COLUMN_DIVIDER_STYLE : undefined,
                            paddingLeft: colIdx > 0 && settings.columnDivider ? "12px" : undefined,
                          }}
                        >
                          {rows.map((row, rowIdx) => {
                            const q = row[colIdx];
                            if (!q) return null;
                            const idx = groupBaseNum + groupQs.findIndex(item => item.id === q.id) + 1;
                            return (
                              <div key={`${q.id}-${rowIdx}`} className={`${editableClass} mcq-print-item`} style={{ marginBottom: `${settings.questionGap}px` }} data-editable={`mcq-${q.id}`} onClick={(e) => handleEditableClick(e, q.id)} suppressContentEditableWarning>
                                <div style={{ display: "flex", alignItems: "baseline", gap: "0" }}>
                                  <span style={{ width: "1.8rem", flexShrink: 0, fontWeight: 400 }}>{padPaperNumber(idx)}{isEnglishVersion ? "." : "।"}</span>
                                  <div style={{ flex: 1 }}>
                                    <div className="mc-block-question"><LatexRenderer text={q.question} /></div>
                                    <div style={{ display: "grid", gridTemplateColumns: shouldStackOptions(q) ? "1fr" : "1fr 1fr", gap: "0", rowGap: "0.35em", fontSize: "0.96em", lineHeight: 1.25, marginTop: "0" }}>
                                      {(["option_a", "option_b", "option_c", "option_d"] as const).map((key, oi) => {
                                        const val = q[key]; if (!val) return null;
                                        const cleaned = stripPTags(val);
                                        const label = optionLabels[oi];
                                        const isCorrect = settings.showAnswerSheet && isCorrectOption(q.correct_answer, oi, [q.option_a, q.option_b, q.option_c, q.option_d]);
                                        return (<span key={key} className="mcq-option-choice" style={{ ...(isCorrect ? { fontWeight: 700, color: "#047857" } : {}) }}><span>{getOptionLabel(label)}</span><LatexRenderer text={cleaned} />{isCorrect && <span style={{ marginLeft: "1px", fontWeight: 900 }}>✔</span>}</span>);
                                      })}
                                    </div>
                                    {settings.showAnswerSheet && q.explanation && (<McqExplanation text={q.explanation} isEnglishVersion={isEnglishVersion} />)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>

                    <div
                      className="mcq-print-layout mcq-print-layout-grid"
                      style={{
                        display: "none",
                        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                        columnGap: cols > 1 ? `${settings.columnGap}px` : "0",
                        alignItems: "start",
                      }}
                    >
                      {Array.from({ length: cols }).map((_, colIdx) => (
                        <div
                          key={`print-col-${groupId}-${colIdx}`}
                          style={{
                            minWidth: 0,
                            borderLeft: colIdx > 0 && settings.columnDivider ? COLUMN_DIVIDER_STYLE : undefined,
                            paddingLeft: colIdx > 0 && settings.columnDivider ? "12px" : undefined,
                          }}
                        >
                          {rows.map((row, rowIdx) => {
                            const q = row[colIdx];
                            if (!q) return null;
                            const idx = groupBaseNum + groupQs.findIndex(item => item.id === q.id) + 1;
                            return (
                              <div key={`print-${q.id}-${rowIdx}`} className="mcq-print-item" style={{ marginBottom: `${settings.questionGap}px` }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: "0" }}>
                                  <span style={{ width: "1.8rem", flexShrink: 0, fontWeight: 400 }}>{padPaperNumber(idx)}{isEnglishVersion ? "." : "।"}</span>
                                  <div style={{ flex: 1 }}>
                                    <div className="mc-block-question"><LatexRenderer text={q.question} /></div>
                                    <div style={{ display: "grid", gridTemplateColumns: shouldStackOptions(q) ? "1fr" : "1fr 1fr", gap: "0", rowGap: "0.35em", fontSize: "0.96em", lineHeight: 1.25, marginTop: "0" }}>
                                      {(["option_a", "option_b", "option_c", "option_d"] as const).map((key, oi) => {
                                        const val = q[key]; if (!val) return null;
                                        const cleaned = stripPTags(val);
                                        const label = optionLabels[oi];
                                        const isCorrect = settings.showAnswerSheet && isCorrectOption(q.correct_answer, oi, [q.option_a, q.option_b, q.option_c, q.option_d]);
                                        return (<span key={key} className="mcq-option-choice" style={{ ...(isCorrect ? { fontWeight: 700, color: "#047857" } : {}) }}><span>{getOptionLabel(label)}</span><LatexRenderer text={cleaned} />{isCorrect && <span style={{ marginLeft: "1px", fontWeight: 900 }}>✔</span>}</span>);
                                      })}
                                    </div>
                                    {settings.showAnswerSheet && q.explanation && (<McqExplanation text={q.explanation} isEnglishVersion={isEnglishVersion} />)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            );
          })()}

          {/* ===== SHORT SECTION (2nd) ===== */}
          {shortQuestions.length > 0 && (() => {
            const shortToAnswer = settings.shortToAnswer > 0 ? Math.min(settings.shortToAnswer, shortQuestions.length) : shortQuestions.length;
            const shortTotalMarks = shortToAnswer * 2;
            const shortMarksLine = `${paperNumber(shortToAnswer)} × ${paperNumber(2)} = ${paperNumber(shortTotalMarks)}`;
            const shortInstruction = shortQuestions.length === shortToAnswer
              ? ""
              : (isEnglishVersion ? `Answer any ${shortToAnswer} questions:` : `যেকোনো ${toBanglaNum(shortToAnswer)}টি প্রশ্নের উত্তর দাও :`);

            const repeatedShortStimuli = findRepeatedStimuli(shortQuestions, q => q.stimulus_text);
            const shortStimulusGroupKey = (q: QuestionRow): string | null => {
              const normalizedStimulus = normalizeStimulusKey(q.stimulus_text);
              return q.stimulus_group_id
                ? `id:${q.stimulus_group_id}`
                : repeatedShortStimuli.has(normalizedStimulus)
                  ? `stimulus:${normalizedStimulus}`
                  : null;
            };
            const shownShortStimuli = new Set<string>();

            return (
            <div style={{ marginTop: "10px", marginBottom: "8px" }}>
              <div data-section-header style={{ textAlign: "center", fontWeight: 700, fontSize: "0.95em", marginBottom: "2px", textDecoration: "underline" }}>
                <span
                  className={editableClass}
                  data-editable="short-title"
                  onClick={handleEditableClick}
                  suppressContentEditableWarning
                >
                  {isEnglishVersion ? "Short-answer Questions (2 marks each)" : "সংক্ষিপ্ত উত্তর প্রশ্ন (প্রতি প্রশ্নের মান ২)"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9em", marginBottom: "3px" }}>
                <span className={editableClass} style={{ fontWeight: 600 }} onClick={handleEditableClick} suppressContentEditableWarning>&nbsp;</span>
                <span className={editableClass} style={{ fontWeight: 600, fontSize: "0.95em" }} onClick={handleEditableClick} suppressContentEditableWarning>
                  {shortMarksLine}
                </span>
              </div>
              {shortInstruction && (
                <div style={{ fontSize: "0.9em", marginBottom: "4px" }}>
                  <span className={editableClass} style={{ fontWeight: 600 }} onClick={handleEditableClick} suppressContentEditableWarning>{shortInstruction}</span>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: `${settings.questionGap}px` }}>
                {shortQuestions.map((q, idx) => {
                  const num = idx + 1;
                  const refStr = formatRefs(q);
                  const isDuplicate = duplicateIds.has(q.id);
                  const groupKey = shortStimulusGroupKey(q);
                  const showStimulus = hasRenderableStimulus(q.stimulus_text) && (!groupKey || !shownShortStimuli.has(groupKey));
                  if (groupKey && showStimulus) shownShortStimuli.add(groupKey);

                  return (
                    <div key={q.id} className={editableClass} style={{ background: isDuplicate ? "rgba(255,200,0,0.15)" : undefined }} data-editable={`short-${q.id}`} onClick={(e) => handleEditableClick(e, q.id)} suppressContentEditableWarning>
                      <div style={{ display: "block" }}>
                        <span className="mc-block-question">
                          <LatexRenderer inline text={`${padPaperNumber(num)}${isEnglishVersion ? "." : "।"} ${q.question}`} />
                        </span>
                        {settings.showQuestionInfo && refStr && <span className="paper-question-info"><mark>{refStr}</mark></span>}
                      </div>

                      {showStimulus && (
                        <div className="short-stimulus" style={{ marginTop: "3px", marginBottom: "4px", padding: "2px 0", paddingLeft: "1.8rem" }}>
                          {groupKey && (
                            <div style={{ fontWeight: 500, fontStyle: "italic", marginBottom: "2px" }}>
                              {isEnglishVersion ? "Read the following stimulus and answer the questions:" : "নিচের উদ্দীপকটি পড়ে পরবর্তী প্রশ্নগুলোর উত্তর দাও:"}
                            </div>
                          )}
                          <div className="mc-block-question">
                            <LatexRenderer text={q.stimulus_text || ""} />
                          </div>
                        </div>
                      )}

                      {settings.showAnswerSheet && (q.correct_answer || q.explanation) && (
                        <div style={{ marginTop: "4px", padding: "4px 8px", borderLeft: "3px solid #047857", backgroundColor: "rgba(4,120,55,0.05)" }}>
                          <span style={{ fontWeight: 600, color: "#047857", marginRight: "4px" }}>{isEnglishVersion ? "Answer:" : "উত্তর:"}</span>
                          <AnswerContent text={q.correct_answer || q.explanation || ""} className="answer-content--inline-start" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })()}

          {/* ===== CQ SECTION (3rd) ===== */}
          {cqQuestions.length > 0 && (
            <div style={{ marginTop: "10px", marginBottom: "8px" }}>
              <div data-section-header style={{ textAlign: "center", fontWeight: 700, fontSize: "0.95em", marginBottom: "2px", textDecoration: "underline" }}>
                <span
                  className={editableClass}
                  data-editable="cq-title"
                  onClick={handleEditableClick}
                  suppressContentEditableWarning
                >
                  {isEnglishVersion ? "Creative Questions (10 marks each)" : "সৃজনশীল প্রশ্ন (প্রতিটি প্রশ্নের মান ১০)"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9em", marginBottom: "6px" }}>
                <span className={editableClass} style={{ fontWeight: 600 }} onClick={handleEditableClick} suppressContentEditableWarning>{cqInstruction}</span>
                <span className={editableClass} style={{ fontWeight: 600 }} onClick={handleEditableClick} suppressContentEditableWarning>{cqMarksLine}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: `${settings.questionGap}px` }}>
                {cqQuestions.map((q, idx) => {
                  const num = idx + 1;
                  const refStr = formatRefs(q);
                  const cData = q.creative_data;
                  const subQuestions = cData?.sub_questions || [];
                  const usesMathMarks = isMathSubject || cData?.is_math === true;
                  const subLabels = isEnglishVersion
                    ? (usesMathMarks ? ["a", "b", "c"] : ["a", "b", "c", "d"])
                    : (usesMathMarks ? ["ক", "খ", "গ"] : ["ক", "খ", "গ", "ঘ"]);
                  const subMarksMap = usesMathMarks ? [2, 4, 4] : [1, 2, 3, 4];
                  const isDuplicate = duplicateIds.has(q.id);
                  return (
                    <div key={q.id} className={editableClass} style={{ background: isDuplicate ? "rgba(255,200,0,0.15)" : undefined }} data-editable={`cq-${q.id}`} onClick={(e) => handleEditableClick(e, q.id)} suppressContentEditableWarning>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "0", marginBottom: "2px" }}>
                        <span style={{ width: "2.2rem", flexShrink: 0, fontWeight: 600 }}>{padPaperNumber(num)}{isEnglishVersion ? "." : "।"}</span>
                        <div style={{ flex: 1 }}>
                          {(() => {
                            const stemText = cData?.stem || q.stimulus_text || q.question;
                            return (
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                <span className="mc-block-question"><LatexRenderer text={stemText} /></span>
                                {settings.showQuestionInfo && refStr && <span className="paper-question-info paper-question-info--flex"><mark>{refStr}</mark></span>}
                              </div>
                            );
                          })()}
                          {subQuestions.length > 0 && (
                            <div>
                              {subQuestions.map((sq: any, si: number) => {
                                const label = subLabels[si] || "";
                                const marks = subMarksMap[si] || "";
                                if (!label) return null;
                                return (
                                  <div key={si} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", lineHeight: 1.5 }}>
                                    <div style={{ display: "flex", gap: "4px", flex: 1 }}>
                                      <span style={{ flexShrink: 0 }}>({label})</span>
                                      <span style={{ flex: 1 }}><LatexRenderer text={sq.question || sq.text || ""} /></span>
                                    </div>
                                    <span style={{ flexShrink: 0, marginLeft: "12px", fontWeight: 500 }}>{paperNumber(Number(marks))}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {(!subQuestions || subQuestions.length === 0) && (() => {
                            const showStem = false;
                            const keys = usesMathMarks ? ["q_ka", "q_kha", "q_ga"] : ["q_ka", "q_kha", "q_ga", "q_gha"];
                            const hasSubParts = keys.some(key => cData?.[key]);
                            if (!showStem && !hasSubParts) return null;
                            return (
                              <div>
                                {showStem && (
                                  <p style={{ fontStyle: "italic", marginBottom: "2px" }}>
                                    <LatexRenderer text={cData.stem} />
                                  </p>
                                )}
                                {keys.map((key, si) => {
                                  const text = cData?.[key];
                                  if (!text) return null;
                                  return (
                                    <div key={si} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", lineHeight: 1.5 }}>
                                      <div style={{ display: "flex", gap: "4px", flex: 1 }}>
                                        <span style={{ flexShrink: 0 }}>({subLabels[si]})</span>
                                        <span style={{ flex: 1 }}><LatexRenderer text={text} /></span>
                                      </div>
                                      <span style={{ flexShrink: 0, marginLeft: "12px", fontWeight: 500 }}>{paperNumber(subMarksMap[si])}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                          {/* CQ Answers when answer sheet is on */}
                          {settings.showAnswerSheet && (() => {
                            const cData2 = q.creative_data;
                            if (!cData2) return null;
                            const usesMath2 = isMathSubject || cData2.is_math === true;
                            const ansKeys = usesMath2 ? ["ans_ka", "ans_kha", "ans_ga"] : ["ans_ka", "ans_kha", "ans_ga", "ans_gha"];
                            const ansLabels = isEnglishVersion
                              ? (usesMath2 ? ["a", "b", "c"] : ["a", "b", "c", "d"])
                              : (usesMath2 ? ["ক", "খ", "গ"] : ["ক", "খ", "গ", "ঘ"]);
                            // Also check sub_questions for answers
                            const subQs = cData2.sub_questions || [];
                            const hasAnyAnswer = ansKeys.some(k => cData2[k]) || subQs.some((sq: any) => sq.answer);
                            if (!hasAnyAnswer) return null;
                            return (
                              <div style={{ marginTop: "6px", padding: "6px 8px", borderLeft: "3px solid #047857", backgroundColor: "rgba(4,120,55,0.05)" }}>
                                <span style={{ fontWeight: 700, color: "#047857", display: "block", marginBottom: "4px" }}>{isEnglishVersion ? "Answer:" : "উত্তর:"}</span>
                                {ansKeys.map((key, ai) => {
                                  const ansText = cData2[key] || (subQs[ai] && subQs[ai].answer) || "";
                                  if (!ansText) return null;
                                  return (
                                    <div key={ai} style={{ marginBottom: "4px", lineHeight: 1.5 }}>
                                      <span style={{ fontWeight: 600 }}>({ansLabels[ai]}) </span>
                                      <AnswerContent text={ansText} className="answer-content--inline-start" />
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== DESCRIPTIVE SECTION (4th) ===== */}
          {descriptiveQuestions.length > 0 && (() => {
            const descToAnswer = settings.descToAnswer > 0 ? Math.min(settings.descToAnswer, descriptiveQuestions.length) : descriptiveQuestions.length;
            const descTotalMarks = descToAnswer * 10;
            const descMarksLine = `${paperNumber(10)} × ${paperNumber(descToAnswer)} = ${paperNumber(descTotalMarks)}`;
            const descInstruction = descriptiveQuestions.length === descToAnswer
              ? ""
              : (isEnglishVersion ? `Answer any ${descToAnswer} questions:` : `যেকোনো ${toBanglaNum(descToAnswer)}টি প্রশ্নের উত্তর দাও :`);
            return (
            <div style={{ marginTop: "10px", marginBottom: "8px" }}>
              <div data-section-header style={{ textAlign: "center", fontWeight: 700, fontSize: "0.95em", marginBottom: "2px", textDecoration: "underline" }}>
                <span
                  className={editableClass}
                  data-editable="desc-title"
                  onClick={handleEditableClick}
                  suppressContentEditableWarning
                >
                  {isEnglishVersion ? "Descriptive Questions (10 marks each)" : "বর্ণনামূলক প্রশ্ন (প্রতি প্রশ্নের মান ১০)"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9em", marginBottom: "4px" }}>
                <span className={editableClass} style={{ fontWeight: 600 }} onClick={handleEditableClick} suppressContentEditableWarning>&nbsp;</span>
                <span className={editableClass} style={{ fontWeight: 600, fontSize: "0.95em" }} onClick={handleEditableClick} suppressContentEditableWarning>
                  {descMarksLine}
                </span>
              </div>
              {descInstruction && (
                <div style={{ fontSize: "0.9em", marginBottom: "4px" }}>
                  <span className={editableClass} style={{ fontWeight: 600 }} onClick={handleEditableClick} suppressContentEditableWarning>{descInstruction}</span>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: `${settings.questionGap}px` }}>
                {descriptiveQuestions.map((q, idx) => {
                  const num = idx + 1;
                  const refStr = formatRefs(q);
                  const dData = q.creative_data;
                  const isDuplicate = duplicateIds.has(q.id);
                  return (
                    <div
                      key={q.id}
                      className={editableClass}
                      style={{ background: isDuplicate ? "rgba(255,200,0,0.15)" : undefined }}
                      data-editable={`desc-${q.id}`}
                      onClick={(e) => handleEditableClick(e, q.id)}
                      suppressContentEditableWarning
                    >
                      {hasRenderableStimulus(q.stimulus_text) && (
                        <div className="desc-stimulus" style={{ marginBottom: "4px", padding: "2px 0" }}>
                          <div className="mc-block-question">
                            <LatexRenderer text={q.stimulus_text || ""} />
                          </div>
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "0", marginBottom: "2px" }}>
                        <span style={{ width: "2.2rem", flexShrink: 0, fontWeight: 600 }}>
                          {padPaperNumber(num)}{isEnglishVersion ? "." : "।"}
                        </span>
                        <div style={{ flex: 1 }}>
                        {settings.showQuestionInfo && refStr && <span className="paper-question-info"><mark>{refStr}</mark></span>}
                      {dData && (
                        <div>
                          {dData.desc_q_ka && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", lineHeight: 1.4, marginBottom: "2px" }}>
                              <div style={{ display: "flex", gap: "4px", flex: 1 }}>
                                <span style={{ flexShrink: 0 }}>({isEnglishVersion ? "a" : "ক"})</span>
                                <span style={{ flex: 1 }}><LatexRenderer text={dData.desc_q_ka} /></span>
                              </div>
                              <span style={{ flexShrink: 0, marginLeft: "12px", fontWeight: 500 }}>{paperNumber(3)}</span>
                            </div>
                          )}
                          {dData.desc_q_kha && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", lineHeight: 1.4 }}>
                              <div style={{ display: "flex", gap: "4px", flex: 1 }}>
                                <span style={{ flexShrink: 0 }}>({isEnglishVersion ? "b" : "খ"})</span>
                                <span style={{ flex: 1 }}><LatexRenderer text={dData.desc_q_kha} /></span>
                              </div>
                              <span style={{ flexShrink: 0, marginLeft: "12px", fontWeight: 500 }}>{paperNumber(7)}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {!dData && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <span className="mc-block-question"><LatexRenderer text={q.question} /></span>
                        </div>
                      )}
                          {/* Descriptive Answers when answer sheet is on */}
                          {settings.showAnswerSheet && (() => {
                            const dd = q.creative_data;
                            const hasDescAns = dd && (dd.desc_ans_ka || dd.desc_ans_kha);
                            const hasExpl = q.explanation;
                            if (!hasDescAns && !hasExpl) return null;
                            return (
                              <div style={{ marginTop: "6px", padding: "6px 8px", borderLeft: "3px solid #047857", backgroundColor: "rgba(4,120,55,0.05)" }}>
                                <span style={{ fontWeight: 700, color: "#047857", display: "block", marginBottom: "4px" }}>উত্তর:</span>
                                {dd?.desc_ans_ka && (
                                  <div style={{ marginBottom: "4px", lineHeight: 1.5 }}>
                                    <span style={{ fontWeight: 600 }}>({isEnglishVersion ? "a" : "ক"}) </span>
                                    <AnswerContent text={dd.desc_ans_ka} className="answer-content--inline-start" />
                                  </div>
                                )}
                                {dd?.desc_ans_kha && (
                                  <div style={{ marginBottom: "4px", lineHeight: 1.5 }}>
                                    <span style={{ fontWeight: 600 }}>({isEnglishVersion ? "b" : "খ"}) </span>
                                    <AnswerContent text={dd.desc_ans_kha} className="answer-content--inline-start" />
                                  </div>
                                )}
                                {!hasDescAns && hasExpl && <AnswerContent text={q.explanation!} />}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })()}

          {/* Address moved to header */}
        </div>
        </div> {/* end scaling wrapper */}
      </div>

      {/* ===== SETTINGS SIDEBAR (Desktop) ===== */}
      <aside className="hidden xl:block bg-[#f7f8fa] h-[calc(100vh-80px)] sticky top-0 overflow-y-auto">
        <div className="p-2 space-y-2">
          <Card className="paper-settings-card">
            <CardContent className="p-0">
              <h3 className="paper-settings-title font-heading font-bold text-center mb-3 flex items-center justify-center gap-2">
                <Settings className="h-4 w-4" /> সেটিংস
              </h3>

              <div className="paper-settings-sticky-actions flex gap-2 mb-4">
                <Button className="flex-1 bg-[#082f57] hover:bg-[#062542] text-white border-0 font-heading font-semibold shadow-sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" /> ডাউনলোড
                </Button>
                {cloudBackupEnabled && (
                  <Button variant="outline" className="font-heading font-semibold" onClick={handleSavePaper} disabled={saving}>
                    <Save className="h-4 w-4 mr-1" /> {saving ? "..." : "সেভ"}
                  </Button>
                )}
              </div>

              <div className="paper-settings-groups">{settingsContent}</div>
            </CardContent>
          </Card>
        </div>
      </aside>

      {/* ===== SETTINGS SHEET (Mobile) ===== */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="pb-2">
            <SheetTitle className="font-heading flex items-center justify-center gap-2">
              <Settings className="h-4 w-4" /> সেটিংস
            </SheetTitle>
          </SheetHeader>
          <div className="px-2 pb-4">
            <div className="flex gap-2 mb-4">
              <Button className="flex-1 gradient-green text-primary-foreground border-0 font-heading font-semibold" onClick={() => { setSettingsOpen(false); handleDownload(); }}>
                <Download className="h-4 w-4 mr-2" /> ডাউনলোড
              </Button>
              {cloudBackupEnabled && (
                <Button variant="outline" className="font-heading font-semibold" onClick={() => { handleSavePaper(); }} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" /> {saving ? "..." : "সেভ"}
                </Button>
              )}
            </div>
            <div className="paper-settings-groups">{settingsContent}</div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={pageSetupOpen} onOpenChange={setPageSetupOpen}>
        <DialogContent className="page-settings-dialog max-w-md overflow-hidden p-0">
          <DialogHeader className="bg-slate-700 px-4 py-3 text-left text-white">
            <DialogTitle>Page Setup</DialogTitle>
            <DialogDescription className="sr-only">প্রশ্নপত্রের চারপাশের স্পেস ও পেপার সাইজ পরিবর্তন করুন।</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-4 pb-5">
            <p className="text-xs text-muted-foreground">প্রশ্নপত্রের ডানে, বামে, উপরে, নিচের স্পেস কমানো বাড়ানো করা যাবে।</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              {([
                { key: "pageMarginTop" as const, label: "উপরে", max: 100 },
                { key: "pageMarginBottom" as const, label: "নিচে", max: 100 },
                { key: "pageMarginLeft" as const, label: "বামে", max: 120 },
                { key: "pageMarginRight" as const, label: "ডানে", max: 120 },
              ]).map(item => (
                <div key={item.key}>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span>{item.label}</span>
                    <span>{settings[item.key]}px</span>
                  </div>
                  <Slider
                    aria-label={item.label}
                    value={[settings[item.key]]}
                    min={0}
                    max={item.max}
                    step={1}
                    onValueChange={([value]) => updateSetting(item.key, value)}
                  />
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-4">
              <Label className="text-xs text-muted-foreground">পেপার সাইজ</Label>
              <div className="paper-size-selector mt-2">
                {(["A4", "Letter", "Legal", "A5"] as PaperSize[]).map(size => (
                  <Button key={size} variant="outline" className="paper-size-control" data-active={settings.paperSize === size} onClick={() => updateSetting("paperSize", size)}>
                    <span className="paper-size-sheet" data-paper-size={size.toLowerCase()} aria-hidden="true" />
                    <span>{size}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pageNumberOpen} onOpenChange={setPageNumberOpen}>
        <DialogContent className="page-settings-dialog max-w-sm overflow-hidden p-0">
          <DialogHeader className="bg-slate-700 px-4 py-3 text-left text-white">
            <DialogTitle>পৃষ্ঠা নম্বর সংযুক্ত</DialogTitle>
            <DialogDescription className="sr-only">PDF-এ স্বয়ংক্রিয় পৃষ্ঠা নম্বর যুক্ত করুন।</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-6 pt-3">
            <Button
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => updateSetting("showPageNumbers", !settings.showPageNumbers)}
            >
              {settings.showPageNumbers ? "পৃষ্ঠা নম্বর বন্ধ করুন" : "পৃষ্ঠা নম্বর চালু করুন"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">চালু করলে PDF-এ স্বয়ংক্রিয়ভাবে পৃষ্ঠা নম্বর যুক্ত হবে।</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
