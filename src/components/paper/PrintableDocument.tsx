import { useLayoutEffect, useRef } from "react";

/** One DOM tree for screen pages and native browser PDF output. */
export default function PrintableDocument({ pages, visible, widthMm, heightMm, showPageNumbers, logoPosition }: {
  logoPosition?: { enabled?: boolean; src?: string; absolute: boolean; x: number; y: number; opacity: number };
  pages: string[]; visible: boolean; widthMm: number; heightMm: number; showPageNumbers: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const { enabled = true, src, absolute, x, y, opacity } = logoPosition || {};
  useLayoutEffect(() => {
    if (opacity === undefined) return;
    root.current?.querySelectorAll<HTMLElement>('[data-paper-first-page-only]').forEach(logo => {
      // Cached sheets may still contain the previous logo while pagination runs.
      logo.style.display = enabled ? "" : "none";
      if (enabled && src) logo.setAttribute("src", src);
      logo.style.opacity = String(opacity / 100);
      if (absolute) {
        logo.style.left = `${x}%`;
        logo.style.top = `${y}%`;
        logo.style.transform = `translate(-50%, -${y}%)`;
      }
    });
  }, [pages, enabled, src, absolute, x, y, opacity]);
  return <div ref={root} className={`paper-paged-preview paper-paged-print-source${visible ? ' paper-paged-preview--visible' : ''}`} aria-label="Print layout preview">
    {pages.map((html, index) => <div className="paper-paged-preview-sheet" key={index}
      style={{ width: `${widthMm}mm`, height: `${heightMm}mm` }}>
      <div className="paper-paged-preview-slice" dangerouslySetInnerHTML={{ __html: html }} />
      {showPageNumbers && <div className="paper-shared-page-number">{index + 1}</div>}
    </div>)}
  </div>;
}
