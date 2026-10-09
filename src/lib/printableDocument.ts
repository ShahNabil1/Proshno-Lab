/** The browser measures the same fixed-size sheets that Preview and Print use. */
export const PAPER_DIMENSIONS = {
  A4: [210, 297], Letter: [215.9, 279.4], Legal: [215.9, 355.6], A5: [148, 210],
} as const;

export interface PrintLayout {
  widthMm: number;
  heightMm: number;
  columns: number;
  gap: number;
  divider: string;
  margins: [number, number, number, number];
}

const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

export async function waitForPrintableAssets(root: HTMLElement) {
  await document.fonts.ready;
  await Promise.all(Array.from(root.querySelectorAll('img')).map(async image => {
    if (!image.complete) await new Promise<void>(resolve => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
    });
    if (image.naturalWidth && image.decode) await image.decode();
    if (!image.naturalWidth) throw new Error(`An image could not be loaded: ${image.getAttribute('src')}`);
  }));
  // KaTeX is rendered synchronously by React. Its font fitting and the option
  // grids use ResizeObserver/rAF, so wait for their actual geometry to settle.
  let previous = '';
  let stable = 0;
  for (let attempt = 0; attempt < 120; attempt++) {
    await frame();
    const signature = Array.from(root.querySelectorAll('.latex-renderer, img, [data-auto-fit-columns]'))
      .map(element => `${element.getBoundingClientRect().width}:${element.getBoundingClientRect().height}:${element.getAttribute('style')}`).join('|');
    stable = signature === previous ? stable + 1 : 0;
    if (stable >= 3) return;
    previous = signature;
  }
  throw new Error('Printable layout did not settle');
}

type Boundary = { node: Node; offset: number };

// Never cut through a KaTeX expression, image, or question sub-row. Prefer
// paragraphs; word boundaries are only used for a paragraph taller than a column.
function boundaries(root: HTMLElement, words: boolean): Boundary[] {
  const result: Boundary[] = [];
  const after = (node: Node) => ({ node: node.parentNode!, offset: Array.prototype.indexOf.call(node.parentNode!.childNodes, node) + 1 });
  function visit(node: Node) {
    if (node instanceof HTMLElement) {
      if (node !== root && node.matches('.katex, img, svg, .cq-sub-question-row, .cq-stem-row, tr')) {
        result.push(after(node));
        return;
      }
      if (node !== root && !words && node.matches('p, li, .answer-fit-line, .math-authored-row') && !node.querySelector('.answer-fit-line')) {
        result.push(after(node));
        return;
      }
      if (node.matches('.paper-question-number, .cq-main-number, .cq-reference-answer-label, .cq-reference-answer-title, [data-section-header], .katex-mathml')) return;
    }
    if (words && node.nodeType === Node.TEXT_NODE) {
      for (const match of (node.textContent || '').matchAll(/\s+/g)) result.push({ node, offset: match.index! + match[0].length });
    }
    node.childNodes.forEach(visit);
    if (node !== root && node instanceof HTMLElement && !node.matches('span, .latex-renderer, .answer-content')) result.push(after(node));
  }
  visit(root);
  return result;
}

function portion(root: HTMLElement, boundary: Boundary, before: boolean): HTMLElement {
  const range = document.createRange();
  range.selectNodeContents(root);
  if (before) range.setEnd(boundary.node, boundary.offset);
  else range.setStart(boundary.node, boundary.offset);
  const copy = root.cloneNode(false) as HTMLElement;
  copy.append(range.cloneContents());
  // Range cloning preserves the ancestor tree, but drops preceding label
  // siblings. Keep their original track widths on continued answer boxes.
  if (!before) {
    for (const selector of ['.mcq-question-row', '.cq-main-layout', '.cq-reference-answer-row']) {
      const originalRows = Array.from(root.querySelectorAll<HTMLElement>(selector));
      const rows = Array.from(copy.querySelectorAll<HTMLElement>(selector));
      rows.forEach((row, index) => {
        const labelSelector = selector === '.mcq-question-row' ? '.paper-question-number'
          : selector === '.cq-main-layout' ? '.cq-main-number' : '.cq-reference-answer-label';
        if (row.querySelector(labelSelector)) return;
        const original = originalRows[originalRows.length - rows.length + index]?.querySelector(labelSelector);
        if (original) {
          const placeholder = original.cloneNode(true) as HTMLElement;
          placeholder.style.visibility = 'hidden';
          placeholder.setAttribute('aria-hidden', 'true');
          placeholder.setAttribute('data-print-placeholder', '');
          row.prepend(placeholder);
        }
      });
    }
  }
  return copy;
}

