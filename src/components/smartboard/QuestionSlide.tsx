import type { SlideParts } from "./boardHistory";
import LatexRenderer from "@/components/LatexRenderer";
import { answerLabelBangla, isCorrectOption } from "@/lib/answerKey";
import { brandMarkUrl } from "@/lib/brandAssets";
import { useState, useRef, type CSSProperties, type ReactNode } from "react";

export interface SmartBoardQuestion {
  id: number;
  question: string;
  type: string;
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  correct_answer?: string | null;
  explanation?: string | null;
  creative_data?: any;
  stimulus_text?: string | null;
  board_references?: any[] | null;
  university_references?: any[] | null;
}

export interface SmartBoardPaperMeta {
  instituteName?: string;
  className?: string;
  subjectName?: string;
  programName?: string;
  chapterNames?: string[];
  teacherName?: string;
  instituteLogoUrl?: string;
}

interface QuestionSlideProps {
  headerOnly?: boolean;
  hideHeader?: boolean;
  selectedPartIds?: string[];
  parts?: SlideParts;
  onPartsChange?: (parts: SlideParts) => void;
  dragEnabled?: boolean;
  boardScale?: number;
  contentScale?: number;
  contentOffset?: { x: number; y: number };
  question: SmartBoardQuestion;
  number: number;
  meta: SmartBoardPaperMeta | null;
  showAnswer: boolean;
  dark: boolean;
  questionTextColor?: string;
  stimulusTextColor?: string;
  questionFontSize?: number;
  questionFontFamily?: string;
  showBoardReferences?: boolean;
  showInstitutionReferences?: boolean;
  headerAccentColor?: string;
  headerInstitutionColor?: string;
  headerLogoUrl?: string;
  institutionFontFamily?: string;
  institutionFontSize?: number;
  chapterFontFamily?: string;
  chapterFontSize?: number;
  chapterTextColor?: string;
  courseFontFamily?: string;
  courseFontSize?: number;
  courseColor?: string;
  institutionText?: string;
  chapterText?: string;
  courseText?: string;
  referenceStyle?: "filled" | "black" | "outline" | "bracket" | "underline";
  referenceColor?: string;
  referenceTextColor?: string;
  referenceFontFamily?: string;
  referenceFontSize?: number;
  referenceBold?: boolean;
  referenceItalic?: boolean;
  mcqOptionBorderColor?: string;
  mcqOptionTextColor?: string;
  mcqCorrectColor?: string;
  mcqAnswerBackgroundColor?: string;
  mcqAnswerBorderColor?: string;
  mcqAnswerBorderStyle?: "solid" | "dashed" | "double" | "none";
}

const STEP_MARKERS = /(?:বা,|অর্থাৎ,|সুতরাং,|অতএব,|এখানে,|আবার,|∴|⇒)/;
const BANGLA_OPTION_LABELS = ["ক", "খ", "গ", "ঘ"];
const TYPE_LABELS: Record<string, string> = {
  mcq: "বহুনির্বাচনী",
  short: "সংক্ষিপ্ত",
  cq: "সৃজনশীল",
  descriptive: "বর্ণনামূলক",
};

/** Plain-text answers coming from bulk uploads are split into readable lines. */
function formatAnswerContent(raw: string): string {
  if (!raw) return "";
  if (/<(p|br|div|ul|ol|li|table|img|h[1-6])\b/i.test(raw)) return raw;

  let text = raw.replace(/\r\n/g, "\n").trim();
  if (!text.includes("\n")) {
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g);
    text = parts
      .map((segment, index) =>
        index % 2 === 1 ? segment : segment.replace(new RegExp(`\\s*(${STEP_MARKERS.source})`, "g"), "\n$1"),
      )
      .join("");
  }

  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join("");
}

function AnswerBody({ text }: { text: string }) {
  return <LatexRenderer text={formatAnswerContent(text)} />;
}

