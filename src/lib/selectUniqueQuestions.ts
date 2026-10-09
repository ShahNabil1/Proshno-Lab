import { getQuestionDuplicateSignature, type DuplicateComparableQuestion } from "./questionDuplicates.ts";

/** Scan shuffled candidates until the requested number of distinct questions is filled. */
export async function selectUniqueQuestions<T extends DuplicateComparableQuestion>(
  candidateIds: number[], count: number, fetchRows: (ids: number[]) => Promise<T[]>,
): Promise<T[]> {
  const selected: T[] = [];
  const seen = new Set<string>();
  const ids = [...new Set(candidateIds)];
  for (let offset = 0; offset < ids.length && selected.length < count;) {
    const batch = ids.slice(offset, offset + Math.min(200, Math.max(50, count - selected.length)));
    offset += batch.length;
    const rows = await fetchRows(batch);
    const byId = new Map(rows.map(row => [row.id, row]));
    for (const id of batch) {
      const row = byId.get(id);
      if (!row) continue;
      const signature = getQuestionDuplicateSignature(row);
      if (!signature.split("::").slice(1).join("::") || seen.has(signature)) continue;
      seen.add(signature);
      selected.push(row);
      if (selected.length === count) break;
    }
  }
  return selected;
}