function hasContent(element: HTMLElement) {
  if (element.querySelector('img, svg')) return true;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.textContent?.trim() && !node.parentElement?.closest('[data-print-placeholder], .katex-mathml')) return true;
  }
  return false;
}

export async function buildPrintablePages(source: HTMLElement, layout: PrintLayout, isCancelled?: () => boolean, onProgress?: (percent: number) => void): Promise<string[]> {
  let lastYield = performance.now();
  const yieldWork = async () => {
    if (isCancelled?.()) throw new DOMException("Pagination cancelled", "AbortError");
    if (performance.now() - lastYield < 12) return;
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    lastYield = performance.now();
    if (isCancelled?.()) throw new DOMException("Pagination cancelled", "AbortError");
  };
  const host = document.createElement('div');
  host.className = 'paper-pagination-measure';
  document.body.append(host);
  const template = source.cloneNode(true) as HTMLElement;
  template.classList.remove('paper-print-layout-preview');
  template.classList.add('paper-paged-snapshot-source');
  Object.assign(template.style, {
    width: `${layout.widthMm}mm`, height: `${layout.heightMm}mm`, minHeight: '0',
    boxSizing: 'border-box', border: '0', boxShadow: 'none', overflow: 'visible',
    padding: layout.margins.map(value => `${value}px`).join(' '),
  });
  // These are alternative hidden render trees, not additional questions.
  template.querySelectorAll('.mcq-print-layout').forEach(element => element.remove());
  if (template.getAttribute('data-answers-hidden') === 'true') {
    template.querySelectorAll('.paper-answer-block, .mcq-explanation, .mcq-correct-answer-badge').forEach(element => element.remove());
  }
  // Range fragments omit the preceding number. Identify its flex row so
  // continued MCQ text/options retain the same number gutter and content width.
  template.querySelectorAll('.mcq-print-item .paper-question-number').forEach(number => {
    number.parentElement?.classList.add('mcq-question-row');
  });
  const flow = template.querySelector<HTMLElement>('.combined-question-flow');
  if (!flow) { host.remove(); throw new Error('Printable question flow is missing'); }
  // Unwrap only display:contents containers. Work one logical question at a
  // time; repeatedly cloning an entire chapter makes long papers quadratic.
  host.append(template);
  const pending: HTMLElement[] = [];
  const collect = (element: HTMLElement) => {
    const display = getComputedStyle(element).display;
    if (display === 'none') return;
    if (display === 'contents') Array.from(element.children).forEach(child => collect(child as HTMLElement));
    else if (hasContent(element)) pending.push(element.cloneNode(true) as HTMLElement);
  };
  Array.from(flow.children).forEach(element => collect(element as HTMLElement));
  flow.replaceChildren();
  flow.classList.add('paper-explicit-columns');
  Object.assign(flow.style, { columnCount: 'auto', columnRule: 'none', display: 'grid',
    gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`, gap: `${layout.gap}px`, alignItems: 'start' });
  const pages: string[] = [];
  const totalWork = Math.max(1, pending.reduce((sum, item) => sum + (item.textContent?.length || 0) + 1, 0));
  let completedWork = 0;
  let lastProgress = 0;
  const report = (percent: number) => {
    const next = Math.min(99, Math.max(lastProgress, Math.floor(percent)));
    if (next !== lastProgress) { lastProgress = next; onProgress?.(next); }
  };
  const complete = (queue: HTMLElement[], item: HTMLElement, partial = false) => {
    if (queue !== pending) return;
    completedWork += (item.textContent?.length || 0) + (partial ? 0 : 1);
    report(10 + 75 * completedWork / totalWork);
  };
  report(10);
  try {
    while (pending.length) {
      await yieldWork();
      const page = template.cloneNode(true) as HTMLElement;
      if (pages.length) page.querySelector('.paper-document-header')?.remove();
      const pageFlow = page.querySelector<HTMLElement>('.combined-question-flow')!;
      host.replaceChildren(page);
      const pageBottom = page.getBoundingClientRect().bottom - layout.margins[2];
      // Footer/attachments retain their authored layout and are reserved on
      // every sheet where present, rather than overlapping question content.
      const tail = Array.from(page.children).slice(Array.from(page.children).indexOf(pageFlow) + 1)
        .filter(node => getComputedStyle(node).position !== 'absolute' && getComputedStyle(node).display !== 'none');
      const tailHeight = tail.reduce((sum, node) => sum + node.getBoundingClientRect().height + parseFloat(getComputedStyle(node).marginTop || '0') + parseFloat(getComputedStyle(node).marginBottom || '0'), 0);
      const availableBottom = pageBottom - tailHeight - parseFloat(getComputedStyle(pageFlow).paddingBottom || '0');
      const pageStart = [...pending];
      const fill = async (queue: HTMLElement[], bottom: number) => {
        pageFlow.replaceChildren();
        for (let columnIndex = 0; columnIndex < layout.columns && queue.length; columnIndex++) {
        const column = document.createElement('div');
        column.className = 'paper-explicit-column';
        if (columnIndex && layout.divider) {
          column.style.borderLeft = layout.divider;
          column.style.paddingLeft = `${layout.gap / 2}px`;
        }
        pageFlow.append(column);
        const fits = () => column.getBoundingClientRect().bottom <= bottom;
        while (queue.length) {
          await yieldWork();
          const item = queue[0];
          column.append(item);
          if (fits()) { complete(queue, item); queue.shift(); continue; }
          item.remove();
          let cut: Boundary | undefined;
          for (const words of [false, true]) {
            const candidates = boundaries(item, words);
            let low = 0, high = candidates.length - 1;
            while (low <= high) {
              await yieldWork();
              const mid = (low + high) >>> 1;
              const candidate = portion(item, candidates[mid], true);
              column.append(candidate);
              const fitsHere = fits();
              candidate.remove();
              if (fitsHere) { cut = candidates[mid]; low = mid + 1; }
              else high = mid - 1;
            }
            if (cut) break;
          }
          if (cut) {
            const first = portion(item, cut, true);
            const rest = portion(item, cut, false);
            if (hasContent(first)) {
              column.append(first);
              if (hasContent(rest)) { complete(queue, first, true); queue[0] = rest; }
              else { complete(queue, item); queue.shift(); }
            }
          }

          break;
        }
      }
        return queue;
      };
      await fill(pending, availableBottom);
      if (!pageFlow.textContent?.trim()) throw new Error('A single equation/image is taller than the printable column');
      // Word's continuous section ending: find the smallest measured column
      // height that fits the final remainder. No added spacing or offsets.
      if (!pending.length && layout.columns > 1) {
        let low = pageFlow.getBoundingClientRect().top;
        let high = availableBottom;
        let best = pageFlow.innerHTML;
        const balanceRange = Math.max(1, high - low);
        while (high - low > 0.5) {
          const middle = (low + high) / 2;
          const remainder = await fill(pageStart.map(item => item.cloneNode(true) as HTMLElement), middle);
          if (!remainder.length) { high = middle; best = pageFlow.innerHTML; }
          else low = middle;
          report(85 + 14 * (1 - (high - low) / balanceRange));
        }
        pageFlow.innerHTML = best;
      }
      pages.push(page.outerHTML);
      if (pages.length > 500) throw new Error('Pagination made no progress');
    }
    onProgress?.(100);
    return pages;
  } finally { host.remove(); }
}
