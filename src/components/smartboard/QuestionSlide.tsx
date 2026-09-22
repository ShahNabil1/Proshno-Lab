import LatexRenderer from "@/components/LatexRenderer";
import { answerLabelBangla, isCorrectOption } from "@/lib/answerKey";

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
}

interface QuestionSlideProps {
  question: SmartBoardQuestion;
  number: number;
  meta: SmartBoardPaperMeta | null;
  showAnswer: boolean;
  dark: boolean;
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

export default function QuestionSlide({ question, number, meta, showAnswer, dark }: QuestionSlideProps) {
  const muted = dark ? "text-slate-300" : "text-slate-500";
  const strong = dark ? "text-white" : "text-slate-900";
  const optionLabels = question.type === "mcq" ? BANGLA_OPTION_LABELS : [];
  const options = [question.option_a, question.option_b, question.option_c, question.option_d];
  const typeLabel = TYPE_LABELS[question.type] || question.type;
  const creative = question.creative_data || null;
  const answerAvailable = hasAnswer(question);

  return (
    <div className="flex h-full w-full flex-col px-[70px] py-[46px]">
      <div className={`flex items-center justify-between border-b pb-3 ${dark ? "border-white/20" : "border-slate-200"}`}>
        <div className={`font-semibold ${muted}`} style={{ fontSize: 26 }}>
          {meta?.instituteName || "প্রশ্নল্যাব"}
        </div>
        <div className={`flex items-center gap-3 font-medium ${muted}`} style={{ fontSize: 26 }}>
          {meta?.className ? <span>{meta.className}</span> : null}
          {meta?.subjectName ? <span>{meta.subjectName}</span> : null}
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
          className="rounded-[1px] border px-4 py-1 font-semibold"
          style={{
            fontSize: 22,
            borderColor: dark ? "rgba(255,255,255,0.35)" : "#cbd5e1",
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

      <div className={`mt-7 flex-1 overflow-hidden ${strong}`}>
        {question.stimulus_text ? (
          <div
            className="mb-5 rounded-[1px] border-l-4 px-5 py-4"
            style={{
              fontSize: 30,
              borderColor: dark ? "#38bdf8" : "#0284c7",
              backgroundColor: dark ? "rgba(56,189,248,0.12)" : "rgba(2,132,199,0.06)",
            }}
          >
            <LatexRenderer text={question.stimulus_text} />
          </div>
        ) : null}

        {question.type === "mcq" ? (
          <div>
            <div style={{ fontSize: 36, lineHeight: 1.5 }}>
              <LatexRenderer text={question.question || ""} />
            </div>
            <div className="mt-7 space-y-5">
              {options.map((option, index) => {
                const correct = showAnswer && isCorrectOption(question.correct_answer, index, options);
                return (
                  <div
                    key={index}
                    className="flex items-start gap-4 rounded-[1px] border px-5 py-4"
                    style={{
                      fontSize: 32,
                      lineHeight: 1.35,
                      borderColor: correct ? "#059669" : dark ? "rgba(255,255,255,0.18)" : "#cbd5e1",
                      backgroundColor: correct
                        ? dark
                          ? "rgba(5,150,105,0.25)"
                          : "rgba(5,150,105,0.10)"
                        : "transparent",
                    }}
                  >
                    <span
                      className="shrink-0 font-semibold"
                      style={{ color: correct ? "#16a34a" : dark ? "#cbd5e1" : "#334155" }}
                    >
                      {optionLabels[index]}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <LatexRenderer text={option || ""} />
                    </div>
                    {correct ? (
                      <span className="shrink-0 font-semibold" style={{ color: "#16a34a", fontSize: 26 }}>
                        ✓
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {question.type === "cq" ? (
          <div>
            <div style={{ fontSize: 36, lineHeight: 1.5 }}>
              <LatexRenderer text={creative?.stem || question.question || ""} />
            </div>
            <div className="mt-6 space-y-4">
              {(creative?.sub_questions || []).map((sub: any, index: number) => (
                <div key={index} className="flex items-start gap-3" style={{ fontSize: 32, lineHeight: 1.4 }}>
                  <span className="shrink-0 font-semibold">{["ক", "খ", "গ", "ঘ"][index] || ""})</span>
                  <div className="min-w-0 flex-1">
                    <LatexRenderer text={sub?.question || sub?.text || ""} />
                  </div>
                </div>
              ))}
              {(!creative?.sub_questions || creative.sub_questions.length === 0) &&
                ["q_ka", "q_kha", "q_ga", "q_gha"].map((key, index) =>
                  creative?.[key] ? (
                    <div key={key} className="flex items-start gap-3" style={{ fontSize: 32, lineHeight: 1.4 }}>
                      <span className="shrink-0 font-semibold">{["ক", "খ", "গ", "ঘ"][index]})</span>
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
            <div style={{ fontSize: 36, lineHeight: 1.5 }}>
              <LatexRenderer text={question.question || creative?.stem || ""} />
            </div>
            <div className="mt-6 space-y-4">
              {creative?.desc_q_ka ? (
                <div className="flex items-start gap-3" style={{ fontSize: 32, lineHeight: 1.4 }}>
                  <span className="shrink-0 font-semibold">ক)</span>
                  <div className="min-w-0 flex-1">
                    <LatexRenderer text={creative.desc_q_ka} />
                  </div>
                </div>
              ) : null}
              {creative?.desc_q_kha ? (
                <div className="flex items-start gap-3" style={{ fontSize: 32, lineHeight: 1.4 }}>
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
          <div style={{ fontSize: 36, lineHeight: 1.5 }}>
            <LatexRenderer text={question.question || ""} />
          </div>
        ) : null}

        {!["mcq", "cq", "descriptive", "short"].includes(question.type) ? (
          <div style={{ fontSize: 36, lineHeight: 1.5 }}>
            <LatexRenderer text={question.question || ""} />
          </div>
        ) : null}
      </div>

      {showAnswer ? (
        <div
          className="mt-6 rounded-[1px] border px-5 py-4"
          style={{
            borderColor: "#059669",
            backgroundColor: dark ? "rgba(5,150,105,0.20)" : "rgba(5,150,105,0.08)",
            maxHeight: 640,
            overflow: "hidden",
          }}
        >
          <div className="mb-2 font-bold" style={{ color: "#047857", fontSize: 28 }}>
            উত্তর
          </div>
          <div style={{ fontSize: 28, lineHeight: 1.45 }} className={dark ? "text-white" : "text-slate-900"}>
            {question.type === "mcq" ? (
              answerAvailable ? (
                <div>
                  <div className="mb-2">
                    <span className="font-semibold">সঠিক উত্তর: </span>
                    <span className="font-semibold" style={{ color: "#15803d" }}>
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
              <AnswerByType question={question} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AnswerByType({ question }: { question: SmartBoardQuestion }) {
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
    <div className="space-y-2">
      {blocks.map((block, index) => (
        <div key={index}>
          {block.label ? <span className="font-semibold">{block.label}</span> : null}
          <AnswerBody text={block.text} />
        </div>
      ))}
    </div>
  );
}
