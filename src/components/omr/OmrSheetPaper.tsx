import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  A4_H_PX,
  A4_W_PX,
  BOX_BORDER,
  BOX_PAD_X,
  BUBBLE_D,
  BUBBLE_ZONE_W,
  COLUMN_GAP,
  COLUMN_W,
  MARKER_BAR_H,
  MARKER_BAR_W,
  MARKER_GAP,
  MARKER_GROUP_GAP,
  MARKER_H,
  MARKER_PAD,
  NUMBER_W,
  OPTION_LETTERS,
  ROW_H,
  ROW_PITCH,
  boxHeight,
  boxWidth,
  markerGroups,
  rowsPerColumn,
  toBn,
  columnLeft,
  bubbleCentersInColumn,
  firstRowCenterY,
} from "@/lib/omrLayout";

export interface OmrSheetPaperProps {
  columns: number;
  questions: number;
  code: string;
  instituteName?: string;
  instituteAddress?: string;
  logoText?: string;
  examTitle?: string;
  showFields?: boolean;
  signatureLeft?: string;
  signatureRight?: string;
  /** current answer key: question number -> option index */
  answers?: Record<number, number>;
  /** when set, bubbles become clickable */
  onPick?: (question: number, option: number) => void;
  /** grey out a question (e.g. already answered section) */
  disabledQuestions?: Set<number>;
  /** preview scale (1 = full A4 at 96 DPI) */
  scale?: number;
  className?: string;
}

// Same Bangla font stack as the rest of the site so printed sheets match the UI.
const SHEET_FONT = 'var(--font-body), "SolaimanLipi", "Times New Roman", serif';

const bubbleCenters = bubbleCentersInColumn();
/** distance from the grid top to the top edge of the first row (layout ROW_GAP) */
const FIRST_ROW_OFFSET = firstRowCenterY() - (BOX_BORDER + MARKER_H) - ROW_H / 2;

const SheetField: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flex: 1, minWidth: 0 }}>
    <span style={{ whiteSpace: "nowrap" }}>{label} :</span>
    <span style={{ flex: 1, borderBottom: "1px dashed #555", height: 15, minWidth: 20 }} />
  </div>
);

