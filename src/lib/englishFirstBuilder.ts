export type BuilderQuestion = { id: number; type: string; question: string; chapter_id: number; stimulus_text?: string | null; stimulus_group_id?: string | null; creative_data?: { passage_name?: string } | null };
export { lowerEnglishBlocks as englishBlocks } from './englishFirstPattern';
import type { EnglishBlock } from './englishFirstPattern';
export const plainText = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
export function blockCandidates<T extends BuilderQuestion>(pool: T[], block: EnglishBlock): { key: string; label: string; rows: T[] }[] {
  const types = block.needs.map(n => n[0]);
  if (!block.passage) {
    if (block.needs[0][1] === 1) return pool.filter(q => types.includes(q.type as never)).map(q => ({ key: String(q.id), label: plainText(q.question), rows: [q] }));
    const rows = pool.filter(q => types.includes(q.type as never));
    return rows.length ? [{ key: block.needs[0][0], label: block.needs[0][0] === 'story_questions' ? 'পাঠ্যবইয়ের গল্পের প্রশ্ন' : 'পাঠ্যবইয়ের কবিতার প্রশ্ন', rows }] : [];
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
export function blockMissing(rows: BuilderQuestion[], block: EnglishBlock) {
  return block.needs.filter(([type, count]) => rows.filter(q => q.type === type).length < count).map(([type, count]) => `${type}: ${rows.filter(q => q.type === type).length}/${count}`);
}
export function pickBlock<T extends BuilderQuestion>(rows: T[], block: EnglishBlock): T[] {
  return [...(block.passage ? rows.filter(q => q.type === block.passage).slice(0, 1) : []), ...block.needs.flatMap(([type, count]) => rows.filter(q => q.type === type).slice(0, count))];
}
