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
  subjectCode?: string;
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
        if ((r.name || r.university) && r.year) refs.push(`${r.name || r.university} '${r.year}`);
      });
    }
    return refs.length > 0 ? `[${refs.join(", ")}]` : "";
  };

  const editableClass = "outline-none cursor-text";

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
          className="mx-auto font-paper"
          ref={paperRef}
          style={{
            maxWidth: "780px",
            fontSize: `${settings.fontSize}px`,
            lineHeight: 1.35,
            userSelect: "none",
            WebkitUserSelect: "none",
            padding: "28px 44px",
            color: "#000",
            background: "#fff",
            boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
            fontFamily: "'SolaimanLipi', 'Arial', sans-serif",
          }}
        >
          {/* ===== HEADER with optional Marks Box ===== */}
          <div style={{ position: "relative" }}>
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

            <div style={{ textAlign: "center", marginBottom: "0" }}>
            <h1
              className={editableClass}
              style={{ fontSize: "1.35em", fontWeight: 800, lineHeight: 1.3, margin: 0 }}
              data-editable="institute"
              onClick={handleEditableClick}
              suppressContentEditableWarning
            >
              {meta.instituteName}
            </h1>
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
          </div>
          </div>

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
          {mcqQuestions.length > 0 && (
            <div style={{ marginTop: "6px", marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontSize: "0.9em", borderBottom: "1px solid #000", paddingBottom: "2px", marginBottom: "4px" }}>
                <span>—</span>
                <span
                  className={editableClass}
                  data-editable="mcq-title"
                  onClick={handleEditableClick}
                  suppressContentEditableWarning
                >
                  বহুনির্বাচনী অংশ
                </span>
                <span>—</span>
                <span style={{ fontWeight: 400, fontSize: "0.9em" }}>{mcqMarksLine}</span>
              </div>

              {/* MCQ 2-column grid with central divider */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: settings.columns >= 2 ? "1fr 1fr" : "1fr",
                  columnGap: "0",
                  rowGap: "0",
                }}
              >
                {mcqQuestions.map((q, idx) => {
                  const refStr = formatRefs(q);
                  const isRightCol = settings.columns >= 2 && idx % 2 === 1;
                  return (
                    <div
                      key={q.id}
                      className={editableClass}
                      style={{
                        padding: "1px 0",
                        paddingLeft: isRightCol ? "10px" : "0",
                        paddingRight: !isRightCol && settings.columns >= 2 ? "10px" : "0",
                        borderLeft: isRightCol && settings.columnDivider ? "0.5px solid #555" : "none",
                      }}
                      data-editable={`mcq-${q.id}`}
                      onClick={(e) => handleEditableClick(e, q.id)}
                      suppressContentEditableWarning
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "3px" }}>
                        <span style={{ flex: 1 }}>
                          <LatexRenderer text={`${padBangla(idx + 1)}। ${q.question}`} />
                        </span>
                        {settings.showQuestionInfo && refStr && (
                          <span style={{ fontSize: "0.72em", whiteSpace: "nowrap", flexShrink: 0, opacity: 0.65 }}>{refStr}</span>
                        )}
                      </div>
                      <div style={{ marginLeft: "16px", display: "flex", flexWrap: "wrap", gap: "1px 10px", fontSize: "0.88em", lineHeight: 1.3 }}>
                        {(["option_a", "option_b", "option_c", "option_d"] as const).map((key, oi) => {
                          const val = q[key];
                          if (!val) return null;
                          const label = ["ক", "খ", "গ", "ঘ"][oi];
                          return (
                            <span key={key}>
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
            <div style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontSize: "0.9em", borderBottom: "1px solid #000", paddingBottom: "2px", marginBottom: "3px" }}>
                <span>—</span>
                <span
                  className={editableClass}
                  data-editable="short-title"
                  onClick={handleEditableClick}
                  suppressContentEditableWarning
                >
                  সংক্ষিপ্ত প্রশ্ন
                </span>
                <span>—</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                {shortQuestions.map((q, idx) => {
                  const num = mcqQuestions.length + idx + 1;
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

          {/* ===== CREATIVE QUESTION (CQ) SECTION ===== */}
          {cqQuestions.length > 0 && (
            <div style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontSize: "0.9em", borderBottom: "1px solid #000", paddingBottom: "2px", marginBottom: "4px" }}>
                <span>—</span>
                <span
                  className={editableClass}
                  data-editable="cq-title"
                  onClick={handleEditableClick}
                  suppressContentEditableWarning
                >
                  সৃজনশীল অংশ
                </span>
                <span>—</span>
                <span style={{ fontWeight: 400, fontSize: "0.9em" }}>{cqMarksLine}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
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
                      {/* Stem */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "6px", marginBottom: "2px" }}>
                        <span style={{ fontWeight: 600, flex: 1 }}>
                          <LatexRenderer text={`${padBangla(num)}। ${q.question}`} />
                        </span>
                        {settings.showQuestionInfo && refStr && <span style={{ fontSize: "0.72em", whiteSpace: "nowrap", flexShrink: 0, opacity: 0.65 }}>{refStr}</span>}
                      </div>

                      {/* Sub-questions with marks pinned far right */}
                      {subQuestions.length > 0 && (
                        <div style={{ marginLeft: "18px" }}>
                          {subQuestions.map((sq: any, si: number) => {
                            const subLabel = ["ক", "খ", "গ", "ঘ"][si] || "";
                            const subMarks = [1, 2, 3, 4][si] || "";
                            return (
                              <div key={si} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", lineHeight: 1.4 }}>
                                <span>({subLabel}) <LatexRenderer text={sq.question || sq.text || ""} /></span>
                                <span style={{ flexShrink: 0, marginLeft: "12px", fontWeight: 500 }}>{toBanglaNum(Number(subMarks))}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Fallback for stem-based CQ */}
                      {(!subQuestions || subQuestions.length === 0) && cData?.stem && (
                        <div style={{ marginLeft: "18px" }}>
                          <p style={{ fontStyle: "italic", marginBottom: "2px" }}><LatexRenderer text={cData.stem} /></p>
                          {["ক", "খ", "গ", "ঘ"].map((label, si) => {
                            const key = `sub_${si + 1}` as string;
                            const text = cData[key];
                            if (!text) return null;
                            const marks = [1, 2, 3, 4][si];
                            return (
                              <div key={si} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", lineHeight: 1.4 }}>
                                <span>({label}) <LatexRenderer text={text} /></span>
                                <span style={{ flexShrink: 0, marginLeft: "12px", fontWeight: 500 }}>{toBanglaNum(marks)}</span>
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
