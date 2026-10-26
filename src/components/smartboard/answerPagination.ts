export interface AnswerSlice { start: number; end: number }

/** Choose breaks between rendered lines, math expressions, images and table rows. */
export function answerSlices(content: HTMLElement, height: number): AnswerSlice[] {
  if (height <= 0 || !content.offsetWidth) return [{ start: 0, end: 0 }];
  content.querySelectorAll<HTMLElement>('img').forEach(image => {
    image.style.maxHeight = `${height - 8}px`;
    image.style.objectFit = 'contain';
  });
  const bounds = content.getBoundingClientRect();
  const scale = bounds.width / content.offsetWidth || 1;
  const intervals: Array<[number, number]> = [];
  const add = (rect: DOMRect) => {
    if (rect.height > 0) intervals.push([(rect.top - bounds.top) / scale, (rect.bottom - bounds.top) / scale]);
  };
  content.querySelectorAll<HTMLElement>('.katex, img, tr').forEach(element => add(element.getBoundingClientRect()));
  const walker = content.ownerDocument.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest('.katex, tr')) continue;
    for (const match of (node.textContent || '').matchAll(/\S+/g)) {
      const range = content.ownerDocument.createRange();
      range.setStart(node, match.index!);
      range.setEnd(node, match.index! + match[0].length);
      if (typeof range.getClientRects === "function") Array.from(range.getClientRects()).forEach(add);
    }
  }
  const total = Math.max(content.scrollHeight, ...intervals.map(interval => interval[1]), 1);
  const result: AnswerSlice[] = [];
  let start = 0;
  while (start < total - 1) {
    let end = Math.min(start + height - 2, total);
    for (let pass = 0; pass < intervals.length + 1; pass++) {
      const crossing = intervals.filter(([top, bottom]) => top < end && bottom > end + 0.5);
      const next = crossing.length ? Math.min(...crossing.map(([top]) => top)) - 1 : end;
      if (next === end || next <= start + 1) break;
      end = next;
    }
    if (end <= start + 1) end = Math.min(start + height - 2, total);
    result.push({ start, end });
    start = end;
  }
  return result.length ? result : [{ start: 0, end: total }];
}

/** Expand each answer into full-size continuation slides before native printing. */
export function paginatePrintedAnswers(doc: Document) {
  Array.from(doc.querySelectorAll<HTMLElement>('.board-pdf-page')).forEach(page => {
    const viewport = page.querySelector<HTMLElement>('[data-answer-viewport]');
    const content = page.querySelector<HTMLElement>('[data-answer-content]');
    if (!viewport || !content) return;
    const slices = answerSlices(content, viewport.clientHeight);
    const clones = slices.map((slice, index) => {
      const clone = page.cloneNode(true) as HTMLElement;
      const body = clone.querySelector<HTMLElement>('[data-answer-content]')!;
      const window = clone.querySelector<HTMLElement>('[data-answer-window]')!;
      body.style.transform = `translateY(-${slice.start}px)`;
      window.style.height = `${slice.end - slice.start}px`;
      clone.querySelectorAll<HTMLElement>('[data-answer-page-label]').forEach(label => {
        label.textContent = `সমাধান ${index + 1} / ${slices.length}${index ? ' — পরবর্তী অংশ' : ''}`;
      });
      clone.querySelectorAll('[data-answer-controls]').forEach(control => control.remove());
      clone.querySelectorAll<SVGElement>('[data-answer-ink-part]').forEach(ink => {
        ink.style.display = Number(ink.dataset.answerInkPart) === index ? 'inline' : 'none';
      });
      return clone;
    });
    page.replaceWith(...clones);
  });
}
