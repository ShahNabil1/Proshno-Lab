import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, Settings, Plus, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import LatexRenderer from "@/components/LatexRenderer";
import FloatingToolbar from "@/components/FloatingToolbar";

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
}

interface PaperMeta {
  instituteName: string;
  className: string;
  subjectName: string;
  chapterNames: string[];
  programName: string;
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
  const paperRef = useRef<HTMLDivElement>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [meta, setMeta] = useState<PaperMeta | null>(null);

  // Inline editing state
  const [activeEditEl, setActiveEditEl] = useState<HTMLElement | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null);

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
    showShuffle: false,
    showAddress: false,
    showWatermark: false,
  });

  useEffect(() => {
    const qData = sessionStorage.getItem("viewPaperQuestions");
    const mData = sessionStorage.getItem("viewPaperMeta");
    if (qData) setQuestions(JSON.parse(qData));
    if (mData) setMeta(JSON.parse(mData));
  }, []);

  const handleEditableClick = useCallback((e: React.MouseEvent<HTMLElement>, questionId?: number) => {
    e.stopPropagation();
    const el = e.currentTarget;
    el.contentEditable = "true";
    el.focus();
    setActiveEditEl(el);
    setActiveQuestionId(questionId ?? null);
  }, []);

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

  const handleDownload = async () => {
    if (!paperRef.current) return;
    toast.info("ডাউনলোড শুরু হচ্ছে...");

    paperRef.current.querySelectorAll("[contenteditable]").forEach(el => {
      (el as HTMLElement).contentEditable = "false";
    });
    handleCloseToolbar();

    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error("পপআপ ব্লক হয়েছে। অনুগ্রহ করে পপআপ অনুমতি দিন।");
        return;
      }

      const paperWidths: Record<PaperSize, string> = {
        A4: "210mm", Letter: "216mm", Legal: "216mm", A5: "148mm",
      };

      const content = paperRef.current.innerHTML;
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>প্রশ্নপত্র</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.33/dist/katex.min.css">
          <style>
            @import url('https://fonts.maateen.me/solaiman-lipi/font.css');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'SolaimanLipi', 'Arial', sans-serif; font-size: ${settings.fontSize}px; color: #000; background: #fff; }
            @page { size: ${paperWidths[settings.paperSize]} auto; margin: 12mm 15mm; }
            .paper-content { max-width: ${paperWidths[settings.paperSize]}; margin: 0 auto; }
            [data-editable] { outline: none; }
            @media print { body { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="paper-content">${content}</div>
          <script>window.onload = function() { window.print(); }<\/script>
        </body>
        </html>
      `);
      printWindow.document.close();
    } catch {
      toast.error("ডাউনলোড করতে সমস্যা হয়েছে");
    }
  };

  const mcqQuestions = questions.filter(q => q.type === "mcq");
  const shortQuestions = questions.filter(q => q.type === "short");
  const cqQuestions = questions.filter(q => q.type === "cq");

  const totalMarks = mcqQuestions.length + shortQuestions.length * 2 + cqQuestions.length * 10;

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
        if (r.university && r.year) refs.push(`${r.university} '${r.year}`);
      });
    }
    return refs.length > 0 ? `[${refs.join(", ")}]` : "";
  };

  const editableClass = "outline-none transition-all hover:bg-primary/5 focus:ring-1 focus:ring-primary/40 focus:bg-primary/5 cursor-text rounded-sm";

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

  /* CQ marks line */
  const cqTotalMarks = cqQuestions.length * 10;
  const cqMarksLine = cqQuestions.length > 0
    ? `${toBanglaNum(cqQuestions.length)} x ${toBanglaNum(10)} = ${toBanglaNum(cqTotalMarks)}`
    : "";

  return (
    <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-6">
      {/* Floating Toolbar */}
      <FloatingToolbar
        targetEl={activeEditEl}
        onDelete={activeQuestionId !== null ? handleDeleteQuestion : undefined}
        onExchange={activeQuestionId !== null ? handleExchangeQuestion : undefined}
        onClose={handleCloseToolbar}
      />

      {/* Paper preview */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/create")}>
            <Plus className="h-4 w-4 mr-1" /> আরও প্রশ্ন যুক্ত করুন
          </Button>
          <span className="text-xs text-muted-foreground">💡 যেকোনো টেক্সটে ক্লিক করে সরাসরি এডিট করুন</span>
        </div>

        <div
          className="bg-white border rounded shadow-sm font-paper"
          ref={paperRef}
          style={{ fontSize: `${settings.fontSize}px`, lineHeight: 1.55, padding: "32px 40px", color: "#000" }}
        >
          {/* ===== HEADER ===== */}
          <div className="text-center mb-0" style={{ lineHeight: 1.4 }}>
            <h1
              className={`font-bold ${editableClass}`}
              style={{ fontSize: "1.3em", letterSpacing: "-0.01em" }}
              data-editable="institute"
              onClick={handleEditableClick}
              suppressContentEditableWarning
            >
              {meta.instituteName}
            </h1>
            {settings.showProgramName && meta.programName && (
              <p
                className={`font-bold ${editableClass}`}
                style={{ fontSize: "1.1em" }}
                data-editable="program"
                onClick={handleEditableClick}
                suppressContentEditableWarning
              >
                {meta.programName}
              </p>
            )}
            {settings.showClassName && (
              <p
                className={editableClass}
                data-editable="className"
                onClick={handleEditableClick}
                suppressContentEditableWarning
              >
                {meta.className}
              </p>
            )}
            {settings.showSubjectName && (
              <p
                className={editableClass}
                data-editable="subjectName"
                onClick={handleEditableClick}
                suppressContentEditableWarning
              >
                {meta.subjectName} ১ম পত্র
              </p>
            )}
            {settings.showChapterName && meta.chapterNames.length > 0 && (
              <p
                className={editableClass}
                data-editable="chapters"
                onClick={handleEditableClick}
                suppressContentEditableWarning
              >
                {meta.chapterNames.join(", ")}
              </p>
            )}
            {settings.showSetCode && (
              <p
                className={`text-right ${editableClass}`}
                data-editable="setCode"
                onClick={handleEditableClick}
                suppressContentEditableWarning
              >
                সেট: <span className="border border-black px-2 py-0.5 font-bold">ক</span>
              </p>
            )}
          </div>

          {/* ===== TIME / MARKS ROW ===== */}
          <div
            className="flex justify-between items-center py-0.5 my-1.5"
            style={{ fontWeight: 600, borderTop: "1.5px solid #000", borderBottom: "1.5px solid #000" }}
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

          {/* ===== INSTRUCTION ===== */}
          {settings.showInstruction && (
            <p
              className={`text-center my-1 ${editableClass}`}
              style={{ fontSize: "0.88em" }}
              data-editable="instruction"
              onClick={handleEditableClick}
              suppressContentEditableWarning
            >
              প্রশ্নপত্রে কোনো প্রকার দাগ/চিহ্ন দেয়া যাবেনা ।
            </p>
          )}

          {/* ===== MCQ SECTION ===== */}
          {mcqQuestions.length > 0 && (
            <div className="mt-2 mb-3">
              {/* Section header */}
              <div className="flex justify-between items-baseline mb-1.5">
                <p
                  className={`font-bold ${editableClass}`}
                  data-editable="mcq-title"
                  onClick={handleEditableClick}
                  suppressContentEditableWarning
                >
                  বহুনির্বাচনী অংশ:
                </p>
                <span className="text-sm">{mcqMarksLine}</span>
              </div>

              {/* MCQ Grid */}
              <div
                className={
                  settings.columns >= 2
                    ? `grid grid-cols-2 gap-x-6 gap-y-1 ${settings.columnDivider ? "divide-x divide-black/15" : ""}`
                    : "space-y-1"
                }
              >
                {mcqQuestions.map((q, idx) => {
                  const refStr = formatRefs(q);
                  return (
                    <div
                      key={q.id}
                      className={`${editableClass} px-0 py-0 ${settings.columns >= 2 && idx % 2 === 1 ? "pl-3" : ""}`}
                      data-editable={`mcq-${q.id}`}
                      onClick={(e) => handleEditableClick(e, q.id)}
                      suppressContentEditableWarning
                    >
                      {/* Question line with ref on right */}
                      <div className="flex justify-between items-start gap-1">
                        <p style={{ fontWeight: 500 }}>
                          <LatexRenderer text={`${padBangla(idx + 1)}।  ${q.question}`} />
                        </p>
                        {refStr && (
                          <span className="text-xs whitespace-nowrap shrink-0 opacity-70">{refStr}</span>
                        )}
                      </div>
                      {/* Options 2x2 */}
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0 ml-5 mt-0">
                        {(["option_a", "option_b", "option_c", "option_d"] as const).map((key, oi) => {
                          const val = q[key];
                          if (!val) return null;
                          const label = ["ক", "খ", "গ", "ঘ"][oi];
                          return (
                            <span key={key} style={{ fontSize: "0.9em", lineHeight: 1.4 }}>
                              {getOptionLabel(label)} <LatexRenderer text={val} />
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== SHORT SECTION ===== */}
          {shortQuestions.length > 0 && (
            <div className="mb-4">
              <p
                className={`font-bold mb-2 ${editableClass}`}
                data-editable="short-title"
                onClick={handleEditableClick}
                suppressContentEditableWarning
              >
                সংক্ষিপ্ত প্রশ্ন:
              </p>
              <div className="space-y-0.5">
                {shortQuestions.map((q, idx) => {
                  const num = mcqQuestions.length + idx + 1;
                  const refStr = formatRefs(q);
                  return (
                    <div
                      key={q.id}
                      className={`flex justify-between items-start gap-2 ${editableClass}`}
                      data-editable={`short-${q.id}`}
                      onClick={(e) => handleEditableClick(e, q.id)}
                      suppressContentEditableWarning
                    >
                      <p>
                        <LatexRenderer text={`${padBangla(num)}।  ${q.question}`} />
                      </p>
                      {refStr && <span className="text-xs whitespace-nowrap shrink-0 opacity-70">{refStr}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== CREATIVE QUESTION (CQ) SECTION ===== */}
          {cqQuestions.length > 0 && (
            <div className="mb-4">
              {/* Section header */}
              <div className="flex justify-between items-baseline mb-1.5">
                <p
                  className={`font-bold ${editableClass}`}
                  data-editable="cq-title"
                  onClick={handleEditableClick}
                  suppressContentEditableWarning
                >
                  সৃজনশীল অংশ:
                </p>
                <span className="text-sm">{cqMarksLine}</span>
              </div>

              <div className="space-y-3">
                {cqQuestions.map((q, idx) => {
                  const num = mcqQuestions.length + shortQuestions.length + idx + 1;
                  const refStr = formatRefs(q);
                  const cData = q.creative_data;
                  const subQuestions = cData?.sub_questions || [];

                  return (
                    <div
                      key={q.id}
                      className={editableClass}
                      data-editable={`cq-${q.id}`}
                      onClick={(e) => handleEditableClick(e, q.id)}
                      suppressContentEditableWarning
                    >
                      {/* Stem number + text */}
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <p style={{ fontWeight: 500 }}>
                          <LatexRenderer text={`${padBangla(num)}।  ${q.question}`} />
                        </p>
                        {refStr && <span className="text-xs whitespace-nowrap shrink-0 opacity-70">{refStr}</span>}
                      </div>

                      {/* Sub-questions with marks on right */}
                      {subQuestions.length > 0 && (
                        <div className="ml-5 mt-1 space-y-0.5">
                          {subQuestions.map((sq: any, si: number) => {
                            const subLabel = ["ক", "খ", "গ", "ঘ"][si] || "";
                            const subMarks = [1, 2, 3, 4][si] || "";
                            return (
                              <div key={si} className="flex justify-between items-start">
                                <p>
                                  ({subLabel}) <LatexRenderer text={sq.question || sq.text || ""} />
                                </p>
                                <span className="shrink-0 ml-2">{toBanglaNum(Number(subMarks))}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Fallback if no creative_data sub_questions */}
                      {(!subQuestions || subQuestions.length === 0) && cData?.stem && (
                        <div className="ml-5 mt-1">
                          <p className="italic mb-1"><LatexRenderer text={cData.stem} /></p>
                          {["ক", "খ", "গ", "ঘ"].map((label, si) => {
                            const key = `sub_${si + 1}` as string;
                            const text = cData[key];
                            if (!text) return null;
                            const marks = [1, 2, 3, 4][si];
                            return (
                              <div key={si} className="flex justify-between items-start">
                                <p>({label}) <LatexRenderer text={text} /></p>
                                <span className="shrink-0 ml-2">{toBanglaNum(marks)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== SETTINGS SIDEBAR ===== */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-heading font-bold text-center mb-3 flex items-center justify-center gap-2">
                <Settings className="h-4 w-4" /> সেটিংস
              </h3>

              <Button className="w-full gradient-green text-primary-foreground border-0 mb-4 font-heading font-semibold" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" /> ডাউনলোড
              </Button>

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
                      <SelectItem value="bangla">বাংলা</SelectItem>
                      <SelectItem value="english">English</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <div className="flex items-center justify-between">
                    <span className="text-sm">শীট</span>
                    <Switch checked={settings.showSheet} onCheckedChange={(v) => updateSetting("showSheet", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">শাফল (সেট কোড তৈরী)</span>
                    <span className="text-muted-foreground">⇆</span>
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
                  <div className="flex items-center justify-between">
                    <span className="text-sm">জলছাপ</span>
                    <Switch checked={settings.showWatermark} onCheckedChange={(v) => updateSetting("showWatermark", v)} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </aside>
    </div>
  );
}
