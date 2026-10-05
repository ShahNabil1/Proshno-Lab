import { describe, expect, it } from 'vitest';
import { blockCandidates, blockMissing, englishBlocks, pickBlock } from './englishFirstBuilder';

describe('English first paper passage selection', () => {
  const row = (id: number, type: string, text: string, chapter_id = 1) => ({ id, type, question: 'Question', chapter_id, stimulus_text: text });
  it('does not combine questions from different passages or chapters', () => {
    const pool = [row(1, 'mcq', 'Passage A'), row(2, 'answering_questions', 'Passage B'), row(3, 'mcq', 'Passage A', 2)];
    expect(blockCandidates(pool, englishBlocks[0]).map(c => c.rows.length)).toEqual([1, 1, 1]);
  });
  it('links equivalent HTML text and selects only the required counts', () => {
    const pool = [...Array.from({ length: 9 }, (_, i) => row(i, 'mcq', '<p>Shared passage</p>')), ...Array.from({ length: 6 }, (_, i) => row(i + 10, 'answering_questions', 'Shared  passage'))];
    const candidates = blockCandidates(pool, englishBlocks[0]);
    expect(candidates).toHaveLength(1);
    expect(blockMissing(candidates[0].rows, englishBlocks[0])).toEqual([]);
    expect(pickBlock(candidates[0].rows, englishBlocks[0])).toHaveLength(12);
  });
  it('reports shortages rather than silently filling from another passage', () => {
    expect(blockMissing([row(1, 'mcq', 'A')], englishBlocks[0])).toEqual(['mcq: 1/7', 'answering_questions: 0/5']);
  });
});
