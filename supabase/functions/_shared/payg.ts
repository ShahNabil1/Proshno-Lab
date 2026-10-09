import { selectUniqueQuestions } from "../../../src/lib/selectUniqueQuestions.ts";
export const questionRate = (type: string) => type === "cq" ? 100 : 25;

// Reserve a fixed set before payment. Prices and availability are resolved on
// the server; retrying delivery returns this same set instead of new questions.
export async function preparePayg(admin: any, request: any) {
  const chapterIds = [...new Set<number>((request?.chapter_ids || []).map(Number))];
  if (!chapterIds.length || chapterIds.length > 200 || chapterIds.some(id => !Number.isSafeInteger(id) || id < 1)) throw new Error("Invalid chapters");
  const { data: chapters, error } = await admin.from("chapters").select("id, name, subject_id").in("id", chapterIds).eq("is_active", true);
  if (error || chapters?.length !== chapterIds.length) throw new Error("Selected chapters are unavailable");
  const subjectIds = [...new Set(chapters.map((c: any) => c.subject_id))];
  const { data: subjects } = await admin.from("subjects").select("id, name, class_id, subject_code").in("id", subjectIds);
  if (!subjects?.length) throw new Error("Subjects unavailable");
  const classIds = [...new Set(subjects.map((s: any) => s.class_id))];
  const { data: classes } = await admin.from("classes").select("id, name").in("id", classIds);
  const questionIds: number[] = [];
  const counts: Record<string, number> = {};
  let totalPaisa = 0;
  const entries = Object.entries(request?.counts || {});
  if (!entries.length || entries.length > 50) throw new Error("Invalid question counts");
  for (const [type, raw] of entries) {
    const count = Number(raw);
    if (!/^[a-z][a-z0-9_]{0,60}$/.test(type) || !Number.isInteger(count) || count < 1 || count > 200) throw new Error("Invalid question count");
    const ids: number[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.from("questions").select("id").in("chapter_id", chapterIds).eq("type", type).order("id").range(offset, offset + 999);
      if (error) throw error;
      ids.push(...(data || []).map((q: any) => q.id));
      if (!data || data.length < 1000) break;
    }
    if (ids.length < count) throw new Error(`Not enough ${type} questions; choose fewer before paying`);
    for (let i = ids.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const selected = await selectUniqueQuestions(ids, count, async batch => {
      const { data, error } = await admin.from("questions")
        .select("id, type, question, stimulus_text, creative_data")
        .in("id", batch);
      if (error) throw error;
      return data || [];
    });
    if (selected.length !== count) throw new Error(`Not enough unique ${type} questions: requested ${count}, available ${selected.length}; add chapters or choose fewer before paying`);
    questionIds.push(...selected.map(question => question.id));
    counts[type] = count;
    totalPaisa += count * questionRate(type);
  }
  if (questionIds.length > 2000) throw new Error("Too many questions");
  return { kind: "payg", price: totalPaisa / 100, question_ids: questionIds, counts,
    class_name: classes?.map((c: any) => c.name).join(", ") || "", subject_name: subjects.map((s: any) => s.name).join(", "),
    chapter_names: chapters.map((c: any) => c.name), chapter_ids: chapterIds, class_ids: classIds, subject_ids: subjectIds };
}
