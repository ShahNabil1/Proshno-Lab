import React from "react";

export interface InPaperOmrBoxProps {
  totalQuestions: number;
  columns?: 2 | 3 | 4;
  isEnglishVersion?: boolean;
  setCode?: string;
  showSetCode?: boolean;
  showStudentInfo?: boolean;
  instituteName?: string;
  subjectName?: string;
}

const BN = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const toBanglaNum = (n: number) => String(n).split("").map((d) => BN[Number(d)] ?? d).join("");

const CalibrationMarks = ({ side }: { side: string }) => (
  <div style={{ display: "flex", gap: "5px" }}>
    {Array.from({ length: 4 }, (_, i) => (
      <span key={`${side}-${i}`} style={{ width: "11px", height: "14px", background: "#111", display: "block" }} />
    ))}
  </div>
);

export default function InPaperOmrBox({ totalQuestions, columns = 4, isEnglishVersion = false }: InPaperOmrBoxProps) {
  if (totalQuestions <= 0) return null;

  const count = Math.max(1, totalQuestions);
  const colCount = Math.min(Math.max(columns, 2), 4) as 2 | 3 | 4;
  const perCol = Math.ceil(count / colCount);
  const labels = isEnglishVersion ? ["A", "B", "C", "D"] : ["ক", "খ", "গ", "ঘ"];
  const formatNum = (n: number) => isEnglishVersion ? String(n) : toBanglaNum(n);
  const omrCode = String(14000 + count * 6).slice(-5);

  return (
    <section className="in-paper-omr-container" style={{ marginTop: "12px", marginBottom: "8px", breakInside: "avoid", pageBreakInside: "avoid" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "9px", color: "#6b7280", fontSize: "12px", fontStyle: "italic" }}>
        <span style={{ flex: 1, borderTop: "1px solid #d1d5db" }} />
        <span>OMR Area</span>
        <span style={{ flex: 1, borderTop: "1px solid #d1d5db" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "45px", margin: "0 28px 9px", fontSize: "12px" }}>
        <div>{isEnglishVersion ? "Name:" : "নাম:"} <span style={{ display: "inline-block", width: "75%", borderBottom: "1px dashed #9ca3af" }} /></div>
        <div>{isEnglishVersion ? "Roll:" : "রোল :"} <span style={{ display: "inline-block", width: "70%", borderBottom: "1px dashed #9ca3af" }} /></div>
      </div>

      <div style={{ border: "2px solid #1f2937", padding: "4px 7px 5px", margin: "0 28px", background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #1f2937", paddingBottom: "3px", marginBottom: "4px" }}>
          <CalibrationMarks side="left" />
          <CalibrationMarks side="right" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`, columnGap: "13px" }}>
          {Array.from({ length: colCount }, (_, colIdx) => {
            const start = colIdx * perCol + 1;
            const end = Math.min(start + perCol - 1, count);
            return (
              <div key={`omr-col-${colIdx}`}>
                {Array.from({ length: Math.max(0, end - start + 1) }, (_, rowIdx) => start + rowIdx).map((qNum) => (
                  <div key={`omr-${qNum}`} style={{ display: "grid", gridTemplateColumns: "22px repeat(4, 22px)", alignItems: "center", columnGap: "6px", minHeight: "25px", fontSize: "11px" }}>
                    <strong>{formatNum(qNum)}</strong>
                    {labels.map((label) => (
                      <span key={`${qNum}-${label}`} style={{ width: "20px", height: "20px", border: "1px solid #374151", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1, background: "#fff" }}>
                        {label}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: "6px", fontSize: "11px", fontStyle: "italic", color: "#6b7280", lineHeight: 1.45 }}>
        <div><span style={{ color: "#102E56", fontStyle: "normal", fontWeight: 800 }}>●</span> This OMR is scanable</div>
        <div>OMR Code : <strong style={{ color: "#111" }}>{omrCode}</strong></div>
      </div>
    </section>
  );
}
