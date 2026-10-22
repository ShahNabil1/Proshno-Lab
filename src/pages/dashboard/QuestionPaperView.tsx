import { normalizeQuestionReferenceSettings } from "@/lib/questionReferenceSettings";
import { usePaperInlineEdits } from "@/hooks/usePaperInlineEdits";
import type { PaperInlineEdits } from "@/lib/paperInlineEdits";
import PaperLoading from "@/components/paper/PaperLoading";
import PaperFontPicker from "@/components/paper/PaperFontPicker";
import { paperFontFamily } from "@/lib/paperFonts";
import { trackEvent } from "@/lib/analytics";
import { paperPdfFilename } from "@/lib/paperPdfFilename";
import PrintableDocument from "@/components/paper/PrintableDocument";
import { flushSync } from "react-dom";
import { buildPrintablePages, PAPER_DIMENSIONS, waitForPrintableAssets } from "@/lib/printableDocument";
import AutoFitQuestionGrid from "@/components/AutoFitQuestionGrid";
import { englishPaperSections, englishSectionInstruction, englishItemLabel, englishPassageInstruction } from '@/lib/englishPaperSections';
import { languageSubject, usesEnglishFirstTemplate } from '@/lib/languageQuestionTypes';
import { isLanguageType, questionTypeLabel, questionMarks } from "@/lib/languageQuestionTypes";
import { isCorrectOption } from "@/lib/answerKey";
import { useState, useEffect, useRef, useCallback, useMemo, memo, Fragment, type CSSProperties } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, AlignCenter, AlignJustify, AlignLeft, AlignRight, Download, Settings, Plus, Minus, Save, Pencil, Upload, SlidersHorizontal, Tv } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import LatexRenderer from "@/components/LatexRenderer";
import { EquationBoldContext, AnswerLineFitContext } from "@/contexts/EquationStyleContext";
import FloatingToolbar from "@/components/FloatingToolbar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";

import { findRepeatedStimuli, hasRenderableStimulus, normalizeStimulusKey } from "@/lib/stimulusGroups";
import InPaperOmrBox from "@/components/paper/InPaperOmrBox";
import ChirkutAnswerSheet from "@/components/paper/ChirkutAnswerSheet";
import { trimLeadingRichTextWhitespace } from "@/lib/richText";
import { exportPaperToDocx } from "@/lib/docxExport";
import { isLocalMockAdminEnabled } from "@/lib/localDevAuth";

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
  category_id?: number | null;
  topic_id?: number | null;
}

