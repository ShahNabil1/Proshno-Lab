import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Settings, Plus, Minus, Save, Pencil } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import LatexRenderer from "@/components/LatexRenderer";
import FloatingToolbar from "@/components/FloatingToolbar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

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

/* Convert index to Bangla numeral */
const toBanglaNum = (n: number): string => {
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(n).split("").map(d => digits[parseInt(d)] ?? d).join("");
};

const padBangla = (n: number): string => {
  const s = toBanglaNum(n);
  return s.length < 2 ? "০" + s : s;
};

export default function QuestionPaperView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const paperRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [meta, setMeta] = useState<PaperMeta | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentPaperId, setCurrentPaperId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const isMobile = useIsMobile();
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    showMarksBox: false,
    showSubjectCode: false,
    showClassName: true,
    showSubjectName: true,
    showChapterName: true,
    showSetCode: false,
    showProgramName: true,
    showInstruction: true,
    paperSize: "A4" as PaperSize,
    optionStyle: "bracket" as OptionStyle,
    fontLang: "bangla",
    fontSize: 14,
    columns: 2 as ColumnCount,
    columnDivider: true,
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
    cqToAnswer: 0, // 0 means auto (all)
  });

  // Measure container width for responsive scaling
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width - 32);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const paperWidthPx = useMemo(() => {
    const map: Record<PaperSize, number> = { A4: 780, Letter: 800, Legal: 800, A5: 560 };
    return map[settings.paperSize];
  }, [settings.paperSize]);

  const paperScale = useMemo(() => {
    if (!containerWidth || containerWidth >= paperWidthPx) return 1;
    return containerWidth / paperWidthPx;
  }, [containerWidth, paperWidthPx]);

  useEffect(() => {
    const paperId = searchParams.get("paper_id");
    if (paperId) {
      // Load saved paper from DB
      setCurrentPaperId(paperId);
      supabase.from("saved_papers").select("*").eq("id", paperId).maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          setMeta(data.meta as any);
          if (data.settings) setSettings(prev => ({ ...prev, ...(data.settings as any) }));
          // Fetch actual questions by IDs
          const ids = data.question_ids as number[];
          if (ids.length > 0) {
            supabase.from("questions").select("*").in("id", ids)
              .then(({ data: qData }) => {
                if (qData) {
                  // Preserve original order
                  const qMap = new Map(qData.map(q => [q.id, q]));
                  setQuestions(ids.map(id => qMap.get(id)).filter(Boolean) as QuestionRow[]);
                }
              });
          }
        });
    } else {
      const qData = sessionStorage.getItem("viewPaperQuestions");
      const mData = sessionStorage.getItem("viewPaperMeta");
      if (qData) setQuestions(JSON.parse(qData));
      if (mData) setMeta(JSON.parse(mData));
    }
  }, [searchParams]);

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

  const cqToAnswerForTotal = settings.cqToAnswer > 0 ? Math.min(settings.cqToAnswer, cqQuestions.length) : cqQuestions.length;
  const totalMarks = mcqQuestions.length + shortQuestions.length * 2 + cqToAnswerForTotal * 10 + descriptiveQuestions.length * 10;

  const getOptionLabel = (label: string) => {
    switch (settings.optionStyle) {
      case "bracket": return `(${label})`;
      case "paren": return `${label})`;
      case "dot": return `${label}.`;
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
    A4: "780px", Letter: "800px", Legal: "800px", A5: "560px",
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

  /* MCQ marks line */
  const mcqTotalMarks = mcqQuestions.length;
  const mcqMarksLine = mcqQuestions.length > 0
    ? `${toBanglaNum(mcqQuestions.length)} x ${toBanglaNum(1)} = ${toBanglaNum(mcqTotalMarks)}`
    : "";

  /* CQ marks line - dynamic based on toAnswer */
  const cqToAnswer = settings.cqToAnswer > 0 ? Math.min(settings.cqToAnswer, cqQuestions.length) : cqQuestions.length;
  const cqTotalMarks = cqToAnswer * 10;
  const cqMarksLine = cqQuestions.length > 0
    ? `${toBanglaNum(10)} x ${toBanglaNum(cqToAnswer)} = ${toBanglaNum(cqTotalMarks)}`
    : "";

  /* CQ dynamic instruction */
  const cqInstruction = cqQuestions.length > 0
    ? (cqQuestions.length === cqToAnswer
      ? "সবগুলো প্রশ্নের উত্তর দাও :"
      : `যেকোনো ${toBanglaNum(cqToAnswer)}টি প্রশ্নের উত্তর দাও :`)
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
          <div className="flex gap-1 mt-1">
            {(["left", "center", "right", "justify"] as TextAlign[]).map(a => (
              <Button key={a} size="sm" variant={settings.textAlign === a ? "default" : "outline"} className="flex-1 text-xs px-2" onClick={() => updateSetting("textAlign", a)}>
                {a === "left" ? "≡←" : a === "center" ? "≡↔" : a === "right" ? "≡→" : "≡≡"}
              </Button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <Label className="text-xs text-muted-foreground">পেপার সাইজ</Label>
          <div className="flex gap-1 mt-1">
            {(["A4", "Letter", "Legal", "A5"] as PaperSize[]).map(s => (
              <Button key={s} size="sm" variant={settings.paperSize === s ? "default" : "outline"} className="flex-1 text-xs px-2" onClick={() => updateSetting("paperSize", s)}>
                {s}
              </Button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <Label className="text-xs text-muted-foreground">অপশন স্টাইল</Label>
          <div className="flex gap-1 mt-1">
            {([
              { v: "none" as OptionStyle, l: "○" },
              { v: "bracket" as OptionStyle, l: "( )" },
              { v: "dot" as OptionStyle, l: "." },
              { v: "paren" as OptionStyle, l: ")" },
            ]).map(s => (
              <Button key={s.v} size="sm" variant={settings.optionStyle === s.v ? "default" : "outline"} className="flex-1 text-xs px-2" onClick={() => updateSetting("optionStyle", s.v)}>
                {s.l}
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
              <SelectItem value="solaimanlipi">সোলাইমান লিপি</SelectItem>
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
            <p className="text-[10px] text-muted-foreground">একই প্রশ্ন একাধিকবার নির্বাচিত হলে সহজে শনাক্ত ও পরিবর্তন করা যাবে।</p>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm">শীট</span>
              <Switch checked={settings.showSheet} onCheckedChange={(v) => updateSetting("showSheet", v)} />
            </div>
            <p className="text-[10px] text-muted-foreground">শীট তৈরী সেটিংগুলো অটোমেটিক সেট থাকবে সবসময়।</p>
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
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleShuffle}>⇆</Button>
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
                  <span className="text-xs font-medium">{settings.watermarkSize}</span>
                </div>
                <Slider value={[settings.watermarkSize]} min={12} max={80} step={2} onValueChange={([v]) => updateSetting("watermarkSize", v)} />
              </div>
              <Input className="text-xs h-8" placeholder={meta?.instituteName || "জলছাপ টেক্সট লিখুন"} value={settings.watermarkText} onChange={(e) => updateSetting("watermarkText", e.target.value)} />
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="lg:grid lg:grid-cols-[1fr_300px] gap-0 -m-4 md:-m-6 relative">
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
      <div className="p-4 md:p-6 overflow-y-auto lg:h-[calc(100vh-64px)]" ref={scrollContainerRef}>
        {!isMobile && (
          <div className="mb-4 flex items-center gap-3 max-w-[800px] mx-auto">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/create")}>
              <Plus className="h-4 w-4 mr-1" /> আরও প্রশ্ন যুক্ত করুন
            </Button>
          </div>
        )}
        {isMobile && (
          <div className="mb-3 flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate("/dashboard/create")}>
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

        {/* Scaling wrapper: maintains fixed desktop width, scales down on mobile */}
        <div className="mx-auto" style={{
          width: isMobile ? '100%' : paperPreviewWidths[settings.paperSize],
          maxWidth: '100%',
          transformOrigin: "top left",
          transform: isMobile ? 'none' : `scale(${paperScale})`,
          marginBottom: isMobile ? 0 : `calc((${paperScale} - 1) * -50%)`,
        }}>
        <div
          className="font-paper"
          ref={paperRef}
          data-print-paper
          style={{
            width: isMobile ? '100%' : paperPreviewWidths[settings.paperSize],
            fontSize: `${settings.fontSize}px`,
            lineHeight: 1.35,
            userSelect: "none",
            WebkitUserSelect: "none",
            padding: isMobile ? "12px 10px" : "28px 44px",
            color: "#000",
            background: "#fff",
            boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
            fontFamily: settings.fontLang === "solaimanlipi"
              ? "'SolaimanLipi', 'Arial', sans-serif"
              : settings.fontLang === "kalpurush"
              ? "'Kalpurush', 'Arial', sans-serif"
              : settings.fontLang === "timesnewroman"
              ? "'Times New Roman', 'Georgia', serif"
              : "'SolaimanLipi', 'Arial', sans-serif",
            textAlign: settings.textAlign,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* ===== WATERMARK ===== */}
          {settings.showWatermark && (settings.watermarkText || meta.instituteName) && (
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%) rotate(-35deg)",
              fontSize: `${settings.watermarkSize || 30}px`,
              fontWeight: 900,
              opacity: (settings.watermarkOpacity || 40) / 100,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 0,
              color: "#000",
            }}>
              {settings.watermarkText || meta.instituteName}
            </div>
          )}

          {/* ===== HEADER with optional Marks Box ===== */}
          <div style={{ position: "relative", zIndex: 1 }}>
            {/* Marks Box - simple label + box, top left */}
            {settings.showMarksBox && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "0",
                fontFamily: "'SolaimanLipi', 'Arial', sans-serif",
                fontSize: "0.85em",
                fontWeight: 700,
                marginBottom: "6px",
              }}>
                <span style={{
                  border: "1.5px solid #000",
                  padding: "2px 8px",
                  lineHeight: 1.4,
                }}>প্রাপ্ত নম্বর</span>
                <span style={{
                  border: "1.5px solid #000",
                  borderLeft: "none",
                  padding: "2px 18px",
                  minWidth: "50px",
                  lineHeight: 1.4,
                }}>&nbsp;</span>
              </div>
            )}

            <div style={{
              textAlign: "center",
              marginBottom: "0",
              ...(settings.showSheet && settings.sheetColoredBg ? {
                backgroundColor: settings.sheetBgColor,
                color: settings.sheetTextColor,
                padding: "8px 12px",
                margin: "0 -44px",
              } : {}),
            }}>
            <h1
              className={editableClass}
              style={{ fontSize: "1.35em", fontWeight: 800, lineHeight: 1.3, margin: 0 }}
              data-editable="institute"
              onClick={handleEditableClick}
              suppressContentEditableWarning
            >
              {meta.instituteName}
            </h1>
            {/* Address below institute name */}
            {settings.showAddress && (() => {
              const parts: string[] = [];
              if (settings.showAddressSpecific && (settings.addressText || meta.instituteSpecificAddress)) parts.push(settings.addressText || meta.instituteSpecificAddress || "");
              if (settings.showAddressUpazila && meta.instituteUpazila) parts.push(meta.instituteUpazila);
              if (settings.showAddressDistrict && meta.instituteDistrict) parts.push(meta.instituteDistrict);
              if (settings.showAddressDivision && meta.instituteDivision) parts.push(meta.instituteDivision);
              const addressStr = parts.join(", ");
              return addressStr ? (
                <p
                  className={editableClass}
                  style={{ fontSize: "0.85em", margin: "0", fontWeight: 600 }}
                  data-editable="address"
                  onClick={handleEditableClick}
                  suppressContentEditableWarning
                >
                  {addressStr}
                </p>
              ) : null;
            })()}
            {settings.showProgramName && meta.programName && (
              <p
                className={editableClass}
                style={{ fontSize: "1.05em", fontWeight: 700, margin: "1px 0 0" }}
                data-editable="program"
                onClick={handleEditableClick}
                suppressContentEditableWarning
              >
                {meta.programName}
              </p>
            )}
            {(settings.showClassName || settings.showSubjectName) && (
              <p
                className={editableClass}
                data-editable="classSubject"
                onClick={handleEditableClick}
                suppressContentEditableWarning
                style={{ fontSize: "0.95em", margin: "1px 0 0" }}
              >
                {settings.showClassName && meta.className}
                {settings.showClassName && settings.showSubjectName && " — "}
                {settings.showSubjectName && `${meta.subjectName} ১ম পত্র`}
              </p>
            )}
            {settings.showSubjectCode && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: "8px", fontSize: "0.95em", margin: "1px 0 0" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 600 }}>
                  বিষয় কোড :
                  <span style={{ display: "inline-flex", gap: "0" }}>
                    {(meta.subjectCode || "১৭৮").split("").map((digit, i) => (
                      <span key={i} style={{
                        border: "1.5px solid #000",
                        borderLeft: i === 0 ? "1.5px solid #000" : "none",
                        padding: "1px 6px",
                        fontWeight: 700,
                        fontSize: "1em",
                        lineHeight: 1.3,
                        minWidth: "22px",
                        textAlign: "center" as const,
                      }}>{digit}</span>
                    ))}
                  </span>
                </span>
              </div>
            )}
            {settings.showChapterName && meta.chapterNames.length > 0 && (
              <p
                className={editableClass}
                style={{ fontSize: "0.85em", margin: "1px 0 0" }}
                data-editable="chapters"
                onClick={handleEditableClick}
                suppressContentEditableWarning
              >
                ({meta.chapterNames.join(", ")})
              </p>
            )}
            {/* ===== SHEET: Instructor, Profile, Topic inside header ===== */}
            {settings.showSheet && settings.sheetInstructorName && meta.teacherName && (
              <p style={{ fontSize: "0.95em", fontWeight: 700, margin: "1px 0 0" }}>
                ইন্সট্রাক্টর: {meta.teacherName}
              </p>
            )}
            {settings.showSheet && settings.sheetInstructorProfile && (
              <p
                className={editableClass}
                style={{ fontSize: "0.85em", margin: "0", color: settings.sheetColoredBg ? settings.sheetTextColor : "#0066cc" }}
                data-editable="instructor-profile"
                onClick={handleEditableClick}
                suppressContentEditableWarning
              >
                {settings.sheetInstructorProfileText || "+ Write Your Profile Here"}
              </p>
            )}
            {settings.showSheet && settings.sheetTopic && meta.topicNames && meta.topicNames.length > 0 && (
              <p style={{ fontSize: "0.85em", fontWeight: 600, margin: "1px 0 0" }}>
                লেকচার টপিক: {meta.topicNames.join(", ")}
              </p>
            )}
          </div>
          </div>
          {/* Lecture number & date row outside colored bg */}
          {settings.showSheet && (settings.sheetLectureNumber || settings.sheetDate) && (
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.85em",
              margin: "2px 0 0",
              zIndex: 1,
              position: "relative",
            }}>
              {settings.sheetLectureNumber && (
                <span style={{ fontWeight: 600 }}>
                  লেকচার নম্বরঃ {settings.sheetLectureNumberText || "১"}
                </span>
              )}
              {settings.sheetDate && (
                <span style={{ fontWeight: 600, marginLeft: "auto" }}>
                  Date: {new Date().toLocaleDateString("en-US", { timeZone: "Asia/Dhaka", month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
            </div>
          )}

          {settings.showSetCode && (
            <div style={{ textAlign: "right", margin: "2px 0" }}>
              <span
                className={editableClass}
                data-editable="setCode"
                onClick={handleEditableClick}
                suppressContentEditableWarning
              >
                সেট: <span style={{ border: "1.5px solid #000", padding: "0 5px", fontWeight: 700 }}>ক</span>
              </span>
            </div>
          )}

          {/* ===== TIME / MARKS ROW ===== */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontWeight: 600,
              fontSize: "0.95em",
              borderTop: "1.5px solid #000",
              borderBottom: "1.5px solid #000",
              padding: "2px 0",
              margin: "4px 0 2px",
            }}
          >
            <span
              className={editableClass}
              data-editable="time"
              onClick={handleEditableClick}
              suppressContentEditableWarning
            >
              সময়— ৫৫ মিনিট
            </span>
            <span
              className={editableClass}
              data-editable="marks"
              onClick={handleEditableClick}
              suppressContentEditableWarning
            >
              পূর্ণমান— {toBanglaNum(totalMarks)}
            </span>
          </div>

          {/* ===== STUDENT INFO ===== */}
          {settings.showStudentInfo && (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "8px",
                fontSize: "0.88em",
                padding: "3px 0",
                borderBottom: "1px solid #000",
                fontFamily: "'SolaimanLipi', 'Arial', sans-serif",
              }}
            >
              <span style={{ whiteSpace: "nowrap", fontWeight: 600 }}>শিক্ষার্থীর নাম:</span>
              <span style={{ flex: 1, borderBottom: "1.5px dotted #000", minWidth: "80px" }}>&nbsp;</span>
              <span style={{ whiteSpace: "nowrap", fontWeight: 600, marginLeft: "12px" }}>শাখা:</span>
              <span style={{ borderBottom: "1.5px dotted #000", minWidth: "80px", width: "120px" }}>&nbsp;</span>
              <span style={{ whiteSpace: "nowrap", fontWeight: 600, marginLeft: "12px" }}>রোল:</span>
              <span style={{ borderBottom: "1.5px dotted #000", minWidth: "60px", width: "100px" }}>&nbsp;</span>
            </div>
          )}

          {/* ===== INSTRUCTION ===== */}
          {settings.showInstruction && (
            <p
              className={editableClass}
              style={{ textAlign: "center", fontSize: "0.8em", margin: "2px 0", fontStyle: "italic" }}
              data-editable="instruction"
              onClick={handleEditableClick}
              suppressContentEditableWarning
            >
              [প্রশ্নপত্রে কোনো প্রকার দাগ/চিহ্ন দেয়া যাবেনা]
            </p>
          )}

          {/* ===== MCQ SECTION ===== */}
          {mcqQuestions.length > 0 && (() => {
            // Group MCQs: separate standalone vs grouped by stimulus_group_id
            const standaloneWithStimulus: QuestionRow[] = []; // single MCQ with optional stimulus
            const grouped = new Map<string, QuestionRow[]>();
            const standalone: QuestionRow[] = [];

            mcqQuestions.forEach(q => {
              if (q.stimulus_group_id) {
                if (!grouped.has(q.stimulus_group_id)) grouped.set(q.stimulus_group_id, []);
                grouped.get(q.stimulus_group_id)!.push(q);
              } else if (q.stimulus_text) {
                standaloneWithStimulus.push(q);
              } else {
                standalone.push(q);
              }
            });

            // Build rendering order: standalone first, then standalone-with-stimulus, then groups
            let mcqNumber = 0;

            return (
            <div style={{ marginTop: "6px", marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontSize: "0.9em", borderBottom: "1px solid #000", paddingBottom: "2px", marginBottom: "4px" }}>
                <span
                  className={editableClass}
                  data-editable="mcq-title"
                  onClick={handleEditableClick}
                  suppressContentEditableWarning
                >
                  বহুনির্বাচনি অংশ:
                </span>
                <span style={{ fontWeight: 600, fontSize: "0.95em" }}>{mcqMarksLine}</span>
              </div>

              {/* Regular standalone MCQs in grid */}
              {standalone.length > 0 && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: settings.columns === 3 ? "1fr 1fr 1fr" : settings.columns === 2 ? "1fr 1fr" : "1fr",
                  columnGap: "0", rowGap: "0",
                }}>
                  {standalone.map((q) => {
                    mcqNumber++;
                    const idx = mcqNumber;
                    const isDuplicate = duplicateIds.has(q.id);
                    const refStr = formatRefs(q);
                    const colIdx = (idx - 1) % settings.columns;
                    const showLeftBorder = colIdx > 0 && settings.columnDivider;
                    return (
                    <div key={q.id} className={editableClass} style={{
                        padding: "1px 0", paddingLeft: colIdx > 0 ? "10px" : "0", paddingRight: colIdx < settings.columns - 1 ? "10px" : "0",
                        borderLeft: showLeftBorder ? "0.5px solid #555" : "none",
                        background: isDuplicate ? "rgba(255,200,0,0.15)" : undefined,
                      }} data-editable={`mcq-${q.id}`} onClick={(e) => handleEditableClick(e, q.id)} suppressContentEditableWarning>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "0" }}>
                          <span style={{ width: "2.2rem", flexShrink: 0, fontWeight: 600 }}>{padBangla(idx)}।</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "3px" }}>
                              <span style={{ flex: 1 }}><LatexRenderer text={q.question} /></span>
                              {settings.showQuestionInfo && refStr && <span style={{ fontSize: "0.72em", whiteSpace: "nowrap", flexShrink: 0, opacity: 0.65 }}>{refStr}</span>}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px", fontSize: "0.88em", lineHeight: 1.3 }}>
                              {(["option_a", "option_b", "option_c", "option_d"] as const).map((key, oi) => {
                                const val = q[key]; if (!val) return null;
                                const label = ["ক", "খ", "গ", "ঘ"][oi];
                                const isCorrect = settings.showAnswerSheet && q.correct_answer?.trim() === val?.trim();
                                return (<span key={key} style={{ display: "inline-flex", alignItems: "baseline", gap: "3px", ...(isCorrect ? { fontWeight: 700, color: "#047857" } : {}) }}><span>{getOptionLabel(label)}</span> <LatexRenderer text={val} />{isCorrect && <span style={{ marginLeft: "2px", fontWeight: 900 }}>✔</span>}</span>);
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Standalone MCQs with optional stimulus (not grouped) */}
              {standaloneWithStimulus.map((q) => {
                mcqNumber++;
                const idx = mcqNumber;
                return (
                  <div key={q.id} style={{ marginTop: "6px" }}>
                    {q.stimulus_text && (
                      <div style={{ marginBottom: "4px", fontStyle: "italic", padding: "4px 0" }}>
                        <span dangerouslySetInnerHTML={{ __html: q.stimulus_text }} />
                      </div>
                    )}
                    <div className={editableClass} data-editable={`mcq-${q.id}`} onClick={(e) => handleEditableClick(e, q.id)} suppressContentEditableWarning>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "0" }}>
                        <span style={{ width: "2.2rem", flexShrink: 0, fontWeight: 600 }}>{padBangla(idx)}।</span>
                        <div style={{ flex: 1 }}>
                          <span><LatexRenderer text={q.question} /></span>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px", fontSize: "0.88em", lineHeight: 1.3 }}>
                            {(["option_a", "option_b", "option_c", "option_d"] as const).map((key, oi) => {
                              const val = q[key]; if (!val) return null;
                              const label = ["ক", "খ", "গ", "ঘ"][oi];
                              const isCorrect = settings.showAnswerSheet && q.correct_answer?.trim() === val?.trim();
                              return (<span key={key} style={{ display: "inline-flex", alignItems: "baseline", gap: "3px", ...(isCorrect ? { fontWeight: 700, color: "#047857" } : {}) }}><span>{getOptionLabel(label)}</span> <LatexRenderer text={val} />{isCorrect && <span style={{ marginLeft: "2px", fontWeight: 900 }}>✔</span>}</span>);
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Grouped MCQs with shared stimulus */}
              {Array.from(grouped.entries()).map(([groupId, groupQs]) => {
                const stimulusHtml = groupQs[0]?.stimulus_text || "";
                return (
                  <div key={groupId} style={{ marginTop: "8px" }}>
                    <p style={{ fontStyle: "italic", marginBottom: "4px", fontWeight: 500 }}>
                      নিচের উদ্দীপকটি পড়ে পরবর্তী প্রশ্নগুলোর উত্তর দাও:
                    </p>
                    {stimulusHtml && (
                      <div style={{ marginBottom: "6px", padding: "4px 8px", borderLeft: "2px solid #000" }}>
                        <span dangerouslySetInnerHTML={{ __html: stimulusHtml }} />
                      </div>
                    )}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: settings.columns === 3 ? "1fr 1fr 1fr" : settings.columns === 2 ? "1fr 1fr" : "1fr",
                      columnGap: "0", rowGap: "0",
                    }}>
                      {groupQs.map((q) => {
                        mcqNumber++;
                        const idx = mcqNumber;
                        const colIdx = (groupQs.indexOf(q)) % settings.columns;
                        const showLeftBorder = colIdx > 0 && settings.columnDivider;
                        return (
                          <div key={q.id} className={editableClass} style={{
                            padding: "1px 0", paddingLeft: colIdx > 0 ? "10px" : "0", paddingRight: colIdx < settings.columns - 1 ? "10px" : "0",
                            borderLeft: showLeftBorder ? "0.5px solid #555" : "none",
                          }} data-editable={`mcq-${q.id}`} onClick={(e) => handleEditableClick(e, q.id)} suppressContentEditableWarning>
                            <div style={{ display: "flex", alignItems: "baseline", gap: "0" }}>
                              <span style={{ width: "2.2rem", flexShrink: 0, fontWeight: 600 }}>{padBangla(idx)}।</span>
                              <div style={{ flex: 1 }}>
                                <span><LatexRenderer text={q.question} /></span>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px", fontSize: "0.88em", lineHeight: 1.3 }}>
                                  {(["option_a", "option_b", "option_c", "option_d"] as const).map((key, oi) => {
                                    const val = q[key]; if (!val) return null;
                                    const label = ["ক", "খ", "গ", "ঘ"][oi];
                                    const isCorrect = settings.showAnswerSheet && q.correct_answer?.trim() === val?.trim();
                                    return (<span key={key} style={{ display: "inline-flex", alignItems: "baseline", gap: "3px", ...(isCorrect ? { fontWeight: 700, color: "#047857" } : {}) }}><span>{getOptionLabel(label)}</span> <LatexRenderer text={val} />{isCorrect && <span style={{ marginLeft: "2px", fontWeight: 900 }}>✔</span>}</span>);
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            );
          })()}

          {/* ===== SHORT SECTION (2nd) ===== */}
          {shortQuestions.length > 0 && (
            <div style={{ marginTop: "10px", marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontSize: "0.9em", marginBottom: "3px" }}>
                <span
                  className={editableClass}
                  data-editable="short-title"
                  onClick={handleEditableClick}
                  suppressContentEditableWarning
                >
                  সংক্ষিপ্ত উত্তর প্রশ্ন (প্রতি প্রশ্নের মান ২)
                </span>
                <span style={{ fontWeight: 600, fontSize: "0.95em" }}>
                  {`${toBanglaNum(shortQuestions.length)} x ${toBanglaNum(2)} = ${toBanglaNum(shortQuestions.length * 2)}`}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                {shortQuestions.map((q, idx) => {
                  const num = idx + 1;
                  const refStr = formatRefs(q);
                  return (
                    <div
                      key={q.id}
                      className={editableClass}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "6px" }}
                      data-editable={`short-${q.id}`}
                      onClick={(e) => handleEditableClick(e, q.id)}
                      suppressContentEditableWarning
                    >
                      <span>
                        <LatexRenderer text={`${padBangla(num)}। ${q.question}`} />
                      </span>
                      {settings.showQuestionInfo && refStr && <span style={{ fontSize: "0.72em", whiteSpace: "nowrap", flexShrink: 0, opacity: 0.65 }}>{refStr}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== CQ SECTION (3rd) ===== */}
          {cqQuestions.length > 0 && (
            <div style={{ marginTop: "10px", marginBottom: "8px" }}>
              <div style={{ textAlign: "center", fontWeight: 700, fontSize: "0.95em", marginBottom: "2px", textDecoration: "underline" }}>
                <span
                  className={editableClass}
                  data-editable="cq-title"
                  onClick={handleEditableClick}
                  suppressContentEditableWarning
                >
                  সৃজনশীল প্রশ্ন (প্রতিটি প্রশ্নের মান ১০)
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9em", marginBottom: "6px" }}>
                <span style={{ fontWeight: 600 }}>{cqInstruction}</span>
                <span style={{ fontWeight: 600 }}>{cqMarksLine}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {cqQuestions.map((q, idx) => {
                  const num = idx + 1;
                  const refStr = formatRefs(q);
                  const cData = q.creative_data;
                  const subQuestions = cData?.sub_questions || [];
                  const usesMathMarks = isMathSubject || cData?.is_math === true;
                  const subLabels = usesMathMarks ? ["ক", "খ", "গ"] : ["ক", "খ", "গ", "ঘ"];
                  const subMarksMap = usesMathMarks ? [2, 4, 4] : [1, 2, 3, 4];
                  return (
                    <div key={q.id} className={editableClass} data-editable={`cq-${q.id}`} onClick={(e) => handleEditableClick(e, q.id)} suppressContentEditableWarning>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "0", marginBottom: "2px" }}>
                        <span style={{ width: "2.2rem", flexShrink: 0, fontWeight: 600 }}>{padBangla(num)}।</span>
                        <div style={{ flex: 1 }}>
                          {q.stimulus_text ? (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <span dangerouslySetInnerHTML={{ __html: q.stimulus_text }} />
                              {settings.showQuestionInfo && refStr && <span style={{ fontSize: "0.72em", whiteSpace: "nowrap", flexShrink: 0, opacity: 0.65, marginLeft: "8px" }}>{refStr}</span>}
                            </div>
                          ) : (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <span><LatexRenderer text={q.question} /></span>
                              {settings.showQuestionInfo && refStr && <span style={{ fontSize: "0.72em", whiteSpace: "nowrap", flexShrink: 0, opacity: 0.65, marginLeft: "8px" }}>{refStr}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                      {subQuestions.length > 0 && (
                        <div style={{ paddingLeft: "2.2rem" }}>
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
                                <span style={{ flexShrink: 0, marginLeft: "12px", fontWeight: 500 }}>{toBanglaNum(Number(marks))}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {(!subQuestions || subQuestions.length === 0) && cData?.stem && (
                        <div style={{ paddingLeft: "2.2rem" }}>
                          <p style={{ fontStyle: "italic", marginBottom: "2px" }}>
                            <span dangerouslySetInnerHTML={{ __html: cData.stem }} />
                          </p>
                          {(() => {
                            const keys = usesMathMarks ? ["q_ka", "q_kha", "q_ga"] : ["q_ka", "q_kha", "q_ga", "q_gha"];
                            return keys.map((key, si) => {
                              const text = cData[key];
                              if (!text) return null;
                              return (
                                <div key={si} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", lineHeight: 1.5 }}>
                                  <div style={{ display: "flex", gap: "4px", flex: 1 }}>
                                    <span style={{ flexShrink: 0 }}>({subLabels[si]})</span>
                                    <span style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: text }} />
                                  </div>
                                  <span style={{ flexShrink: 0, marginLeft: "12px", fontWeight: 500 }}>{toBanglaNum(subMarksMap[si])}</span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}
                      {(!subQuestions || subQuestions.length === 0) && !cData?.stem && q.stimulus_text && (
                        <div style={{ paddingLeft: "2.2rem" }}>
                          {(() => {
                            const keys = usesMathMarks ? ["q_ka", "q_kha", "q_ga"] : ["q_ka", "q_kha", "q_ga", "q_gha"];
                            return keys.map((key, si) => {
                              const text = cData?.[key];
                              if (!text) return null;
                              return (
                                <div key={si} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", lineHeight: 1.5 }}>
                                  <div style={{ display: "flex", gap: "4px", flex: 1 }}>
                                    <span style={{ flexShrink: 0 }}>({subLabels[si]})</span>
                                    <span style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: text }} />
                                  </div>
                                  <span style={{ flexShrink: 0, marginLeft: "12px", fontWeight: 500 }}>{toBanglaNum(subMarksMap[si])}</span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== DESCRIPTIVE SECTION (4th) ===== */}
          {descriptiveQuestions.length > 0 && (
            <div style={{ marginTop: "10px", marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontSize: "0.9em", marginBottom: "4px" }}>
                <span
                  className={editableClass}
                  data-editable="desc-title"
                  onClick={handleEditableClick}
                  suppressContentEditableWarning
                >
                  প্র্যাক্টিস অংশঃ বর্ণনামূলক প্রশ্ন (প্রতি প্রশ্নের মান ১০)
                </span>
                <span style={{ fontWeight: 600, fontSize: "0.95em" }}>
                  {`${toBanglaNum(10)} x ${toBanglaNum(descriptiveQuestions.length)} = ${toBanglaNum(descriptiveQuestions.length * 10)}`}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {descriptiveQuestions.map((q, idx) => {
                  const num = idx + 1;
                  const refStr = formatRefs(q);
                  const dData = q.creative_data;
                  return (
                    <div
                      key={q.id}
                      className={editableClass}
                      data-editable={`desc-${q.id}`}
                      onClick={(e) => handleEditableClick(e, q.id)}
                      suppressContentEditableWarning
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "0", marginBottom: "2px" }}>
                        <span style={{ width: "2.2rem", flexShrink: 0, fontWeight: 600 }}>
                          {padBangla(num)}।
                        </span>
                        <div style={{ flex: 1 }}>
                        {settings.showQuestionInfo && refStr && <span style={{ fontSize: "0.72em", whiteSpace: "nowrap", flexShrink: 0, opacity: 0.65 }}>{refStr}</span>}
                      {dData && (
                        <div>
                          {dData.desc_q_ka && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", lineHeight: 1.4, marginBottom: "2px" }}>
                              <div style={{ display: "flex", gap: "4px", flex: 1 }}>
                                <span style={{ flexShrink: 0 }}>(ক)</span>
                                <span style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: dData.desc_q_ka }} />
                              </div>
                              <span style={{ flexShrink: 0, marginLeft: "12px", fontWeight: 500 }}>৩</span>
                            </div>
                          )}
                          {dData.desc_q_kha && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", lineHeight: 1.4 }}>
                              <div style={{ display: "flex", gap: "4px", flex: 1 }}>
                                <span style={{ flexShrink: 0 }}>(খ)</span>
                                <span style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: dData.desc_q_kha }} />
                              </div>
                              <span style={{ flexShrink: 0, marginLeft: "12px", fontWeight: 500 }}>৭</span>
                            </div>
                          )}
                        </div>
                      )}
                      {!dData && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <span><LatexRenderer text={q.question} /></span>
                        </div>
                      )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Address moved to header */}
        </div>
        </div> {/* end scaling wrapper */}
      </div>

      {/* ===== SETTINGS SIDEBAR (Desktop) ===== */}
      <aside className="hidden lg:block border-l border-border h-[calc(100vh-64px)] sticky top-0 overflow-y-auto">
        <div className="p-4 space-y-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-heading font-bold text-center mb-3 flex items-center justify-center gap-2">
                <Settings className="h-4 w-4" /> সেটিংস
              </h3>

              <div className="flex gap-2 mb-4">
                <Button className="flex-1 gradient-green text-primary-foreground border-0 font-heading font-semibold" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" /> ডাউনলোড
                </Button>
                <Button variant="outline" className="font-heading font-semibold" onClick={handleSavePaper} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" /> {saving ? "..." : "সেভ"}
                </Button>
              </div>

              {settingsContent}
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
              <Button variant="outline" className="font-heading font-semibold" onClick={() => { handleSavePaper(); }} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> {saving ? "..." : "সেভ"}
              </Button>
            </div>
            {settingsContent}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
