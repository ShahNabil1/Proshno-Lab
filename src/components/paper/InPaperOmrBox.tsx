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

const toBanglaNum = (n: number): string => {
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(n)
    .split("")
    .map((d) => digits[parseInt(d, 10)] ?? d)
    .join("");
};

export default function InPaperOmrBox({
  totalQuestions,
  columns = 4,
  isEnglishVersion = false,
  setCode,
  showSetCode = true,
  showStudentInfo = false,
  instituteName,
  subjectName,
}: InPaperOmrBoxProps) {
  if (totalQuestions <= 0) return null;

  const count = Math.max(1, totalQuestions);
  const colCount = Math.min(Math.max(columns, 2), 4) as 2 | 3 | 4;
  const labels = isEnglishVersion ? ["A", "B", "C", "D"] : ["ক", "খ", "গ", "ঘ"];
  const setLabels = isEnglishVersion ? ["A", "B", "C", "D"] : ["ক", "খ", "গ", "ঘ"];

  // Split question numbers into columns evenly
  const perCol = Math.ceil(count / colCount);
  const columnData: number[][] = [];
  for (let c = 0; c < colCount; c++) {
    const start = c * perCol + 1;
    const end = Math.min((c + 1) * perCol, count);
    const colNums: number[] = [];
    for (let i = start; i <= end; i++) {
      colNums.push(i);
    }
    columnData.push(colNums);
  }

  const formatNum = (n: number) => {
    const raw = isEnglishVersion ? String(n) : toBanglaNum(n);
    return raw.length < 2 ? (isEnglishVersion ? `0${raw}` : `০${raw}`) : raw;
  };

  return (
    <div
      className="in-paper-omr-container"
      style={{
        marginTop: "16px",
        marginBottom: "12px",
        border: "2px solid #111827",
        borderRadius: "4px",
        padding: "8px 10px 6px 10px",
        backgroundColor: "#ffffff",
        color: "#111827",
        fontFamily: isEnglishVersion ? "inherit" : "'SolaimanLipi', 'Kalpurush', sans-serif",
        pageBreakInside: "avoid",
        breakInside: "avoid",
      }}
    >
      {/* Top Timing Calibration Marks (Optical Alignment for Scanners) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1.5px dashed #9ca3af",
          paddingBottom: "4px",
          marginBottom: "6px",
        }}
      >
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`tl-${i}`}
              style={{
                width: "12px",
                height: "14px",
                backgroundColor: "#000000",
                borderRadius: "1px",
              }}
            />
          ))}
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.5px",
              color: "#374151",
              marginLeft: "4px",
            }}
          >
            OMR AREA
          </span>
        </div>

        <div style={{ fontSize: "11px", fontWeight: 700, color: "#111827" }}>
          {instituteName ? `${instituteName} • ` : ""}
          {isEnglishVersion ? "OMR ANSWER SHEET" : "OMR উত্তরপত্র"}
          {subjectName ? ` (${subjectName})` : ""}
        </div>

        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <span
            style={{
              fontSize: "10px",
              color: "#6b7280",
              marginRight: "4px",
              display: "inline-block",
            }}
          >
            {isEnglishVersion ? "SCANABLE" : "স্ক্যানযোগ্য"}
          </span>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`tr-${i}`}
              style={{
                width: "12px",
                height: "14px",
                backgroundColor: "#000000",
                borderRadius: "1px",
              }}
            />
          ))}
        </div>
      </div>

      {/* Instructions & Set Code / Roll Info Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "8px",
          padding: "4px 6px",
          backgroundColor: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: "3px",
          fontSize: "10.5px",
        }}
      >
        <div style={{ color: "#4b5563" }}>
          <span style={{ fontWeight: 700, color: "#111827" }}>
            {isEnglishVersion ? "Instruction: " : "নির্দেশনা: "}
          </span>
          {isEnglishVersion
            ? "Fill the correct bubble completely with a black ballpoint pen."
            : "সঠিক উত্তরের বৃত্তটি বলপয়েন্ট কলম দ্বারা সম্পূর্ণ ভরাট করুন।"}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {showSetCode && (
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ fontWeight: 700 }}>{isEnglishVersion ? "Set Code:" : "সেট কোড:"}</span>
              <div style={{ display: "flex", gap: "4px" }}>
                {setLabels.map((sLabel) => {
                  const isCurrentSet = setCode && setCode.trim().toUpperCase() === sLabel.trim().toUpperCase();
                  return (
                    <div
                      key={sLabel}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "2px",
                        padding: "1px 3px",
                      }}
                    >
                      <div
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          border: "1.5px solid #1f2937",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "9px",
                          fontWeight: 700,
                          backgroundColor: isCurrentSet ? "#111827" : "#ffffff",
                          color: isCurrentSet ? "#ffffff" : "#111827",
                        }}
                      >
                        {sLabel}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showStudentInfo && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ fontWeight: 700 }}>{isEnglishVersion ? "Roll No:" : "রোল নং:"}</span>
              <div style={{ display: "flex", gap: "2px" }}>
                {Array.from({ length: 6 }).map((_, rIdx) => (
                  <div
                    key={`roll-${rIdx}`}
                    style={{
                      width: "14px",
                      height: "16px",
                      border: "1px solid #374151",
                      borderRadius: "2px",
                      backgroundColor: "#ffffff",
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid of Columns for Questions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
          columnGap: "12px",
          rowGap: "0px",
        }}
      >
        {columnData.map((colNums, cIdx) => (
          <div
            key={`omr-col-${cIdx}`}
            style={{
              display: "flex",
              flexDirection: "column",
              borderLeft: cIdx > 0 ? "1px dashed #d1d5db" : "none",
              paddingLeft: cIdx > 0 ? "10px" : "0",
            }}
          >
            {colNums.map((qNum) => (
              <div
                key={`omr-q-${qNum}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "2.5px 0",
                  borderBottom: "0.5px dotted #f3f4f6",
                  fontSize: "11px",
                }}
              >
                {/* Question Number */}
                <div
                  style={{
                    width: "22px",
                    fontWeight: 700,
                    textAlign: "right",
                    marginRight: "6px",
                    color: "#1f2937",
                  }}
                >
                  {formatNum(qNum)}
                </div>

                {/* 4 Bubble Circles */}
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    alignItems: "center",
                    flex: 1,
                    justifyContent: "space-around",
                  }}
                >
                  {labels.map((lbl, lIdx) => (
                    <div
                      key={`b-${qNum}-${lIdx}`}
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        border: "1.2px solid #374151",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "9.5px",
                        fontWeight: 600,
                        color: "#1f2937",
                        backgroundColor: "#ffffff",
                        lineHeight: 1,
                      }}
                    >
                      {lbl}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom Timing / Code Sync Bar */}
      <div
        style={{
          marginTop: "6px",
          paddingTop: "4px",
          borderTop: "1.5px dashed #9ca3af",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "9px",
          color: "#6b7280",
        }}
      >
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`bl-${i}`}
              style={{
                width: "10px",
                height: "6px",
                backgroundColor: "#000000",
                borderRadius: "1px",
              }}
            />
          ))}
        </div>

        <div style={{ fontWeight: 600, letterSpacing: "1px" }}>
          PROSHNO LAB OMR ENGINE • ID: {count}Q-{colCount}C
        </div>

        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`br-${i}`}
              style={{
                width: "10px",
                height: "6px",
                backgroundColor: "#000000",
                borderRadius: "1px",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
