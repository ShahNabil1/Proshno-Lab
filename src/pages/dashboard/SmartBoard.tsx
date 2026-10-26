import { withAnswerSlides, type SlideExportMode } from "@/components/smartboard/answerSequence";
import { renderToStaticMarkup } from "react-dom/server";
import { expandSmartboardQuestions } from "@/components/smartboard/slideSequence";
import { printSmartboard } from "@/lib/printSmartboard";
import { BoardElementView } from "@/components/smartboard/BoardCanvas";
import LatexRenderer from "@/components/LatexRenderer";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle as CircleIcon,
  Diamond,
  Eraser,
  Eye,
  EyeOff,
  Hexagon,
  Maximize2,
  Minimize2,
  Minus,
  Move,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  Pen,
  Palette,
  Pentagon,
  Redo2,
  Square,
  Star,
  Trash2,
  Triangle,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
  BookOpen,
  FolderOpen,
  HelpCircle,
  FileQuestion,
  RotateCcw,
  Tv,
  Ruler,
  Compass,
  Calculator,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import BoardCanvas from "@/components/smartboard/BoardCanvas";
import ScientificCalculator from "@/components/smartboard/ScientificCalculator";
import LoadPaperDialog, { type LoadedPaper } from "@/components/smartboard/LoadPaperDialog";
import QuestionSlide, { getQuestionSlideForExport, type SmartBoardPaperMeta, type SmartBoardQuestion } from "@/components/smartboard/QuestionSlide";
import { BOARD_BACKGROUNDS, DEFAULT_BACKGROUND_ID, getBackground } from "@/components/smartboard/boardBackgrounds";
import { BLANK_BOARD_KEY, boardReducer, createBoardState } from "@/components/smartboard/boardHistory";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  DEFAULT_BOARD_STYLE,
  MAX_ZOOM,
  MIN_ZOOM,
  PEN_COLORS,
  STROKE_WIDTHS,
  type BoardElement,
  type ToolId,
} from "@/components/smartboard/boardTypes";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { PortalContainerProvider } from "@/components/ui/portal-container";

const toBanglaNum = (value: number): string => {
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(value)
    .split("")
    .map((digit) => digits[Number(digit)] ?? digit)
    .join("");
};

const stripHtml = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

type QuestionPositionMode = "left" | "center" | "right" | "manual";

const TOOLS: Array<{ id: ToolId; label: string; hint: string; Icon: typeof Pen }> = [
  { id: "select", label: "সিলেক্ট", hint: "V", Icon: MousePointer2 },
  { id: "pen", label: "কলম", hint: "P", Icon: Pen },
  { id: "eraser", label: "ইরেজার", hint: "E", Icon: Eraser },
  { id: "rect", label: "আয়তক্ষেত্র", hint: "R", Icon: Square },
  { id: "circle", label: "বৃত্ত", hint: "C", Icon: CircleIcon },
  { id: "triangle", label: "ত্রিভুজ", hint: "T", Icon: Triangle },
  { id: "rightTriangle", label: "সমকোণী ত্রিভুজ", hint: "", Icon: Triangle },
  { id: "ruler", label: "স্কেল", hint: "", Icon: Ruler },
  { id: "protractor", label: "চাঁদা", hint: "", Icon: CircleIcon },
  { id: "compass", label: "কম্পাস", hint: "", Icon: Compass },
  { id: "line", label: "লাইন", hint: "L", Icon: Minus },
  { id: "diamond", label: "রম্বস", hint: "K", Icon: Diamond },
  { id: "pentagon", label: "পঞ্চভুজ", hint: "G", Icon: Pentagon },
  { id: "hexagon", label: "ষড়ভুজ", hint: "H", Icon: Hexagon },
  { id: "star", label: "তারা", hint: "S", Icon: Star },
  { id: "arrow", label: "তীর", hint: "A", Icon: ArrowUpRight },
  { id: "text", label: "লেখা", hint: "X", Icon: Type },
];

const TOOL_SHORTCUTS: Record<string, ToolId> = {
  v: "select",
  p: "pen",
  e: "eraser",
  r: "rect",
  c: "circle",
  t: "triangle",
  l: "line",
  k: "diamond",
  g: "pentagon",
  h: "hexagon",
  s: "star",
  a: "arrow",
  x: "text",
};

// Popular 1-click classroom inks
const QUICK_COLORS = [
  { hex: "#ef4444", name: "লাল" },
  { hex: "#3b82f6", name: "নীল" },
  { hex: "#22c55e", name: "সবুজ" },
  { hex: "#eab308", name: "হলুদ" },
  { hex: "#0f172a", name: "কালো" },
  { hex: "#ffffff", name: "সাদা" },
];

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

