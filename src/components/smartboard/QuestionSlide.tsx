import LatexRenderer from "@/components/LatexRenderer";
import { answerLabelBangla, isCorrectOption } from "@/lib/answerKey";
import logoImg from "@/assets/logo.png";
import type { CSSProperties } from "react";

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
  question: SmartBoardQuestion;
  number: number;
  meta: SmartBoardPaperMeta | null;
  showAnswer: boolean;
  dark: boolean;
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
  question,
  number,
  meta,
  showAnswer,
  dark,
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
  const muted = dark ? "text-slate-300" : "text-slate-500";
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
  const stackCqAnswer = showAnswer && question.type === "cq";
  const mcqHasImage = /<img\s/i.test(`${question.question || ""} ${question.stimulus_text || ""} ${options.join(" ")}`);
  const mcqUsesLeftColumn = mcqHasImage || Boolean(question.stimulus_text?.trim());
  const mediaScaleStyle = { "--smartboard-media-scale": Math.max(0.55, questionFontSize / 36) } as CSSProperties;
  const mcqOptionCount = options.filter(Boolean).length;
  const mcqContentHeight = Math.max(
    mcqUsesLeftColumn ? 500 * Math.max(0.75, questionFontSize / 36) : 300,
    mcqOptionCount * (optionFontSize * 1.35 + 34) + Math.max(0, mcqOptionCount - 1) * 20 + 24,
  );

  return (
    <div className={`flex h-full w-full flex-col px-[70px] py-[46px] ${stackCqAnswer ? "overflow-y-auto overscroll-contain" : ""}`}>
      <div
        className="grid grid-cols-[1fr_1.25fr_1fr] items-center gap-8 border-b-2 pb-4"
        style={{ borderBottomColor: headerAccentColor }}
      >
        <div
          className="flex min-w-0 items-center gap-3 font-bold"
          style={{ fontSize: institutionFontSize, color: headerInstitutionColor, fontFamily: institutionFontFamily }}
        >
          <img
            src={headerLogoUrl || meta?.instituteLogoUrl || logoImg}
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

      <div className="mt-6 flex items-center gap-4">
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
        {meta?.programName ? (
          <span className={`font-medium ${muted}`} style={{ fontSize: 24 }}>
            {meta.programName}
          </span>
        ) : null}
      </div>

      <div
        data-testid="smartboard-question-panel"
        className={`relative mt-7 ${stackCqAnswer ? "flex-none overflow-visible" : `min-h-0 flex-1 ${question.type === "mcq" || showAnswer ? "overflow-y-auto pr-2" : "overflow-hidden"} ${showAnswer ? "max-h-[55%]" : ""}`} ${strong}`}
        onPointerDown={showAnswer && !stackCqAnswer ? (event) => event.stopPropagation() : undefined}
      >
        {question.stimulus_text && question.type !== "cq" && question.type !== "mcq" ? (
          <div
            className="mb-5 rounded-[1px] border-l-4 px-5 py-4"
            style={{
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
                    className="smartboard-scalable-media mb-4 bg-transparent p-0 shadow-none"
                    style={mediaScaleStyle}
                  >
                    <LatexRenderer text={question.stimulus_text} />
                  </div>
                ) : null}
                <LatexRenderer text={question.question || ""} />
              </div>
              {references.length > 0 ? (
                <span
                  className="shrink-0"
                  style={{
                    padding: referenceStyle === "bracket" || referenceStyle === "underline" ? "0 2px" : "2px 8px",
                    border: referenceStyle === "outline" ? `1px solid ${referenceColor}` : undefined,
                    borderBottom: referenceStyle === "underline" ? `2px solid ${referenceColor}` : undefined,
                    borderRadius: ["filled", "black", "outline"].includes(referenceStyle) ? 3 : undefined,
                    background: referenceStyle === "filled" ? referenceColor : referenceStyle === "black" ? "#000000" : "transparent",
                    color: referenceStyle === "black" ? "#ffffff" : referenceTextColor,
                    fontFamily: referenceFontFamily,
                    fontSize: referenceFontSize,
                    fontWeight: referenceBold ? 700 : 400,
                    fontStyle: referenceItalic ? "italic" : "normal",
                  }}
                >
                  {referenceStyle === "bracket" ? `[${references.join(" • ")}]` : references.join(" • ")}
                </span>
              ) : null}
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
            <div style={{ fontSize: questionFontSize, lineHeight: 1.5, fontFamily: questionFontFamily }}>
              <LatexRenderer text={creative?.stem || question.stimulus_text || question.question || ""} />
            </div>
            <div
              className="mt-6 space-y-4 border-l-2 pl-4"
              style={{ borderColor: dark ? "rgba(255,255,255,0.28)" : "rgba(15,23,42,0.20)" }}
            >
              {(creative?.sub_questions || []).map((sub: any, index: number) => (
                <div key={index} className="flex items-start gap-3" style={{ fontSize: supportingFontSize, lineHeight: 1.4, fontFamily: questionFontFamily }}>
                  <span className="shrink-0 font-semibold">({["ক", "খ", "গ", "ঘ"][index] || ""})</span>
                  <div className="min-w-0 flex-1">
                    <LatexRenderer text={sub?.question || sub?.text || ""} />
                  </div>
                </div>
              ))}
              {(!creative?.sub_questions || creative.sub_questions.length === 0) &&
                ["q_ka", "q_kha", "q_ga", "q_gha"].map((key, index) =>
                  creative?.[key] ? (
                    <div key={key} className="flex items-start gap-3" style={{ fontSize: supportingFontSize, lineHeight: 1.4, fontFamily: questionFontFamily }}>
                      <span className="shrink-0 font-semibold">({["ক", "খ", "গ", "ঘ"][index]})</span>
                      <div className="min-w-0 flex-1">
                        <LatexRenderer text={creative[key]} />
                      </div>
                    </div>
                  ) : null,
                )}
            </div>
          </div>
        ) : null}

        {question.type === "descriptive" ? (
          <div>
            <div style={{ fontSize: questionFontSize, lineHeight: 1.5, fontFamily: questionFontFamily }}>
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
          className={`mx-2 ${question.type === "mcq" ? "mt-10" : "mt-5"} box-border rounded-[1px] ${question.type === "cq" || question.type === "mcq" ? "border-0 p-0" : "border px-5 py-4"} ${stackCqAnswer ? "flex-none overflow-visible" : question.type === "mcq" ? "max-h-[45%] flex-none overflow-y-auto overscroll-contain" : "min-h-0 flex-1 overflow-y-auto overscroll-contain"}`}
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
