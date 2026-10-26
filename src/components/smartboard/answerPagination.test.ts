import { describe, expect, it } from 'vitest';
import { answerSlices, paginatePrintedAnswers } from './answerPagination';

function measuredAnswer() {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = '<section class="board-pdf-page"><svg><g data-answer-ink-part="0"></g><g data-answer-ink-part="1"></g></svg><span data-answer-page-label></span><div data-answer-controls>controls</div><div data-answer-viewport><div data-answer-window><div data-answer-content><img src="data:image/png;base64,AA" /></div></div></div></section>';
  const content = doc.querySelector<HTMLElement>('[data-answer-content]')!;
  const viewport = doc.querySelector<HTMLElement>('[data-answer-viewport]')!;
  Object.defineProperties(content, { offsetWidth: { value: 1000 }, scrollHeight: { value: 230 } });
  Object.defineProperty(viewport, 'clientHeight', { value: 100 });
  content.getBoundingClientRect = () => ({ top: 0, width: 1000, height: 230 } as DOMRect);
  content.querySelector('img')!.getBoundingClientRect = () => ({ top: 90, bottom: 130, height: 40 } as DOMRect);
  return { doc, content };
}

describe('answer continuation pages', () => {
  it('breaks before a diagram instead of slicing through it', () => {
    const { content } = measuredAnswer();
    const slices = answerSlices(content, 100);
    expect(slices).toHaveLength(3);
    expect(slices[0].end).toBeLessThan(90);
    expect(slices[1].start).toBe(slices[0].end);
    expect(slices[1].end).toBeGreaterThanOrEqual(130);
    expect(slices.at(-1)!.end).toBe(230);
    expect(slices.every(slice => slice.end - slice.start <= 100)).toBe(true);
  });
  it('creates separately labeled print pages without navigation controls', () => {
    const { doc } = measuredAnswer();
    paginatePrintedAnswers(doc);
    expect(doc.querySelectorAll('.board-pdf-page')).toHaveLength(3);
    expect(doc.querySelectorAll('[data-answer-controls]')).toHaveLength(0);
    const labels = Array.from(doc.querySelectorAll('[data-answer-page-label]')).map(label => label.textContent);
    expect(labels).toEqual(['সমাধান 1 / 3', 'সমাধান 2 / 3 — পরবর্তী অংশ', 'সমাধান 3 / 3 — পরবর্তী অংশ']);
    expect(doc.querySelectorAll('[data-answer-content]')[1].getAttribute('style')).toContain('translateY(-89px)');
    const second = doc.querySelectorAll('.board-pdf-page')[1];
    expect((second.querySelector('[data-answer-ink-part="0"]') as SVGElement).style.display).toBe('none');
    expect((second.querySelector('[data-answer-ink-part="1"]') as SVGElement).style.display).toBe('inline');
  });
});
