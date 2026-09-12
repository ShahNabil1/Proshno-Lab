import React from "react";
import { answerLabelBangla, normalizeAnswerKey } from "@/lib/answerKey";

export interface ChirkutQuestionItem {
  id: number;
  type: string;
  question: string;
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  correct_answer?: string | null;
  explanation?: string | null;
}

export interface ChirkutAnswerSheetProps {
  questions: ChirkutQuestionItem[];
  instituteName?: string;
  subjectName?: string;
  className?: string;
  setCode?: string;
  showSetCode?: boolean;
  isEnglishVersion?: boolean;
  columns?: number;
}

const toBanglaNum = (n: number): string => {
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(n)
    .split("")
    .map((d) => digits[parseInt(d, 10)] ?? d)
    .join("");
};

export default function ChirkutAnswerSheet({
  questions,
  instituteName,
  subjectName,
  className,
  setCode,
  showSetCode = true,
  isEnglishVersion = false,
  columns = 5,
}: ChirkutAnswerSheetProps) {
  const mcqs = questions.filter((q) => q.type === "mcq");
  const shorts = questions.filter((q) => q.type === "short");

  if (mcqs.length === 0 && shorts.length === 0) return null;

  const colCount = Math.max(3, Math.min(columns, 8));

  // Build MCQ key list
  const mcqAnswers = mcqs.map((q, idx) => {
    let ans = "";
    if (isEnglishVersion) {
      const key = normalizeAnswerKey(q.correct_answer, [
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
      ]);
      ans = key ? key.toUpperCase() : "-";
    } else {
      ans =
        answerLabelBangla(q.correct_answer, [
          q.option_a,
          q.option_b,
          q.option_c,
          q.option_d,
        ]) || "-";
    }
    return {
      num: idx + 1,
      ans,
    };
  });

  // Split MCQ answers into balanced columns (sorted column-wise)
  const perCol = Math.ceil(mcqAnswers.length / colCount);
  const columnData: typeof mcqAnswers[] = [];
  for (let c = 0; c < colCount; c++) {
    const start = c * perCol;
    const end = Math.min((c + 1) * perCol, mcqAnswers.length);
    columnData.push(mcqAnswers.slice(start, end));
  }

  const formatNum = (n: number) => (isEnglishVersion ? String(n) : toBanglaNum(n));

  return (
    <div
      className="chirkut-answer-container"
      style={{
        marginTop: "16px",
        marginBottom: "10px",
        pageBreakInside: "avoid",
        breakInside: "avoid",
        fontFamily: isEnglishVersion ? "inherit" : "'SolaimanLipi', 'Kalpurush', sans-serif",
      }}
    >
      {/* Scissor Cut Line */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "6px",
          color: "#4b5563",
          fontSize: "11px",
          fontWeight: 600,
        }}
      >
        <span style={{ fontSize: "14px" }}>✂️</span>
        <div
          style={{
            flex: 1,
            borderBottom: "1.5px dashed #4b5563",
          }}
        />
        <span
          style={{
            backgroundColor: "#f3f4f6",
            padding: "2px 8px",
            borderRadius: "4px",
            border: "1px solid #d1d5db",
            fontSize: "10.5px",
            letterSpacing: "0.2px",
          }}
        >
          {isEnglishVersion
            ? "✂️ CUT HERE — CHIRKUT ANSWER KEY"
            : "✂️ কেটে আলাদা করুন — চিরকুট উত্তরমালা"}
        </span>
        <div
          style={{
            flex: 1,
            borderBottom: "1.5px dashed #4b5563",
          }}
        />
        <span style={{ fontSize: "14px" }}>✂️</span>
      </div>

      {/* Main Chirkut Box */}
      <div
        style={{
          border: "1.5px solid #111827",
          borderRadius: "4px",
          padding: "6px 8px",
          backgroundColor: "#ffffff",
          color: "#111827",
        }}
      >
        {/* Compact Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "4px",
            borderBottom: "1px solid #111827",
            paddingBottom: "4px",
            marginBottom: "6px",
            fontSize: "11px",
          }}
        >
          <div style={{ fontWeight: 700 }}>
            {instituteName ? `${instituteName} • ` : ""}
            <span>{isEnglishVersion ? "ANSWER KEY" : "চিরকুট উত্তরমালা"}</span>
            {subjectName ? ` (${subjectName})` : ""}
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", fontWeight: 600 }}>
            {className && (
              <span>
                {isEnglishVersion ? "Class: " : "শ্রেণি: "}
                {className}
              </span>
            )}
            {showSetCode && setCode && (
              <span
                style={{
                  backgroundColor: "#111827",
                  color: "#ffffff",
                  padding: "1px 6px",
                  borderRadius: "2px",
                  fontSize: "10px",
                }}
              >
                {isEnglishVersion ? "SET: " : "সেট: "}
                {setCode}
              </span>
            )}
            <span style={{ color: "#4b5563" }}>
              {isEnglishVersion ? "Total: " : "মোট: "}
              {formatNum(mcqs.length + shorts.length)}
            </span>
          </div>
        </div>

        {/* MCQ Compact Grid */}
        {mcqAnswers.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
              columnGap: "8px",
              rowGap: "0",
            }}
          >
            {columnData.map((colItems, cIdx) => (
              <div
                key={`chirkut-col-${cIdx}`}
                style={{
                  borderLeft: cIdx > 0 ? "1px solid #e5e7eb" : "none",
                  paddingLeft: cIdx > 0 ? "6px" : "0",
                }}
              >
                {colItems.map((item) => (
                  <div
                    key={`chirkut-ans-${item.num}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "1.5px 2px",
                      borderBottom: "0.5px dotted #e5e7eb",
                      fontSize: "11px",
                      lineHeight: 1.3,
                    }}
                  >
                    <span style={{ color: "#4b5563", fontWeight: 500 }}>
                      {formatNum(item.num)}.
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: item.ans !== "-" ? "#065f46" : "#9ca3af",
                        backgroundColor: item.ans !== "-" ? "#ecfdf5" : "transparent",
                        padding: "0 4px",
                        borderRadius: "2px",
                      }}
                    >
                      {item.ans}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Short Question Answers (if present and have answers) */}
        {shorts.length > 0 && (
          <div
            style={{
              marginTop: mcqAnswers.length > 0 ? "6px" : "0",
              paddingTop: mcqAnswers.length > 0 ? "4px" : "0",
              borderTop: mcqAnswers.length > 0 ? "1px dashed #d1d5db" : "none",
            }}
          >
            <div
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                color: "#1f2937",
                marginBottom: "3px",
              }}
            >
              {isEnglishVersion ? "Short Questions Answer Key:" : "সংক্ষিপ্ত প্রশ্নের উত্তরমালা:"}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "4px 8px",
                fontSize: "10px",
              }}
            >
              {shorts.map((sq, sIdx) => {
                const ans = sq.correct_answer || sq.explanation || "-";
                return (
                  <div
                    key={`sq-ans-${sq.id}`}
                    style={{
                      display: "flex",
                      gap: "4px",
                      padding: "1px 0",
                      borderBottom: "0.5px dotted #f3f4f6",
                    }}
                  >
                    <span style={{ fontWeight: 700, color: "#374151" }}>
                      ({formatNum(sIdx + 1)})
                    </span>
                    <span
                      style={{
                        color: "#111827",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ans}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
