export type BuilderQuestion = { id: number; type: string; question: string; chapter_id: number; stimulus_text?: string | null; stimulus_group_id?: string | null; creative_data?: { passage_name?: string } | null };
export const englishBlocks = [
  { title: 'Seen Passage 1', marks: 17, passage: 'seen_passage_1', needs: [['mcq', 7], ['answering_questions', 5]] },
  { title: 'Seen Passage 2', marks: 10, passage: 'seen_passage_2', needs: [['gap_filling', 1], ['vocabulary', 5]] },
  { title: 'Unseen Passage', marks: 20, passage: 'unseen_passage', needs: [['information_transfer', 1], ['true_false', 5], ['writing_summary', 1]] },
  { title: 'Matching · Q8', marks: 5, needs: [['matching', 1]] },
  { title: 'Rearranging · Q9', marks: 8, needs: [['rearranging', 1]] },
  { title: 'Poems · Q10 (৮টি থেকে ৫টির উত্তর)', marks: 10, needs: [['poem_questions', 8]] },
  { title: 'Completing a Story · Q11', marks: 10, needs: [['completing_story', 1]] },
  { title: 'Paragraph · Q12', marks: 10, needs: [['paragraph', 1]] },
  { title: 'Dialogue · Q13', marks: 10, needs: [['dialogue', 1]] },
] as const;
export const plainText = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
export function blockCandidates<T extends BuilderQuestion>(pool: T[], block: typeof englishBlocks[number]): { key: string; label: string; rows: T[] }[] {
  const types = block.needs.map(n => n[0]);
  if (!('passage' in block)) {
    if (block.needs[0][1] === 1) return pool.filter(q => types.includes(q.type as never)).map(q => ({ key: String(q.id), label: plainText(q.question), rows: [q] }));
    const rows = pool.filter(q => types.includes(q.type as never));
    return rows.length ? [{ key: 'poems', label: 'পাঠ্যবইয়ের কবিতার প্রশ্ন', rows }] : [];
  }
  const groups = new Map<string, T[]>();
  for (const q of pool.filter(q => types.includes(q.type as never) || q.type === block.passage)) {
    const text = plainText(q.stimulus_text || (q.type === block.passage ? q.question : '')).toLowerCase();
    // A shared text is stronger evidence than an import's per-type group ID.
    const key = text ? `${q.chapter_id}:text:${text}` : q.stimulus_group_id ? `${q.chapter_id}:group:${q.stimulus_group_id}` : '';
    if (!key) continue;
    groups.set(key, [...(groups.get(key) || []), q]);
  }
  return [...groups].map(([key, rows]) => ({ key, rows, label: plainText(rows.find(q => q.creative_data?.passage_name)?.creative_data?.passage_name || rows.find(q => q.type === block.passage)?.question || rows[0].stimulus_text || 'Passage') }));
}
export function blockMissing(rows: BuilderQuestion[], block: typeof englishBlocks[number]) {
  return block.needs.filter(([type, count]) => rows.filter(q => q.type === type).length < count).map(([type, count]) => `${type}: ${rows.filter(q => q.type === type).length}/${count}`);
}
export function pickBlock<T extends BuilderQuestion>(rows: T[], block: typeof englishBlocks[number]): T[] {
  return [...('passage' in block ? rows.filter(q => q.type === block.passage).slice(0, 1) : []), ...block.needs.flatMap(([type, count]) => rows.filter(q => q.type === type).slice(0, count))];
}