export default function OmrSheetPaper({
  columns,
  questions,
  code,
  instituteName = "প্রতিষ্ঠানের নাম",
  instituteAddress = "ঠিকানা এখানে লিখুন",
  logoText = "অ",
  examTitle,
  showFields = true,
  signatureLeft = "শিক্ষকের স্বাক্ষর",
  signatureRight = "প্রধান শিক্ষকের স্বাক্ষর",
  answers,
  onPick,
  disabledQuestions,
  scale = 1,
  className,
}: OmrSheetPaperProps) {
  const width = boxWidth(columns);
  const height = boxHeight(columns, questions);
  const rows = rowsPerColumn(columns, questions);
  const groups = markerGroups(columns, questions);
  const interactive = typeof onPick === "function";

  const questionNumbers = useMemo(() => {
    const list: { number: number; column: number; row: number }[] = [];
    for (let column = 0; column < columns; column += 1) {
      for (let row = 0; row < rows; row += 1) {
        const number = column * rows + row + 1;
        if (number > questions) break;
        list.push({ number, column, row });
      }
    }
    return list;
  }, [columns, questions, rows]);

  return (
    <div
      className={className}
      style={{
        width: A4_W_PX,
        height: A4_H_PX,
        background: "#fff",
        color: "#000",
        fontFamily: SHEET_FONT,
        boxSizing: "border-box",
        padding: "30px 23px",
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: "top left",
        flex: "0 0 auto",
      }}
    >
      {/* --- head ------------------------------------------------------- */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
        <div
          style={{
            width: 34,
            height: 34,
            border: "2px solid #111",
            borderRadius: 8,
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 17,
            flex: "0 0 auto",
          }}
        >
          {String(logoText || "অ").slice(0, 2)}
        </div>
        <div style={{ textAlign: "center", minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.25 }}>{instituteName}</div>
          <div style={{ fontSize: 12, color: "#333" }}>{instituteAddress}</div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #111", margin: "6px 14px 0" }} />
      <div style={{ borderTop: "1px solid #111", margin: "3px 24px 0" }} />

      {examTitle ? (
        <div style={{ textAlign: "center", fontWeight: 700, fontSize: 14, marginTop: 6 }}>
          {examTitle}
        </div>
      ) : null}

      {showFields ? (
        <div style={{ margin: "10px 4px 0", fontSize: 14 }}>
          {[
            ["নাম", "শ্রেণি"],
            ["শাখা", "বিষয়"],
            ["রোল", "তারিখ"],
          ].map((row, index) => (
            <div key={index} style={{ display: "flex", gap: 14, marginBottom: 9 }}>
              {row.map((label) => (
                <SheetField key={label} label={label} />
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ textAlign: "center", fontSize: 12, color: "#222", margin: "8px 0 4px", fontWeight: 700, letterSpacing: "0.5px" }}>
        OMR CODE: {code}
      </div>

      {/* --- answer box ------------------------------------------------- */}
      <div
        style={{
          border: `${BOX_BORDER}px solid #111`,
          margin: "0 auto",
          background: "#fff",
          width,
          boxSizing: "content-box",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: MARKER_GROUP_GAP,
            padding: MARKER_PAD,
            borderBottom: "1px dashed #888",
            alignItems: "center",
          }}
        >
          {groups.map((count, groupIndex) => (
            <div
              key={groupIndex}
              style={{
                display: "flex",
                gap: MARKER_GAP,
                marginLeft: groupIndex === groups.length - 1 ? "auto" : undefined,
              }}
            >
              {Array.from({ length: count }, (_, bar) => (
                <span
                  key={bar}
                  style={{ width: MARKER_BAR_W, height: MARKER_BAR_H, background: "#000", display: "block", flex: "0 0 auto" }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* The grid box is exactly rows * ROW_PITCH tall with no extra padding:
            the recognizer maps the whole box, so any spare height would shift
            every row away from where it looks for the bubbles. */}
        <div style={{ position: "relative", height: rows * ROW_PITCH, padding: 0 }}>
          {questionNumbers.map(({ number, column, row }) => {
            const disabled = disabledQuestions?.has(number) ?? false;
            return (
              <div
                key={number}
                style={{
                  position: "absolute",
                  left: columnLeft(column),
                  top: FIRST_ROW_OFFSET + row * ROW_PITCH,
                  height: ROW_H,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: COLUMN_W,
                }}
              >
                <span style={{ width: NUMBER_W, textAlign: "center", fontSize: 14, fontWeight: 700 }}>
                  {toBn(number)}
                </span>
                <div
                  style={{
                    width: BUBBLE_ZONE_W,
                    display: "flex",
                    justifyContent: "space-evenly",
                    alignItems: "center",
                  }}
                >
                  {OPTION_LETTERS.map((letter, option) => {
                    const picked = answers?.[number] === option;
                    return (
                      <button
                        key={letter}
                        type="button"
                        disabled={!interactive || disabled}
                        onClick={interactive ? () => onPick?.(number, option) : undefined}
                        title={`প্রশ্ন ${number} - ${letter}`}
                        style={{
                          width: BUBBLE_D,
                          height: BUBBLE_D,
                          border: "1px solid #333",
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 12,
                          lineHeight: 1,
                          padding: 0,
                          background: picked ? "#111" : "transparent",
                          color: "#111",
                          cursor: interactive && !disabled ? "pointer" : "default",
                          opacity: disabled ? 0.4 : 1,
                          fontFamily: SHEET_FONT,
                        }}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- foot ------------------------------------------------------- */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, margin: "10px 6px 0" }}>
        {[signatureLeft, signatureRight].map((label) => (
          <div
            key={label}
            style={{
              border: "1px solid #111",
              width: 196,
              height: 60,
              position: "relative",
            }}
          >
            <span style={{ position: "absolute", bottom: 3, left: 0, right: 0, textAlign: "center" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Renders the sheet inside a print-only container in <body>.  Printing then
 * shows nothing but the A4 sheet (see the .omr-print-* rules in index.css).
 */
export const OmrPrintPaper: React.FC<OmrSheetPaperProps> = (props) => {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const node = document.createElement("div");
    node.className = "omr-print-root";
    document.body.appendChild(node);
    setHost(node);
    return () => {
      document.body.removeChild(node);
      setHost(null);
    };
  }, []);

  useEffect(() => {
    if (!host) return;
    document.body.classList.add("omr-printing");
    return () => {
      document.body.classList.remove("omr-printing");
    };
  }, [host]);

  if (!host) return null;
  return createPortal(<OmrSheetPaper {...props} scale={1} />, host);
};
