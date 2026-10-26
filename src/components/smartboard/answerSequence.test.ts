import { describe, expect, it } from 'vitest';
import { expandSmartboardQuestions } from './slideSequence';
import { withAnswerSlides } from './answerSequence';

const source = expandSmartboardQuestions([
  { id: 1, type: 'mcq', question: 'MCQ', correct_answer: 'a' },
  { id: 2, type: 'short', question: 'SQ', explanation: 'answer' },
  { id: 3, type: 'cq', question: 'CQ', creative_data: { stem: 'stem', q_ka: 'a', q_kha: 'b', q_ga: 'c', q_gha: 'd' } },
]);

describe('answer slide sequence', () => {
  it('preserves question-only layout and pairs each CQ part with its answer', () => {
    expect(withAnswerSlides(source, 'questions')).toEqual(source);
    const both = withAnswerSlides(source, 'both');
    expect(both).toHaveLength(13);
    expect(both[4].type).toBe('cq');
    expect(both[4].cqPartIndex).toBeUndefined();
    expect(both.slice(5).map(page => [page.cqPartIndex, !!page.answerSlide])).toEqual([
      [0, false], [0, true], [1, false], [1, true], [2, false], [2, true], [3, false], [3, true],
    ]);
    expect(new Set(both.map(page => page.id)).size).toBe(both.length);
    expect(both[6].sourcePageId).toBe(both[5].id);
    expect(both[6].sourceQuestionNumber).toBe(3);
  });
  it('answer-only mode excludes overviews and blank writing pages', () => {
    const answers = withAnswerSlides([...source, { id: -1, type: 'blank', question: '' }], 'answers');
    expect(answers).toHaveLength(6);
    expect(answers.every(page => page.answerSlide)).toBe(true);
    expect(answers.map(page => page.sourceQuestionNumber)).toEqual([1, 2, 3, 3, 3, 3]);
  });
});
