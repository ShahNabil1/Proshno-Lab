export function paperPdfFilename(subjectName: string | undefined, answers: boolean, now = new Date()): string {
  const name = String(subjectName || "").trim().normalize("NFC");
  const prefix = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim() || "subject";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka", day: "2-digit", month: "2-digit", year: "numeric",
  }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  return `${answers ? "Ans" : "Ques"}-${prefix}-proshnolab.com_${value("day")}-${value("month")}-${value("year")}.pdf`;
}