export default function SmartBoard() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const paperIdFromUrl = searchParams.get("paper_id");

  const frameRef = useRef<HTMLDivElement | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const directImportHandledRef = useRef(false);

  const [questionPages, setQuestions] = useState<SmartBoardQuestion[]>([]);
  const [meta, setMeta] = useState<SmartBoardPaperMeta | null>(null);
  const [returnToPaper, setReturnToPaper] = useState<string | null>(paperIdFromUrl ? `/dashboard/view-paper?paper_id=${encodeURIComponent(paperIdFromUrl)}&action=view` : null);
  const [paperTitle, setPaperTitle] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadOpen, setLoadOpen] = useState(false);
  const [questionStyleOpen, setQuestionStyleOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const questions = useMemo(() => withAnswerSlides(questionPages, showAnswer ? "both" : "questions"), [questionPages, showAnswer]);
  const [tool, setTool] = useState<ToolId>("pen");
  const [style, setStyle] = useState(DEFAULT_BOARD_STYLE);
  const [backgroundId, setBackgroundId] = useState(DEFAULT_BACKGROUND_ID);
  const [zoom, setZoom] = useState(1);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [questionPositionMode, setQuestionPositionMode] = useState<QuestionPositionMode>("center");
  const [manualQuestionPosition, setManualQuestionPosition] = useState({ x: 50, y: 50 });
  const [questionTextColor, setQuestionTextColor] = useState("");
  const [stimulusTextColor, setStimulusTextColor] = useState("");
  const [questionFontSize, setQuestionFontSize] = useState(48);
  const [questionFontFamily, setQuestionFontFamily] = useState("inherit");
  const [mcqOptionBorderColor, setMcqOptionBorderColor] = useState("#cbd5e1");
  const [mcqOptionTextColor, setMcqOptionTextColor] = useState("#334155");
  const [mcqCorrectColor, setMcqCorrectColor] = useState("#059669");
  const [mcqAnswerBackgroundColor, setMcqAnswerBackgroundColor] = useState("#ffffff");
  const [mcqAnswerBorderColor, setMcqAnswerBorderColor] = useState("#777777");
  const [mcqAnswerBorderStyle, setMcqAnswerBorderStyle] = useState<"solid" | "dashed" | "double" | "none">("solid");
  const [showBoardReferences, setShowBoardReferences] = useState(true);
  const [showInstitutionReferences, setShowInstitutionReferences] = useState(true);
  const [headerAccentColor, setHeaderAccentColor] = useState("#ff0099");
  const [headerInstitutionColor, setHeaderInstitutionColor] = useState("#00B4BC");
  const [headerLogoUrl, setHeaderLogoUrl] = useState("");
  const [institutionFontFamily, setInstitutionFontFamily] = useState("'NotoSerifBengali', serif");
  const [institutionFontSize, setInstitutionFontSize] = useState(40);
  const [chapterFontFamily, setChapterFontFamily] = useState("'HasanHera', 'NotoSerifBengali', serif");
  const [chapterFontSize, setChapterFontSize] = useState(48);
  const [chapterTextColor, setChapterTextColor] = useState("#ffffff");
  const [courseFontFamily, setCourseFontFamily] = useState("'NotoSerifBengali', serif");
  const [courseFontSize, setCourseFontSize] = useState(44);
  const [courseColor, setCourseColor] = useState("#ff0099");
  const [institutionText, setInstitutionText] = useState("");
  const [chapterText, setChapterText] = useState("");
  const [courseText, setCourseText] = useState("");
  const [referenceStyle, setReferenceStyle] = useState<"filled" | "black" | "outline" | "bracket" | "underline">("outline");
  const [referenceColor, setReferenceColor] = useState("#ff0099");
  const [referenceTextColor, setReferenceTextColor] = useState("#ff66c4");
  const [referenceFontFamily, setReferenceFontFamily] = useState("inherit");
  const [referenceFontSize, setReferenceFontSize] = useState(20);
  const [referenceBold, setReferenceBold] = useState(true);
  const [referenceItalic, setReferenceItalic] = useState(false);
  const [compassRadius, setCompassRadius] = useState(180);
  const [showCompassCenter, setShowCompassCenter] = useState(true);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatorPosition, setCalculatorPosition] = useState({ x: 40, y: 90 });
  const calculatorDragRef = useRef<{ clientX: number; clientY: number; x: number; y: number } | null>(null);
  const questionDragRef = useRef<{ clientX: number; clientY: number; x: number; y: number } | null>(null);
  const setFrameNode = useCallback((node: HTMLDivElement | null) => {
    frameRef.current = node;
    setPortalContainer(node);
  }, []);

  const [board, dispatch] = useReducer(boardReducer, undefined, () => createBoardState(BLANK_BOARD_KEY));

  const blankPageSequence = useRef(0);
  const currentPage = questions[currentIndex] ?? null;
  const currentQuestion = currentPage?.type === "blank" ? null : currentPage;
  const [answerPart, setAnswerPart] = useState(0);
  useEffect(() => { setAnswerPart(0); }, [currentPage?.id]);
  const boardKey = currentPage ? `q-${currentPage.id}${currentPage.answerSlide ? `-part-${answerPart}` : ""}` : BLANK_BOARD_KEY;
  const questionNumber = currentPage?.sourceQuestionNumber ?? questions.slice(0, currentIndex + 1).filter(question => question.type !== "blank").length;
  const addBlankPage = () => {
    const page: SmartBoardQuestion = {
      id: -(++blankPageSequence.current), type: "blank", question: "সমাধানের ফাঁকা পৃষ্ঠা",
    };
    const sourceId = currentPage?.sourcePageId ?? currentPage?.id;
    const insertAt = Math.max(0, questionPages.findIndex(page => page.id === sourceId) + 1);
    setQuestions(previous => [...previous.slice(0, insertAt), page, ...previous.slice(insertAt)]);
    setShowAnswer(false);
    setCurrentIndex(insertAt);
    setTool("pen");
  };
  const [pdfMode, setPdfMode] = useState<SlideExportMode>("questions");
  const [pdfDrawings, setPdfDrawings] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const downloadSlides = async () => {
    setPdfBusy(true);
    try {
      const ExportQuestionSlide = getQuestionSlideForExport();
      let pageNumber = 0;
      const pages = withAnswerSlides(questionPages.length ? questionPages : [{ id: 0, type: "blank", question: "" } as SmartBoardQuestion], pdfMode);
      if (!pages.length) { toast.error("এক্সপোর্ট করার মতো উত্তর নেই।"); return; }
      const slides = pages.map(page => {
        const baseKey = `q-${page.id}`;
        const key = questionPages.length ? `${baseKey}${page.answerSlide ? "-part-0" : ""}` : BLANK_BOARD_KEY;
        const elements = key === board.key ? board.elements : board.store[key] || [];
        const pageParts = key === board.key ? board.parts : board.partsStore[key] || {};
        const answerInk = page.answerSlide ? Object.entries({ ...board.store, [board.key]: board.elements })
          .filter(([inkKey]) => inkKey.startsWith(`${baseKey}-part-`))
          .map(([inkKey, inkElements]) => ({ part: Number(inkKey.slice(`${baseKey}-part-`.length)), elements: inkElements })) : [];
        if (page.type !== "blank") pageNumber++;
        return renderToStaticMarkup(<div className="board-pdf-slide" data-board-dark={background.dark ? "true" : "false"} style={background.style}>
          {page.type !== "blank" && <div style={{ position: 'absolute', left: 0, top: 0, width: boardWidth, height: boardHeight }}>
                    <ExportQuestionSlide
                      parts={pageParts}
                      dragEnabled={false}
                      question={page}
                      number={page.sourceQuestionNumber ?? pageNumber}
                      meta={meta}
                      showAnswer={Boolean(page.answerSlide)}
                      dark={background.dark}
                      questionTextColor={questionTextColor}
                      stimulusTextColor={stimulusTextColor}
                      questionFontSize={questionFontSize}
                      questionFontFamily={questionFontFamily}
                      mcqOptionBorderColor={mcqOptionBorderColor}
                      mcqOptionTextColor={mcqOptionTextColor}
                      mcqCorrectColor={mcqCorrectColor}
                      mcqAnswerBackgroundColor={mcqAnswerBackgroundColor}
                      mcqAnswerBorderColor={mcqAnswerBorderColor}
                      mcqAnswerBorderStyle={mcqAnswerBorderStyle}
                      showBoardReferences={showBoardReferences}
                      showInstitutionReferences={showInstitutionReferences}
                      headerAccentColor={headerAccentColor}
                      headerInstitutionColor={headerInstitutionColor}
                      headerLogoUrl={headerLogoUrl}
                      institutionFontFamily={institutionFontFamily}
                      institutionFontSize={institutionFontSize}
                      chapterFontFamily={chapterFontFamily}
                      chapterFontSize={chapterFontSize}
                      chapterTextColor={chapterTextColor}
                      courseFontFamily={courseFontFamily}
                      courseFontSize={courseFontSize}
                      courseColor={courseColor}
                      institutionText={institutionText}
                      chapterText={chapterText}
                      courseText={courseText}
                      referenceStyle={referenceStyle}
                      referenceColor={referenceColor}
                      referenceTextColor={referenceTextColor}
                      referenceFontFamily={referenceFontFamily}
                      referenceFontSize={referenceFontSize}
                      referenceBold={referenceBold}
                      referenceItalic={referenceItalic}
                    />
          </div>}
          {pdfDrawings && <svg viewBox={`0 0 ${boardWidth} ${boardHeight}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            {page.answerSlide ? answerInk.map(ink => <g key={ink.part} data-answer-ink-part={ink.part} style={{ display: ink.part === 0 ? "inline" : "none" }}>
              {ink.elements.map(element => <BoardElementView key={element.id} element={element} />)}
            </g>) : elements.map(element => <BoardElementView key={element.id} element={element} />)}
          </svg>}
        </div>);
      });
      await printSmartboard(slides, boardWidth, boardHeight);
    } catch (error) { console.error(error); toast.error(error instanceof Error && error.message.startsWith("PDF image") ? "ছবি লোড হয়নি। ইন্টারনেট সংযোগ দেখে আবার PDF তৈরি করুন।" : "PDF তৈরি করা যায়নি। আবার চেষ্টা করুন।"); }
    finally { setPdfBusy(false); }
  };
  const duplicatePage = () => {
    const id = -(++blankPageSequence.current);
    const page: SmartBoardQuestion = currentPage
      ? { ...structuredClone(questionPages.find(page => page.id === (currentPage.sourcePageId ?? currentPage.id)) || currentPage), id, answerSlide: false, sourcePageId: undefined }
      : { id, type: "blank", question: "সমাধানের ফাঁকা পৃষ্ঠা" };
    const sourceId = currentPage?.sourcePageId ?? currentPage?.id;
    const insertAt = Math.max(0, questionPages.findIndex(page => page.id === sourceId) + 1);
    dispatch({ type: "duplicate", key: `q-${id}`, sourceId: currentPage?.id, targetId: id });
    setQuestions(previous => [...previous.slice(0, insertAt), page, ...previous.slice(insertAt)]);
    setShowAnswer(false);
    setCurrentIndex(insertAt);
  };
  const background = useMemo(() => getBackground(backgroundId), [backgroundId]);

  // A freshly created preview can be opened on the board without first saving
  // the paper to the database.
  useEffect(() => {
    if (directImportHandledRef.current) return;
    const imported = (location.state as {
      smartBoardImport?: {
        returnUrl?: string;
        questions: SmartBoardQuestion[];
        meta: SmartBoardPaperMeta;
        title?: string;
      };
    } | null)?.smartBoardImport;
    if (!imported || imported.questions.length === 0) return;
    directImportHandledRef.current = true;
    if (imported.returnUrl?.startsWith('/dashboard/view-paper')) setReturnToPaper(imported.returnUrl);
    setQuestions(expandSmartboardQuestions(imported.questions));
    setMeta(imported.meta);
    setPaperTitle(imported.title || "বর্তমান প্রশ্নপত্র");
    setCurrentIndex(0);
    setShowAnswer(false);
    toast.success(`${toBanglaNum(imported.questions.length)}টি প্রশ্ন Smart Board-এ ইমপোর্ট হয়েছে`);
  }, [location.state]);

  // Load paper automatically if paper_id is provided in URL params
  useEffect(() => {
    if (!paperIdFromUrl) return;

    supabase
      .from("saved_papers")
      .select("id, institution_name, exam_name, class_name, subject_name, chapter_names, question_ids")
      .eq("id", paperIdFromUrl)
      .maybeSingle()
      .then(async ({ data: paper, error }) => {
        if (error || !paper) return;
        const qIds = (paper.question_ids as number[]) || [];
        if (qIds.length === 0) return;

        const { data: qData } = await supabase
          .from("questions")
          .select("id, question, type, option_a, option_b, option_c, option_d, correct_answer, explanation, creative_data, stimulus_text, board_references, university_references")
          .in("id", qIds);

        if (qData && qData.length > 0) {
          const map = new Map(qData.map((q) => [q.id, q]));
          const sortedQuestions = qIds.map((id) => map.get(id)).filter(Boolean) as SmartBoardQuestion[];

          setQuestions(expandSmartboardQuestions(sortedQuestions));
          setMeta({
            instituteName: paper.institution_name || undefined,
            className: paper.class_name || undefined,
            subjectName: paper.subject_name || undefined,
            chapterNames: paper.chapter_names || undefined,
            programName: paper.exam_name || undefined,
          });
          setPaperTitle(paper.exam_name || "সংরক্ষিত প্রশ্নপত্র");
          setCurrentIndex(0);
          setShowAnswer(false);
          toast.success(`${toBanglaNum(sortedQuestions.length)}টি প্রশ্ন স্মার্টবোর্ডে লোড হয়েছে`);
        }
      });
  }, [paperIdFromUrl]);

  useEffect(() => {
    dispatch({ type: "switch", key: boardKey });
  }, [boardKey]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const update = () => {
      const width = node.clientWidth, height = node.clientHeight;
      setViewport(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isFullscreen, sidebarOpen]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = calculatorDragRef.current;
      const frame = frameRef.current;
      if (!drag || !frame) return;
      setCalculatorPosition({
        x: Math.max(0, Math.min(frame.clientWidth - 336, drag.x + event.clientX - drag.clientX)),
        y: Math.max(56, Math.min(frame.clientHeight - 570, drag.y + event.clientY - drag.clientY)),
      });
    };
    const stop = () => { calculatorDragRef.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
  }, []);

  const fitScale = useMemo(() => {
    if (viewport.width === 0 || viewport.height === 0) return 1;
    return Math.min((viewport.width - 40) / BOARD_WIDTH, (viewport.height - 40) / BOARD_HEIGHT);
  }, [viewport]);

  const scale = Math.max(0.05, fitScale * zoom);

  const boardWidth = BOARD_WIDTH;
  const boardHeight = BOARD_HEIGHT;
  const [questionResizePreview, setQuestionResizePreview] = useState<number | null>(null);
  const questionSurface = useRef<HTMLDivElement>(null);
  const [selectedQuestionParts, setSelectedQuestionParts] = useState<string[]>([]);
  useEffect(() => { setSelectedQuestionParts([]); }, [boardKey, tool]);
  const questionResize = useRef<{ clientX: number; startZoom: number } | null>(null);
  const savedQuestionZoom = selectedQuestionParts.length ? board.parts[selectedQuestionParts[0]]?.scale ?? 1 : 1;
  const questionZoom = currentQuestion?.type === "cq" ? questionResizePreview ?? savedQuestionZoom : 1;
  const setQuestionZoom = (value: number) => dispatch({ type: "parts", parts: {
    ...board.parts, ...Object.fromEntries(selectedQuestionParts.map(id => [id, {
      ...(board.parts[id] || { x: 0, y: 0 }), scale: Math.max(0.25, Math.min(3, value)),
    }])),
  } });
  const questionPanelWidth = boardWidth;
  const questionPanelHeight = boardHeight;
  // Keep slide geometry independent of viewport size and editor zoom.
  const questionTravelX = boardWidth * 0.06;
  const questionTravelY = boardHeight * 0.14;
  const questionPanelLeft = (
    questionPositionMode === "left" ? 0
      : questionPositionMode === "right" ? questionTravelX
      : questionPositionMode === "manual" ? questionTravelX * (manualQuestionPosition.x / 100)
      : questionTravelX / 2
  );
  const questionPanelTop = (
    questionPositionMode === "manual"
      ? questionTravelY * (manualQuestionPosition.y / 100)
      : questionTravelY / 2
  );

  const beginQuestionDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== "select" || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const startPosition = questionPositionMode === "manual"
      ? manualQuestionPosition
      : {
          x: questionPositionMode === "left" ? 0 : questionPositionMode === "right" ? 100 : 50,
          y: 50,
        };

    setQuestionPositionMode("manual");
    setManualQuestionPosition(startPosition);
    questionDragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      x: startPosition.x,
      y: startPosition.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [manualQuestionPosition, questionPositionMode, tool]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = questionDragRef.current;
      if (!drag || questionPositionMode !== "manual") return;
      const x = drag.x + ((event.clientX - drag.clientX) / Math.max(1, questionTravelX * scale)) * 100;
      const y = drag.y + ((event.clientY - drag.clientY) / Math.max(1, questionTravelY * scale)) * 100;
      setManualQuestionPosition({
        x,
        y,
      });
    };
    const handlePointerUp = () => { questionDragRef.current = null; };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [questionPositionMode, questionTravelX, questionTravelY, scale]);

  const commitBoard = useCallback(
    (elements: BoardElement[]) => dispatch({ type: "commit", elements }),
    [],
  );

  const handleLoadPaper = useCallback((paper: LoadedPaper) => {
    setReturnToPaper(paper.id ? `/dashboard/view-paper?paper_id=${encodeURIComponent(paper.id)}&action=view` : '/dashboard/view-paper');
    setQuestions(expandSmartboardQuestions(paper.questions));
    setMeta(paper.meta);
    setPaperTitle(paper.title);
    setCurrentIndex(0);
    setShowAnswer(false);
    toast.success(`${toBanglaNum(paper.questions.length)}টি প্রশ্ন স্মার্টবোর্ডে লোড হয়েছে`);
  }, []);

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex((current) => {
        if (questions.length === 0) return 0;
        const next = Math.max(0, Math.min(questions.length - 1, index));
        return next === current ? current : next;
      });
    },
    [questions.length],
  );

  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);
  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (frameRef.current) {
        await frameRef.current.requestFullscreen();
      }
    } catch {
      toast.error("ফুলস্ক্রিন মোড চালু করা যায়নি");
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const mod = event.ctrlKey || event.metaKey;

      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
        return;
      }
      if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
        return;
      }
      if (mod) return;

      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        goNext();
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goPrev();
        return;
      }
      const shortcut = TOOL_SHORTCUTS[event.key.toLowerCase()];
      if (shortcut && !event.altKey) {
        event.preventDefault();
        setTool(shortcut);
        return;
      }

      if (event.key.toLowerCase() === "f" && !event.altKey) {
        event.preventDefault();
        void toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev, toggleFullscreen]);

  const handleSelectBackground = (id: string) => {
    setBackgroundId(id);
    const next = getBackground(id);
    if (next.dark && style.color !== "#ffffff") setStyle((prev) => ({ ...prev, color: "#ffffff" }));
    if (!next.dark && style.color === "#ffffff") setStyle((prev) => ({ ...prev, color: "#ef4444" }));
  };

  return (
    <PortalContainerProvider container={portalContainer}>
    <div className="space-y-3 max-w-full">
      {/* Board Frame Container */}
      <div
        ref={setFrameNode}
        className={cn(
          "smartboard-shell relative flex flex-col overflow-hidden bg-white shadow-xs",
          isFullscreen
            ? "fixed inset-0 z-50 h-screen w-screen rounded-none border-0"
            : "h-[calc(100dvh-110px)] min-h-[440px] md:h-[calc(100vh-140px)] md:min-h-[620px] rounded-[1px] border border-slate-300"
        )}
      >
        {calculatorOpen && (
          <section
            className="absolute z-[80] w-[min(390px,calc(100vw-24px))] origin-top-left scale-[0.86]"
            style={{ left: calculatorPosition.x, top: calculatorPosition.y }}
            aria-label="সায়েন্টিফিক ক্যালকুলেটর"
          >
            <ScientificCalculator
              onClose={() => setCalculatorOpen(false)}
              onDragStart={(event) => {
                event.preventDefault();
                calculatorDragRef.current = { clientX: event.clientX, clientY: event.clientY, ...calculatorPosition };
              }}
            />
          </section>
        )}

        {/* ========================================================
            TOP BAR: Minimalist, Eye-Friendly Header
           ======================================================== */}
        <header aria-label="বোর্ডের প্রধান নিয়ন্ত্রণ" className="smartboard-topbar flex h-14 shrink-0 items-center justify-between gap-2 bg-[#0A1E38] px-3 md:px-4 text-white border-b border-slate-800 select-none shadow-xs">
          {/* Left section: Title & Quick Paper Actions */}
          <div className="flex min-w-0 items-center gap-2">
            {!isFullscreen && (
              <Link
                to="/dashboard"
                title="ড্যাশবোর্ডে ফিরুন"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[1px] transition-colors hover:bg-white/10 text-slate-300 hover:text-white border border-white/10"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
            )}

            <Button
              size="sm"
              variant="ghost"
              className="gap-2 px-3 h-9 text-sm font-semibold text-white hover:bg-white/10 rounded-[1px] border border-white/10"
              onClick={() => setSidebarOpen((open) => !open)}
              title={sidebarOpen ? "প্রশ্ন তালিকা লুকান" : "প্রশ্ন তালিকা দেখান"}
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4 text-[#00B4BC]" /> : <PanelLeftOpen className="h-4 w-4 text-[#00B4BC]" />}
              <span className="hidden sm:inline">প্রশ্ন তালিকা</span>
              {questions.length > 0 && (
                <Badge className="h-5 px-1.5 bg-[#00B4BC] text-[#0A1E38] text-xs font-bold border-0 rounded-[1px]">
                  {toBanglaNum(questions.length)}
                </Badge>
              )}
            </Button>

            <div className="hidden 2xl:flex items-center gap-2 pl-2 border-l border-white/15">
              <h1 className="truncate font-heading text-sm font-bold text-white flex items-center gap-1.5">
                <Tv className="w-4 h-4 text-[#00B4BC]" />
                ইন্টারেক্টিভ স্মার্টবোর্ড
              </h1>
              {paperTitle && (
                <span className="max-w-[220px] truncate text-xs text-amber-200 bg-white/10 px-2.5 py-1 rounded-[1px] border border-white/15 font-medium">
                  {paperTitle}
                </span>
              )}
            </div>
          </div>

          {/* Center section: Question Navigation & Answer Toggle */}
          <div className="flex items-center gap-2">
            <Popover open={questionStyleOpen} onOpenChange={setQuestionStyleOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5 text-sm font-semibold bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-[1px]"
                  disabled={!currentQuestion}
                  title="প্রশ্নের অবস্থান"
                >
                  {questionPositionMode === "left" ? <AlignLeft className="h-4 w-4" />
                    : questionPositionMode === "right" ? <AlignRight className="h-4 w-4" />
                    : questionPositionMode === "manual" ? <Move className="h-4 w-4" />
                    : <AlignCenter className="h-4 w-4" />}
                  <span className="hidden xl:inline">অবস্থান</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 max-w-[calc(100vw-24px)] rounded-[1px] p-3">
                <div className="mb-2 text-sm font-bold text-slate-800">প্রশ্ন কোথায় দেখাবে?</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { id: "left", label: "বামে", icon: AlignLeft },
                    { id: "center", label: "মাঝে", icon: AlignCenter },
                    { id: "right", label: "ডানে", icon: AlignRight },
                    { id: "manual", label: "Manual", icon: Move },
                  ] as const).map(({ id, label, icon: Icon }) => (
                    <Button
                      key={id}
                      type="button"
                      variant={questionPositionMode === id ? "default" : "outline"}
                      size="sm"
                      className="h-auto flex-col gap-1 rounded-[1px] px-1 py-2 text-xs"
                      onClick={() => setQuestionPositionMode(id)}
                    >
                      <Icon className="h-4 w-4" /> {label}
                    </Button>
                  ))}
                </div>
                {questionPositionMode === "manual" && (
                  <div className="mt-3 space-y-3 border-t pt-3">
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-slate-600"><span>আড়াআড়ি</span><span>{Math.round(manualQuestionPosition.x)}%</span></div>
                      <Slider value={[manualQuestionPosition.x]} min={0} max={100} step={1} onValueChange={([x]) => setManualQuestionPosition((previous) => ({ ...previous, x }))} />
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-slate-600"><span>উপর–নিচ</span><span>{Math.round(manualQuestionPosition.y)}%</span></div>
                      <Slider value={[manualQuestionPosition.y]} min={0} max={100} step={1} onValueChange={([y]) => setManualQuestionPosition((previous) => ({ ...previous, y }))} />
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      “সিলেক্ট” টুল চালু করে প্রশ্নের যেকোনো অংশ ধরে পুরো বোর্ডে সরাতে পারবেন।
                    </p>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5 text-sm font-semibold bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-[1px]"
                  disabled={!currentQuestion}
                  title="প্রশ্নের লেখা ও রেফারেন্স নিয়ন্ত্রণ"
                >
                  <Type className="h-4 w-4" />
                  <span className="hidden xl:inline">প্রশ্ন স্টাইল</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="max-h-[78dvh] w-96 max-w-[calc(100vw-24px)] overflow-y-auto rounded-[1px] p-4">
                <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                  <div className="text-sm font-bold text-slate-800">প্রশ্নের স্টাইল ও তথ্য</div>
                  <button type="button" onClick={() => setQuestionStyleOpen(false)} className="inline-flex h-8 items-center gap-1 rounded-[1px] border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <ChevronLeft className="h-3.5 w-3.5" /> ফিরে যান
                  </button>
                </div>
                <div className="mb-4 space-y-3 border-b border-slate-200 pb-3">
                  <label className="flex items-center justify-between gap-2 text-sm">
                    প্রশ্নের রং
                    <input type="color" aria-label="প্রশ্নের রং" value={questionTextColor || (background.dark ? currentQuestion?.type === "cq" ? "#ffff00" : "#f1f5f9" : "#0f172a")}
                      onChange={event => setQuestionTextColor(event.target.value)} />
                  </label>
                  <label className="flex items-center justify-between gap-2 text-sm">
                    উদ্দীপকের রং
                    <input type="color" aria-label="উদ্দীপকের রং" value={stimulusTextColor || (background.dark ? currentQuestion?.type === "cq" ? "#ffffff" : "#fde047" : "#92400e")}
                      onChange={event => setStimulusTextColor(event.target.value)} />
                  </label>
                  <Button size="sm" variant="outline" onClick={() => { setQuestionTextColor(""); setStimulusTextColor(""); }}>
                    বোর্ড অনুযায়ী স্বয়ংক্রিয় রং
                  </Button>
                </div>
                <label className="block text-xs font-semibold text-slate-600">ফন্ট</label>
                <select
                  value={questionFontFamily}
                  onChange={(event) => setQuestionFontFamily(event.target.value)}
                  className="mt-1 h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm text-slate-800"
                >
                  <option value="inherit">ডিফল্ট বাংলা</option>
                  <option value="'Noto Sans Bengali', sans-serif">Noto Sans Bengali</option>
                  <option value="'Hind Siliguri', sans-serif">Hind Siliguri</option>
                  <option value="'SolaimanLipi', serif">SolaimanLipi</option>
                  <option value="Arial, sans-serif">Arial</option>
                </select>

                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
                    <span>ফন্ট সাইজ</span><span>{questionFontSize}px</span>
                  </div>
                  <Slider
                    value={[questionFontSize]}
                    min={20}
                    max={64}
                    step={1}
                    onValueChange={([value]) => setQuestionFontSize(value)}
                  />
                </div>

                {currentQuestion?.type === "mcq" && (
                  <div className="mt-4 space-y-3 border-t border-slate-200 pt-3">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500">MCQ রং ও Answer border</div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] font-semibold text-slate-600">
                      <label>Option border<input type="color" value={mcqOptionBorderColor} onChange={(event) => setMcqOptionBorderColor(event.target.value)} className="mt-1 h-9 w-full rounded border p-1" /></label>
                      <label>Option text<input type="color" value={mcqOptionTextColor} onChange={(event) => setMcqOptionTextColor(event.target.value)} className="mt-1 h-9 w-full rounded border p-1" /></label>
                      <label>Correct<input type="color" value={mcqCorrectColor} onChange={(event) => setMcqCorrectColor(event.target.value)} className="mt-1 h-9 w-full rounded border p-1" /></label>
                      <label>Answer bg<input type="color" value={mcqAnswerBackgroundColor} onChange={(event) => setMcqAnswerBackgroundColor(event.target.value)} className="mt-1 h-9 w-full rounded border p-1" /></label>
                      <label>Answer border<input type="color" value={mcqAnswerBorderColor} onChange={(event) => setMcqAnswerBorderColor(event.target.value)} className="mt-1 h-9 w-full rounded border p-1" /></label>
                      <label>Border style<select value={mcqAnswerBorderStyle} onChange={(event) => setMcqAnswerBorderStyle(event.target.value as typeof mcqAnswerBorderStyle)} className="mt-1 h-9 w-full rounded border border-slate-300 bg-white px-1"><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="double">Double</option><option value="none">None</option></select></label>
                    </div>
                  </div>
                )}

                <div className="mt-4 space-y-3 border-t border-slate-200 pt-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Header control</div>

                  <div className="rounded border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 text-sm font-bold text-slate-700">প্রতিষ্ঠান ও Logo</div>
                    <input value={institutionText} onChange={(event) => setInstitutionText(event.target.value)} placeholder={meta?.instituteName || "প্রতিষ্ঠানের নাম"} className="mb-2 h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs" />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="mb-2 block w-full text-xs text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-slate-200 file:px-2 file:py-1.5 file:font-semibold"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setHeaderLogoUrl(String(reader.result || ""));
                        reader.readAsDataURL(file);
                      }}
                    />
                    <div className="grid grid-cols-[1fr_72px_46px] gap-2">
                      <select value={institutionFontFamily} onChange={(event) => setInstitutionFontFamily(event.target.value)} className="h-8 rounded border border-slate-300 bg-white px-2 text-xs">
                        <option value="inherit">ডিফল্ট</option><option value="'HasanHera', 'NotoSerifBengali', serif">Hasan Hera — স্টাইলিশ</option><option value="'NotoSerifBengali', serif">Noto Serif — বোল্ড</option><option value="'Noto Sans Bengali', sans-serif">Noto Sans</option><option value="'Hind Siliguri', sans-serif">Hind</option><option value="'SolaimanLipi', serif">Solaiman</option><option value="Arial, sans-serif">Arial</option>
                      </select>
                      <input type="number" min={14} max={96} value={institutionFontSize} onChange={(event) => setInstitutionFontSize(Number(event.target.value))} className="h-8 rounded border border-slate-300 px-2 text-xs" aria-label="প্রতিষ্ঠানের font size" />
                      <input type="color" value={headerInstitutionColor} onChange={(event) => setHeaderInstitutionColor(event.target.value)} className="h-8 w-full cursor-pointer rounded border border-slate-300 p-1" aria-label="প্রতিষ্ঠানের color" />
                    </div>
                  </div>

                  <div className="rounded border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 text-sm font-bold text-slate-700">Chapter</div>
                    <input value={chapterText} onChange={(event) => setChapterText(event.target.value)} placeholder={meta?.chapterNames?.join(", ") || "Chapter name"} className="mb-2 h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs" />
                    <div className="grid grid-cols-[1fr_72px_46px_46px] gap-2">
                      <select value={chapterFontFamily} onChange={(event) => setChapterFontFamily(event.target.value)} className="h-8 rounded border border-slate-300 bg-white px-2 text-xs">
                        <option value="inherit">ডিফল্ট</option><option value="'HasanHera', 'NotoSerifBengali', serif">Hasan Hera — স্টাইলিশ</option><option value="'NotoSerifBengali', serif">Noto Serif — বোল্ড</option><option value="'Noto Sans Bengali', sans-serif">Noto Sans</option><option value="'Hind Siliguri', sans-serif">Hind</option><option value="'SolaimanLipi', serif">Solaiman</option><option value="Arial, sans-serif">Arial</option>
                      </select>
                      <input type="number" min={14} max={96} value={chapterFontSize} onChange={(event) => setChapterFontSize(Number(event.target.value))} className="h-8 rounded border border-slate-300 px-2 text-xs" aria-label="Chapter font size" />
                      <input type="color" value={headerAccentColor} onChange={(event) => setHeaderAccentColor(event.target.value)} className="h-8 w-full cursor-pointer rounded border border-slate-300 p-1" aria-label="Chapter background color" />
                      <input type="color" value={chapterTextColor} onChange={(event) => setChapterTextColor(event.target.value)} className="h-8 w-full cursor-pointer rounded border border-slate-300 p-1" aria-label="Chapter text color" />
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">Font · Size · Background · Text</div>
                  </div>

                  <div className="rounded border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 text-sm font-bold text-slate-700">Course</div>
                    <input value={courseText} onChange={(event) => setCourseText(event.target.value)} placeholder={meta?.programName || meta?.subjectName || "Course name"} className="mb-2 h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs" />
                    <div className="grid grid-cols-[1fr_72px_46px] gap-2">
                      <select value={courseFontFamily} onChange={(event) => setCourseFontFamily(event.target.value)} className="h-8 rounded border border-slate-300 bg-white px-2 text-xs">
                        <option value="inherit">ডিফল্ট</option><option value="'HasanHera', 'NotoSerifBengali', serif">Hasan Hera — স্টাইলিশ</option><option value="'NotoSerifBengali', serif">Noto Serif — বোল্ড</option><option value="'Noto Sans Bengali', sans-serif">Noto Sans</option><option value="'Hind Siliguri', sans-serif">Hind</option><option value="'SolaimanLipi', serif">Solaiman</option><option value="Arial, sans-serif">Arial</option>
                      </select>
                      <input type="number" min={14} max={96} value={courseFontSize} onChange={(event) => setCourseFontSize(Number(event.target.value))} className="h-8 rounded border border-slate-300 px-2 text-xs" aria-label="Course font size" />
                      <input type="color" value={courseColor} onChange={(event) => setCourseColor(event.target.value)} className="h-8 w-full cursor-pointer rounded border border-slate-300 p-1" aria-label="Course color" />
                    </div>
                  </div>

                  <div className="rounded border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 text-sm font-bold text-slate-700">বোর্ড/স্কুল Reference style</div>
                    <select value={referenceStyle} onChange={(event) => setReferenceStyle(event.target.value as typeof referenceStyle)} className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs">
                      <option value="filled">রঙিন Filled Badge</option><option value="black">Black Badge</option><option value="outline">Outline Badge</option><option value="bracket">[Bracket]</option><option value="underline">Underline</option>
                    </select>
                    <div className="mt-2 grid grid-cols-[1fr_68px_46px_46px] gap-2">
                      <select value={referenceFontFamily} onChange={(event) => setReferenceFontFamily(event.target.value)} className="h-8 rounded border border-slate-300 bg-white px-2 text-xs">
                        <option value="inherit">ডিফল্ট</option><option value="SolaimanLipi">SolaimanLipi</option><option value="OmicronBangla">OmicronBangla</option><option value="Kalpurush">Kalpurush</option><option value="Noto Serif Bengali">Noto Serif</option><option value="Arial">Arial</option><option value="Times New Roman">Times</option>
                      </select>
                      <input type="number" min={8} max={64} value={referenceFontSize} onChange={(event) => setReferenceFontSize(Number(event.target.value))} className="h-8 rounded border border-slate-300 px-2 text-xs" aria-label="Reference font size" />
                      <input type="color" value={referenceColor} onChange={(event) => setReferenceColor(event.target.value)} className="h-8 w-full rounded border border-slate-300 p-1" aria-label="Reference badge color" />
                      <input type="color" value={referenceTextColor} onChange={(event) => setReferenceTextColor(event.target.value)} className="h-8 w-full rounded border border-slate-300 p-1" aria-label="Reference text color" />
                    </div>
                    <div className="mt-2 flex gap-4 text-xs text-slate-700">
                      <label className="flex items-center gap-1"><input type="checkbox" checked={referenceBold} onChange={(event) => setReferenceBold(event.target.checked)} /> Bold</label>
                      <label className="flex items-center gap-1"><input type="checkbox" checked={referenceItalic} onChange={(event) => setReferenceItalic(event.target.checked)} /> Italic</label>
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-700">
                    <span>বোর্ড রেফারেন্স দেখান</span>
                    <input
                      type="checkbox"
                      checked={showBoardReferences}
                      onChange={(event) => setShowBoardReferences(event.target.checked)}
                      className="h-4 w-4 accent-emerald-600"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-700">
                    <span>স্কুল/বিশ্ববিদ্যালয় রেফারেন্স দেখান</span>
                    <input
                      type="checkbox"
                      checked={showInstitutionReferences}
                      onChange={(event) => setShowInstitutionReferences(event.target.checked)}
                      className="h-4 w-4 accent-emerald-600"
                    />
                  </label>
                </div>
              </PopoverContent>
            </Popover>

            <div className="flex items-center rounded-[1px] bg-white/10 border border-white/20 p-0.5">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-[1px] text-white hover:bg-white/15 disabled:opacity-30"
                onClick={goPrev}
                disabled={currentIndex === 0 || questions.length === 0}
                title="পূর্ববর্তী প্রশ্ন (Left Arrow)"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span className="min-w-[84px] text-center text-xs sm:text-sm font-bold text-amber-300 px-2">
                {questions.length === 0
                  ? "০ / ০"
                  : `পৃষ্ঠা ${toBanglaNum(currentIndex + 1)} / ${toBanglaNum(questions.length)}`}
              </span>

              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-[1px] text-white hover:bg-white/15 disabled:opacity-30"
                onClick={goNext}
                disabled={questions.length === 0 || currentIndex >= questions.length - 1}
                title="পরবর্তী প্রশ্ন (Right Arrow)"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button size="sm" variant="outline" onClick={addBlankPage}
              className="h-9 rounded-[1px] border-white/20 bg-white/10 font-semibold text-white hover:bg-white/20 hover:text-white" title="সমাধানের জন্য ফাঁকা পৃষ্ঠা যোগ করুন">
              + ফাঁকা পৃষ্ঠা
            </Button>

            <Button size="sm" variant="outline" onClick={duplicatePage}
              className="h-9 rounded-[1px] border-white/20 bg-white/10 font-semibold text-white hover:bg-white/20 hover:text-white"
              title="বর্তমান পৃষ্ঠা ডুপ্লিকেট করুন">পৃষ্ঠা ডুপ্লিকেট</Button>

            <Popover>
              <PopoverTrigger asChild><Button size="sm" variant="outline" className="h-9 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">PDF স্লাইড</Button></PopoverTrigger>
              <PopoverContent className="w-72 max-w-[calc(100vw-24px)] space-y-4 p-4">
                <div className="font-semibold">সব পৃষ্ঠা PDF করুন</div>
                <label className="block space-y-2"><span>এক্সপোর্টের ধরন</span><select aria-label="এক্সপোর্টের ধরন" value={pdfMode} onChange={event => setPdfMode(event.target.value as SlideExportMode)} className="h-10 w-full rounded border bg-white px-2">
                  <option value="questions">শুধু প্রশ্ন</option><option value="both">প্রশ্ন ও উত্তর</option><option value="answers">শুধু উত্তর</option>
                </select></label>
                <label className="flex items-center gap-3"><input type="checkbox" checked={pdfDrawings} onChange={event => setPdfDrawings(event.target.checked)} />লেখা ও আঁকা দাগসহ</label>
                <Button className="w-full" onClick={downloadSlides} disabled={pdfBusy}>{pdfBusy ? "তৈরি হচ্ছে…" : "PDF ডাউনলোড / প্রিন্ট"}</Button>
                <p className="text-xs text-slate-500">প্রিন্ট উইন্ডোতে Save as PDF বেছে নিন। বড় উত্তর আলাদা ধারাবাহিক স্লাইডে থাকবে।</p>
              </PopoverContent>
            </Popover>

            {returnToPaper && <Link to={returnToPaper} title="প্রশ্নপত্রে ফিরে যান"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20">
              <ChevronLeft className="h-4 w-4" /> প্রশ্নপত্রে ফিরুন
            </Link>}

            {/* Answer Toggle */}
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "h-9 gap-1.5 text-sm font-semibold transition-all rounded-[1px]",
                showAnswer
                  ? "bg-[#059669] hover:bg-[#047857] text-white border-0 shadow-xs"
                  : "bg-white/10 hover:bg-white/20 text-white border-white/20"
              )}
              onClick={() => {
                const source = currentPage?.sourcePageId ?? currentPage?.id;
                const next = withAnswerSlides(questionPages, showAnswer ? "questions" : "both");
                const target = next.findIndex(page => showAnswer ? page.id === source : page.answerSlide && (page.sourcePageId === source || (currentPage?.type === "cq" && currentPage.cqPartIndex === undefined && page.sourceQuestionNumber === currentPage.sourceQuestionNumber)));
                setShowAnswer(value => !value);
                setCurrentIndex(Math.max(0, target >= 0 ? target : next.findIndex(page => page.id === source)));
              }}
            >
              {showAnswer ? <EyeOff className="h-4 w-4 text-white" /> : <Eye className="h-4 w-4 text-amber-300" />}
              <span>{showAnswer ? "উত্তর লুকান" : "উত্তর দেখান"}</span>
            </Button>
          </div>

          {/* Right section: Load Paper, History & Fullscreen */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-9 gap-1.5 text-sm font-bold bg-[#059669] hover:bg-[#047857] text-white shadow-xs border-0 rounded-[1px]"
              onClick={() => setLoadOpen(true)}
            >
              <FolderOpen className="h-4 w-4 text-white" />
              <span className="hidden sm:inline">প্রশ্নপত্র লোড</span>
              <span className="sm:hidden">লোড</span>
            </Button>

            <div className="flex items-center gap-0.5 border-l border-white/15 pl-1.5">
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-[1px] text-white hover:bg-white/15 disabled:opacity-30"
                onClick={() => dispatch({ type: "undo" })}
                disabled={board.past.length === 0}
                title="আনডু (Ctrl+Z)"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-[1px] text-white hover:bg-white/15 disabled:opacity-30"
                onClick={() => dispatch({ type: "redo" })}
                disabled={board.future.length === 0}
                title="রিডু (Ctrl+Shift+Z)"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-[1px] text-white hover:bg-white/15 disabled:opacity-30"
                onClick={() => dispatch({ type: "clear" })}
                disabled={board.elements.length === 0}
                title="বোর্ড মুছুন"
              >
                <Trash2 className="h-4 w-4 text-rose-300" />
              </Button>
            </div>

            {/* Fullscreen Button */}
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 px-3 text-sm font-medium text-white bg-white/10 hover:bg-white/20 border-white/20 rounded-[1px]"
              onClick={toggleFullscreen}
              title={isFullscreen ? "ফুলস্ক্রিন বন্ধ করুন (F)" : "ফুলস্ক্রিন ক্লাসরুম মোড (F)"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4 text-amber-300" /> : <Maximize2 className="h-4 w-4 text-amber-300" />}
              <span className="hidden sm:inline">{isFullscreen ? "সাধারণ মোড" : "ফুলস্ক্রিন"}</span>
            </Button>
          </div>
        </header>

        {/* ========================================================
            MAIN BODY: Questions Drawer & Board Viewport
           ======================================================== */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {/* Questions Sidebar Drawer */}
          {sidebarOpen && <button type="button" aria-label="প্রশ্ন তালিকা বন্ধ করুন" onClick={() => setSidebarOpen(false)} className="absolute inset-0 z-10 bg-black/25 md:hidden" />}
          {sidebarOpen && (
            <aside className="absolute inset-y-0 left-0 w-[min(85vw,320px)] md:relative md:w-80 shrink-0 flex-col border-r border-slate-300 bg-slate-50 z-20 shadow-xs animate-in slide-in-from-left duration-200">
              <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-bold text-sm text-[#0A1E38]">
                    Questions ({toBanglaNum(questions.length)})
                  </h3>
                  {paperTitle && (
                    <p className="text-xs text-slate-500 truncate max-w-[180px]">
                      {paperTitle}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1 px-2.5 border-slate-300 hover:bg-slate-100 rounded-[1px]"
                  onClick={() => setLoadOpen(true)}
                >
                  প্রশ্নপত্র পরিবর্তন
                </Button>
              </div>

              {/* Questions List */}
              <div className="flex-1 space-y-2 overflow-y-auto p-3 custom-sidebar-scrollbar">
                {questions.length === 0 ? (
                  <div className="rounded-[1px] border border-dashed border-slate-300 bg-white p-5 text-center">
                    <FileQuestion className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600 font-semibold">কোনো প্রশ্ন লোড করা নেই</p>
                    <p className="text-xs text-slate-400 mt-1">
                      প্রশ্নপত্র লোড করলে এখানে ক্রমানুসারে তালিকা দেখা যাবে।
                    </p>
                    <Button
                      size="sm"
                      className="mt-3 w-full bg-[#059669] hover:bg-[#047857] text-white text-sm font-bold rounded-[1px] h-9"
                      onClick={() => setLoadOpen(true)}
                    >
                      প্রশ্নপত্র লোড করুন
                    </Button>
                  </div>
                ) : (
                  questions.map((question, index) => {
                    const isSelected = index === currentIndex;
                    return (
                      <button
                        key={`${question.id}-${index}`}
                        type="button"
                        onClick={() => { goTo(index); if (window.innerWidth < 768) setSidebarOpen(false); }}
                        className={cn(
                          "w-full rounded-[1px] border p-3.5 text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-emerald-600 bg-emerald-50/50 shadow-xs"
                            : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={cn(
                            "text-xs font-bold",
                            isSelected ? "text-emerald-800" : "text-slate-600"
                          )}>
                            {question.type === "blank" ? "ফাঁকা পৃষ্ঠা" : question.answerSlide ? "উত্তর" : "প্রশ্ন"} {toBanglaNum(question.sourceQuestionNumber ?? index + 1)}{question.type === "cq" ? question.cqPartIndex === undefined ? " — সম্পূর্ণ" : ` — ${["ক", "খ", "গ", "ঘ"][question.cqPartIndex]}` : ""}
                          </span>
                          <Badge variant="secondary" className="text-xs px-2 py-0.5 rounded-[1px] uppercase bg-slate-100 border border-slate-200 text-slate-700">
                            {question.type}
                          </Badge>
                        </div>
                        <div className="line-clamp-3 max-h-24 overflow-hidden break-words text-sm font-medium leading-snug text-slate-800 [&_img]:hidden [&_.katex]:text-[1em]">
                          <LatexRenderer text={question.creative_data?.stem || question.stimulus_text || question.question || "(প্রশ্ন নেই)"} />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="p-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-600">
                <span>মোট প্রশ্ন: <strong className="text-slate-800">{toBanglaNum(questions.length)}</strong> টি</span>
                <span className="text-xs">ক্লিক করে জাম্প করুন</span>
              </div>
            </aside>
          )}

          {/* Board Viewport Surface */}
          <div ref={viewportRef} className="smartboard-viewport relative min-h-0 min-w-0 flex-1 overflow-scroll bg-slate-100">
            {currentQuestion && <div className="pointer-events-none sticky left-0 top-0 z-30 h-0" style={{ width: boardWidth * Math.max(0.05, fitScale), margin: "0 auto" }}>
              <div style={{ width: boardWidth,
                height: 180, transform: `scale(${Math.max(0.05, fitScale)})`, transformOrigin: 'top left' }}>
                    <QuestionSlide
                      headerOnly
                      parts={questionResizePreview === null ? board.parts : {
                        ...board.parts, ...Object.fromEntries(selectedQuestionParts.map(id => [id, {
                          ...(board.parts[id] || { x: 0, y: 0 }), scale: questionResizePreview,
                        }])),
                      }}
                      onPartsChange={parts => dispatch({ type: "parts", parts })}
                      dragEnabled={tool === "select"}
                      selectedPartIds={selectedQuestionParts}
                      contentOffset={{ x: questionPanelLeft - questionTravelX / 2, y: questionPanelTop - questionTravelY / 2 }}
                      contentScale={1}
                      boardScale={scale}
                      question={currentQuestion}
                      number={questionNumber}
                      meta={meta}
                      showAnswer={Boolean(currentQuestion?.answerSlide)}
                      onAnswerPageChange={setAnswerPart}
                      dark={background.dark}
                      questionTextColor={questionTextColor}
                      stimulusTextColor={stimulusTextColor}
                      questionFontSize={questionFontSize}
                      questionFontFamily={questionFontFamily}
                      mcqOptionBorderColor={mcqOptionBorderColor}
                      mcqOptionTextColor={mcqOptionTextColor}
                      mcqCorrectColor={mcqCorrectColor}
                      mcqAnswerBackgroundColor={mcqAnswerBackgroundColor}
                      mcqAnswerBorderColor={mcqAnswerBorderColor}
                      mcqAnswerBorderStyle={mcqAnswerBorderStyle}
                      showBoardReferences={showBoardReferences}
                      showInstitutionReferences={showInstitutionReferences}
                      headerAccentColor={headerAccentColor}
                      headerInstitutionColor={headerInstitutionColor}
                      headerLogoUrl={headerLogoUrl}
                      institutionFontFamily={institutionFontFamily}
                      institutionFontSize={institutionFontSize}
                      chapterFontFamily={chapterFontFamily}
                      chapterFontSize={chapterFontSize}
                      chapterTextColor={chapterTextColor}
                      courseFontFamily={courseFontFamily}
                      courseFontSize={courseFontSize}
                      courseColor={courseColor}
                      institutionText={institutionText}
                      chapterText={chapterText}
                      courseText={courseText}
                      referenceStyle={referenceStyle}
                      referenceColor={referenceColor}
                      referenceTextColor={referenceTextColor}
                      referenceFontFamily={referenceFontFamily}
                      referenceFontSize={referenceFontSize}
                      referenceBold={referenceBold}
                      referenceItalic={referenceItalic}
                    />
              </div>
            </div>}

            <div
              className="relative m-auto"
              style={{ width: boardWidth * scale, height: boardHeight * scale }}
            >
              <div
                className="absolute left-0 top-0 overflow-hidden shadow-sm rounded-[1px] border border-slate-300"
                style={{
                  width: boardWidth,
                  height: boardHeight,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  ...background.style,
                }}
              >
                {/* Question Slide: select tool lets teachers drag it anywhere on the full board. */}
                {currentQuestion ? (
                  <div
                    className={cn(
                      "absolute overflow-visible rounded-[1px] pointer-events-none",
                      tool === "select" ? "z-20 touch-none select-none" : "pointer-events-none z-0",
                    )}
                    style={{
                      left: 0,
                      top: 0,
                      width: questionPanelWidth,
                      height: questionPanelHeight,
                      backgroundColor: "transparent",
                      outline: undefined,
                    }}
                    ref={questionSurface}
                    aria-label="প্রশ্ন নির্বাচন করে সরান"
                    title={tool === "select" ? "প্রশ্নটি ধরে বোর্ডের যেকোনো স্থানে সরান" : undefined}
                  >
                    {tool === "select" && selectedQuestionParts.length > 0 && currentQuestion.type === "cq" && <>
                      <div className="pointer-events-auto absolute left-2 top-0 z-50 flex items-center gap-2 rounded border border-sky-500 bg-white p-2 text-sm text-slate-900 shadow"
                        onPointerDown={event => event.stopPropagation()}>
                        <span>সিলেক্ট করা অংশ</span>
                        <button type="button" aria-label="CQ ছোট করুন" className="h-8 w-8 rounded bg-slate-100" onClick={() => setQuestionZoom(questionZoom - 0.1)}>−</button>
                        <span>{Math.round(questionZoom * 100)}%</span>
                        <button type="button" aria-label="CQ বড় করুন" className="h-8 w-8 rounded bg-slate-100" onClick={() => setQuestionZoom(questionZoom + 0.1)}>+</button>
                        <button type="button" className="rounded bg-slate-100 px-2 py-1" onClick={() => setQuestionZoom(1)}>রিসেট</button>
                      </div>
                      <button type="button" aria-label="কোণা টেনে CQ ছোট বড় করুন"
                        className="pointer-events-auto absolute -bottom-3 -right-3 z-50 h-8 w-8 cursor-nwse-resize rounded border-2 border-white bg-sky-600 text-white shadow" style={{ touchAction: "none" }}
                        onPointerDown={event => {
                          event.preventDefault(); event.stopPropagation();
                          questionResize.current = { clientX: event.clientX, startZoom: questionZoom };
                          event.currentTarget.setPointerCapture(event.pointerId);
                        }}
                        onPointerMove={event => {
                          if (!questionResize.current) return;
                          event.stopPropagation();
                          setQuestionResizePreview(Math.max(0.25, Math.min(3, questionResize.current.startZoom + (event.clientX - questionResize.current.clientX) / (questionPanelWidth * scale))));
                        }}
                        onPointerUp={event => {
                          if (!questionResize.current) return;
                          event.stopPropagation();
                          setQuestionZoom(questionResize.current.startZoom + (event.clientX - questionResize.current.clientX) / (questionPanelWidth * scale));
                          questionResize.current = null; setQuestionResizePreview(null);
                        }}
                        onPointerCancel={() => { questionResize.current = null; setQuestionResizePreview(null); }}>↘</button>
                    </>}
                    <QuestionSlide
                      hideHeader
                      parts={questionResizePreview === null ? board.parts : {
                        ...board.parts, ...Object.fromEntries(selectedQuestionParts.map(id => [id, {
                          ...(board.parts[id] || { x: 0, y: 0 }), scale: questionResizePreview,
                        }])),
                      }}
                      onPartsChange={parts => dispatch({ type: "parts", parts })}
                      dragEnabled={tool === "select"}
                      selectedPartIds={selectedQuestionParts}
                      contentOffset={{ x: questionPanelLeft - questionTravelX / 2, y: questionPanelTop - questionTravelY / 2 }}
                      contentScale={1}
                      boardScale={scale}
                      question={currentQuestion}
                      number={questionNumber}
                      meta={meta}
                      showAnswer={Boolean(currentQuestion?.answerSlide)}
                      onAnswerPageChange={setAnswerPart}
                      dark={background.dark}
                      questionTextColor={questionTextColor}
                      stimulusTextColor={stimulusTextColor}
                      questionFontSize={questionFontSize}
                      questionFontFamily={questionFontFamily}
                      mcqOptionBorderColor={mcqOptionBorderColor}
                      mcqOptionTextColor={mcqOptionTextColor}
                      mcqCorrectColor={mcqCorrectColor}
                      mcqAnswerBackgroundColor={mcqAnswerBackgroundColor}
                      mcqAnswerBorderColor={mcqAnswerBorderColor}
                      mcqAnswerBorderStyle={mcqAnswerBorderStyle}
                      showBoardReferences={showBoardReferences}
                      showInstitutionReferences={showInstitutionReferences}
                      headerAccentColor={headerAccentColor}
                      headerInstitutionColor={headerInstitutionColor}
                      headerLogoUrl={headerLogoUrl}
                      institutionFontFamily={institutionFontFamily}
                      institutionFontSize={institutionFontSize}
                      chapterFontFamily={chapterFontFamily}
                      chapterFontSize={chapterFontSize}
                      chapterTextColor={chapterTextColor}
                      courseFontFamily={courseFontFamily}
                      courseFontSize={courseFontSize}
                      courseColor={courseColor}
                      institutionText={institutionText}
                      chapterText={chapterText}
                      courseText={courseText}
                      referenceStyle={referenceStyle}
                      referenceColor={referenceColor}
                      referenceTextColor={referenceTextColor}
                      referenceFontFamily={referenceFontFamily}
                      referenceFontSize={referenceFontSize}
                      referenceBold={referenceBold}
                      referenceItalic={referenceItalic}
                    />
                  </div>
                ) : (
                  !currentPage && board.elements.length === 0 && (
                    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-8 text-center">
                      <div className="w-16 h-16 rounded-[1px] bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center shadow-xs">
                        <Tv className="w-8 h-8 text-[#00B4BC]" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-heading font-bold text-slate-800">
                          স্মার্টবোর্ড প্রস্তুত
                        </h2>
                        <p className="max-w-md text-base text-slate-600 mt-1">
                          কলম, লাইন, শেপ, তীর ও ইরেজার দিয়ে সরাসরি বোর্ডে লিখুন। প্রশ্ন দেখাতে চাইলে প্রশ্নপত্র লোড করুন।
                        </p>
                      </div>
                      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 mt-2">
                        <Button
                          size="default"
                          className="bg-[#059669] hover:bg-[#047857] text-white gap-2 font-bold shadow-xs rounded-[1px] h-11 px-6 text-base"
                          onClick={() => setLoadOpen(true)}
                        >
                          <FolderOpen className="w-4 h-4 text-white" />
                          প্রশ্নপত্র লোড করুন
                        </Button>
                        <Link
                          to="/dashboard/create"
                          className="text-base font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-4 px-3 py-2"
                        >
                          নতুন প্রশ্ন তৈরি করুন
                        </Link>
                      </div>
                    </div>
                  )
                )}

                {/* Interactive SVG Drawing Canvas */}
                <BoardCanvas
                  boardWidth={boardWidth}
                  boardHeight={boardHeight}
                  tool={tool}
                  color={style.color}
                  strokeWidth={style.strokeWidth}
                  opacity={style.opacity}
                  fontSize={style.fontSize}
                  elements={board.elements}
                  onMarqueeSelect={rect => {
                    const ids = Array.from(questionSurface.current?.querySelectorAll<HTMLElement>('[data-question-part]') || []).filter(element => {
                      const bounds = element.getBoundingClientRect();
                      return bounds.width > 0 && bounds.height > 0 && bounds.left < rect.right && bounds.right > rect.left && bounds.top < rect.bottom && bounds.bottom > rect.top;
                    }).map(element => element.dataset.questionPart!);
                    // A selection covering the complete CQ carries its number/type badge too.
                    const questionParts = Array.from(questionSurface.current?.querySelectorAll<HTMLElement>('[data-question-part]') || [])
                      .map(element => element.dataset.questionPart!).filter(id => !id.endsWith(':question-label') && !board.parts[id]?.deleted);
                    if (currentQuestion?.type === "cq" && questionParts.length && questionParts.every(id => ids.includes(id))) {
                      const labelId = `${currentQuestion.id}:question-label`;
                      if (!ids.includes(labelId)) ids.push(labelId);
                    }
                    setSelectedQuestionParts(ids);
                  }}
                  onCommit={commitBoard}
                  compassRadius={compassRadius}
                  showCompassCenter={showCompassCenter}
                  onCompassRadiusChange={setCompassRadius}
                  onCompassClose={() => setTool("select")}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            BOTTOM TOOLBAR: Intuitive, Minimalist Teacher Tools
           ======================================================== */}
        <footer aria-label="বোর্ডের আঁকার সরঞ্জাম" className="smartboard-toolbar flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-300 bg-white px-3 py-2 shadow-xs select-none">
          {/* Tools Selector */}
          <div className="smartboard-tools flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto">
            {TOOLS.map(({ id, label, hint, Icon }) => {
              const isActive = tool === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTool(id)}
                  title={`${label} (${hint})`}
                  aria-label={label}
                  className={cn(
                    "flex h-9 md:h-10 min-w-9 md:min-w-10 items-center gap-1.5 rounded-[1px] px-2.5 text-sm font-medium transition-all cursor-pointer",
                    isActive
                      ? "bg-primary text-white shadow-xs font-bold"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="sr-only">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Swatches & Settings */}
          <div className="smartboard-options flex flex-wrap items-center gap-2 sm:gap-3">
            {tool === "compass" && (
              <div className="flex h-10 items-center gap-2 rounded-[1px] border border-slate-300 bg-white px-2" title="কম্পাসের ব্যাসার্ধ ছোট–বড় করুন">
                <Compass className="h-4 w-4 text-slate-600" />
                <span className="hidden 2xl:inline text-xs font-semibold text-slate-700">ব্যাসার্ধ</span>
                <Slider className="w-24" value={[compassRadius]} min={10} max={Math.max(Math.ceil(Math.hypot(boardWidth, boardHeight)), compassRadius)} step={5} onValueChange={([value]) => setCompassRadius(value)} />
                <input type="number" aria-label="কম্পাসের ব্যাসার্ধ" min={10} step={5} value={compassRadius}
                  className="h-8 w-20 rounded border border-slate-300 bg-white px-2 text-right text-sm font-bold text-slate-700"
                  onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= 10) setCompassRadius(value); }} />
                <button
                  type="button"
                  onClick={() => setShowCompassCenter((value) => !value)}
                  className={cn("flex h-7 items-center gap-1 rounded-[1px] border px-2 text-xs font-semibold", showCompassCenter ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 text-slate-600")}
                  title={showCompassCenter ? "কেন্দ্রচিহ্ন বন্ধ করুন" : "কেন্দ্রচিহ্ন দেখান"}
                >
                  {showCompassCenter ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  কেন্দ্র
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setCalculatorOpen((value) => !value)}
              className={cn("flex h-9 md:h-10 items-center gap-1.5 rounded-[1px] border px-3 text-sm font-semibold", calculatorOpen ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-300 text-slate-700 hover:bg-slate-50")}
              title="সায়েন্টিফিক ক্যালকুলেটর"
            >
              <Calculator className="h-4 w-4" />
              <span className="hidden xl:inline">ক্যালকুলেটর</span>
            </button>
            {/* Quick 1-click popular color dots */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-[1px] border border-slate-300">
              {QUICK_COLORS.map((qc) => (
                <button
                  key={qc.hex}
                  type="button"
                  onClick={() => setStyle((prev) => ({ ...prev, color: qc.hex }))}
                  className={cn(
                    "w-6 h-6 rounded-[1px] transition-transform border border-slate-300 flex items-center justify-center cursor-pointer",
                    style.color.toLowerCase() === qc.hex.toLowerCase() && "ring-2 ring-[#0A1E38]"
                  )}
                  style={{ backgroundColor: qc.hex }}
                  title={qc.name}
                >
                  {style.color.toLowerCase() === qc.hex.toLowerCase() && (
                    <span className={cn("block w-1.5 h-1.5 rounded-[1px]", qc.hex === "#ffffff" ? "bg-slate-900" : "bg-white")} />
                  )}
                </button>
              ))}
            </div>

            {/* Color & Brush Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 md:h-10 items-center gap-2 rounded-[1px] border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  title="রঙ ও ব্রাশ"
                >
                  <span className="h-4 w-4 rounded-[1px] border border-slate-300 shadow-xs" style={{ backgroundColor: style.color }} />
                  <Palette className="h-4 w-4 text-slate-600" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-4 shadow-lg rounded-[1px] border-slate-300 bg-white">
                <div>
                  <p className="mb-2 text-sm font-bold text-slate-800">রঙ নির্বাচন করুন</p>
                  <div className="grid grid-cols-5 gap-2">
                    {PEN_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setStyle((prev) => ({ ...prev, color }))}
                        className={cn(
                          "h-8 w-8 rounded-[1px] border transition-transform cursor-pointer",
                          style.color === color ? "border-slate-900 ring-2 ring-slate-900 shadow-xs" : "border-slate-300"
                        )}
                        style={{ backgroundColor: color }}
                        title={color}
                      >
                        {style.color === color ? <Check className="mx-auto h-4 w-4 text-white drop-shadow" /> : null}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-bold text-slate-800">ব্রাশ সাইজ (Stroke Width)</p>
                  <div className="flex items-center gap-1.5">
                    {STROKE_WIDTHS.map((width) => (
                      <button
                        key={width}
                        type="button"
                        onClick={() => setStyle((prev) => ({ ...prev, strokeWidth: width }))}
                        className={cn(
                          "flex h-9 flex-1 items-center justify-center rounded-[1px] border text-xs cursor-pointer",
                          style.strokeWidth === width ? "border-emerald-600 bg-emerald-50 font-bold text-emerald-800" : "border-slate-300 hover:bg-slate-50"
                        )}
                        title={`${width}px`}
                      >
                        <span
                          className="rounded-[1px] bg-slate-900"
                          style={{ width: Math.min(width, 16), height: Math.min(width, 16) }}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-bold text-slate-800">
                    অপাসিটি ({toBanglaNum(Math.round(style.opacity * 100))}%)
                  </p>
                  <Slider
                    value={[Math.round(style.opacity * 100)]}
                    min={20}
                    max={100}
                    step={5}
                    onValueChange={([value]) => setStyle((prev) => ({ ...prev, opacity: value / 100 }))}
                  />
                </div>

                <div>
                  <p className="mb-2 text-sm font-bold text-slate-800">লেখার সাইজ (Font Size)</p>
                  <div className="flex items-center gap-2">
                    {[26, 34, 44, 56].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setStyle((prev) => ({ ...prev, fontSize: size }))}
                        className={cn(
                          "h-9 flex-1 rounded-[1px] border text-sm font-bold cursor-pointer",
                          style.fontSize === size ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 text-slate-700"
                        )}
                      >
                        {toBanglaNum(size)}
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Board Background Selector */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 md:h-10 items-center gap-2 rounded-[1px] border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  title="বোর্ড ব্যাকগ্রাউন্ড"
                >
                  <span
                    className="h-4 w-4 rounded-[1px] border border-slate-300 shadow-xs"
                    style={{ ...background.style, backgroundColor: background.style.backgroundColor || "#ffffff" }}
                  />
                  <span className="hidden md:inline">{background.label}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 shadow-lg rounded-[1px] border-slate-300 bg-white">
                <p className="mb-3 text-sm font-bold text-slate-800">বোর্ড ব্যাকগ্রাউন্ড</p>
                <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1">
                  {BOARD_BACKGROUNDS.map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => handleSelectBackground(bg.id)}
                      className={cn(
                        "rounded-[1px] border p-2 text-left text-xs font-medium transition-colors cursor-pointer",
                        backgroundId === bg.id ? "border-emerald-600 ring-2 ring-emerald-600/30 font-bold text-emerald-800" : "border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <span className="mb-1.5 block h-10 w-full rounded-[1px] border border-slate-300" style={bg.style} />
                      <span className="block truncate text-slate-700">{bg.label}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 rounded-[1px] border border-slate-300 px-1.5 py-0.5 bg-white">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-[1px] hover:bg-slate-100 text-slate-700 cursor-pointer"
                onClick={() => setZoom((value) => Math.max(MIN_ZOOM, Number((value - 0.1).toFixed(2))))}
                title="জুম কম (-)"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="min-w-[54px] text-center text-sm font-bold text-slate-800">
                {toBanglaNum(Math.round(zoom * fitScale * 100))}%
              </span>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-[1px] hover:bg-slate-100 text-slate-700 cursor-pointer"
                onClick={() => setZoom((value) => Math.min(MAX_ZOOM, Number((value + 0.1).toFixed(2))))}
                title="জুম বেশি (+)"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Helper Tips at the Bottom */}
      <div className="flex flex-wrap items-center justify-between text-sm text-slate-600 px-2 py-1">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>শর্টকাট: কিবোর্ডের F চাপলে ফুলস্ক্রিন, Space/Arrow দিয়ে প্রশ্ন পরিবর্তন, Ctrl+Z দিয়ে আনডু করা যায়।</span>
        </div>
        <div>
          <span className="font-medium">ক্লাসরুম ও প্রজেক্টরের জন্য অপ্টিমাইজড</span>
        </div>
      </div>

      {/* Load Paper Dialog */}
      <LoadPaperDialog open={loadOpen} onOpenChange={setLoadOpen} onLoad={handleLoadPaper} />
    </div>
    </PortalContainerProvider>
  );
}
