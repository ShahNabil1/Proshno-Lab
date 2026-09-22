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

const BN = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const toBanglaNum = (n: number) => String(n).split("").map((d) => BN[Number(d)] ?? d).join("");

export default function ChirkutAnswerSheet({ questions, isEnglishVersion = false }: ChirkutAnswerSheetProps) {
  const answers = questions.filter((q) => q.type === "mcq").map((q, index) => {
    const options = [q.option_a, q.option_b, q.option_c, q.option_d];
    const answer = isEnglishVersion
      ? (normalizeAnswerKey(q.correct_answer, options)?.toUpperCase() || "-")
      : (answerLabelBangla(q.correct_answer, options) || "-");
    return { number: index + 1, answer };
  });

  if (answers.length === 0) return null;
  const answersPerRow = 15;
  const answersPerStrip = answersPerRow * 2;
  const strips = Array.from({ length: Math.ceil(answers.length / answersPerStrip) }, (_, stripIndex) =>
    answers.slice(stripIndex * answersPerStrip, (stripIndex + 1) * answersPerStrip)
  );

  const renderAnswerCells = (items: typeof answers, rowKey: string) => (
    <>
      {Array.from({ length: answersPerRow }, (_, cellIndex) => {
        const item = items[cellIndex];
        return (
          <React.Fragment key={`${rowKey}-${cellIndex}`}>
            <td className="chirkut-number-cell">
              {item ? (isEnglishVersion ? item.number : toBanglaNum(item.number)) : ""}
            </td>
            <td className="chirkut-answer-cell">
              {item && <span className="chirkut-answer-circle">{item.answer}</span>}
            </td>
          </React.Fragment>
        );
      })}
    </>
  );

  return (
    <section className="chirkut-answer-container" aria-label={isEnglishVersion ? "Answer strip" : "চিরকুট উত্তরপত্র"}>
      {strips.map((strip, stripIndex) => {
        const firstRow = strip.slice(0, answersPerRow);
        const secondRow = strip.slice(answersPerRow, answersPerStrip);
        return (
          <table className="chirkut-answer-table" key={`answer-strip-${stripIndex}`}>
            <tbody>
              <tr>
                <th className="chirkut-answer-heading" rowSpan={2} scope="rowgroup">
                  <span>{isEnglishVersion ? "ANSWER" : "উত্তর"}</span>
                </th>
                {renderAnswerCells(firstRow, `top-${stripIndex}`)}
              </tr>
              <tr>{renderAnswerCells(secondRow, `bottom-${stripIndex}`)}</tr>
            </tbody>
          </table>
        );
      })}
    </section>
  );
}
