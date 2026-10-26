import type { SmartBoardQuestion } from './QuestionSlide';

export type SlideExportMode = 'questions' | 'both' | 'answers';

export function withAnswerSlides(pages: SmartBoardQuestion[], mode: SlideExportMode): SmartBoardQuestion[] {
  return pages.flatMap(page => {
    if (page.type === 'blank') return mode === 'answers' ? [] : [page];
    const cqOverview = page.type === 'cq' && page.cqPartIndex === undefined && pages.some(other =>
      other.type === 'cq' && other.cqPartIndex !== undefined && other.sourceQuestionNumber === page.sourceQuestionNumber);
    const answer: SmartBoardQuestion = { ...page, id: -6_000_000_000_000 - page.id, sourcePageId: page.id, answerSlide: true };
    return mode === 'questions' ? [page] : mode === 'answers' ? cqOverview ? [] : [answer] : cqOverview ? [page] : [page, answer];
  });
}
