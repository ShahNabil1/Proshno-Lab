/** Restore the browsing scope without asking for a new paper's exam details. */
export function addToPaperForm(context: {classId?: unknown; subjectId?: unknown; chapterIds?: unknown}, meta: {programName?: unknown}, questions: {class_id?: number; subject_id?: number; chapter_id?: number}[]) {
  const classId=String(context.classId || questions[0]?.class_id || "");
  const subjectIds=String(context.subjectId || questions[0]?.subject_id || "").split(",").map(s=>s.trim()).filter(s=>/^\d+$/.test(s));
  const chapterIds=[...new Set([
    ...(Array.isArray(context.chapterIds)?context.chapterIds:[]),
    ...questions.map(q=>q.chapter_id),
  ].filter(v=>v!==null && v!==undefined).map(String).filter(v=>/^\d+$/.test(v)))];
  return {classId,subjectId:subjectIds.join(","),subjectIds,chapterIds,type:"all",programName:typeof meta.programName==="string" && meta.programName.trim()?meta.programName:"ক্লাস টেস্ট"};
}
