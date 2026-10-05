import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Choose the widest column count that keeps every item on one line. */
export default function AutoFitQuestionGrid({ children, maxColumns, gap, className = "", style, enabled = true, manualColumns }: {
  children: ReactNode; maxColumns: 1 | 2 | 4; gap: number; className?: string; style?: CSSProperties; enabled?: boolean; manualColumns?: 1 | 2 | 4;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(maxColumns);
  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid || !enabled || manualColumns) return;
    let disposed = false;
    const measure = () => {
      if (disposed || !grid.clientWidth) return;
      const widths = Array.from(grid.children)
        .filter(item => !item.classList.contains("col-span-full"))
        .map(item => {
          const copy = item.cloneNode(true) as HTMLElement;
          copy.style.cssText += ";position:absolute;visibility:hidden;width:max-content;max-width:none;white-space:nowrap;";
          copy.querySelectorAll<HTMLElement>("*").forEach(el => {
            el.style.whiteSpace = "nowrap";
            el.style.maxWidth = "none";
          });
          grid.appendChild(copy);
          const width = Math.max(copy.offsetWidth, copy.scrollWidth);
          copy.remove();
          return width;
        });
      const widest = Math.max(0, ...widths);
      const next = ([4, 2, 1] as const).find(count => count <= maxColumns && widest <= (grid.clientWidth - gap * (count - 1)) / count - 2) || 1;
      setColumns(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    grid.addEventListener("input", measure);
    document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => {
      disposed = true;
      observer.disconnect();
      grid.removeEventListener("input", measure);
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [children, maxColumns, gap, enabled, manualColumns]);
  const effectiveColumns = manualColumns || columns;
  return <div ref={ref} data-auto-fit-columns={enabled ? effectiveColumns : undefined} data-layout-mode={manualColumns ? "manual" : "auto"} className={className} style={enabled ? { ...style, display: "grid", columnGap: gap, gridTemplateColumns: `repeat(${effectiveColumns}, minmax(0, 1fr))` } : style}>{children}</div>;
}
