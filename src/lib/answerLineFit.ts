/** Each authored answer line is measured independently; questions never enter here. */
export function prepareAnswerLines(root: HTMLElement): HTMLElement[] {
  // Older measurements may contain an outer wrapper around several lines.
  // Remove it so pagination can split at each actual authored line.
  Array.from(root.querySelectorAll<HTMLElement>(".answer-fit-line")).forEach(line => {
    if (line.querySelector(".answer-fit-line")) line.replaceWith(...Array.from(line.childNodes));
  });
  const lines: HTMLElement[] = [];
  const visit = (container: HTMLElement) => {
    if (container.matches(".math-authored-row, .answer-fit-line")) {
      container.classList.add("answer-fit-line"); lines.push(container); return;
    }
    let run: Node[] = [];
    const flush = () => {
      if (!run.length) return;
      if (run.some(node => node.textContent?.trim())) {
        const line = document.createElement("span");
        line.className = "answer-fit-line";
        container.insertBefore(line, run[0]);
        run.forEach(node => line.appendChild(node));
        lines.push(line);
      }
      run = [];
    };
    Array.from(container.childNodes).forEach(node => {
      if (node instanceof HTMLElement && node.tagName === "BR") { flush(); node.remove(); }
      else if (node instanceof HTMLElement && node.tagName === "IMG") { flush(); }
      else if (node instanceof HTMLElement && (node.querySelector("br, .answer-fit-line") || node.matches("p, div, ul, ol, li, .math-authored-rows, .math-authored-row, .answer-fit-line"))) {
        flush(); visit(node);
      } else run.push(node);
    });
    flush();
  };
  visit(root);
  return lines;
}

export function fitAnswerLine(line: HTMLElement, minimumPx: number, previousPx?: number): number | undefined {
  const saved = new Map<number, number>();
  if (previousPx !== undefined) saved.set(0, previousPx);
  fitAnswerLines([line], minimumPx, saved);
  return saved.get(0);
}

/** Batch writes and measurements so large answer sheets need only a few layouts. */
export function fitAnswerLines(lines: HTMLElement[], minimumPx: number, saved: Map<number, number>) {
  lines.forEach((line, index) => {
    line.style.fontSize = saved.has(index) ? `${saved.get(index)}px` : "";
    line.classList.remove("answer-fit-single");
    line.classList.add("answer-fit-measuring");
  });
  const measurements = lines.map((line, index) => ({
    line, index, width: line.clientWidth, natural: line.scrollWidth,
    size: saved.get(index) ?? parseFloat(getComputedStyle(line).fontSize),
    locked: saved.has(index), adjusted: saved.has(index),
  }));
  measurements.forEach(item => {
    if (!item.locked && item.width > 0 && item.natural > item.width + 1 && item.size > minimumPx) {
      item.size = Math.max(minimumPx, Math.floor(item.size * item.width / item.natural * 2) / 2);
      item.line.style.fontSize = `${item.size}px`; item.adjusted = true;
    }
  });
  for (let step = 0; step < 48; step++) {
    const overflowing = measurements.filter(item => !item.locked && item.width > 0 && item.size > minimumPx && item.line.scrollWidth > item.width + 1);
    if (!overflowing.length) break;
    overflowing.forEach(item => {
      item.size = Math.max(minimumPx, item.size - 0.5);
      item.line.style.fontSize = `${item.size}px`; item.adjusted = true;
    });
  }
  const fits = measurements.map(item => item.width > 0 && item.line.scrollWidth <= item.width + 1);
  measurements.forEach((item, index) => {
    item.line.classList.toggle("answer-fit-single", fits[index]);
    item.line.classList.remove("answer-fit-measuring");
    if (item.adjusted) saved.set(item.index, item.size);
  });
}