function hasAnswer(question: SmartBoardQuestion): boolean {
  if (question.type === "mcq") return Boolean(question.correct_answer);
  if (question.explanation && question.explanation.trim()) return true;
  const data = question.creative_data;
  if (!data) return false;
  return Boolean(
    data.ans_ka || data.ans_kha || data.ans_ga || data.ans_gha || data.desc_ans_ka || data.desc_ans_kha,
  );
}

function formatReferenceList(references: any[] | null | undefined, kind: "board" | "institution"): string[] {
  if (!Array.isArray(references)) return [];
  return references.map((reference) => {
    const name = kind === "board"
      ? reference?.board || reference?.name
      : reference?.name || reference?.university || reference?.school;
    if (!name) return "";
    return reference?.year ? `${name} '${reference.year}` : String(name);
  }).filter(Boolean);
}

export default function QuestionSlide({
  headerOnly = false,
  hideHeader = false,
  selectedPartIds,
  parts: controlledParts,
  onPartsChange,
  dragEnabled = false,
  boardScale = 1,
  contentScale = 1,
  contentOffset = { x: 0, y: 0 },
  question,
  number,
  meta,
  showAnswer,
  dark,
  questionTextColor,
  stimulusTextColor,
  questionFontSize = 36,
  questionFontFamily = "inherit",
  showBoardReferences = true,
  showInstitutionReferences = true,
  headerAccentColor = "#ec168c",
  headerInstitutionColor = "#22c55e",
  headerLogoUrl,
  institutionFontFamily = "inherit",
  institutionFontSize = 26,
  chapterFontFamily = "inherit",
  chapterFontSize = 24,
  chapterTextColor = "#ffffff",
  courseFontFamily = "inherit",
  courseFontSize = 26,
  courseColor = "#ec168c",
  institutionText,
  chapterText,
  courseText,
  referenceStyle = "outline",
  referenceColor = "#64748b",
  referenceTextColor = "#475569",
  referenceFontFamily = "inherit",
  referenceFontSize = 20,
  referenceBold = true,
  referenceItalic = false,
  mcqOptionBorderColor = "#cbd5e1",
  mcqOptionTextColor = "#334155",
  mcqCorrectColor = "#059669",
  mcqAnswerBackgroundColor = "#ffffff",
  mcqAnswerBorderColor = "#777777",
  mcqAnswerBorderStyle = "solid",
}: QuestionSlideProps) {
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [groupDrag, setGroupDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [localParts, setLocalParts] = useState<SlideParts>({});
  const parts = controlledParts ?? localParts;
  const changeParts = (next: SlideParts) => {
    const movedId = selectedPartIds?.find(id => {
      const before = parts[id] || { x: 0, y: 0 };
      const after = next[id];
      return after && (after.x !== before.x || after.y !== before.y);
    });
    if (movedId && selectedPartIds && selectedPartIds.length > 1) {
      const before = parts[movedId] || { x: 0, y: 0 };
      const dx = next[movedId].x - before.x, dy = next[movedId].y - before.y;
      next = { ...next };
      for (const id of selectedPartIds) {
        if (id === movedId) continue;
        const original = parts[id] || { x: 0, y: 0 };
        next[id] = { ...original, x: original.x + dx, y: original.y + dy };
      }
    }
    (onPartsChange ?? setLocalParts)(next);
  };
  const movable = (part: string, children: ReactNode) => {
    const id = `${question.id}:${part}`;
    return <MovablePart key={id} id={id}
      previewOffset={groupDrag && groupDrag.id !== id && selectedPartIds?.includes(id) ? groupDrag : undefined}
      onDragPreview={delta => setGroupDrag(delta ? { id, ...delta } : null)} selectedId={selectedPartIds?.includes(id) ? id : selectedPartIds ? null : selectedPart} onSelect={setSelectedPart} enabled={dragEnabled && (!selectedPartIds || selectedPartIds.includes(id))} scale={boardScale} parts={parts} onChange={changeParts}>{children}</MovablePart>;
  };
  const muted = dark ? "text-slate-300" : "text-slate-500";
  const questionColor = questionTextColor || (dark ? "#f1f5f9" : "#0f172a");
  const stimulusColor = stimulusTextColor || (dark ? "#fde047" : "#92400e");
  const strong = dark ? "text-white" : "text-slate-900";
  const optionLabels = question.type === "mcq" ? BANGLA_OPTION_LABELS : [];
  const options = [question.option_a, question.option_b, question.option_c, question.option_d];
  const typeLabel = TYPE_LABELS[question.type] || question.type;
  const creative = question.creative_data || null;
  const answerAvailable = hasAnswer(question);
  const boardReferences = showBoardReferences ? formatReferenceList(question.board_references, "board") : [];
  const institutionReferences = showInstitutionReferences
    ? formatReferenceList(question.university_references, "institution")
    : [];
  // The smartboard font control represents the complete question content,
  // including choices, sub-questions and the revealed answer.
  const optionFontSize = questionFontSize;
  const supportingFontSize = Math.max(16, Math.round(questionFontSize * 0.88));
  const answerFontSize = Math.max(16, Math.round(questionFontSize * 0.88));
  const references = [...boardReferences, ...institutionReferences];
  const referenceBadge = references.length > 0 ? (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-2" aria-label="প্রশ্নের রেফারেন্স">
      {references.map((reference, index) => <span key={`${reference}-${index}`}
        className="inline-flex max-w-full items-center whitespace-normal break-words"
        style={{
          boxSizing: "border-box", lineHeight: 1.5,
          padding: referenceStyle === "bracket" || referenceStyle === "underline" ? "2px 4px" : "5px 12px",
          border: ["outline", "filled", "black"].includes(referenceStyle)
            ? `2px solid ${referenceStyle === "black" ? "#000000" : referenceColor}` : undefined,
          borderBottom: referenceStyle === "underline" ? `2px solid ${referenceColor}`
            : ["outline", "filled", "black"].includes(referenceStyle)
              ? `2px solid ${referenceStyle === "black" ? "#000000" : referenceColor}` : undefined,
          borderRadius: ["filled", "black", "outline"].includes(referenceStyle) ? 6 : undefined,
          background: referenceStyle === "filled" ? referenceColor : referenceStyle === "black" ? "#000000"
            : referenceStyle === "outline" ? (dark ? "#1e293b" : "#f8fafc") : "transparent",
          color: referenceStyle === "black" ? "#ffffff" : referenceTextColor,
          fontFamily: referenceFontFamily, fontSize: referenceFontSize,
          fontWeight: referenceBold ? 700 : 400, fontStyle: referenceItalic ? "italic" : "normal",
        }}>
        {referenceStyle === "bracket" ? `[${reference}]` : reference}
      </span>)}
    </span>
  ) : null;
  const sideCq = question.type === "cq";
  const mcqHasImage = /<img\s/i.test(`${question.question || ""} ${question.stimulus_text || ""} ${options.join(" ")}`);
  const mcqUsesLeftColumn = mcqHasImage || Boolean(question.stimulus_text?.trim());
  const mediaScaleStyle = { "--smartboard-media-scale": Math.max(0.55, questionFontSize / 36) } as CSSProperties;
  const mcqOptionCount = options.filter(Boolean).length;
  const mcqContentHeight = Math.max(
    mcqUsesLeftColumn ? 500 * Math.max(0.75, questionFontSize / 36) : 300,
    mcqOptionCount * (optionFontSize * 1.35 + 34) + Math.max(0, mcqOptionCount - 1) * 20 + 24,
  );

  return (
    <div className={`flex h-full w-full flex-col px-[70px] py-[46px] `}>
      <div
        data-testid="smartboard-fixed-header"
        className="pointer-events-none grid shrink-0 grid-cols-[1fr_1.25fr_1fr] items-center gap-8 border-b-2 pb-4"
        style={{ borderBottomColor: headerAccentColor, visibility: hideHeader ? "hidden" : undefined }}
      >
        <div
          className="flex min-w-0 items-center gap-3 font-bold"
          style={{ fontSize: institutionFontSize, color: headerInstitutionColor, fontFamily: institutionFontFamily }}
        >
          <img
            src={headerLogoUrl || meta?.instituteLogoUrl || brandMarkUrl}
            alt="প্রতিষ্ঠানের লোগো"
            className="h-12 w-12 shrink-0 object-contain"
          />
          <span className="truncate">{institutionText || meta?.instituteName || "প্রশ্নল্যাব"}</span>
        </div>
        <div
          className="truncate rounded-lg px-5 py-2 text-center font-bold text-white"
          style={{
            fontSize: chapterFontSize,
            backgroundColor: headerAccentColor,
            color: chapterTextColor,
            fontFamily: chapterFontFamily,
          }}
        >
          {chapterText || meta?.chapterNames?.join(", ") || "অধ্যায়"}
        </div>
        <div
          className="flex min-w-0 items-center justify-end gap-2 truncate text-right font-bold"
          style={{ fontSize: courseFontSize, color: courseColor, fontFamily: courseFontFamily }}
        >
          {courseText ? <span className="truncate">{courseText}</span> : meta?.programName ? <span className="truncate">{meta.programName}</span> : (
            <>
              {meta?.className ? <span>{meta.className}</span> : null}
              {meta?.className && meta?.subjectName ? <span aria-hidden="true">•</span> : null}
              {meta?.subjectName ? <span>{meta.subjectName}</span> : null}
              {!meta?.className && !meta?.subjectName ? <span>কোর্স</span> : null}
            </>
          )}
        </div>
      </div>

      <div data-testid="smartboard-question-content" style={{ display: headerOnly ? "none" : undefined, transform: `translate(${contentOffset.x}px, ${contentOffset.y}px) scale(${sideCq ? contentScale : 1})`, transformOrigin: "top right" }} className={sideCq ? "grid min-h-0 flex-1 grid-cols-[minmax(0,3fr)_minmax(0,2fr)] grid-rows-[auto_minmax(0,1fr)] gap-x-10" : "flex min-h-0 flex-1 flex-col"}>
      <div className={sideCq ? "col-start-2 row-start-1" : undefined}>
        {sideCq ? movable("question-label", (
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <span
          className="inline-flex items-center justify-center rounded-[1px]"
          style={{
            width: 58,
            height: 58,
            fontSize: 32,
            fontWeight: 700,
            backgroundColor: dark ? "#1e293b" : "#0A1E38",
            color: "#ffffff",
          }}
        >
          {number}
        </span>
        <span
          className="rounded-[1px] bg-slate-100/70 px-4 py-1 font-semibold dark:bg-slate-800/70"
          style={{
            fontSize: 22,
            color: dark ? "#e2e8f0" : "#334155",
          }}
        >
          {typeLabel}
        </span>
        {question.type !== "mcq" && referenceBadge}
        {meta?.programName ? (
          <span className={`font-medium ${muted}`} style={{ fontSize: 24 }}>
            {meta.programName}
          </span>
        ) : null}
      </div>

        )) : (
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <span
          className="inline-flex items-center justify-center rounded-[1px]"
          style={{
            width: 58,
            height: 58,
            fontSize: 32,
            fontWeight: 700,
            backgroundColor: dark ? "#1e293b" : "#0A1E38",
            color: "#ffffff",
          }}
        >
          {number}
        </span>
        <span
          className="rounded-[1px] bg-slate-100/70 px-4 py-1 font-semibold dark:bg-slate-800/70"
          style={{
            fontSize: 22,
            color: dark ? "#e2e8f0" : "#334155",
          }}
        >
          {typeLabel}
        </span>
        {question.type !== "mcq" && referenceBadge}
        {meta?.programName ? (
          <span className={`font-medium ${muted}`} style={{ fontSize: 24 }}>
            {meta.programName}
          </span>
        ) : null}
      </div>

        )}
      </div>

      <div
        data-testid="smartboard-question-panel"
        style={{ color: questionColor }}
        className={`relative mt-7 ${sideCq ? "col-start-2 row-start-2 min-h-0 overflow-visible pr-2" : `min-h-0 flex-1 ${question.type === "mcq" || showAnswer ? "overflow-y-auto pr-2" : "overflow-hidden"} ${showAnswer ? "max-h-[55%]" : ""}`} ${strong}`}
        onPointerDown={showAnswer || sideCq ? (event) => event.stopPropagation() : undefined}
      >
        {question.stimulus_text && question.type !== "cq" && question.type !== "mcq" ? (
          <div
            className="smartboard-stimulus mb-5 rounded-[1px] border-l-4 px-5 py-4"
            style={{
              color: stimulusColor,
              fontSize: supportingFontSize,
              fontFamily: questionFontFamily,
              borderColor: dark ? "#38bdf8" : "#0284c7",
              backgroundColor: dark ? "rgba(56,189,248,0.12)" : "rgba(2,132,199,0.06)",
            }}
          >
            <LatexRenderer text={question.stimulus_text} />
          </div>
        ) : null}

        {question.type === "mcq" ? (
          <div className="relative w-full" style={{ minHeight: mcqContentHeight }}>
            <div
              className={`absolute left-1 top-0 flex items-start gap-3 ${mcqUsesLeftColumn ? "h-full w-[57%] overflow-y-auto whitespace-normal pr-4" : "w-[calc(100%_-_8px)] overflow-hidden whitespace-nowrap"}`}
              style={{ fontSize: questionFontSize, lineHeight: 1.5, fontFamily: questionFontFamily }}
            >
              <div className={`smartboard-scalable-media min-w-0 shrink [&_img]:mx-auto [&_img]:my-4 [&_img]:max-h-[420px] [&_img]:max-w-full [&_img]:object-contain ${mcqUsesLeftColumn ? "whitespace-normal" : "overflow-hidden whitespace-nowrap"}`} style={mediaScaleStyle}>
                {question.stimulus_text ? (
                  <div
                    className="smartboard-stimulus smartboard-scalable-media mb-4 bg-transparent p-0 shadow-none"
                    style={{ ...mediaScaleStyle, color: stimulusColor }}
                  >
                    <LatexRenderer text={question.stimulus_text} />
                  </div>
                ) : null}
                <LatexRenderer text={question.question || ""} />
              </div>
              {referenceBadge}
            </div>
            <div className="absolute right-2 top-[22%] w-[calc(39%_-_8px)] space-y-5 pl-px">
              {options.map((option, index) => {
                if (!option) return null;
                const correct = showAnswer && isCorrectOption(question.correct_answer, index, options);
                return (
                  <div
                    key={index}
                    className="box-border flex items-start gap-4 rounded-[1px] border px-5 py-4"
                    style={{
                      fontSize: optionFontSize,
                      fontFamily: questionFontFamily,
                      lineHeight: 1.35,
                      color: correct ? mcqCorrectColor : dark ? "#cbd5e1" : mcqOptionTextColor,
                      borderColor: correct ? mcqCorrectColor : dark ? "rgba(255,255,255,0.18)" : mcqOptionBorderColor,
                      borderStyle: "solid",
                      borderWidth: 1,
                      backgroundColor: correct ? `${mcqCorrectColor}1a` : "transparent",
                    }}
                  >
                    <span className="shrink-0 font-semibold">
                      {optionLabels[index]}.
                    </span>
                    <div className="smartboard-scalable-media min-w-0 flex-1" style={mediaScaleStyle}>
                      <LatexRenderer text={option || ""} />
                    </div>
                    {correct ? <span className="shrink-0 font-semibold" style={{ color: mcqCorrectColor, fontSize: supportingFontSize }}>✓</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {question.type === "cq" ? (
          <div>
            {movable("stimulus", <div className="smartboard-stimulus" style={{ color: stimulusColor, fontSize: questionFontSize, lineHeight: 1.5, fontFamily: questionFontFamily }}>
              <LatexRenderer text={creative?.stem || question.stimulus_text || question.question || ""} />
            </div>)}
            <div
              className="mt-6 space-y-4"
            >
              {(creative?.sub_questions || []).map((sub: any, index: number) => (
                <div key={index}>{movable(`sub-${index}`, <div className="flex items-start gap-3" style={{ fontSize: supportingFontSize, lineHeight: 1.4, fontFamily: questionFontFamily }}>
                  <span className="shrink-0 font-semibold">({["ক", "খ", "গ", "ঘ"][index] || ""})</span>
                  <div className="min-w-0 flex-1">
                    <LatexRenderer text={sub?.question || sub?.text || ""} />
                  </div>
                </div>)}</div>
              ))}
              {(!creative?.sub_questions || creative.sub_questions.length === 0) &&
                ["q_ka", "q_kha", "q_ga", "q_gha"].map((key, index) =>
                  creative?.[key] ? (
                    <div key={key}>{movable(key, <div className="flex items-start gap-3" style={{ fontSize: supportingFontSize, lineHeight: 1.4, fontFamily: questionFontFamily }}>
                      <span className="shrink-0 font-semibold">({["ক", "খ", "গ", "ঘ"][index]})</span>
                      <div className="min-w-0 flex-1">
                        <LatexRenderer text={creative[key]} />
                      </div>
                    </div>)}</div>
                  ) : null,
                )}
            </div>
          </div>
        ) : null}

        {question.type === "descriptive" ? (
          <div>
            <div className="smartboard-stimulus" style={{ color: stimulusColor, fontSize: questionFontSize, lineHeight: 1.5, fontFamily: questionFontFamily }}>
              <LatexRenderer text={question.question || creative?.stem || ""} />
            </div>
            <div className="mt-6 space-y-4">
              {creative?.desc_q_ka ? (
                <div className="flex items-start gap-3" style={{ fontSize: supportingFontSize, lineHeight: 1.4, fontFamily: questionFontFamily }}>
                  <span className="shrink-0 font-semibold">ক)</span>
                  <div className="min-w-0 flex-1">
                    <LatexRenderer text={creative.desc_q_ka} />
                  </div>
                </div>
              ) : null}
              {creative?.desc_q_kha ? (
                <div className="flex items-start gap-3" style={{ fontSize: supportingFontSize, lineHeight: 1.4, fontFamily: questionFontFamily }}>
                  <span className="shrink-0 font-semibold">খ)</span>
                  <div className="min-w-0 flex-1">
                    <LatexRenderer text={creative.desc_q_kha} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {question.type === "short" ? (
          <div style={{ fontSize: questionFontSize, lineHeight: 1.5, fontFamily: questionFontFamily }}>
            <LatexRenderer text={question.question || ""} />
          </div>
        ) : null}

        {!["mcq", "cq", "descriptive", "short"].includes(question.type) ? (
          <div style={{ fontSize: questionFontSize, lineHeight: 1.5, fontFamily: questionFontFamily }}>
            <LatexRenderer text={question.question || ""} />
          </div>
        ) : null}
      </div>

      {showAnswer ? (
        <div
          data-testid="smartboard-answer-panel"
          className={`mx-2 ${question.type === "mcq" ? "mt-10" : "mt-5"} box-border rounded-[1px] ${question.type === "cq" || question.type === "mcq" ? "border-0 p-0" : "border px-5 py-4"} ${sideCq ? "col-start-1 row-start-1 row-span-2 min-h-0 overflow-y-auto overscroll-contain" : question.type === "mcq" ? "max-h-[45%] flex-none overflow-y-auto overscroll-contain" : "min-h-0 flex-1 overflow-y-auto overscroll-contain"}`}
          style={{
            borderColor: question.type === "cq" || question.type === "mcq" ? "transparent" : "#059669",
            backgroundColor: question.type === "cq" || question.type === "mcq" ? "transparent" : dark ? "rgba(5,150,105,0.20)" : "rgba(5,150,105,0.08)",
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div
            className={question.type === "cq" || question.type === "mcq" ? "mb-0 w-full px-4 py-2 font-bold text-white" : "mb-4 border-b border-emerald-500/40 pb-2 font-bold"}
            style={{
              color: question.type === "cq" || question.type === "mcq" ? "#ffffff" : mcqCorrectColor,
              backgroundColor: question.type === "cq" || question.type === "mcq" ? "#050505" : "transparent",
              fontSize: answerFontSize,
              fontFamily: questionFontFamily,
            }}
          >
            উত্তর
          </div>
          <div
            style={{
              fontSize: answerFontSize,
              lineHeight: 1.45,
              fontFamily: questionFontFamily,
              ...(question.type === "mcq" ? {
                borderColor: mcqAnswerBorderColor,
                borderStyle: mcqAnswerBorderStyle,
                borderWidth: mcqAnswerBorderStyle === "none" ? 0 : mcqAnswerBorderStyle === "double" ? 3 : 1,
                backgroundColor: mcqAnswerBackgroundColor,
              } : {}),
            }}
            className={`${dark ? "text-white" : "text-slate-900"} ${question.type === "mcq" ? "box-border px-5 py-4" : ""}`}
          >
            {question.type === "mcq" ? (
              answerAvailable ? (
                <div>
                  <div className="mb-2">
                    <span className="font-semibold">সঠিক উত্তর: </span>
                    <span className="font-semibold" style={{ color: mcqCorrectColor }}>
                      ({answerLabelBangla(question.correct_answer, options)})
                    </span>{" "}
                    <LatexRenderer
                      inline
                      text={
                        options[
                          BANGLA_OPTION_LABELS.indexOf(answerLabelBangla(question.correct_answer, options))
                        ] || ""
                      }
                    />
                  </div>
                  {question.explanation ? (
                    <div>
                      <span className="font-semibold">ব্যাখ্যা: </span>
                      <AnswerBody text={question.explanation} />
                    </div>
                  ) : null}
                </div>
              ) : (
                <em>কোনো সমাধান পাওয়া যায়নি</em>
              )
            ) : (
              <AnswerByType question={question} dark={dark} />
            )}
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}

function AnswerByType({ question, dark }: { question: SmartBoardQuestion; dark: boolean }) {
  const creative = question.creative_data || {};
  const blocks: Array<{ label: string; text: string }> = [];

  if (question.type === "cq") {
    const subs: any[] = creative.sub_questions || [];
    subs.forEach((sub, index) => {
      if (sub?.answer) blocks.push({ label: `${["ক", "খ", "গ", "ঘ"][index] || ""}) `, text: sub.answer });
    });
    if (blocks.length === 0) {
      (["ans_ka", "ans_kha", "ans_ga", "ans_gha"] as const).forEach((key, index) => {
        if (creative[key]) blocks.push({ label: `${["ক", "খ", "গ", "ঘ"][index]}) `, text: creative[key] });
      });
    }
  }

  if (question.type === "descriptive") {
    if (creative.desc_ans_ka) blocks.push({ label: "ক) ", text: creative.desc_ans_ka });
    if (creative.desc_ans_kha) blocks.push({ label: "খ) ", text: creative.desc_ans_kha });
  }

  if (question.type === "short" && question.explanation) {
    blocks.push({ label: "", text: question.explanation });
  }

  if (blocks.length === 0 && question.explanation) {
    blocks.push({ label: "", text: question.explanation });
  }

  if (blocks.length === 0) return <em>কোনো সমাধান পাওয়া যায়নি</em>;

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => (
        <div
          key={index}
          className={`flex items-start gap-3 ${question.type === "cq" ? "border px-4 py-3" : ""}`}
          style={question.type === "cq" ? { borderColor: dark ? "rgba(255,255,255,0.32)" : "#a8a8a8", backgroundColor: "transparent" } : undefined}
        >
          {block.label ? (
            <span
              className={`shrink-0 font-semibold ${question.type === "cq" ? "inline-flex h-[1.5em] w-[1.5em] items-center justify-center text-white" : ""}`}
              style={question.type === "cq" ? { backgroundColor: "#050505" } : undefined}
            >
              {question.type === "cq" ? block.label.replace(")", "").trim() : block.label}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <AnswerBody text={block.text} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MovablePart({ id, previewOffset, onDragPreview, selectedId, onSelect, enabled, scale, parts, onChange, children }: {
  previewOffset?: { x: number; y: number }; onDragPreview?: (delta: { x: number; y: number } | null) => void;
  id: string; selectedId: string | null; onSelect: (id: string) => void; enabled: boolean; scale: number; parts: SlideParts;
  onChange: (parts: SlideParts) => void; children: ReactNode;
}) {
  const position = parts[id] || { x: 0, y: 0 };
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const shown = draft ?? position;
  const textZoom = Math.max(0.25, Math.min(3, position.scale ?? 1));
  const update = (value: typeof position) => onChange({ ...parts, [id]: value });
  return <div className="relative">
    {!position.deleted && <div data-question-part={id} style={{ pointerEvents: enabled ? "auto" : undefined, zoom: textZoom, width: `${100 / textZoom}%`, maxWidth: "none", overflowWrap: "anywhere", transformOrigin: "top left", transform: `translate(${(shown.x + (previewOffset?.x || 0)) / textZoom}px, ${(shown.y + (previewOffset?.y || 0)) / textZoom}px)`, position: 'relative', zIndex: enabled ? 30 : undefined, touchAction: enabled ? 'none' : undefined }}
      className={enabled ? 'cursor-move outline-dashed outline-1 outline-sky-400/40' : undefined}
      onClick={event => { if (enabled) { event.stopPropagation(); onSelect(id); } }}
      onPointerDown={event => {
        if (!enabled || event.button !== 0) return;
        event.preventDefault(); event.stopPropagation();
        onSelect(id);
        drag.current = { x: event.clientX, y: event.clientY, startX: position.x, startY: position.y };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (!drag.current) return;
        event.stopPropagation();
        onDragPreview?.({ x: (event.clientX - drag.current.x) / scale, y: (event.clientY - drag.current.y) / scale });
        setDraft({ x: drag.current.startX + (event.clientX - drag.current.x) / scale,
          y: drag.current.startY + (event.clientY - drag.current.y) / scale });
      }}
      onPointerUp={event => {
        if (!drag.current) return;
        event.stopPropagation();
        const next = { x: drag.current.startX + (event.clientX - drag.current.x) / scale,
          y: drag.current.startY + (event.clientY - drag.current.y) / scale };
        if (next.x !== position.x || next.y !== position.y) update({ ...position, ...next });
        drag.current = null; setDraft(null); onDragPreview?.(null);
      }}
      onPointerCancel={() => { drag.current = null; setDraft(null); onDragPreview?.(null); }}>
      {enabled && selectedId === id && <div className="absolute -top-7 right-0 flex gap-1 text-xs text-white" onPointerDown={event => event.stopPropagation()}>
        <button type="button" aria-label="এই অংশ কপি করুন" className="rounded bg-sky-700 px-2 py-1"
          onClick={event => { event.stopPropagation();
            const copyId = `${id}:copy:${crypto.randomUUID()}`;
            onSelect(copyId);
            onChange({ ...parts, [id]: { ...position, copies: [...(position.copies || []), copyId] },
              [copyId]: { x: position.x - 160, y: position.y + 60 } });
          }}>কপি</button>
        <button type="button" aria-label={id.includes(':copy:') ? 'কপি সরান' : 'এই অংশ ডিলিট করুন'} className="rounded bg-red-700 px-2 py-1"
          onClick={event => { event.stopPropagation(); update({ ...position, deleted: true }); }}>ডিলিট</button>
      </div>}
      {children}
    </div>}
    {(position.copies || []).map(copyId => <div key={copyId} className="absolute left-0 top-0 w-full">
      <MovablePart id={copyId} selectedId={selectedId} onSelect={onSelect} enabled={enabled} scale={scale} parts={parts} onChange={onChange}>{children}</MovablePart>
    </div>)}
  </div>;
}
