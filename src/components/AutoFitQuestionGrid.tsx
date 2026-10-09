import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Choose the widest column count that keeps every item on one line. */
export default function AutoFitQuestionGrid({ children, maxColumns, gap, className = "", style, enabled = true, manualColumns, measurementKey }: {
  children: ReactNode; maxColumns: 1 | 2 | 4; gap: number; className?: string; style?: CSSProperties; enabled?: boolean; manualColumns?: 1 | 2 | 4; measurementKey?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(maxColumns);
  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid || !enabled || manualColumns) return;
    let disposed = false;
    const measure = () => {
      if (disposed || !grid.clientWidth) return;
      const items = Array.from(grid.children);
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;contain:strict;visibility:hidden;overflow:hidden;pointer-events:none;";
      grid.appendChild(probe);
      const copies = items
        .filter(item => !item.classList.contains("col-span-full"))
        .map(item => {
          const copy = item.cloneNode(true) as HTMLElement;
          copy.style.cssText += ";position:absolute;visibility:hidden;width:max-content;max-width:none;white-space:nowrap;";
          copy.querySelectorAll<HTMLElement>("*").forEach(el => {
            el.style.whiteSpace = "nowrap";
            el.style.maxWidth = "none";
          });
          probe.appendChild(copy);
          return copy;
        });
      // Insert all probes before reading sizes to avoid a layout per option.
      const widths = copies.map(copy => Math.max(copy.offsetWidth, copy.scrollWidth));
      probe.remove();
      const widest = Math.max(0, ...widths);
      const next = ([4, 2, 1] as const).find(count => count <= maxColumns && widest <= (grid.clientWidth - gap * (count - 1)) / count - 2) || 1;
      setColumns(next);
    };
    let pendingFrame = 0;
    const scheduleMeasure = () => { if (disposed) return; cancelAnimationFrame(pendingFrame); pendingFrame = requestAnimationFrame(measure); };
    scheduleMeasure();
    let lastWidth = grid.clientWidth;
    const observer = new ResizeObserver(() => {
      const width = grid.clientWidth;
      // Column changes also change height; only width affects the fit.
      if (width === lastWidth) return;
      lastWidth = width;
      scheduleMeasure();
    });
    observer.observe(grid);
    grid.addEventListener("input", scheduleMeasure);
    document.fonts.ready.then(scheduleMeasure);
    document.fonts.addEventListener("loadingdone", scheduleMeasure);
    return () => {
      disposed = true;
      cancelAnimationFrame(pendingFrame);
      observer.disconnect();
      grid.removeEventListener("input", scheduleMeasure);
      document.fonts.removeEventListener("loadingdone", scheduleMeasure);
    };
  }, [measurementKey ?? children, maxColumns, gap, enabled, manualColumns]);
  const effectiveColumns = manualColumns || columns;
  return <div ref={ref} data-auto-fit-columns={enabled ? effectiveColumns : undefined} data-layout-mode={manualColumns ? "manual" : "auto"} className={className} style={enabled ? { ...style, display: "grid", columnGap: gap, gridTemplateColumns: `repeat(${effectiveColumns}, minmax(0, 1fr))` } : style}>{children}</div>;
}