interface PaperMeta {
  purchaseMode?: string;
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

function isPaperMeta(value: unknown): value is PaperMeta {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const meta = value as Record<string, unknown>;
  return ["instituteName", "className", "subjectName", "programName"].every(key => typeof meta[key] === "string")
    && Array.isArray(meta.chapterNames) && meta.chapterNames.every(name => typeof name === "string");
}
type PaperSize = "A4" | "Letter" | "Legal" | "A5";
type PaperOrientation = "portrait" | "landscape";
type PreviewLayoutMode = "continuous" | "print";
type OptionStyle = "none" | "square" | "bracket" | "dot" | "paren";
type ColumnCount = 1 | 2 | 3;
type TextAlign = "left" | "center" | "right" | "justify";
type McqOptionLayout = "4x1" | "2x2" | "1x4";
type QuestionNumberStyle = "bn-padded-danda" | "bn-padded-dot" | "bn-dot" | "en-padded-dot";
type CqNumberStyle = QuestionNumberStyle | "box" | "pointer";
type SectionBorderStyle = "none" | "solid" | "double";
type QuestionReferenceStyle = "filled" | "black" | "outline" | "bracket" | "underline";

const isEnglishPaperMeta = (paperMeta: Pick<PaperMeta, "className" | "subjectName">): boolean =>
  /english|eglish|ইংলিশ/i.test(`${paperMeta.className || ""} ${paperMeta.subjectName || ""}`);

const DUPLICATE_IGNORED_CREATIVE_KEYS = /^(id|answer|answers|explanation|correct_answer|ans_|desc_ans_|marks?|created_at|updated_at)/i;

/** Canonical text used only for duplicate comparison; the rendered question stays untouched. */
function normalizeDuplicateText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, " image:$1 ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(nbsp|ensp|emsp|thinsp);|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[−–—]/g, "-")
    .replace(/\\(?:left|right|displaystyle|textstyle)/gi, "")
    .replace(/\\[a-z]+/gi, "")
    .replace(/[{}()[\]$^_`'".,;:!?।॥|]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}+\-=/<>%]/gu, "")
    .toLocaleLowerCase("bn-BD")
    .trim();
}

function collectCreativeQuestionText(value: unknown, key = ""): string[] {
  if (value == null || DUPLICATE_IGNORED_CREATIVE_KEYS.test(key)) return [];
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => collectCreativeQuestionText(item, key));
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([childKey, childValue]) => collectCreativeQuestionText(childValue, childKey));
  }
  return [];
}

function getQuestionDuplicateSignature(question: QuestionRow): string {
  const base = [question.question, question.stimulus_text];
  if (/^(cq|creative|descriptive)$/i.test(question.type) || !normalizeDuplicateText(question.question)) {
    base.push(...collectCreativeQuestionText(question.creative_data));
  }
  return `${question.type.toLowerCase()}::${normalizeDuplicateText(base.join(" "))}`;
}

// Preserve the user's selection; similar wording is only a duplicate marker.
function uniqueSelectedQuestions(rows: QuestionRow[]): QuestionRow[] {
  const seenIds = new Set<number>();
  return rows.filter(question => {
    if (seenIds.has(question.id)) return false;
    seenIds.add(question.id);
    return true;
  });
}

// Match eproshnobank's subtle, print-friendly question-column separator.
const COLUMN_DIVIDER_STYLE = "1px solid rgba(0, 0, 0, 0.2)";
const PREVIEW_FONT_SCALE = 16 / 14;
const ALWAYS_EDITABLE_HEADER_FIELDS = new Set([
  "institute", "address", "program", "class", "subject", "chapters",
  "setCode", "time", "marks", "instructor-profile",
]);

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
const AnswerContent = memo(({ text, className = "" }: { text: string; className?: string }) => (
  <div className={`answer-content ${className}`}>
    <LatexRenderer text={formatAnswerContent(text)} />
  </div>
));

// Print-friendly MCQ explanation.
const McqExplanation = memo(({ text, isEnglishVersion = false }: { text: string; isEnglishVersion?: boolean }) => (
  <div className="mcq-explanation" style={{ position: "relative", marginTop: "9px", padding: "20px 8px 6px", border: "1px solid #777", borderRadius: "4px", fontSize: "0.9em", lineHeight: 1.5, breakInside: "avoid" }}>
    <div style={{ position: "absolute", top: "-1px", left: "-1px", padding: "1px 6px 2px", borderRadius: "3px 0 3px 0", background: "#050505", color: "#fff", fontWeight: 700, lineHeight: 1.25 }}>
      {isEnglishVersion ? "Explanation" : "ব্যাখ্যা"}
    </div>
    <AnswerContent text={text} />
  </div>
));

function QuestionNumberGapControl({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = (next: number) => { setDraft(next); onCommit(next); };
  return <div className="mt-3 space-y-2 rounded-md border border-border/70 bg-muted/30 p-3">
    <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">নম্বর ও প্রশ্নের গ্যাপ</span><span className="text-sm font-semibold tabular-nums">{draft}px</span></div>
    <div className="flex items-center gap-3">
      <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" aria-label="নম্বর ও প্রশ্নের গ্যাপ কমান" disabled={draft === 0} onClick={() => commit(Math.max(0, draft - 1))}><Minus className="h-4 w-4" /></Button>
      <Slider aria-label="নম্বর ও প্রশ্নের গ্যাপ" className="flex-1 min-w-0 h-10 [&_[role=slider]]:h-7 [&_[role=slider]]:w-7" value={[draft]} min={0} max={24} step={1} onValueChange={([next]) => setDraft(next)} onValueCommit={([next]) => commit(next)} />
      <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" aria-label="নম্বর ও প্রশ্নের গ্যাপ বাড়ান" disabled={draft === 24} onClick={() => commit(Math.min(24, draft + 1))}><Plus className="h-4 w-4" /></Button>
    </div>
  </div>;
}
const CorrectAnswerBadge = ({ question, isEnglishVersion = false }: { question: QuestionRow; isEnglishVersion?: boolean }) => {
  const options = [question.option_a, question.option_b, question.option_c, question.option_d];
  const correctIndex = options.findIndex((_, index) => isCorrectOption(question.correct_answer, index, options));
  if (correctIndex < 0) return null;
  const labels = isEnglishVersion ? ["a", "b", "c", "d"] : ["ক", "খ", "গ", "ঘ"];
  return (
    <span className="col-span-full mcq-correct-answer-badge" style={{ gridColumn: "1 / -1", justifySelf: "end", marginRight: "-27px", marginTop: "-22px", breakInside: "avoid", pageBreakInside: "avoid", display: "inline-flex", flexShrink: 0, width: "22px", height: "22px", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "#050505", color: "#fff", fontWeight: 700, lineHeight: 1, zIndex: 1 }}>
      {labels[correctIndex]}
    </span>
  );
};

interface CqSubQuestionRowProps {
  label: React.ReactNode;
  text: string;
  marks: string;
}

// Shared CQ row geometry keeps every label, wrapped line, and mark in the same columns.
const CqSubQuestionRow = ({ label, text, marks }: CqSubQuestionRowProps) => (
  <div className="cq-sub-question-row">
    <span className="cq-sub-question-label">{label}</span>
    <LatexRenderer text={trimLeadingRichTextWhitespace(text)} className="cq-sub-question-text" />
    <span className="cq-sub-question-marks">{marks}</span>
  </div>
);


export default function QuestionPaperView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const paperRef = useRef<HTMLDivElement>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [paperLoading, setPaperLoading] = useState(true);
  const [removedDuplicateQuestions, setRemovedDuplicateQuestions] = useState<QuestionRow[] | null>(null);
  const [meta, setMeta] = useState<PaperMeta | null>(null);
  const autoSaveInFlight = useRef(false);
  const [currentPaperId, setCurrentPaperId] = useState<string | null>(null);
  const [cloudSaveState, setCloudSaveState] = useState<"pending" | "saving" | "saved" | "error">("pending");
  const cloudSaveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const latestCloudSave = useRef<(() => Promise<unknown>) | null>(null);
  const isMobile = useIsMobile();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [pageNumberOpen, setPageNumberOpen] = useState(false);
  const retainedAnswers = useRef(false);
  const [paginationRevision, setPaginationRevision] = useState(0);
  const [docxExporting, setDocxExporting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(isLocalMockAdminEnabled());

  // Inline editing state
  const [activeEditEl, setActiveEditEl] = useState<HTMLElement | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null);
  const [editingMode, setEditingMode] = useState(false);
  const [mcqOptionAdjusting, setMcqOptionAdjusting] = useState(false);
  const [exchangingQuestionId, setExchangingQuestionId] = useState<number | null>(null);
  const hoveredQuestionIdRef = useRef<number | null>(null);

  // Settings
  const [settings, setSettings] = useState({
    inlineEdits: {} as PaperInlineEdits,
    showAnswerSheet: false,
    showChirkutAnswer: false,
    chirkutHideQuestions: false,
    showInPaperOmr: false,
    omrColumns: 4 as 2 | 3 | 4,
    showImportantQ: false,
    showQuestionInfo: false,
    questionReferenceStyle: "outline" as QuestionReferenceStyle,
    questionReferenceColor: "#000000",
    questionReferenceTextColor: "#000000",
    questionReferenceFontFamily: "inherit",
    questionReferenceFontSize: 12,
    questionReferenceBold: true,
    questionReferenceItalic: false,
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
    paperOrientation: "portrait" as PaperOrientation,
    previewLayoutMode: "continuous" as PreviewLayoutMode,
    showPageNumbers: false,
    pageMarginTop: 0,
    pageMarginBottom: 0,
    pageMarginLeft: 0,
    pageMarginRight: 0,
    optionStyle: "none" as OptionStyle,
    cqOptionStyle: "bracket" as OptionStyle,
    sqOptionStyle: "bracket" as OptionStyle,
    questionNumberStyle: "bn-padded-danda" as CqNumberStyle,
    cqNumberStyle: "box" as CqNumberStyle,
    sqNumberStyle: "bn-padded-danda" as CqNumberStyle,
    questionNumberGap: 6,
    fontLang: "bangla",
    fontSize: 12,
    equationBold: true,
    answerLineFit: false,
    columns: 2 as ColumnCount,
    columnDivider: true,
    headerSectionBorderStyle: "none" as SectionBorderStyle,
    headerSectionBorderColor: "#111827",
    questionSectionBorderStyle: "none" as SectionBorderStyle,
    questionSectionBorderColor: "#111827",
    questionGap: 0,
    columnGap: 15,
    textAlign: "justify" as TextAlign,
    mcqOptionLayouts: {} as Record<string, McqOptionLayout>,
    answeringColumns: 2 as 1 | 2,
    manualSectionColumns: {} as Record<string, 1 | 2>,
    showDuplicateMarker: true,
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
    showHeader: true,
    showHeaderLogo: false,
    headerLogoUrl: "",
    headerLogoSize: 44,
    headerLogoOpacity: 100,
    headerLogoPositionMode: "relative" as "relative" | "absolute",
    headerLogoPosition: "center" as "left" | "center" | "right",
    headerLogoX: 50,
    headerLogoY: 8,
    headerText: "",
    headerBackground: "#ffffff",
    headerTextColor: "#111827",
    headerFontSize: 28,
    headerHeight: 0,
    headerAlign: "center" as "left" | "center" | "right",
    headerFontFamily: "inherit",
    headerBold: true,
    headerItalic: false,
    headerLink: "",
    footerBackground: "#ffffff",
    footerTextColor: "#4b5563",
    footerFontSize: 12,
    footerHeight: 0,
    footerFontFamily: "inherit",
    footerBold: false,
    footerItalic: false,
    footerLink: "",
    footerAlign: "center" as "left" | "center" | "right",
    showFooter: false,
    footerText: "",
    showWatermark: false,
    watermarkOpacity: 15,
    watermarkSize: 30,
    watermarkText: "",
    watermarkLogoUrl: "",
    watermarkType: "text" as "text" | "logo",
    watermarkRotation: -35 as number,
    cqToAnswer: 0, // 0 means auto (all)
    shortToAnswer: 0,
    descToAnswer: 0,
  });

  const answerFitPreference = useMemo(() => ({
    enabled: settings.answerLineFit, fontSize: settings.fontSize,
    layoutKey: JSON.stringify([settings.columns, settings.columnGap, settings.paperSize, settings.manualSectionColumns]),
  }), [settings.answerLineFit, settings.fontSize, settings.columns, settings.columnGap, settings.paperSize, settings.manualSectionColumns]);

  useEffect(() => {
    let cancelled = false;
    setPaperLoading(true);
    const loadPaper = async () => {
      try {
    const paperId = searchParams.get("paper_id") || searchParams.get("id");
    const qData = sessionStorage.getItem("viewPaperQuestions");
    const mData = sessionStorage.getItem("viewPaperMeta");
    const savedSettings = sessionStorage.getItem("viewPaperSettings");

    if (qData && mData && !searchParams.get("action")) {
      // Prioritize sessionStorage (fresh generation or returning from "add more")
      const parsedQuestions = JSON.parse(qData);
      const parsedMeta = JSON.parse(mData);
      setQuestions(uniqueSelectedQuestions(parsedQuestions));
      setMeta(parsedMeta);

      // A draft/session can contain an older lightweight question shape. Hydrate it
      // from the source rows so answer explanations are never lost in preview.
      const questionIds = parsedQuestions
        .map((question: QuestionRow) => question.id)
        .filter((id: unknown): id is number => typeof id === "number");
      if (questionIds.length > 0) {
        supabase.from("questions").select("*").in("id", questionIds).then(({ data, error }) => {
          if (error) return;
          const fullRows = new Map(data.map((question) => [question.id, question as QuestionRow]));
          const seenIds = new Set<number>();
          const hydratedQuestions = uniqueSelectedQuestions(parsedQuestions.flatMap((question: QuestionRow) => {
            const sourceQuestion = fullRows.get(question.id);
            // Duplicate cleanup can delete an ID while this paper is still open.
            // Drop deleted cached rows and collapse repeated canonical IDs.
            if (!sourceQuestion || seenIds.has(sourceQuestion.id)) return [];
            seenIds.add(sourceQuestion.id);
            return [{ ...question, ...sourceQuestion }];
          }));
          setQuestions(hydratedQuestions);
          sessionStorage.setItem("viewPaperQuestions", JSON.stringify(hydratedQuestions));

        });
      }
      const restoredSettings = savedSettings ? JSON.parse(savedSettings) : {};
      setSettings(prev => ({
        ...prev,
        questionNumberStyle: restoredSettings.questionNumberStyle
          ?? (isEnglishPaperMeta(parsedMeta) ? "en-padded-dot" : "bn-padded-danda"),
        textAlign: /\u0997\u09a3\u09bf\u09a4|math/i.test(parsedMeta.subjectName || "") ? "left" : "justify",
        ...restoredSettings,
        inlineEdits: restoredSettings.inlineEdits && typeof restoredSettings.inlineEdits === "object" ? restoredSettings.inlineEdits : {},
        ...normalizeQuestionReferenceSettings(restoredSettings),
        showChapterName: parsedMeta.chapterNames.length === 1,
      }));
      if (savedSettings) {
        sessionStorage.removeItem("viewPaperSettings");
      }

      if (paperId) {
        // Returning to existing paper with new questions — update it
        setCurrentPaperId(paperId);
      }
      // Don't remove sessionStorage here — keep for page refresh
      // It will be cleared on unmount (navigation away)
    } else if (paperId) {
      // Load saved paper from DB
      setCurrentPaperId(paperId);
      await supabase.from("saved_papers").select("*").eq("id", paperId).maybeSingle()
        .then(async ({ data }) => {
          if (!data) return;
          if (!isPaperMeta(data.meta)) { toast.error("প্রশ্নপত্রের তথ্য সঠিক নয়।"); return; }
          const loadedMeta: PaperMeta = { ...(data.meta as unknown as PaperMeta) };
          if (!loadedMeta.purchaseMode && user) {
            const { data: payments } = await supabase.from("bkash_payments").select("selected_packages").eq("user_id", user.id).eq("status", "completed");
            const ids = new Set(data.question_ids || []);
            const paid = (payments || []).some(payment => Array.isArray(payment.selected_packages) && payment.selected_packages.some((order: any) => order?.kind === "payg" && order.question_ids?.length === ids.size && order.question_ids.every((id: number) => ids.has(id))));
            if (paid) loadedMeta.purchaseMode = "payg";
          }
          const loadedSettings = (data.settings as any) || {};
          setMeta(loadedMeta);
          setSettings(prev => ({
            ...prev,
            questionNumberStyle: loadedSettings.questionNumberStyle
              ?? (isEnglishPaperMeta(loadedMeta) ? "en-padded-dot" : "bn-padded-danda"),
            textAlign: /\u0997\u09a3\u09bf\u09a4|math/i.test(loadedMeta.subjectName || "") ? "left" : "justify",
            ...loadedSettings,
            inlineEdits: loadedSettings.inlineEdits && typeof loadedSettings.inlineEdits === "object" ? loadedSettings.inlineEdits : {},
            ...normalizeQuestionReferenceSettings(loadedSettings),
            showChapterName: loadedMeta.chapterNames.length === 1,
          }));
          const ids = data.question_ids as number[];
          if (ids.length > 0) {
            await supabase.from("questions").select("*").in("id", ids)
              .then(({ data: qData }) => {
                if (qData) {
                  const qMap = new Map(qData.map(q => [q.id, q]));
                  setQuestions(uniqueSelectedQuestions(ids.map(id => qMap.get(id)).filter(Boolean) as QuestionRow[]));
                }
              });
          }
        });
    }
      } catch {
        toast.error("প্রশ্নপত্র লোড করা যায়নি। আবার চেষ্টা করুন।");
      } finally {
        if (!cancelled) setPaperLoading(false);
      }
    };
    void loadPaper();
    return () => { cancelled = true; };
  }, [searchParams]);

  // Check admin/developer role for admin-only features like Word (.docx) export
  useEffect(() => {
    if (isLocalMockAdminEnabled()) {
      setIsAdmin(true);
      return;
    }
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    Promise.all([
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: user.id, _role: "developer" }),
    ])
      .then(([adminRes, devRes]) => {
        if (!cancelled) {
          setIsAdmin(Boolean(adminRes.data || devRes.data));
        }
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Keep paper data in sessionStorage across navigation & refresh.
  // It is only replaced when a new paper is generated, so returning
  // from any other page restores the exact same paper.


  const handleEditableClick = useCallback((e: React.MouseEvent<HTMLElement>, questionId?: number) => {
    e.stopPropagation();
    if (meta?.purchaseMode === "payg") return;
    const el = e.currentTarget;
    const isAlwaysEditableHeader = ALWAYS_EDITABLE_HEADER_FIELDS.has(el.dataset.editable || "");
    if (!editingMode && (questionId !== undefined || !isAlwaysEditableHeader)) return;
    el.contentEditable = "true";
    el.focus();
    setActiveEditEl(el);
    setActiveQuestionId(questionId ?? null);
  }, [editingMode, meta?.purchaseMode]);

  // Delegate editing to the real paper tree, including answer bodies and
  // fields without an individual React click handler.
  useEffect(() => {
    const paper = paperRef.current;
    if (!paper || !editingMode || meta?.purchaseMode === "payg") return;
    const click = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target || target.closest("button, input, select")) return;
      const el = target.closest<HTMLElement>(".latex-renderer")
        || target.closest<HTMLElement>("[data-editable], .paper-question-number, .cq-reference-answer-label, .cq-reference-answer-title, td, th, h1, h2, p, span")
        || target;
      if (el === paper || !paper.contains(el)) return;
      event.stopPropagation();
      if (activeEditEl === el && el.isContentEditable) return;
      if (activeEditEl) activeEditEl.contentEditable = "false";
      const question = el.closest<HTMLElement>('[data-editable^="mcq-"], [data-editable^="short-"], [data-editable^="cq-"], [data-editable^="desc-"]');
      const id = question?.dataset.editable?.match(/-(\d+)$/)?.[1];
      if (!el.dataset.editable) el.dataset.editable = "paper-field";
      el.contentEditable = "true";
      el.focus();
      setActiveEditEl(el);
      setActiveQuestionId(id ? Number(id) : null);
    };
    paper.addEventListener("click", click, true);
    return () => paper.removeEventListener("click", click, true);
  }, [editingMode, activeEditEl, meta?.purchaseMode]);

  const openMcqOptionAdjuster = useCallback(() => {
    const firstMcq = questions.find(q => q.type === "mcq");
    if (!firstMcq) {
      toast.info("এই প্রশ্নপত্রে কোনো MCQ নেই");
      return;
    }

    setEditingMode(true);
    window.requestAnimationFrame(() => {
      const el = paperRef.current?.querySelector<HTMLElement>(`[data-editable="mcq-${firstMcq.id}"]`);
      if (!el) return;
      el.contentEditable = "true";
      setActiveEditEl(el);
      setActiveQuestionId(firstMcq.id);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    toast.info("MCQ নির্বাচন করা হয়েছে—4x1, 2x2 বা 1x4 বেছে নিন");
  }, [questions]);

  const updateInlineEdits = useCallback((inlineEdits: PaperInlineEdits) => {
    setSettings(previous => ({ ...previous, inlineEdits }));
  }, []);
  const editRenderKey = useMemo(() => [settings, questions, meta, editingMode], [settings, questions, meta, editingMode]);
  const captureInlineEdits = usePaperInlineEdits(paperRef, activeEditEl, settings.inlineEdits, updateInlineEdits, editRenderKey);

  const handleCloseToolbar = useCallback(() => {
    captureInlineEdits();
    if (activeEditEl) {
      activeEditEl.contentEditable = "false";
    }
    setActiveEditEl(null);
    setActiveQuestionId(null);
    if (activeEditEl) setPaginationRevision(value => value + 1);
  }, [activeEditEl, captureInlineEdits]);

  const handleMcqOptionAdjustChange = useCallback((enabled: boolean) => {
    setMcqOptionAdjusting(enabled);
    if (enabled) {
      openMcqOptionAdjuster();
    } else {
      handleCloseToolbar();
    }
  }, [handleCloseToolbar, openMcqOptionAdjuster]);

  useEffect(() => {
    const updateHoveredQuestion = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const questionEl = event.target.closest<HTMLElement>("[data-editable]");
      const match = questionEl?.dataset.editable?.match(/^(?:mcq|short|cq|desc)-(\d+)$/);
      hoveredQuestionIdRef.current = match ? Number(match[1]) : null;
    };

    const scrollHoveredQuestion = (event: KeyboardEvent) => {
      if (editingMode || (event.target instanceof HTMLElement && event.target.isContentEditable)) return;
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      if (hoveredQuestionIdRef.current === null) return;

      event.preventDefault();
      window.scrollBy({
        top: event.key === "ArrowUp" ? -180 : 180,
        behavior: "smooth",
      });
    };

    document.addEventListener("mousemove", updateHoveredQuestion);
    document.addEventListener("keydown", scrollHoveredQuestion);
    return () => {
      document.removeEventListener("mousemove", updateHoveredQuestion);
      document.removeEventListener("keydown", scrollHoveredQuestion);
    };
  }, [editingMode]);

  const handleDeleteQuestion = useCallback(() => {
    if (activeQuestionId !== null) {
      setQuestions(prev => prev.filter(q => q.id !== activeQuestionId));
      handleCloseToolbar();
      toast.success("প্রশ্ন মুছে ফেলা হয়েছে");
    }
  }, [activeQuestionId, handleCloseToolbar]);

  const handleExchangeQuestion = useCallback(async () => {
    if (activeQuestionId === null || exchangingQuestionId !== null) return;
    const current = questions.find((question) => question.id === activeQuestionId);
    if (!current || !current.class_id || !current.subject_id) {
      toast.error("এই প্রশ্নটির শ্রেণি ও বিষয়ের তথ্য পাওয়া যায়নি।");
      return;
    }

    setExchangingQuestionId(activeQuestionId);
    try {
      const usedIds = questions.map((question) => question.id);
      const fetchCandidates = async (sameChapter: boolean) => {
        let query = supabase
          .from("questions")
          .select("*")
          .eq("type", current.type)
          .eq("class_id", current.class_id!)
          .eq("subject_id", current.subject_id!)
          .not("id", "in", `(${usedIds.join(",")})`)
          .limit(200);

        if (sameChapter && current.chapter_id) query = query.eq("chapter_id", current.chapter_id);
        if (sameChapter && current.category_id) query = query.eq("category_id", current.category_id);
        if (sameChapter && current.topic_id) query = query.eq("topic_id", current.topic_id);
        return query;
      };

      let { data, error } = await fetchCandidates(true);
      if (!error && (!data || data.length === 0)) ({ data, error } = await fetchCandidates(false));
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.info("একই শ্রেণি, বিষয় ও ধরনের অন্য প্রশ্ন পাওয়া যায়নি।");
        return;
      }

      const replacement = data[Math.floor(Math.random() * data.length)] as QuestionRow;
      setQuestions((previous) => {
        const next = previous.map((question) => question.id === activeQuestionId ? replacement : question);
        sessionStorage.setItem("viewPaperQuestions", JSON.stringify(next));
        return next;
      });
      toast.success("প্রশ্নটি সফলভাবে বদলানো হয়েছে।");
      handleCloseToolbar();
    } catch (error) {
      console.error("Question exchange failed:", error);
      toast.error("প্রশ্ন বদলানো যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setExchangingQuestionId(null);
    }
  }, [activeQuestionId, exchangingQuestionId, questions, handleCloseToolbar]);

  // Content protection stays active for viewing, but standard editing shortcuts work in Editing Mode.
  useEffect(() => {
    const paperEl = paperRef.current;
    if (!paperEl) return;

    const isEditableInteraction = (target?: EventTarget | null) => {
      if (!editingMode) return false;
      const targetEl = target instanceof Element ? target : null;
      if (targetEl?.closest("[data-editable]") && paperEl.contains(targetEl)) return true;

      const selection = window.getSelection();
      const node = selection?.rangeCount ? selection.getRangeAt(0).commonAncestorContainer : null;
      const selectionEl = node instanceof Element ? node : node?.parentElement;
      return Boolean(selectionEl?.closest("[data-editable]") && paperEl.contains(selectionEl));
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (isEditableInteraction(e.target)) return;
      e.preventDefault();
      toast.error("কপি করা নিষেধ");
    };

    const handleCopy = (e: ClipboardEvent) => {
      if (isEditableInteraction(e.target)) return;
      e.preventDefault();
      toast.error("কপি করা নিষেধ");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingMode && e.key === "Escape") {
        e.preventDefault();
        setEditingMode(false);
        setMcqOptionAdjusting(false);
        handleCloseToolbar();
        return;
      }
      if (isEditableInteraction(e.target)) return;
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
  }, [editingMode, handleCloseToolbar]);

  const [printPreparing, setPrintPreparing] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const handleDownload = async () => {
    if (!paperRef.current || printPreparing) return;
    setPrintPreparing(true);
    setDownloadProgress(0);
    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      paperRef.current.querySelectorAll<HTMLElement>("[contenteditable]").forEach(el => { el.contentEditable = "false"; });
      handleCloseToolbar();
      // Commit the completed shared pages before invoking native print.
      const pages = await preparePrintablePages(undefined, percent => setDownloadProgress(Math.min(95, Math.round(percent * 0.95))));
      if (!pages.length) throw new Error("No printable pages are available");
      flushSync(() => setPagedPreviewPages(pages));
      await waitForPrintableAssets(document.querySelector<HTMLElement>('.paper-paged-print-source')!);
      setDownloadProgress(100);
      const previousTitle = document.title;
      const restoreTitle = () => { document.title = previousTitle; };
      // Chrome uses the page title as its suggested Save as PDF filename.
      document.title = paperPdfFilename(meta?.subjectName, settings.showAnswerSheet || settings.chirkutHideQuestions).replace(/\.pdf$/, "");
      window.addEventListener("afterprint", restoreTitle, { once: true });
      try {
        trackEvent("print_requested", { format: "pdf_or_print" });
        window.print();
      } catch (error) {
        window.removeEventListener("afterprint", restoreTitle);
        restoreTitle();
        throw error;
      }
    } catch (error) {
      console.error("PDF preparation failed", error);
      toast.error("PDF তৈরি করা যায়নি: " + (error instanceof Error ? error.message : String(error)));
    } finally { setPrintPreparing(false); }
  };

  const handleOpenSmartBoard = () => {
    if (!meta || questions.length === 0) {
      toast.error("Smart Board-এ নেওয়ার মতো কোনো প্রশ্ন নেই");
      return;
    }
    navigate("/dashboard/smartboard", {
      state: {
        smartBoardImport: {
          questions,
          meta: {
            instituteName: meta.instituteName,
            className: meta.className,
            subjectName: meta.subjectName,
            chapterNames: meta.chapterNames,
          },
          title: meta.programName || "বর্তমান প্রশ্নপত্র",
        },
      },
    });
  };

  const handleDocxExport = async () => {
    if (!isAdmin) {
      toast.error("ওয়ার্ড ফাইল ডাউনলোড শুধুমাত্র অ্যাডমিনদের জন্য অনুমোদিত।");
      return;
    }
    if (!meta || questions.length === 0) {
      toast.error("ওয়ার্ড ফাইল তৈরির জন্য প্রশ্ন ও মেটাডাটা প্রয়োজন");
      return;
    }

    setDocxExporting(true);
    try {
      await exportPaperToDocx({
        questions,
        meta,
        settings,
      });
      trackEvent("download", { format: "docx" });
      toast.success("Word (.docx) ফাইল সফলভাবে তৈরি হয়েছে!");
    } catch (error) {
      console.error("DOCX export failed:", error);
      toast.error("Word ফাইল তৈরি করা যায়নি");
    } finally {
      setDocxExporting(false);
    }
  };

  // Every newly generated paper is saved once, regardless of cloud-backup preferences.
  useEffect(() => {
    if (paperLoading || !user || !meta || !questions.length || currentPaperId || autoSaveInFlight.current) return;
    if (new URLSearchParams(window.location.search).has("paper_id")) return;
    const timer = window.setTimeout(async () => {
      if (autoSaveInFlight.current) return;
      autoSaveInFlight.current = true;
      try {
        const { data, error } = await supabase.from("saved_papers").insert({
          teacher_id: user.id,
          institution_name: meta.instituteName || "",
          exam_name: meta.programName || "",
          class_name: meta.className || "",
          subject_name: meta.subjectName || "",
          chapter_names: meta.chapterNames || [],
          question_ids: questions.map(q => q.id),
          meta: meta as any,
          settings: settings as any,
        }).select("id").single();
        if (error) throw error;
        setCurrentPaperId(data.id);
        const params = new URLSearchParams(window.location.search);
        params.set("paper_id", data.id);
        window.history.replaceState({}, "", `${window.location.pathname}?${params}`);

      } catch (error) {
        autoSaveInFlight.current = false;
        console.error("Auto-save failed:", error);
        toast.error("প্রশ্নপত্র অটো সেভ হয়নি। সংযোগ পরীক্ষা করে পেজটি রিফ্রেশ করুন।");
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [user, meta, questions, settings, currentPaperId, paperLoading]);

  const persistPaperChanges = useCallback((paperSettings = settings) => {
    if (!user || !meta || !currentPaperId || paperLoading) return Promise.resolve(false);
    const owner = user.id, id = currentPaperId;
    const payload = {
      institution_name: meta.instituteName || "", exam_name: meta.programName || "",
      class_name: meta.className || "", subject_name: meta.subjectName || "",
      chapter_names: meta.chapterNames || [], question_ids: questions.map(q => q.id),
      meta: meta as any, settings: paperSettings as any,
    };
    // Serialize writes so a slow older request cannot overwrite a newer edit.
    cloudSaveQueue.current = cloudSaveQueue.current.catch(() => {}).then(async () => {
      setCloudSaveState("saving");
      const { error } = await supabase.from("saved_papers").update(payload)
        .eq("id", id).eq("teacher_id", owner).select("id").single();
      if (error) { setCloudSaveState("error"); return false; }
      setCloudSaveState("saved"); return true;
    }).catch(() => { setCloudSaveState("error"); return false; });
    return cloudSaveQueue.current;
  }, [user?.id, meta, currentPaperId, paperLoading, questions, settings]);

  useEffect(() => {
    if (paperLoading || !meta || !questions.length) return;
    // Keep the same edited draft on refresh and while adding more questions.
    sessionStorage.setItem("viewPaperQuestions", JSON.stringify(questions));
    sessionStorage.setItem("viewPaperMeta", JSON.stringify(meta));
    sessionStorage.setItem("viewPaperSettings", JSON.stringify(settings));
    if (!currentPaperId) return;
    setCloudSaveState("pending");
    latestCloudSave.current = () => persistPaperChanges();
    const timer = window.setTimeout(() => { void persistPaperChanges(); }, 700);
    return () => window.clearTimeout(timer);
  }, [paperLoading, meta, questions, settings, currentPaperId, persistPaperChanges]);

  useEffect(() => () => { void latestCloudSave.current?.(); }, []);

  const handleSaveEdits = async () => {
    const inlineEdits = captureInlineEdits();
    const saved = await persistPaperChanges({ ...settings, inlineEdits });
    if (saved) toast.success("এডিটসহ প্রশ্নপত্র আমার প্রশ্ন-এ সেভ হয়েছে।");
    else toast.error("সেভ হয়নি। সংযোগ পরীক্ষা করে আবার সেভ করুন।");
  };
  /* Sort questions by type priority: MCQ(1) → Short(2) → CQ(3) → Descriptive(4) */
  const typePriority: Record<string, number> = { mcq: 1, short: 2, cq: 3, descriptive: 4 };
  const sortedQuestions = [...questions].sort(
    (a, b) => (typePriority[a.type] ?? 5) - (typePriority[b.type] ?? 5)
  );

  const mcqOnly = questions.length > 0 && questions.every(q => q.type === 'mcq');
  const autoMcqMode = useRef<boolean | null>(null);
  useEffect(() => {
    if (!questions.length || autoMcqMode.current === mcqOnly) return;
    autoMcqMode.current = mcqOnly;
    setSettings(prev => ({ ...prev, showMarksBox: mcqOnly, optionStyle: 'none' }));
  }, [questions.length, mcqOnly]);
  const isEnglishPaper = !mcqOnly && usesEnglishFirstTemplate(meta?.className || '', meta?.subjectName || '');
  const englishPaper = englishPaperSections(sortedQuestions);
  const mcqQuestions = (() => {
    const items = sortedQuestions.filter(q => q.type === "mcq");
    const repeated = findRepeatedStimuli(items, q => q.stimulus_text);
    const keyOf = (q: QuestionRow) => q.stimulus_group_id
      ? `id:${q.stimulus_group_id}`
      : repeated.has(normalizeStimulusKey(q.stimulus_text))
        ? `stimulus:${normalizeStimulusKey(q.stimulus_text)}` : null;
    const members = new Map<string, QuestionRow[]>();
    items.forEach(q => {
      const key = keyOf(q);
      if (key) members.set(key, [...(members.get(key) || []), q]);
    });
    const emitted = new Set<string>();
    return items.flatMap(q => {
      const key = keyOf(q);
      if (!key) return [q];
      if (emitted.has(key)) return [];
      emitted.add(key);
      return members.get(key) || [q];
    });
  })();
  const cqQuestions = sortedQuestions.filter(q => q.type === "cq");
  const shortQuestions = sortedQuestions.filter(q => q.type === "short");
  const descriptiveQuestions = sortedQuestions.filter(q => q.type === "descriptive");
  const languageQuestions = sortedQuestions.filter(q => isLanguageType(q.type));
  const languageMarks = isEnglishPaper ? englishPaper.sections.filter(s=>s.type !== "mcq").reduce((sum,s)=>sum+s.marks,0) : languageQuestions.reduce((sum,q)=>sum+questionMarks(q),0);

  const isEnglishVersion = languageSubject(meta?.subjectName || "") === "english1" || Boolean(meta && /english|eglish|ইংলিশ/i.test(meta.className || ""));
  const paperNumber = (n: number): string => isEnglishVersion ? String(n) : toBanglaNum(n);
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
    if (isEnglishPaper || /^chapter\s*\d+/i.test(name)) return name;
    const normalized = /^real number$/i.test(name.trim()) ? "Real Numbers" : name;
    return `Chapter ${index + 1} - ${normalized}`;
  };

  const cqToAnswerForTotal = settings.cqToAnswer > 0 ? Math.min(settings.cqToAnswer, cqQuestions.length) : cqQuestions.length;
  const shortToAnswerForTotal = settings.shortToAnswer > 0 ? Math.min(settings.shortToAnswer, shortQuestions.length) : shortQuestions.length;
  const descToAnswerForTotal = settings.descToAnswer > 0 ? Math.min(settings.descToAnswer, descriptiveQuestions.length) : descriptiveQuestions.length;
  const totalMarks = languageMarks + mcqQuestions.length + shortToAnswerForTotal * 2 + cqToAnswerForTotal * 10 + descToAnswerForTotal * 10;

  // Calculate total time: MCQ=1min, CQ=10min, Short=2min, Descriptive=10min
  const totalTimeMinutes = isEnglishPaper && totalMarks === 100 && englishPaper.sections.length === 13 ? 180 : languageMarks + (isEnglishVersion ? Math.ceil(mcqQuestions.length * 1.5) : mcqQuestions.length) + cqToAnswerForTotal * 10 + shortToAnswerForTotal * 2 + descToAnswerForTotal * 10;
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
  const formatQuestionNumberByStyle = (n: number, style: QuestionNumberStyle): string => {
    switch (style) {
      case "bn-padded-dot":
        return `${String(n).padStart(2, "0").replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[Number(d)])}.`;
      case "bn-dot":
        return `${toBanglaNum(n)}.`;
      case "en-padded-dot":
        return `${String(n).padStart(2, "0")}.`;
      case "bn-padded-danda":
      default:
        return `${String(n).padStart(2, "0").replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[Number(d)])}।`;
    }
  };

  const formatQuestionNumber = (n: number, style: CqNumberStyle = settings.questionNumberStyle): React.ReactNode => {
    if (style === "box") return <span className="cq-number-badge cq-number-badge--box">{isEnglishVersion ? String(n).padStart(2, "0") : toBanglaNum(n).padStart(2, "০")}</span>;
    if (style === "pointer") return <span className="cq-number-badge cq-number-badge--pointer"><span>{isEnglishVersion ? n : toBanglaNum(n)}</span><span aria-hidden="true">▶</span></span>;
    return formatQuestionNumberByStyle(n, style);
  };

  const renderCqQuestionNumber = (n: number) => {
    const number = isEnglishVersion ? String(n) : toBanglaNum(n);
    const padded = isEnglishVersion
      ? String(n).padStart(2, "0")
      : toBanglaNum(n).padStart(2, "০");

    if (settings.cqNumberStyle === "pointer") {
      return <span className="cq-number-badge cq-number-badge--pointer"><span>{number}</span><span aria-hidden="true">▶</span></span>;
    }
    if (settings.cqNumberStyle === "box") {
      return <span className="cq-number-badge cq-number-badge--box">{padded}</span>;
    }
    return <span>{formatQuestionNumberByStyle(n, settings.cqNumberStyle)}</span>;
  };

  const getMcqOptionLayout = (q: QuestionRow): McqOptionLayout =>
    settings.mcqOptionLayouts[String(q.id)] || "4x1";

  const getMcqOptionGridColumns = (q: QuestionRow): string => {
    const layout = getMcqOptionLayout(q);
    if (layout === "4x1") return "repeat(4, minmax(0, 1fr))";
    if (layout === "1x4") return "1fr";
    return "repeat(2, minmax(0, 1fr))";
  };

  const activeMcq = activeQuestionId === null
    ? null
    : questions.find(q => q.id === activeQuestionId && q.type === "mcq") || null;

  const activeAnswering = activeQuestionId !== null && questions.some(q=>q.id === activeQuestionId && ['answering_questions', 'true_false'].includes(q.type));
  const cycleAnsweringColumns = () => {
    const type = questions.find(q => q.id === activeQuestionId)?.type;
    if (!type) return;
    const grid = activeEditEl?.closest('[data-auto-fit-columns]') as HTMLElement | null;
    const current = Number(grid?.dataset.autoFitColumns || settings.manualSectionColumns?.[type] || 2);
    setSettings(prev => ({ ...prev, manualSectionColumns: { ...prev.manualSectionColumns, [type]: current === 1 ? 2 : 1 } }));
  };
  const cycleActiveMcqOptionLayout = () => {
    if (!activeMcq) return;
    const fittedColumns = activeEditEl?.querySelector<HTMLElement>("[data-auto-fit-columns]")?.dataset.autoFitColumns;
    const current = settings.mcqOptionLayouts[String(activeMcq.id)] || (fittedColumns === "1" ? "1x4" : fittedColumns === "2" ? "2x2" : getMcqOptionLayout(activeMcq));
    const next: McqOptionLayout = current === "1x4" ? "2x2" : current === "2x2" ? "4x1" : "1x4";
    setSettings(prev => ({
      ...prev,
      mcqOptionLayouts: { ...prev.mcqOptionLayouts, [String(activeMcq.id)]: next },
    }));
  };

  const getOptionLabel = (label: string, optionStyle: OptionStyle = settings.optionStyle): React.ReactNode => {
    switch (optionStyle) {
      case "bracket": return `(${label})`;
      case "paren": return `${label})`;
      case "dot": return `${label}.`;
      case "square": return (
        <span className="mcq-option-label-square">
          <span className="mcq-option-label-glyph">{label}</span>
        </span>
      );
      case "none": return (
        <span className="mcq-option-label-circle">
          <span className="mcq-option-label-glyph">{label}</span>
        </span>
      );
      default: return label;
    }
  };

  const updateSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettings(prev => ({ ...prev, ...(key === "showQuestionInfo" && value ? normalizeQuestionReferenceSettings(prev) : {}), [key]: value }));
  };

  const renderQuestionReference = (text: string, flex = false) => {
    const style = settings.questionReferenceStyle;
    const color = settings.questionReferenceColor;
    return (
      <span className={`paper-question-info${flex ? " paper-question-info--flex" : ""}`}>
        <span style={{
          display: "inline-block",
          padding: style === "bracket" || style === "underline" ? "0 2px" : "1px 5px",
          borderStyle: style === "outline" || style === "underline" ? "solid" : "none",
          borderColor: color,
          borderWidth: style === "outline" ? "1px" : style === "underline" ? "0 0 1px" : "0",
          borderRadius: style === "filled" || style === "black" || style === "outline" ? "2px" : undefined,
          background: style === "filled" ? color : style === "black" ? "#000" : "transparent",
          color: settings.questionReferenceTextColor,
          fontFamily: settings.questionReferenceFontFamily,
          fontSize: `${settings.questionReferenceFontSize}px`,
          fontWeight: settings.questionReferenceBold ? 700 : 400,
          fontStyle: settings.questionReferenceItalic ? "italic" : "normal",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}>
          {style === "bracket" ? `[${text}]` : text}
        </span>
      </span>
    );
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
    return refs.join(", ");
  };

  const editableClass = editingMode ? "outline-none cursor-text" : "outline-none cursor-default";

  const [portraitWidth, portraitHeight] = PAPER_DIMENSIONS[settings.paperSize];
  const pageWidthMm = settings.paperOrientation === "landscape" ? portraitHeight : portraitWidth;
  const pageHeightMm = settings.paperOrientation === "landscape" ? portraitWidth : portraitHeight;
  const previewPaperWidth = `${pageWidthMm}mm`;
  const previewPageHeight = pageHeightMm * 96 / 25.4;
  const [pagedPreviewPages, setPagedPreviewPages] = useState<string[]>([]);

  const printableCache = useRef(new Map<string, string[]>());
  const printablePending = useRef(new Map<string, { promise: Promise<string[]>; required: boolean; progress: number; listeners: Set<(percent: number) => void> }>());
  const [previewPreparing, setPreviewPreparing] = useState(false);
  const previewProgressRef = useRef<HTMLSpanElement>(null);
  const previewProgressValue = useRef(0);
  const showPreviewProgress = useCallback((percent: number) => {
    previewProgressValue.current = percent;
    if (previewProgressRef.current) previewProgressRef.current.textContent = `${percent}%`;
  }, []);
  const preparePrintablePages = useCallback(async (isCancelled?: () => boolean, onProgress?: (percent: number) => void) => {
      const paper = paperRef.current;
      if (!paper) return [];
      onProgress?.(0);
      await waitForPrintableAssets(paper);
      onProgress?.(10);
      if (isCancelled?.()) return [];
      const layout = {
        widthMm: pageWidthMm, heightMm: pageHeightMm,
        columns: isEnglishPaper ? 1 : settings.columns, gap: settings.columnGap,
        divider: settings.columnDivider ? COLUMN_DIVIDER_STYLE : "",
        margins: [38 + settings.pageMarginTop, 38 + settings.pageMarginRight,
          38 + settings.pageMarginBottom, 38 + settings.pageMarginLeft] as [number, number, number, number],
      };
      const key = JSON.stringify(layout) + paper.innerHTML + paper.getAttribute("style") + paper.getAttribute("data-answers-hidden");
      const cachedPages = printableCache.current.get(key);
      if (cachedPages) { onProgress?.(100); return cachedPages; }
      const pending = printablePending.current.get(key);
      if (pending) {
        if (!isCancelled) pending.required = true;
        if (onProgress) pending.listeners.add(onProgress);
        onProgress?.(pending.progress);
        try {
          const pages = await pending.promise;
          onProgress?.(100);
          return pages;
        } finally { if (onProgress) pending.listeners.delete(onProgress); }
      }
      const entry = { promise: Promise.resolve([] as string[]), required: !isCancelled, progress: 10, listeners: new Set<(percent: number) => void>() };
      if (onProgress) entry.listeners.add(onProgress);
      entry.promise = buildPrintablePages(paper, layout, () => !entry.required && Boolean(isCancelled?.()), percent => {
        entry.progress = 10 + Math.round(percent * 0.9);
        entry.listeners.forEach(listener => listener(entry.progress));
      });
      printablePending.current.set(key, entry);
      let pages: string[];
      try { pages = await entry.promise; }
      finally { if (printablePending.current.get(key) === entry) printablePending.current.delete(key); }
      if (isCancelled?.()) return [];
      if (printableCache.current.size >= 4) printableCache.current.delete(printableCache.current.keys().next().value!);
      printableCache.current.set(key, pages);
      return pages;
  }, [settings, pageWidthMm, pageHeightMm, isEnglishPaper]);

  useEffect(() => {
    if (editingMode || !meta || !questions.length) {
      setPreviewPreparing(false);
      return;
    }
    let cancelled = false;
    showPreviewProgress(0);
    setPreviewPreparing(settings.previewLayoutMode === "print");
    const timer = window.setTimeout(() => {
      preparePrintablePages(() => cancelled, percent => { if (!cancelled) showPreviewProgress(percent); }).then(pages => {
        if (!cancelled) { if (settings.previewLayoutMode === "print") setPagedPreviewPages(pages); setPreviewPreparing(false); }
      }).catch(error => {
        if (!cancelled) { setPreviewPreparing(false); console.error("Printable pagination failed", error); }
      });
    }, settings.previewLayoutMode === "print" ? 180 : 2500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [settings.previewLayoutMode, preparePrintablePages, questions, meta, isEnglishVersion, paginationRevision, showPreviewProgress, editingMode]);

  const requestedActionHandled = useRef(false);
  useEffect(() => {
    if (requestedActionHandled.current || !meta || !questions.length) return;
    const action = searchParams.get("action");
    if (action === "edit") {
      requestedActionHandled.current = true;
      if (meta.purchaseMode !== "payg") setEditingMode(true);
    } else if (action === "print") {
      requestedActionHandled.current = true;
      void handleDownload();
    }
  }, [meta, questions, searchParams]);

  /* Detect automatically; only compare with retained questions so the first copy survives. */
  const { allDuplicateIds, redundantDuplicateIds } = useMemo(() => {
    const allDuplicateIds = new Set<number>();
    const redundantDuplicateIds = new Set<number>();
    const retained: { question: QuestionRow; signature: string }[] = [];
    for (const question of questions) {
      const signature = getQuestionDuplicateSignature(question);
      const match = retained.find(item => item.signature === signature);
      if (match && signature.split("::").slice(1).join("::")) {
        allDuplicateIds.add(match.question.id);
        allDuplicateIds.add(question.id);
        redundantDuplicateIds.add(question.id);
      } else retained.push({ question, signature });
    }
    return { allDuplicateIds, redundantDuplicateIds };
  }, [questions]);
  const duplicateIds = settings.showDuplicateMarker ? allDuplicateIds : new Set<number>();
  const removeDuplicateQuestions = () => {
    handleCloseToolbar();
    setRemovedDuplicateQuestions(questions);
    setQuestions(previous => previous.filter(question => !redundantDuplicateIds.has(question.id)));
  };

  /* Shuffle questions for set code */
  const handleShuffle = useCallback(() => {
    setQuestions(prev => {
      const shuffleGroup = (group: QuestionRow[]) => {
        if (group.length < 2) return group;
        const shuffled = [...group];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // A valid random shuffle can occasionally keep the same order. Rotate once
        // in that case so the user always sees that the shuffle action worked.
        if (shuffled.every((question, index) => question.id === group[index].id)) {
          shuffled.push(shuffled.shift()!);
        }
        return shuffled;
      };

      const typeOrder = ["mcq", "short", "cq", "descriptive"];
      const shuffledKnownTypes = typeOrder.flatMap(type =>
        shuffleGroup(prev.filter(question => question.type === type))
      );
      const shuffledOtherTypes = shuffleGroup(
        prev.filter(question => !typeOrder.includes(question.type))
      );
      return [...shuffledKnownTypes, ...shuffledOtherTypes];
    });
    updateSetting("showSetCode", true);
    toast.success("প্রশ্ন শাফল করা হয়েছে — নতুন সেট তৈরী!");
  }, []);

  if (paperLoading) return <PaperLoading />;

  if (!meta) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">কোনো প্রশ্নপত্র পাওয়া যায়নি</p>
        <Button onClick={() => navigate("/dashboard/create")}>← প্রশ্ন তৈরীতে ফিরে যান</Button>
      </div>
    );
  }

  /* CQ answer-count instruction */
  const cqToAnswer = settings.cqToAnswer > 0 ? Math.min(settings.cqToAnswer, cqQuestions.length) : cqQuestions.length;

  /* Match eProshnoBank: only show a CQ instruction when a subset is required. */
  const cqInstruction = cqQuestions.length > cqToAnswer
    ? (isEnglishVersion ? `Answer any ${cqToAnswer} questions:` : `যেকোনো ${toBanglaNum(cqToAnswer)}টি প্রশ্নের উত্তর দাও :`)
    : "";

  /* Detect if subject is Math/Higher Math for CQ marks distribution */
  const isMathSubject = meta?.subjectName ? /গণিত|math|higher\s*math|উচ্চতর\s*গণিত/i.test(meta.subjectName) : false;

  const settingsContent = (
    <>
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm flex items-center gap-1.5">
              <Pencil className="h-3.5 w-3.5 text-primary" /> এডিটিং মোড
            </span>
            <Switch disabled={meta?.purchaseMode === "payg"} checked={editingMode} onCheckedChange={(v) => {
              setEditingMode(v);
              if (!v) handleCloseToolbar();
              if (v) toast.info("এডিটিং মোড অন হয়েছে");
            }} />
          </div>
        </div>


      {/* প্রশ্নে সংযুক্তি */}
      <div className="border-b border-border pb-3 mb-3">
        <h4 className="font-heading font-bold text-sm mb-2">প্রশ্নে সংযুক্তি</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">উত্তরপত্র</span>
            <Switch checked={settings.showAnswerSheet} onCheckedChange={(v) => updateSetting("showAnswerSheet", v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm">চিরকুট উত্তরপত্র</span>
            </div>
            <Switch checked={settings.showChirkutAnswer} onCheckedChange={(v) => updateSetting("showChirkutAnswer", v)} />
          </div>
          {settings.showChirkutAnswer && (
            <div className="ml-1 flex items-center justify-between border border-dashed rounded p-1.5 bg-muted/30">
              <span className="text-xs">প্রশ্ন লুকান</span>
              <Switch checked={settings.chirkutHideQuestions} onCheckedChange={(v) => updateSetting("chirkutHideQuestions", v)} />
            </div>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm">প্রশ্নে OMR সংযুক্ত</span>
              </div>
              <Switch checked={settings.showInPaperOmr} onCheckedChange={(v) => updateSetting("showInPaperOmr", v)} />
            </div>
            {settings.showInPaperOmr && (
              <div className="ml-1 flex items-center justify-between border rounded p-1.5 bg-muted/30">
                <span className="text-xs text-muted-foreground">OMR কলাম:</span>
                <div className="flex gap-1">
                  {([2, 3, 4] as const).map((col) => (
                    <Button
                      key={col}
                      size="sm"
                      variant={settings.omrColumns === col ? "default" : "outline"}
                      className="h-6 text-[10px] px-2"
                      onClick={() => updateSetting("omrColumns", col)}
                    >
                      {toBanglaNum(col)} কলাম
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {([
            { key: "showImportantQ" as const, label: "গুরুত্বপূর্ণ প্রশ্ন" },
            { key: "showQuestionInfo" as const, label: "প্রশ্নের রেফারেন্স" },
            { key: "showStudentInfo" as const, label: "শিক্ষার্থীর তথ্য" },
            { key: "showMarksBox" as const, label: "প্রাপ্ত নম্বর ঘর" },
            { key: "showSubjectCode" as const, label: "বিষয় কোড" },
          ]).map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <span className="text-sm">{item.label}</span>
              <Switch checked={settings[item.key]} onCheckedChange={(v) => updateSetting(item.key, v)} />
            </div>
          ))}
          {settings.showQuestionInfo && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-2">
              <Label className="text-xs text-muted-foreground">বোর্ড/স্কুল রেফারেন্স স্টাইল</Label>
              <Select value={settings.questionReferenceStyle} onValueChange={(value) => setSettings(previous => ({ ...previous, questionReferenceStyle: value as QuestionReferenceStyle, questionReferenceTextColor: value === "filled" || value === "black" ? "#ffffff" : "#000000" }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="filled">রঙিন Filled Badge</SelectItem>
                  <SelectItem value="black">কালো Badge — Print friendly</SelectItem>
                  <SelectItem value="outline">Outline Box — Print friendly</SelectItem>
                  <SelectItem value="bracket">[Bracket] — Print friendly</SelectItem>
                  <SelectItem value="underline">Underline — Print friendly</SelectItem>
                </SelectContent>
              </Select>
              {settings.questionReferenceStyle === "filled" && (
                <label className="flex items-center justify-between text-xs">Badge রং<input type="color" value={settings.questionReferenceColor} className="h-8 w-12 cursor-pointer rounded border p-1" onChange={(event) => updateSetting("questionReferenceColor", event.target.value)} /></label>
              )}
              <label className="flex items-center justify-between text-xs">লেখার রং<input type="color" value={settings.questionReferenceTextColor} className="h-8 w-12 cursor-pointer rounded border p-1" onChange={(event) => updateSetting("questionReferenceTextColor", event.target.value)} /></label>
              <div>
                <Label className="text-[10px] text-muted-foreground">রেফারেন্স ফন্ট</Label>
                <PaperFontPicker familyValue label="প্রশ্নের রেফারেন্সের ফন্ট নির্বাচন" value={settings.questionReferenceFontFamily} onChange={v => updateSetting("questionReferenceFontFamily", v)} />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">রেফারেন্স ফন্ট সাইজ</Label>
                <Select value={String(settings.questionReferenceFontSize)} onValueChange={(value) => updateSetting("questionReferenceFontSize", Number(value))}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 13 }, (_, index) => index + 8).map(size => (
                      <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <Button size="sm" variant={!settings.questionReferenceBold && !settings.questionReferenceItalic ? "default" : "outline"} className="h-7 text-xs" onClick={() => setSettings(previous => ({ ...previous, questionReferenceBold: false, questionReferenceItalic: false }))}>Normal</Button>
                <Button size="sm" variant={settings.questionReferenceBold ? "default" : "outline"} className="h-7 font-bold" onClick={() => updateSetting("questionReferenceBold", !settings.questionReferenceBold)}>B</Button>
                <Button size="sm" variant={settings.questionReferenceItalic ? "default" : "outline"} className="h-7 italic" onClick={() => updateSetting("questionReferenceItalic", !settings.questionReferenceItalic)}>I</Button>
              </div>
            </div>
          )}
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
          <Label className="mt-3 block text-xs text-muted-foreground">পেজ Orientation</Label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Button variant={settings.paperOrientation === "portrait" ? "default" : "outline"} className="h-9 text-xs" onClick={() => updateSetting("paperOrientation", "portrait")}>↕ Vertical</Button>
            <Button variant={settings.paperOrientation === "landscape" ? "default" : "outline"} className="h-9 text-xs" onClick={() => updateSetting("paperOrientation", "landscape")}>↔ Horizontal</Button>
          </div>
          <Label className="mt-3 block text-xs text-muted-foreground">Preview Layout</Label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Button variant={settings.previewLayoutMode === "continuous" ? "default" : "outline"} className="h-9 text-xs" onClick={() => updateSetting("previewLayoutMode", "continuous")}>▤ Continuous</Button>
            <Button variant={settings.previewLayoutMode === "print" ? "default" : "outline"} className="h-9 text-xs" onClick={() => updateSetting("previewLayoutMode", "print")}>▣ Print Layout</Button>
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
          <div className="mt-2 space-y-2 rounded-md border bg-muted/30 p-2">
            <Label className="text-xs text-muted-foreground">সেকশন বর্ডার</Label>
            {([
              ["headerSectionBorderStyle", "headerSectionBorderColor", "মূল হেডার"],
              ["questionSectionBorderStyle", "questionSectionBorderColor", "প্রশ্ন অংশ"],
            ] as const).map(([styleKey, colorKey, label]) => (
              <div key={styleKey} className="space-y-1">
                <span className="text-xs">{label}</span>
                <div className="flex items-center gap-1">
                  <Select value={settings[styleKey]} onValueChange={(value) => updateSetting(styleKey, value as SectionBorderStyle)}>
                    <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">বর্ডার নেই</SelectItem>
                      <SelectItem value="solid">Solid — ১ লাইন</SelectItem>
                      <SelectItem value="double">Double — ২ লাইন</SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="color" aria-label={`${label} বর্ডার রং`} value={settings[colorKey]} className="h-8 w-10 cursor-pointer rounded border bg-background p-1" onChange={(event) => updateSetting(colorKey, event.target.value)} />
                </div>
              </div>
            ))}
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
          <Label className="text-xs text-muted-foreground">MCQ নম্বর স্টাইল</Label>
          <div className="question-number-style-selector mt-1 grid grid-cols-3 gap-1.5">
            {([
              { value: "bn-padded-danda" as QuestionNumberStyle, label: "০১।", name: "বাংলা দুই অঙ্ক ও দাঁড়ি" },
              { value: "bn-padded-dot" as QuestionNumberStyle, label: "০২.", name: "বাংলা দুই অঙ্ক ও ডট" },
              { value: "bn-dot" as QuestionNumberStyle, label: "১.", name: "বাংলা সংখ্যা ও ডট" },
              { value: "en-padded-dot" as QuestionNumberStyle, label: "01.", name: "ইংরেজি দুই অঙ্ক ও ডট" },
              { value: "box" as CqNumberStyle, label: "০১", name: "কালো বক্স" },
              { value: "pointer" as CqNumberStyle, label: "১ ▶", name: "সংখ্যা ও তীর" },
            ]).map((style) => (
              <Button
                key={style.value}
                type="button"
                size="sm"
                variant={settings.questionNumberStyle === style.value ? "default" : "outline"}
                className="h-9 px-1 text-sm"
                aria-label={style.name}
                title={style.name}
                onClick={() => updateSetting("questionNumberStyle", style.value)}
              >
                <span className={`cq-number-control-preview ${style.value === "box" || style.value === "pointer" ? `cq-number-control-preview--${style.value}` : ""}`}>{style.label}</span>
              </Button>
            ))}
          </div>
          {cqQuestions.length > 0 && (
            <div className="mt-2">
              <Label className="text-xs text-muted-foreground">CQ নম্বর স্টাইল</Label>
              <div className="mt-1 grid grid-cols-3 gap-1.5">
                {([
                  { value: "bn-padded-danda", label: "০১।", name: "বাংলা দুই অঙ্ক ও দাঁড়ি" },
                  { value: "bn-padded-dot", label: "০২.", name: "বাংলা দুই অঙ্ক ও ডট" },
                  { value: "bn-dot", label: "১.", name: "বাংলা সংখ্যা ও ডট" },
                  { value: "en-padded-dot", label: "01.", name: "ইংরেজি দুই অঙ্ক ও ডট" },
                  { value: "box", label: "০১", name: "কালো বক্স" },
                  { value: "pointer", label: "১ ▶", name: "সংখ্যা ও তীর" },
                ] as { value: CqNumberStyle; label: string; name: string }[]).map((style) => (
                  <Button
                    key={style.value}
                    type="button"
                    size="sm"
                    variant={settings.cqNumberStyle === style.value ? "default" : "outline"}
                    className="h-9 px-1"
                    aria-label={`CQ নম্বর স্টাইল ${style.name}`}
                    title={style.name}
                    onClick={() => updateSetting("cqNumberStyle", style.value)}
                  >
                    <span className={`cq-number-control-preview ${style.value === "box" || style.value === "pointer" ? `cq-number-control-preview--${style.value}` : ""}`}>
                      {style.label}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}
          {shortQuestions.length > 0 && (
            <div className="mt-2">
              <Label className="text-xs text-muted-foreground">SQ নম্বর স্টাইল</Label>
              <div className="mt-1 grid grid-cols-3 gap-1.5">
                {([
                  { value: "bn-padded-danda", label: "০১।", name: "বাংলা দুই অঙ্ক ও দাঁড়ি" },
                  { value: "bn-padded-dot", label: "০২.", name: "বাংলা দুই অঙ্ক ও ডট" },
                  { value: "bn-dot", label: "১.", name: "বাংলা সংখ্যা ও ডট" },
                  { value: "en-padded-dot", label: "01.", name: "ইংরেজি দুই অঙ্ক ও ডট" },
                  { value: "box", label: "০১", name: "কালো বক্স" },
                  { value: "pointer", label: "১ ▶", name: "সংখ্যা ও তীর" },
                ] as { value: CqNumberStyle; label: string; name: string }[]).map((style) => (
                  <Button
                    key={style.value}
                    type="button"
                    size="sm"
                    variant={settings.sqNumberStyle === style.value ? "default" : "outline"}
                    className="h-9 px-1"
                    aria-label={`SQ নম্বর স্টাইল ${style.name}`}
                    title={style.name}
                    onClick={() => updateSetting("sqNumberStyle", style.value)}
                  >
                    <span className={`cq-number-control-preview ${style.value === "box" || style.value === "pointer" ? `cq-number-control-preview--${style.value}` : ""}`}>
                      {style.label}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}
          <QuestionNumberGapControl value={settings.questionNumberGap} onCommit={(value) => updateSetting("questionNumberGap", value)} />
        </div>

        <div className="mb-3 space-y-2">
          {([
            { key: "optionStyle" as const, label: "MCQ অপশন স্টাইল", ariaPrefix: "MCQ", visible: mcqQuestions.length > 0 },
            { key: "cqOptionStyle" as const, label: "CQ উপ-প্রশ্ন স্টাইল", ariaPrefix: "CQ", visible: cqQuestions.length > 0 },
            { key: "sqOptionStyle" as const, label: "SQ উপ-প্রশ্ন স্টাইল", ariaPrefix: "SQ", visible: descriptiveQuestions.length > 0 },
          ]).filter(control => control.visible).map(control => (
            <div key={control.key} className="option-style-row">
              <Label className="option-style-label" title={control.label}>{control.ariaPrefix}</Label>
              <div className="option-style-selector">
                {([
                  { v: "none" as OptionStyle, l: "○", name: "বৃত্ত" },
                  { v: "square" as OptionStyle, l: "□", name: "চতুর্ভুজ" },
                  { v: "bracket" as OptionStyle, l: "( )", name: "বন্ধনী" },
                  { v: "dot" as OptionStyle, l: ".", name: "ডট" },
                  { v: "paren" as OptionStyle, l: ")", name: "শেষ বন্ধনী" },
                ]).map(style => (
                  <Button
                    key={style.v}
                    size="sm"
                    variant={settings[control.key] === style.v ? "default" : "outline"}
                    className="option-style-control"
                    data-active={settings[control.key] === style.v}
                    aria-label={`${control.ariaPrefix} ${style.name} অপশন স্টাইল`}
                    title={`${control.label}: ${style.name}`}
                    onClick={() => updateSetting(control.key, style.v)}
                  >
                    {style.v === "none" ? <span className="option-style-circle-preview" aria-hidden="true" /> : style.v === "square" ? <span className="option-style-square-preview" aria-hidden="true" /> : style.l}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-3">
          <Label className="text-xs text-muted-foreground">ফন্ট পরিবর্তন</Label>
          <PaperFontPicker value={settings.fontLang} onChange={v => updateSetting("fontLang", v)} />
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> MCQ অপশন অ্যাডজাস্ট
            </span>
            <Switch
              checked={mcqOptionAdjusting}
              disabled={mcqQuestions.length === 0}
              onCheckedChange={handleMcqOptionAdjustChange}
            />
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-3">
            <Label htmlFor="equation-bold" className="text-sm">Equation bold</Label>
            <Switch id="equation-bold" checked={settings.equationBold}
              onCheckedChange={(value) => updateSetting("equationBold", value)} />
          </div>
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="answer-line-fit" className="text-sm">Answer line auto fit</Label>
            <Switch id="answer-line-fit" checked={settings.answerLineFit}
              onCheckedChange={(value) => updateSetting("answerLineFit", value)} />
          </div>
          <p className="text-xs text-muted-foreground mb-3">Answers only: shrink to 8, then wrap. Adjusted sizes stay fixed when the main font changes.</p>
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
          <Label className="text-xs text-muted-foreground">কলাম সংখ্যা</Label>
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
            <Button variant="outline" size="sm" className="mt-2 w-full" disabled={!redundantDuplicateIds.size} onClick={removeDuplicateQuestions}>
              {"\u09a1\u09c1\u09aa\u09cd\u09b2\u09bf\u0995\u09c7\u099f \u09b8\u09b0\u09be\u09a8"} ({redundantDuplicateIds.size})
            </Button>
            {removedDuplicateQuestions && <Button variant="ghost" size="sm" className="w-full" onClick={() => {
              setQuestions(previous => {
                const currentRows = new Map(previous.map(question => [question.id, question]));
                const originalIds = new Set(removedDuplicateQuestions.map(question => question.id));
                return [...removedDuplicateQuestions.map(question => currentRows.get(question.id) || question), ...previous.filter(question => !originalIds.has(question.id))];
              });
              setRemovedDuplicateQuestions(null);
            }}>{"\u09ab\u09bf\u09b0\u09bf\u09df\u09c7 \u0986\u09a8\u09c1\u09a8"}</Button>}
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
            <span className="text-sm">লোগো</span>
            <Switch checked={settings.showHeaderLogo} onCheckedChange={(v) => updateSetting("showHeaderLogo", v)} />
          </div>
          {settings.showHeaderLogo && (
            <div className="ml-1 space-y-2 rounded-md border bg-muted/30 p-2">
              {settings.headerLogoUrl && (
                <div className="flex items-center gap-2">
                  <img src={settings.headerLogoUrl} alt="Header logo" className="h-8 w-8 rounded border object-contain" />
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => updateSetting("headerLogoUrl", "")}>সরান</Button>
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-1 text-xs text-primary hover:underline">
                <Upload size={12} /> <span>{settings.headerLogoUrl ? "পরিবর্তন করুন" : "লোগো আপলোড করুন"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (event) => updateSetting("headerLogoUrl", event.target?.result as string);
                  reader.readAsDataURL(file);
                }} />
              </label>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs">সাইজ</span>
                <Slider className="w-28" value={[settings.headerLogoSize]} min={24} max={80} step={2} onValueChange={([v]) => updateSetting("headerLogoSize", v)} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs">স্বচ্ছতা</span>
                <div className="flex w-32 items-center gap-2"><Slider className="flex-1" value={[settings.headerLogoOpacity]} min={10} max={100} step={5} onValueChange={([v]) => updateSetting("headerLogoOpacity", v)} /><span className="w-8 text-right text-[10px]">{settings.headerLogoOpacity}%</span></div>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <Button size="sm" variant={settings.headerLogoPositionMode === "relative" ? "default" : "outline"} className="h-7 text-[10px]" onClick={() => updateSetting("headerLogoPositionMode", "relative")}>সহজ</Button>
                <Button size="sm" variant={settings.headerLogoPositionMode === "absolute" ? "default" : "outline"} className="h-7 text-[10px]" onClick={() => updateSetting("headerLogoPositionMode", "absolute")}>Drag Mode</Button>
              </div>
              {settings.headerLogoPositionMode === "absolute" ? (
                <div className="space-y-2 rounded border bg-background p-2">
                  <label className="block text-[10px]">X: {settings.headerLogoX}%<Slider value={[settings.headerLogoX]} min={0} max={100} step={1} onValueChange={([v]) => updateSetting("headerLogoX", v)} /></label>
                  <label className="block text-[10px]">Y: {settings.headerLogoY}%<Slider value={[settings.headerLogoY]} min={0} max={100} step={1} onValueChange={([v]) => updateSetting("headerLogoY", v)} /></label>
                </div>
              ) : (
              <div className="flex gap-1">
                {(["left", "center", "right"] as const).map(position => (
                  <Button key={position} size="sm" variant={settings.headerLogoPosition === position ? "default" : "outline"} className="h-6 flex-1 px-1 text-[10px]" onClick={() => updateSetting("headerLogoPosition", position)}>
                    {position === "left" ? "বামে" : position === "center" ? "মাঝে" : "ডানে"}
                  </Button>
                ))}
              </div>
              )}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm">হেডার</span>
            <Switch checked={settings.showHeader} onCheckedChange={(v) => updateSetting("showHeader", v)} />
          </div>
          {settings.showHeader && (
            <div className="ml-1 space-y-2 rounded-md border bg-muted/30 p-2">
              <Input className="h-8 text-xs" placeholder="Header text" value={settings.headerText} onChange={(e) => updateSetting("headerText", e.target.value)} />
              <div className="grid grid-cols-7 gap-1">{[["#1e3a8a","#ffffff"],["#065f46","#ffffff"],["#7f1d1d","#ffffff"],["#4c1d95","#ffffff"],["#164e63","#ffffff"],["#92400e","#ffffff"],["#111827","#f9fafb"],["#e0f2fe","#075985"],["#ecfccb","#365314"],["#fee2e2","#7f1d1d"],["#ede9fe","#4c1d95"],["#cffafe","#164e63"],["#fef3c7","#92400e"],["#f3f4f6","#111827"]].map(([bg, text]) => <button key={bg} type="button" className="h-6 rounded border" style={{background:bg}} onClick={() => setSettings(prev => ({...prev, headerBackground:bg, headerTextColor:text}))} />)}</div>
              <div className="grid grid-cols-2 gap-2"><label className="text-[10px]">হেডার রং<input type="color" value={settings.headerBackground} className="mt-1 block h-7 w-full cursor-pointer rounded border" onChange={(e) => updateSetting("headerBackground", e.target.value)} /></label><label className="text-[10px]">লেখার রং<input type="color" value={settings.headerTextColor} className="mt-1 block h-7 w-full cursor-pointer rounded border" onChange={(e) => updateSetting("headerTextColor", e.target.value)} /></label></div>
              <label className="block text-[10px]">Font Size: {settings.headerFontSize}px<Slider value={[settings.headerFontSize]} min={10} max={40} onValueChange={([v]) => updateSetting("headerFontSize", v)} /></label>
              <label className="block text-[10px]">Height: {settings.headerHeight || "Auto"}{settings.headerHeight ? "px" : ""}<Slider value={[settings.headerHeight]} min={0} max={200} onValueChange={([v]) => updateSetting("headerHeight", v)} /></label>
              <div className="flex gap-1">{(["left","center","right"] as const).map(align => <Button key={align} size="sm" variant={settings.headerAlign === align ? "default" : "outline"} className="h-7 flex-1 text-[10px]" onClick={() => updateSetting("headerAlign", align)}>{align}</Button>)}</div>
              <div>
                <Label className="text-[10px] text-muted-foreground">হেডার ফন্ট পরিবর্তন</Label>
                <PaperFontPicker familyValue label="হেডার ফন্ট নির্বাচন" value={settings.headerFontFamily} onChange={v => updateSetting("headerFontFamily", v)} />
              </div>
              <div className="grid grid-cols-2 gap-1"><Button size="sm" variant={settings.headerBold ? "default" : "outline"} className="h-7 font-bold" onClick={() => updateSetting("headerBold", !settings.headerBold)}>B</Button><Button size="sm" variant={settings.headerItalic ? "default" : "outline"} className="h-7 italic" onClick={() => updateSetting("headerItalic", !settings.headerItalic)}>I</Button></div>
              <Input className="h-8 text-xs" type="url" placeholder="Attached URL" value={settings.headerLink} onChange={(e) => updateSetting("headerLink", e.target.value)} />
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm">ফুটার</span>
            <Switch checked={settings.showFooter} onCheckedChange={(v) => updateSetting("showFooter", v)} />
          </div>
          {settings.showFooter && (
            <div className="ml-1 space-y-2 rounded-md border bg-muted/30 p-2">
              <Input className="h-8 text-xs" placeholder="ফুটার টেক্সট লিখুন" value={settings.footerText} onChange={(e) => updateSetting("footerText", e.target.value)} />
              <div className="grid grid-cols-7 gap-1">{[["#1e3a8a","#ffffff"],["#065f46","#ffffff"],["#7f1d1d","#ffffff"],["#4c1d95","#ffffff"],["#164e63","#ffffff"],["#92400e","#ffffff"],["#111827","#f9fafb"],["#e0f2fe","#075985"],["#ecfccb","#365314"],["#fee2e2","#7f1d1d"],["#ede9fe","#4c1d95"],["#cffafe","#164e63"],["#fef3c7","#92400e"],["#f3f4f6","#111827"]].map(([bg, text]) => <button key={bg} type="button" className="h-6 rounded border" style={{background:bg}} onClick={() => setSettings(prev => ({...prev, footerBackground:bg, footerTextColor:text}))} />)}</div>
              <div className="grid grid-cols-2 gap-2"><label className="text-[10px]">ফুটার রং<input type="color" value={settings.footerBackground} className="mt-1 block h-7 w-full cursor-pointer rounded border" onChange={(e) => updateSetting("footerBackground", e.target.value)} /></label><label className="text-[10px]">লেখার রং<input type="color" value={settings.footerTextColor} className="mt-1 block h-7 w-full cursor-pointer rounded border" onChange={(e) => updateSetting("footerTextColor", e.target.value)} /></label></div>
              <label className="block text-[10px]">Font Size: {settings.footerFontSize}px<Slider value={[settings.footerFontSize]} min={10} max={40} onValueChange={([v]) => updateSetting("footerFontSize", v)} /></label>
              <label className="block text-[10px]">Height: {settings.footerHeight || "Auto"}{settings.footerHeight ? "px" : ""}<Slider value={[settings.footerHeight]} min={0} max={200} onValueChange={([v]) => updateSetting("footerHeight", v)} /></label>
              <div className="flex gap-1">{(["left", "center", "right"] as const).map(align => <Button key={align} size="sm" variant={settings.footerAlign === align ? "default" : "outline"} className="h-7 flex-1 text-[10px]" onClick={() => updateSetting("footerAlign", align)}>{align}</Button>)}</div>
              <div>
                <Label className="text-[10px] text-muted-foreground">ফুটার ফন্ট পরিবর্তন</Label>
                <PaperFontPicker familyValue label="ফুটার ফন্ট নির্বাচন" value={settings.footerFontFamily} onChange={v => updateSetting("footerFontFamily", v)} />
              </div>
              <div className="grid grid-cols-2 gap-1"><Button size="sm" variant={settings.footerBold ? "default" : "outline"} className="h-7 font-bold" onClick={() => updateSetting("footerBold", !settings.footerBold)}>B</Button><Button size="sm" variant={settings.footerItalic ? "default" : "outline"} className="h-7 italic" onClick={() => updateSetting("footerItalic", !settings.footerItalic)}>I</Button></div>
              <Input className="h-8 text-xs" type="url" placeholder="Attached URL" value={settings.footerLink} onChange={(e) => updateSetting("footerLink", e.target.value)} />
            </div>
          )}
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

  if (settings.showAnswerSheet) retainedAnswers.current = true;
  const renderAnswerSheet = settings.showAnswerSheet || retainedAnswers.current;
  const isPrintPreview = settings.previewLayoutMode === "print" && !editingMode;

  return (
    <EquationBoldContext.Provider value={settings.equationBold}>
    <AnswerLineFitContext.Provider value={answerFitPreference}>
    <div
      className="paper-builder-shell xl:grid -m-4 md:-m-6 relative bg-[#eef1f4]"
      style={{ gridTemplateColumns: "minmax(0, 1fr) 256px", gap: "20px", padding: "16px 16px 0" }}
    >
      {/* Floating Toolbar */}
      <FloatingToolbar
        targetEl={activeEditEl}
        optionLayout={activeMcq ? getMcqOptionLayout(activeMcq) : activeAnswering ? ((settings.manualSectionColumns?.[questions.find(q => q.id === activeQuestionId)?.type || ""] || Number(activeEditEl?.closest<HTMLElement>("[data-auto-fit-columns]")?.dataset.autoFitColumns) || 2) === 1 ? "1 column" : "2 columns") : undefined}
        onOptionLayoutChange={activeMcq ? cycleActiveMcqOptionLayout : activeAnswering ? cycleAnsweringColumns : undefined}
        onDelete={activeQuestionId !== null ? handleDeleteQuestion : undefined}
        onExchange={activeQuestionId !== null ? handleExchangeQuestion : undefined}
        onClose={handleCloseToolbar}
      />

      {/* Mobile top toolbar */}
      {isMobile && (
        <div className="paper-mobile-toolbar sticky top-0 z-30">
          <div className="paper-mobile-toolbar-title">প্রশ্নপত্র প্রিভিউ</div>
          <Button variant="outline" size="sm" className="flex-1 font-heading text-xs" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-3.5 w-3.5 mr-1" /> সেটিংস
          </Button>
          <Button variant="outline" size="sm" className="paper-answer-toggle flex-1 font-heading text-xs" aria-pressed={settings.showAnswerSheet} onClick={() => updateSetting("showAnswerSheet", !settings.showAnswerSheet)}>
            <CheckCircle className="h-3.5 w-3.5" /> উত্তরমালা
          </Button>
          <Button size="sm" className="flex-1 min-w-0 px-2 bg-[#082f57] hover:bg-[#062542] text-white border-0 font-heading text-xs" onClick={handleDownload} disabled={printPreparing}>
            <Download className="h-3.5 w-3.5 mr-1" /> {printPreparing ? "প্রস্তুত হচ্ছে…" : "ডাউনলোড"}
          </Button>

        </div>
      )}

      {/* Paper preview */}
      <style>{`
        .english-paper-sections .latex-renderer table { width: 100% !important; max-width: 100%; table-layout: auto; border-collapse: collapse; }
        .english-paper-sections .english-rearranging br { display: initial !important; }
        .english-paper-sections th, .english-paper-sections td { border: 1px solid #111; padding: 2px 6px; overflow-wrap: anywhere; }
        @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
      `}</style>
      <div className="paper-preview-scroll overflow-y-auto xl:h-[calc(100vh-80px)] bg-[#eef1f4]">
        <div className="paper-save-controls mb-3 flex flex-wrap items-center justify-end gap-3 print:hidden" role="status">
          <span className={`text-xs ${cloudSaveState === "error" ? "text-red-700" : "text-slate-600"}`}>
            {cloudSaveState === "saved" ? "এডিটসহ আমার প্রশ্ন-এ সেভ হয়েছে" : cloudSaveState === "error" ? "সেভ হয়নি — আবার চেষ্টা করুন" : "সেভ হচ্ছে…"}
          </span>
          <Button size="sm" variant="outline" onClick={handleSaveEdits} disabled={!currentPaperId || cloudSaveState === "saving" || paperLoading}>
            <Save className="mr-1 h-4 w-4" /> সেভ করুন
          </Button>
        </div>
        {!isMobile && (
          <div className="paper-quick-settings mb-4 mx-auto" style={{ maxWidth: previewPaperWidth }}>
            <div className="paper-quick-settings-title">কুইক সেটিংস</div>
            <div className="flex flex-wrap items-center justify-center gap-2">
            <Button className="paper-quick-settings-action flex bg-[#082f57] hover:bg-[#062542] text-white shadow-none" size="sm" onClick={() => {
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
            <Button className="paper-quick-settings-action flex bg-[#0A1E38] hover:bg-[#153654] text-white shadow-none" size="sm" onClick={handleOpenSmartBoard}>
              <Tv className="h-4 w-4 mr-1" /> Smart Board-এ নিন
            </Button>
            </div>
          </div>
        )}
        {isMobile && (
          <div className="paper-mobile-secondary-actions mb-3 flex items-center gap-2">
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
            <Button size="sm" className="text-xs bg-[#0A1E38] hover:bg-[#153654] text-white" onClick={handleOpenSmartBoard}>
              <Tv className="h-3.5 w-3.5 mr-1" /> Smart Board
            </Button>
          </div>
        )}

        {editingMode && (
          <Alert className="mb-4 border-[#ccd8e6] bg-[#eef3f9] text-[#0c2340]">
            <Pencil className="h-4 w-4 text-[#102E56]" />
            <AlertDescription className="text-xs" style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>
              প্রশ্নে ক্লিক করে লেখা পরিবর্তন করুন। এডিটসহ প্রশ্নপত্র আপনার “আমার প্রশ্ন”-এ অটো সেভ হবে; পরে আবার খুলে এডিট করতে পারবেন।
            </AlertDescription>
          </Alert>
        )}

        {/* Responsive preview: paper and quick settings share the same fluid width. */}
        <div className="mx-auto" data-print-scale-wrapper style={{
          width: '100%',
          maxWidth: previewPaperWidth,
        }}>
        {printPreparing && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A1E38]/25 backdrop-blur-sm print:hidden">
          <div className="w-[440px] max-w-[92vw] max-h-[95vh] overflow-y-auto rounded-lg border bg-white shadow-xl">
            <PaperLoading download progress={downloadProgress} />
          </div>
        </div>}
        {isPrintPreview && previewPreparing && <div role="status" aria-live="off" className="paper-preview-progress pointer-events-none fixed right-3 bottom-3 z-50 flex items-center gap-1.5 rounded border border-slate-200 bg-white/95 px-2 py-1 text-[11px] text-slate-600 shadow-sm print:hidden">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-600" aria-hidden="true" />
          <span>Preview</span><span ref={previewProgressRef} className="font-medium tabular-nums">{previewProgressValue.current}%</span>
        </div>}
        <PrintableDocument pages={pagedPreviewPages} visible={isPrintPreview}
          widthMm={pageWidthMm} heightMm={pageHeightMm} showPageNumbers={settings.showPageNumbers} />
        <div
          className={`paper-live-print-source${isPrintPreview ? " paper-live-preview-source" : ""}`}
          style={isPrintPreview ? { width: previewPaperWidth } : undefined}
        >
        <div
          className={`font-paper${isEnglishVersion ? " paper-english-version" : ""}${isPrintPreview ? " paper-print-layout-preview" : ""}`}
          ref={paperRef}
          data-print-paper
          data-answers-hidden={!settings.showAnswerSheet || undefined}
          data-paper-version={isEnglishVersion ? "english" : "bangla"}
          data-content-align={settings.textAlign}
          style={{
            "--paper-question-gap": `${settings.questionGap}px`,
            "--question-number-gap": `${settings.questionNumberGap}px`,
            "--paper-print-font-size": `${settings.fontSize}px`,
            "--preview-page-height": `${previewPageHeight}px`,
            width: '100%',
            // Preserve the existing Preview typography in both screen and PDF.
            fontSize: `${settings.fontSize * PREVIEW_FONT_SCALE}px`,
            lineHeight: isEnglishVersion ? 1.25 : 1.45,
            userSelect: editingMode ? "text" : "none",
            WebkitUserSelect: editingMode ? "text" : "none",
            paddingTop: `${(isMobile ? 12 : 38) + settings.pageMarginTop}px`,
            paddingRight: `${(isMobile ? 10 : 38) + settings.pageMarginRight}px`,
            paddingBottom: `${(isMobile ? 12 : 38) + settings.pageMarginBottom}px`,
            paddingLeft: `${(isMobile ? 10 : 38) + settings.pageMarginLeft}px`,
            color: "#000",
            backgroundColor: "#fff",
            border: "1px solid #e0e4e9",
            boxShadow: "0 4px 18px rgba(30, 41, 59, 0.07)",
            fontFamily: isEnglishVersion && settings.fontLang === "bangla"
              ? "'Times New Roman', Times, serif"
              : paperFontFamily(settings.fontLang),
            textAlign: settings.textAlign,
            position: "relative",
            overflow: "visible",
          } as CSSProperties}
        >
          {/* Pagination copies this single centered watermark into each sheet. */}
          {settings.showWatermark && (settings.watermarkType === "logo" ? !!settings.watermarkLogoUrl : !!(settings.watermarkText || meta.instituteName)) && (() => {
            const opacity = (settings.watermarkOpacity ?? 15) / 100;
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

            return (
                <div
                  data-paper-watermark
                  aria-hidden="true"
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
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {renderMark("page")}
                </div>
            );
          })()}

          {/* ===== PROFESSIONAL PAPER HEADER ===== */}
          {settings.showHeader && (settings.headerText || (settings.showHeaderLogo && settings.headerLogoUrl)) && (
            <div
              style={{
                position: "relative",
                minHeight: settings.headerHeight ? `${settings.headerHeight}px` : undefined,
                padding: "6px 10px",
                marginBottom: "6px",
                borderRadius: settings.headerBackground !== "#ffffff" ? "4px" : undefined,
                backgroundColor: settings.headerBackground,
                color: settings.headerTextColor,
                textAlign: settings.headerAlign,
                fontFamily: settings.headerFontFamily,
                fontSize: `${settings.headerFontSize}px`,
                fontWeight: settings.headerBold ? 700 : 400,
                fontStyle: settings.headerItalic ? "italic" : "normal",
              }}
            >
              {settings.showHeaderLogo && settings.headerLogoUrl && (
                <img
                  src={settings.headerLogoUrl}
                  alt="হেডার লোগো"
                  style={{
                    height: `${settings.headerLogoSize}px`,
                    maxWidth: "120px",
                    objectFit: "contain",
                    opacity: settings.headerLogoOpacity / 100,
                    position: settings.headerLogoPositionMode === "absolute" ? "absolute" : undefined,
                    left: settings.headerLogoPositionMode === "absolute" ? `${settings.headerLogoX}%` : undefined,
                    top: settings.headerLogoPositionMode === "absolute" ? `${settings.headerLogoY}%` : undefined,
                    transform: settings.headerLogoPositionMode === "absolute" ? "translate(-50%, -50%)" : undefined,
                    margin: settings.headerLogoPositionMode === "relative" ? (settings.headerLogoPosition === "left" ? "0 auto 4px 0" : settings.headerLogoPosition === "right" ? "0 0 4px auto" : "0 auto 4px") : undefined,
                  }}
                />
              )}
              {settings.headerText && (settings.headerLink
                ? <a href={settings.headerLink} target="_blank" rel="noreferrer">{settings.headerText}</a>
                : settings.headerText)}
            </div>
          )}
          <header className="paper-document-header" style={{
            border: settings.headerSectionBorderStyle === "none" ? undefined : settings.headerSectionBorderStyle === "double" ? `3px double ${settings.headerSectionBorderColor}` : `1px solid ${settings.headerSectionBorderColor}`,
            padding: settings.headerSectionBorderStyle === "none" ? undefined : "6px",
          }}>
            <div className="paper-document-heading">
              <div
                className="paper-document-heading-center"
                style={{
                  backgroundColor: settings.showSheet && settings.sheetColoredBg ? settings.sheetBgColor : undefined,
                  color: settings.showSheet && settings.sheetColoredBg ? settings.sheetTextColor : undefined,
                  position: "relative",
                }}
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
                {!isEnglishPaper && settings.showChapterName && meta.chapterNames.length > 0 && (
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
                {!isEnglishPaper && mcqOnly && mcqQuestions.length > 0 && (
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


          <div
            className="combined-question-flow"
            style={{
              columnCount: isEnglishPaper ? 1 : settings.columns,
              columnGap: !isEnglishPaper && settings.columns > 1 ? `${settings.columnGap}px` : "0",
              columnRule: !isEnglishPaper && settings.columns > 1 && settings.columnDivider ? COLUMN_DIVIDER_STYLE : undefined,
              columnFill: "balance" as const,
              border: settings.questionSectionBorderStyle === "none" ? undefined : settings.questionSectionBorderStyle === "double" ? `3px double ${settings.questionSectionBorderColor}` : `1px solid ${settings.questionSectionBorderColor}`,
              padding: settings.questionSectionBorderStyle === "none" ? undefined : "6px",
            }}
          >
          {/* ===== MCQ SECTION ===== */}
          {!isEnglishPaper && !settings.chirkutHideQuestions && mcqQuestions.length > 0 && (() => {
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
            const stimulusInstruction = (numbers: number[]) => {
              const labels = numbers.map(n => paperNumber(n));
              const listed = labels.length > 1
                ? labels.slice(0, -1).join(", ") + (isEnglishVersion ? " and " : " \u0993 ") + labels[labels.length - 1]
                : labels[0];
              return isEnglishVersion
                ? `Read the following stimulus and answer question${numbers.length > 1 ? "s" : ""} ${listed}:`
                : `\u09a8\u09bf\u099a\u09c7\u09b0 \u0989\u09a6\u09cd\u09a6\u09c0\u09aa\u0995\u099f\u09bf \u09aa\u09dc\u09c7 ${listed} \u09a8\u09ae\u09cd\u09ac\u09b0 \u09aa\u09cd\u09b0\u09b6\u09cd\u09a8\u09c7\u09b0 \u0989\u09a4\u09cd\u09a4\u09b0 \u09a6\u09be\u0993\u0964`;
            };
            const stimulusNumbers = (key: string) => standalone.flatMap((q, i) => stimulusGroupKey(q) === key ? [i + 1] : []);
            // All MCQs must share one column-flow container. Splitting them
            // into standalone/group containers makes the visible sequence jump.
            const standalone = mcqQuestions;
            const grouped = new Map<string, QuestionRow[]>();

            // Number questions continuously in their rendered order.
            let mcqNumber = 0;

            return (
            <div className="combined-question-section" style={{ marginTop: "6px", marginBottom: "8px" }}>
                            {!mcqOnly && (<div data-section-header className="paper-part-heading paper-mcq-section-heading" style={{ marginTop: 0 }}><strong>{isEnglishVersion ? "Multiple Choice Section:" : "বহুনির্বাচনি অংশ:"}</strong><strong>{paperNumber(mcqQuestions.length)} × {paperNumber(1)} = {paperNumber(mcqQuestions.length)}</strong></div>)}
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
                        <div key={`${q.id}-${itemIdx}`} className={`${editableClass} mcq-print-item ${isDuplicate ? "paper-duplicate-question" : ""} ${activeQuestionId === q.id ? "rounded-sm bg-black/[0.03] px-1 -mx-1 ring-1 ring-black/35" : ""}`} style={{ background: isDuplicate ? "rgba(255,200,0,0.15)" : undefined, marginBottom: `${settings.questionGap}px` }} data-duplicate={isDuplicate || undefined} data-editable={`mcq-${q.id}`} onClick={(e) => handleEditableClick(e, q.id)} suppressContentEditableWarning>
                          {showStimulus && (
                            <div className="mcq-stimulus" style={{ marginBottom: "4px", fontStyle: "italic", padding: "4px 0" }}>
                              {groupKey && <div className="mcq-stimulus-heading">{stimulusInstruction(stimulusNumbers(groupKey))}</div>}
                              <LatexRenderer text={q.stimulus_text || ""} />
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "baseline", gap: "0" }}>
                            <span className="paper-question-number">{formatQuestionNumber(idx)}</span>
                            <div style={{ flex: 1 }}>
                              <div className="mc-block-question" style={{ display: "block" }}>
                                <LatexRenderer inline text={trimLeadingRichTextWhitespace(q.question)} />
                                {settings.showQuestionInfo && refStr && renderQuestionReference(refStr)}
                              </div>

                              <AutoFitQuestionGrid measurementKey={JSON.stringify([q.option_a, q.option_b, q.option_c, q.option_d, settings.fontSize, settings.fontLang, settings.optionStyle, settings.equationBold, settings.showAnswerSheet])} manualColumns={settings.mcqOptionLayouts[String(q.id)] ? getMcqOptionLayout(q) === "4x1" ? 4 : getMcqOptionLayout(q) === "2x2" ? 2 : 1 : undefined} maxColumns={getMcqOptionLayout(q) === "4x1" ? 4 : getMcqOptionLayout(q) === "2x2" ? 2 : 1} gap={8} style={{ position: "relative", rowGap: "0.35em", fontSize: "0.96em", lineHeight: 1.25, marginTop: "0", paddingRight: settings.showAnswerSheet ? "28px" : undefined }}>
                                {(["option_a", "option_b", "option_c", "option_d"] as const).map((key, oi) => {
                                  const val = q[key]; if (!val) return null;
                                  const cleaned = stripPTags(val);
                                  const label = optionLabels[oi];
                                  return (<span key={key} className="mcq-option-choice"><span>{getOptionLabel(label)}</span><LatexRenderer text={cleaned} /></span>);
                                })}
                                {renderAnswerSheet && <CorrectAnswerBadge question={q} isEnglishVersion={isEnglishVersion} />}
                              </AutoFitQuestionGrid>
                              </div>
                          </div>
                              {renderAnswerSheet && q.explanation && (<McqExplanation text={q.explanation} isEnglishVersion={isEnglishVersion} />)}
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
                        <div key={`print-${q.id}-${itemIdx}`} className={`mcq-print-item ${isDuplicate ? "paper-duplicate-question" : ""}`} style={{ background: isDuplicate ? "rgba(255,200,0,0.15)" : undefined, marginBottom: `${settings.questionGap}px` }} data-duplicate={isDuplicate || undefined}>
                          {showStimulus && (
                            <div className="mcq-stimulus" style={{ marginBottom: "4px", fontStyle: "italic", padding: "4px 0" }}>
                              {groupKey && <div className="mcq-stimulus-heading">{stimulusInstruction(stimulusNumbers(groupKey))}</div>}
                              <LatexRenderer text={q.stimulus_text || ""} />
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "baseline", gap: "0" }}>
                            <span className="paper-question-number">{formatQuestionNumber(idx)}</span>
                            <div style={{ flex: 1 }}>
                              <div className="mc-block-question" style={{ display: "block" }}>
                                <LatexRenderer inline text={trimLeadingRichTextWhitespace(q.question)} />
                                {settings.showQuestionInfo && refStr && renderQuestionReference(refStr)}
                              </div>

                              <AutoFitQuestionGrid measurementKey={JSON.stringify([q.option_a, q.option_b, q.option_c, q.option_d, settings.fontSize, settings.fontLang, settings.optionStyle, settings.equationBold, settings.showAnswerSheet])} manualColumns={settings.mcqOptionLayouts[String(q.id)] ? getMcqOptionLayout(q) === "4x1" ? 4 : getMcqOptionLayout(q) === "2x2" ? 2 : 1 : undefined} maxColumns={getMcqOptionLayout(q) === "4x1" ? 4 : getMcqOptionLayout(q) === "2x2" ? 2 : 1} gap={8} style={{ position: "relative", rowGap: "0.35em", fontSize: "0.96em", lineHeight: 1.25, marginTop: "0", paddingRight: settings.showAnswerSheet ? "28px" : undefined }}>
                                {(["option_a", "option_b", "option_c", "option_d"] as const).map((key, oi) => {
                                  const val = q[key]; if (!val) return null;
                                  const cleaned = stripPTags(val);
                                  const label = optionLabels[oi];
                                  return (<span key={key} className="mcq-option-choice"><span>{getOptionLabel(label)}</span><LatexRenderer text={cleaned} /></span>);
                                })}
                                {renderAnswerSheet && <CorrectAnswerBadge question={q} isEnglishVersion={isEnglishVersion} />}
                              </AutoFitQuestionGrid>
                              </div>
                          </div>
                              {renderAnswerSheet && q.explanation && (<McqExplanation text={q.explanation} isEnglishVersion={isEnglishVersion} />)}
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
                    <p className={`mcq-stimulus-heading ${editableClass}`} style={{ fontStyle: "italic", marginBottom: "4px", fontWeight: 700 }} onClick={handleEditableClick} suppressContentEditableWarning>
                      {stimulusInstruction(groupQs.map((_, i) => groupBaseNum + i + 1))}
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
                              <div key={`${q.id}-${rowIdx}`} className={`${editableClass} mcq-print-item ${activeQuestionId === q.id ? "rounded-sm bg-black/[0.03] px-1 -mx-1 ring-1 ring-black/35" : ""}`} style={{ marginBottom: `${settings.questionGap}px` }} data-editable={`mcq-${q.id}`} onClick={(e) => handleEditableClick(e, q.id)} suppressContentEditableWarning>
                                <div style={{ display: "flex", alignItems: "baseline", gap: "0" }}>
                                  <span className="paper-question-number">{formatQuestionNumber(idx)}</span>
                                  <div style={{ flex: 1 }}>
                                    <div className="mc-block-question"><LatexRenderer text={trimLeadingRichTextWhitespace(q.question)} /></div>
                                    <AutoFitQuestionGrid measurementKey={JSON.stringify([q.option_a, q.option_b, q.option_c, q.option_d, settings.fontSize, settings.fontLang, settings.optionStyle, settings.equationBold, settings.showAnswerSheet])} manualColumns={settings.mcqOptionLayouts[String(q.id)] ? getMcqOptionLayout(q) === "4x1" ? 4 : getMcqOptionLayout(q) === "2x2" ? 2 : 1 : undefined} maxColumns={getMcqOptionLayout(q) === "4x1" ? 4 : getMcqOptionLayout(q) === "2x2" ? 2 : 1} gap={8} style={{ position: "relative", rowGap: "0.35em", fontSize: "0.96em", lineHeight: 1.25, marginTop: "0", paddingRight: settings.showAnswerSheet ? "28px" : undefined }}>
                                      {(["option_a", "option_b", "option_c", "option_d"] as const).map((key, oi) => {
                                        const val = q[key]; if (!val) return null;
                                        const cleaned = stripPTags(val);
                                        const label = optionLabels[oi];
                                        return (<span key={key} className="mcq-option-choice"><span>{getOptionLabel(label)}</span><LatexRenderer text={cleaned} /></span>);
                                      })}
                                      {renderAnswerSheet && <CorrectAnswerBadge question={q} isEnglishVersion={isEnglishVersion} />}
                                    </AutoFitQuestionGrid>
                                    </div>
                                </div>
                              {renderAnswerSheet && q.explanation && (<McqExplanation text={q.explanation} isEnglishVersion={isEnglishVersion} />)}
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
                                  <span className="paper-question-number">{formatQuestionNumber(idx)}</span>
                                  <div style={{ flex: 1 }}>
                                    <div className="mc-block-question"><LatexRenderer text={trimLeadingRichTextWhitespace(q.question)} /></div>
                                    <AutoFitQuestionGrid measurementKey={JSON.stringify([q.option_a, q.option_b, q.option_c, q.option_d, settings.fontSize, settings.fontLang, settings.optionStyle, settings.equationBold, settings.showAnswerSheet])} manualColumns={settings.mcqOptionLayouts[String(q.id)] ? getMcqOptionLayout(q) === "4x1" ? 4 : getMcqOptionLayout(q) === "2x2" ? 2 : 1 : undefined} maxColumns={getMcqOptionLayout(q) === "4x1" ? 4 : getMcqOptionLayout(q) === "2x2" ? 2 : 1} gap={8} style={{ position: "relative", rowGap: "0.35em", fontSize: "0.96em", lineHeight: 1.25, marginTop: "0", paddingRight: settings.showAnswerSheet ? "28px" : undefined }}>
                                      {(["option_a", "option_b", "option_c", "option_d"] as const).map((key, oi) => {
                                        const val = q[key]; if (!val) return null;
                                        const cleaned = stripPTags(val);
                                        const label = optionLabels[oi];
                                        return (<span key={key} className="mcq-option-choice"><span>{getOptionLabel(label)}</span><LatexRenderer text={cleaned} /></span>);
                                      })}
                                      {renderAnswerSheet && <CorrectAnswerBadge question={q} isEnglishVersion={isEnglishVersion} />}
                                    </AutoFitQuestionGrid>
                                    </div>
                                </div>
                              {renderAnswerSheet && q.explanation && (<McqExplanation text={q.explanation} isEnglishVersion={isEnglishVersion} />)}
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

          {!isEnglishPaper && !settings.chirkutHideQuestions && languageQuestions.length > 0 && <div className="language-question-section">
            {languageQuestions.map((q,index)=><div key={q.id} className="paper-question-item" style={{marginBottom:`${settings.questionGap}px`,breakInside:'avoid'}}>
              <div className="flex justify-between font-semibold"><span>{paperNumber(index+1)}. {questionTypeLabel(q.type)}</span>{questionMarks(q)>0 && <span>{paperNumber(questionMarks(q))}</span>}</div>
              {q.stimulus_text && <LatexRenderer text={q.stimulus_text} />}
              <LatexRenderer text={q.question} />
              {renderAnswerSheet && (q.correct_answer || q.explanation) && <div className="paper-answer-block"><AnswerContent text={[q.correct_answer,q.explanation].filter(Boolean).join('<br/>')} /></div>}
            </div>)}
          </div>}

          {isEnglishPaper && !settings.chirkutHideQuestions && <div className="english-paper-sections">
            {englishPaper.sections.map((section, si) => <div key={section.type}>
              {(si === 0 || englishPaper.sections[si-1].part !== section.part) && <div className="paper-question-item text-center font-bold">Part {section.part === 'reading' ? 'A - Reading' : 'B - Writing'} [Marks - {englishPaper.sections.filter(s=>s.part === section.part).reduce((sum,s)=>sum+s.marks,0)}]</div>}
              {section.passage && (si === 0 || englishPaper.sections[si-1].passage?.question !== section.passage.question) && <div data-editable={`passage-${section.passage.id}`} onClick={(e) => handleEditableClick(e,section.passage!.id)} suppressContentEditableWarning className={`paper-question-item ${editableClass}`}>
                <p className="font-semibold">{englishPassageInstruction(englishPaper.sections,si)}</p>
                <LatexRenderer text={section.passage.question} />
              </div>}
              <div className="paper-question-item grid grid-cols-[24px_minmax(0,1fr)_auto] gap-x-2 font-semibold"><span className="font-bold" style={{fontWeight:700}}>{section.number}.</span><span>{section.instruction || questionTypeLabel(section.type)}{section.type === "poem_questions" && section.items.length > section.answerCount ? ` [Any ${section.answerCount} out of ${section.items.length}]` : ""}</span><span className="shrink-0 whitespace-nowrap">{section.marks > 0 ? section.marksLine : ''}</span></div>
              <AutoFitQuestionGrid enabled={['answering_questions','true_false'].includes(section.type)} manualColumns={settings.manualSectionColumns?.[section.type]} maxColumns={section.type === 'answering_questions' ? settings.answeringColumns || 2 : 2} gap={24} style={{marginLeft:32,minWidth:0}} className={section.type === 'vocabulary' ? 'flex flex-wrap gap-x-4' : ''}>
              {section.items.map((q,index) => <Fragment key={q.id}>
                {q.stimulus_text && !section.passage && (index === 0 || q.stimulus_text !== section.items[index-1].stimulus_text) && <div data-editable={`stimulus-${q.id}`} onClick={(e) => handleEditableClick(e)} suppressContentEditableWarning className={`paper-question-item col-span-full w-full ${editableClass}`}><LatexRenderer text={q.stimulus_text} /></div>}
                <div data-editable={`${section.type === "mcq" ? "mcq" : "lang"}-${q.id}`} onClick={(e) => handleEditableClick(e,q.id)} suppressContentEditableWarning className={`paper-question-item ${section.type === 'rearranging' ? 'english-rearranging' : ''} ${editableClass}`} style={{marginBottom:`${settings.questionGap}px`,breakInside:'avoid'}}>

                <div className="flex gap-2">{englishItemLabel(section.type,index,section.items.length) && <span className="shrink-0">{englishItemLabel(section.type,index,section.items.length)}</span>}<LatexRenderer className="min-w-0 flex-1" text={q.question} /></div>
                {section.type === 'mcq' && <AutoFitQuestionGrid className="ml-7" manualColumns={settings.mcqOptionLayouts[String(q.id)] ? getMcqOptionLayout(q) === "4x1" ? 4 : getMcqOptionLayout(q) === "2x2" ? 2 : 1 : undefined} gap={16} maxColumns={getMcqOptionLayout(q) === "4x1" ? 4 : getMcqOptionLayout(q) === "2x2" ? 2 : 1}>{(['option_a','option_b','option_c','option_d'] as const).map((key,oi)=><div key={key}>({['i','ii','iii','iv'][oi]}) <LatexRenderer inline text={q[key] || ''} /></div>)}</AutoFitQuestionGrid>}
                {renderAnswerSheet && (q.correct_answer || q.explanation) && <div className="paper-answer-block"><AnswerContent text={[q.correct_answer,q.explanation].filter(Boolean).join('<br/>')} /></div>}
              </div></Fragment>)}
              </AutoFitQuestionGrid>
            </div>)}
          </div>}

          {/* ===== SHORT SECTION (2nd) ===== */}
          {!settings.chirkutHideQuestions && shortQuestions.length > 0 && (() => {
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
            <div className="combined-question-section" style={{ marginTop: "10px", marginBottom: "8px" }}>
              <div
                data-section-header className="paper-part-heading"
              >
                <span
                  className={editableClass}
                  data-editable="short-title"
                  style={{ fontWeight: 700 }}
                  onClick={handleEditableClick}
                  suppressContentEditableWarning
                >
                  {isEnglishVersion ? "Answer the short questions:" : "সংক্ষিপ্ত প্রশ্নের অংশ:"}
                </span>
                <span className={editableClass} style={{ fontWeight: 600, fontSize: "0.95em" }} onClick={handleEditableClick} suppressContentEditableWarning>
                  {shortMarksLine}
                </span>
              </div>
              {shortInstruction && (
                <div style={{ fontSize: "0.9em", marginBottom: "4px" }}>
                  <span className={editableClass} style={{ fontWeight: 600 }} onClick={handleEditableClick} suppressContentEditableWarning>{shortInstruction}</span>
                </div>
              )}
              <div
                className="short-question-container mcq-print-columns combined-question-items"
                style={{
                  columnCount: settings.columns,
                  columnGap: settings.columns > 1 ? `${settings.columnGap}px` : "0",
                  columnRule: settings.columns > 1 && settings.columnDivider ? COLUMN_DIVIDER_STYLE : undefined,
                  columnFill: "balance" as const,
                }}
              >
                {shortQuestions.map((q, idx) => {
                  const num = idx + 1;
                  const refStr = formatRefs(q);
                  const isDuplicate = duplicateIds.has(q.id);
                  const groupKey = shortStimulusGroupKey(q);
                  const showStimulus = hasRenderableStimulus(q.stimulus_text) && (!groupKey || !shownShortStimuli.has(groupKey));
                  if (groupKey && showStimulus) shownShortStimuli.add(groupKey);

                  return (
                    <div
                      key={`${q.id}-${idx}`}
                      className={`${editableClass} mcq-print-item ${isDuplicate ? "paper-duplicate-question" : ""}`}
                      data-duplicate={isDuplicate || undefined}
                      style={{
                        background: isDuplicate ? "rgba(255,200,0,0.15)" : undefined,
                        breakInside: "avoid",
                        pageBreakInside: "avoid",
                        marginBottom: `${settings.questionGap}px`,
                        display: "block",
                        width: "100%",
                      }}
                      data-editable={`short-${q.id}`}
                      onClick={(e) => handleEditableClick(e, q.id)}
                      suppressContentEditableWarning
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", width: "100%" }}>
                        <span className="paper-question-number">{formatQuestionNumber(num, settings.sqNumberStyle)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {showStimulus && (
                            <div className="short-stimulus" style={{ marginBottom: "2px" }}>
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
                          <span className="mc-block-question">
                            <LatexRenderer inline text={q.question} />
                          </span>
                          {settings.showQuestionInfo && refStr && renderQuestionReference(refStr)}
                        </div>
                      </div>

                      {renderAnswerSheet && (q.correct_answer || q.explanation) && (
                        <div className="paper-answer-block cq-reference-answer-sheet">
                          <div className="cq-reference-answer-title">
                            {isEnglishVersion ? `Answer to question ${num}` : `${paperNumber(num)} নং প্রশ্নের উত্তর`}
                          </div>
                          <div className="cq-reference-answer-row">
                            <AnswerContent text={q.correct_answer || q.explanation || ""} />
                          </div>
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
          {!settings.chirkutHideQuestions && cqQuestions.length > 0 && (
            <div className="combined-question-section" style={{ marginTop: "10px", marginBottom: "8px" }}>
              <div data-section-header className="paper-part-heading"><strong>{isEnglishVersion ? "Creative Question Section:" : "সৃজনশীল অংশ:"}</strong><strong>{paperNumber(settings.cqToAnswer > 0 ? Math.min(settings.cqToAnswer, cqQuestions.length) : cqQuestions.length)} × {paperNumber(10)} = {paperNumber((settings.cqToAnswer > 0 ? Math.min(settings.cqToAnswer, cqQuestions.length) : cqQuestions.length) * 10)}</strong></div>
              {cqInstruction && (
                <div style={{ fontSize: "0.9em", marginBottom: "4px" }}>
                  <span className={editableClass} style={{ fontWeight: 600 }} onClick={handleEditableClick} suppressContentEditableWarning>{cqInstruction}</span>
                </div>
              )}
              <div
                className="cq-question-container mcq-print-columns combined-question-items"
                style={{
                  columnCount: settings.columns,
                  columnGap: settings.columns > 1 ? `${settings.columnGap}px` : "0",
                  columnRule: settings.columns > 1 && settings.columnDivider ? COLUMN_DIVIDER_STYLE : undefined,
                  columnFill: "balance" as const,
                }}
              >
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
                    <div
                      key={`${q.id}-${idx}`}
                      className={`${editableClass} mcq-print-item ${isDuplicate ? "paper-duplicate-question" : ""}`}
                      data-duplicate={isDuplicate || undefined}
                      style={{
                        background: isDuplicate ? "rgba(255,200,0,0.15)" : undefined,
                        breakInside: "avoid",
                        pageBreakInside: "avoid",
                        marginBottom: `${settings.questionGap}px`,
                        display: "block",
                        width: "100%",
                      }}
                      data-editable={`cq-${q.id}`}
                      onClick={(e) => handleEditableClick(e, q.id)}
                      suppressContentEditableWarning
                    >
                      <div className={`cq-main-layout cq-number-style-${settings.cqNumberStyle}`}>
                        <span className="cq-main-number paper-question-number">{renderCqQuestionNumber(num)}</span>
                        <div className="cq-main-content">
                          {(() => {
                            const stemText = cData?.stem || q.stimulus_text || q.question;
                            return (
                              <div className="cq-stem-row">
                                <div className="mc-block-question cq-stem-text"><LatexRenderer text={trimLeadingRichTextWhitespace(stemText)} /></div>
                                {settings.showQuestionInfo && refStr && (
                                  <>{renderQuestionReference(refStr, true)}</>
                                )}
                              </div>
                            );
                          })()}

                          {subQuestions.length > 0 && (
                            <div className="cq-sub-questions">
                              {subQuestions.map((sq: any, si: number) => {
                                const label = subLabels[si] || "";
                                const marks = subMarksMap[si] || "";
                                if (!label) return null;
                                return (
                                  <CqSubQuestionRow
                                    key={si}
                                    label={getOptionLabel(label, settings.cqOptionStyle)}
                                    text={sq.question || sq.text || ""}
                                    marks={paperNumber(Number(marks))}
                                  />
                                );
                              })}
                            </div>
                          )}

                          {(!subQuestions || subQuestions.length === 0) && (() => {
                            const keys = usesMathMarks ? ["q_ka", "q_kha", "q_ga"] : ["q_ka", "q_kha", "q_ga", "q_gha"];
                            const hasSubParts = keys.some(key => cData?.[key]);
                            if (!hasSubParts) return null;
                            return (
                              <div className="cq-sub-questions">
                                {keys.map((key, si) => {
                                  const text = cData?.[key];
                                  if (!text) return null;
                                  return (
                                    <CqSubQuestionRow
                                      key={si}
                                      label={getOptionLabel(subLabels[si], settings.cqOptionStyle)}
                                      text={text}
                                      marks={paperNumber(subMarksMap[si])}
                                    />
                                  );
                                })}
                              </div>
                            );
                          })()}


                        </div>
                      </div>
                          {/* CQ Answers when answer sheet is on */}
                          {renderAnswerSheet && (() => {
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
                              <div className="paper-answer-block cq-reference-answer-sheet">
                                <div className="cq-reference-answer-title">
                                  {isEnglishVersion ? `Answer to question ${num}` : `${paperNumber(num)} নং প্রশ্নের উত্তর`}
                                </div>
                                {ansKeys.map((key, ai) => {
                                  const ansText = cData2[key] || (subQs[ai] && subQs[ai].answer) || "";
                                  if (!ansText) return null;
                                  return (
                                    <div key={ai} className="cq-reference-answer-row">
                                      <span className="cq-reference-answer-label">{ansLabels[ai]}</span>
                                      <AnswerContent text={ansText} />
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== DESCRIPTIVE SECTION (4th) ===== */}
          {!settings.chirkutHideQuestions && descriptiveQuestions.length > 0 && (() => {
            const descToAnswer = settings.descToAnswer > 0 ? Math.min(settings.descToAnswer, descriptiveQuestions.length) : descriptiveQuestions.length;
            const descTotalMarks = descToAnswer * 10;
            const descMarksLine = `${paperNumber(10)} × ${paperNumber(descToAnswer)} = ${paperNumber(descTotalMarks)}`;
            const descInstruction = descriptiveQuestions.length === descToAnswer
              ? ""
              : (isEnglishVersion ? `Answer any ${descToAnswer} questions:` : `যেকোনো ${toBanglaNum(descToAnswer)}টি প্রশ্নের উত্তর দাও :`);
            return (
            <div className="combined-question-section" style={{ marginTop: "10px", marginBottom: "8px" }}>
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
              <div
                className="desc-question-container mcq-print-columns combined-question-items"
                style={{
                  columnCount: settings.columns,
                  columnGap: settings.columns > 1 ? `${settings.columnGap}px` : "0",
                  columnRule: settings.columns > 1 && settings.columnDivider ? COLUMN_DIVIDER_STYLE : undefined,
                  columnFill: "balance" as const,
                }}
              >
                {descriptiveQuestions.map((q, idx) => {
                  const num = idx + 1;
                  const refStr = formatRefs(q);
                  const dData = q.creative_data;
                  const isDuplicate = duplicateIds.has(q.id);
                  return (
                    <div
                      key={`${q.id}-${idx}`}
                      className={`${editableClass} mcq-print-item ${isDuplicate ? "paper-duplicate-question" : ""}`}
                      data-duplicate={isDuplicate || undefined}
                      style={{
                        background: isDuplicate ? "rgba(255,200,0,0.15)" : undefined,
                        breakInside: "avoid",
                        pageBreakInside: "avoid",
                        marginBottom: `${settings.questionGap}px`,
                        display: "block",
                        width: "100%",
                      }}
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
                        <span className="paper-question-number">{formatQuestionNumber(num)}</span>
                        <div style={{ flex: 1 }}>
                        {settings.showQuestionInfo && refStr && renderQuestionReference(refStr)}
                      {dData && (
                        <div>
                          {dData.desc_q_ka && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", lineHeight: 1.4, marginBottom: "2px" }}>
                              <div style={{ display: "flex", gap: "4px", flex: 1 }}>
                                 <span style={{ flexShrink: 0 }}>{getOptionLabel(isEnglishVersion ? "a" : "ক", settings.sqOptionStyle)}</span>
                                <span style={{ flex: 1 }}><LatexRenderer text={dData.desc_q_ka} /></span>
                              </div>
                              <span style={{ flexShrink: 0, marginLeft: "12px", fontWeight: 500 }}>{paperNumber(3)}</span>
                            </div>
                          )}
                          {dData.desc_q_kha && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", lineHeight: 1.4 }}>
                              <div style={{ display: "flex", gap: "4px", flex: 1 }}>
                                 <span style={{ flexShrink: 0 }}>{getOptionLabel(isEnglishVersion ? "b" : "খ", settings.sqOptionStyle)}</span>
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
                          {renderAnswerSheet && (() => {
                            const dd = q.creative_data;
                            const hasDescAns = dd && (dd.desc_ans_ka || dd.desc_ans_kha);
                            const hasExpl = q.explanation;
                            if (!hasDescAns && !hasExpl) return null;
                            return (
                              <div className="paper-answer-block cq-reference-answer-sheet">
                                <div className="cq-reference-answer-title">
                                  {isEnglishVersion ? `Answer to question ${num}` : `${paperNumber(num)} নং প্রশ্নের উত্তর`}
                                </div>
                                {dd?.desc_ans_ka && (
                                  <div className="cq-reference-answer-row">
                                    <span className="cq-reference-answer-label">{isEnglishVersion ? "a" : "ক"}</span>
                                    <AnswerContent text={dd.desc_ans_ka} />
                                  </div>
                                )}
                                {dd?.desc_ans_kha && (
                                  <div className="cq-reference-answer-row">
                                    <span className="cq-reference-answer-label">{isEnglishVersion ? "b" : "খ"}</span>
                                    <AnswerContent text={dd.desc_ans_kha} />
                                  </div>
                                )}
                                {!hasDescAns && hasExpl && (
                                  <div className="cq-reference-answer-row">
                                    <AnswerContent text={q.explanation!} />
                                  </div>
                                )}
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
          </div>

          {/* In-Paper OMR Box */}
          {settings.showInPaperOmr && mcqQuestions.length > 0 && (
            <InPaperOmrBox
              totalQuestions={mcqQuestions.length}
              columns={settings.omrColumns || 4}
              isEnglishVersion={isEnglishVersion}
              setCode={isEnglishVersion ? "A" : "ক"}
              showSetCode={settings.showSetCode}
              showStudentInfo={settings.showStudentInfo}
              instituteName={meta?.instituteName}
              subjectName={meta?.subjectName}
            />
          )}

          {/* Chirkut Mini Answer Sheet */}
          {settings.showChirkutAnswer && (
            <ChirkutAnswerSheet
              questions={sortedQuestions}
              instituteName={meta?.instituteName}
              subjectName={meta?.subjectName}
              className={meta?.className}
              setCode={isEnglishVersion ? "A" : "ক"}
              showSetCode={settings.showSetCode}
              isEnglishVersion={isEnglishVersion}
              columns={5}
            />
          )}

          {settings.showFooter && (
            <footer style={{ marginTop: "16px", padding: "6px 10px", borderTop: "1px solid rgba(0,0,0,0.18)", textAlign: settings.footerAlign, fontSize: `${settings.footerFontSize}px`, minHeight: settings.footerHeight ? `${settings.footerHeight}px` : undefined, color: settings.footerTextColor, backgroundColor: settings.footerBackground, fontFamily: settings.footerFontFamily, fontWeight: settings.footerBold ? 700 : 400, fontStyle: settings.footerItalic ? "italic" : "normal" }}>
              {settings.footerLink ? <a href={settings.footerLink} target="_blank" rel="noreferrer">{settings.footerText || meta.instituteName}</a> : (settings.footerText || meta.instituteName)}
            </footer>
          )}
        </div>
        </div> {/* end live preview source */}
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
                <Button className="flex-1 min-w-0 px-2 bg-[#082f57] hover:bg-[#062542] text-white border-0 font-heading font-semibold shadow-sm" onClick={handleDownload} disabled={printPreparing}>
                  <Download className="h-4 w-4 mr-2" /> {printPreparing ? "প্রস্তুত হচ্ছে…" : "ডাউনলোড"}
                </Button>
                {isAdmin && (
                  <Button variant="outline" className="font-heading font-semibold text-[#082f57] border-[#082f57] hover:bg-[#082f57]/5" onClick={handleDocxExport} disabled={docxExporting}>
                    {docxExporting ? "তৈরি হচ্ছে..." : "Word"}
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
        <SheetContent side="bottom" className="paper-mobile-settings max-h-[85dvh] overflow-y-auto rounded-t-[2px]">
          <SheetHeader className="pb-2">
            <SheetTitle className="font-heading flex items-center justify-center gap-2">
              <Settings className="h-4 w-4" /> সেটিংস
            </SheetTitle>
          </SheetHeader>
          <div className="px-2 pb-4">
            <div className="flex gap-2 mb-4">
              <Button className="flex-1 min-w-0 px-2 bg-[#082f57] hover:bg-[#062542] text-white border-0 font-heading font-semibold" onClick={() => { setSettingsOpen(false); handleDownload(); }}>
                <Download className="h-4 w-4 mr-2" /> {printPreparing ? "প্রস্তুত হচ্ছে…" : "ডাউনলোড"}
              </Button>
              {isAdmin && !isMobile && (
                <Button variant="outline" className="font-heading font-semibold" onClick={handleDocxExport} disabled={docxExporting}>
                  {docxExporting ? "তৈরি হচ্ছে..." : "Word"}
                </Button>
              )}
            </div>
            <div className="paper-settings-groups">{settingsContent}</div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={pageSetupOpen} onOpenChange={setPageSetupOpen}>
        <DialogContent className="page-settings-dialog max-w-md overflow-hidden p-0">
          <DialogHeader className="bg-[#082f57] px-4 py-3 text-left text-white">
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
          <DialogHeader className="bg-[#082f57] px-4 py-3 text-left text-white">
            <DialogTitle>পৃষ্ঠা নম্বর সংযুক্ত</DialogTitle>
            <DialogDescription className="sr-only">PDF-এ স্বয়ংক্রিয় পৃষ্ঠা নম্বর যুক্ত করুন।</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-6 pt-3">
            <Button
              className="w-full bg-[#082f57] text-white hover:bg-[#062542]"
              onClick={() => updateSetting("showPageNumbers", !settings.showPageNumbers)}
            >
              {settings.showPageNumbers ? "পৃষ্ঠা নম্বর বন্ধ করুন" : "পৃষ্ঠা নম্বর চালু করুন"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">চালু করলে PDF-এ স্বয়ংক্রিয়ভাবে পৃষ্ঠা নম্বর যুক্ত হবে।</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </AnswerLineFitContext.Provider>
    </EquationBoldContext.Provider>
  );
}
