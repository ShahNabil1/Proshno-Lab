import { memo, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface LatexRendererProps {
  text: string;
  className?: string;
  inline?: boolean;
}

// Module-level cache so repeated renders (screen + print copies, settings toggles,
// remounts) never re-run KaTeX for the same source string.
const renderCache = new Map<string, string>();
const MAX_CACHE = 5000;

// Long inline expressions (e.g. big tuple/set lists) have no natural break points,
// so KaTeX renders them as one unbreakable box that overflows narrow columns.
// Insert \allowbreak after commas so they can wrap onto the next line instead.
function addBreakHints(expr: string): string {
  if (expr.length < 40) return expr;
  if (/\\(text|begin|mbox|hbox)/.test(expr)) return expr;
  if (expr.includes("\\allowbreak")) return expr;
  return expr.replace(/,(?!\s*\\allowbreak)/g, ",\\allowbreak ");
}

function renderLatex(text: string): string {
  if (!text) return "";
  const cached = renderCache.get(text);
  if (cached !== undefined) return cached;

  const pattern = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\$([\s\S]*?)\$|\\\(([\s\S]*?)\\\)/g;
  const html = text.replace(pattern, (match, dd, db, si, sp) => {
    const display = dd ?? db;
    const expr = display ?? si ?? sp;
    const isDisplay = display !== undefined;
    if (expr === undefined) return match;
    try {
      return katex.renderToString(isDisplay ? expr : addBreakHints(expr), {
        displayMode: isDisplay,
        throwOnError: false,
        trust: true,
      });
    } catch {
      return `<span class="text-destructive">${match}</span>`;
    }
  });


  if (renderCache.size > MAX_CACHE) renderCache.clear();
  renderCache.set(text, html);
  return html;
}

/**
 * Renders text with inline LaTeX expressions wrapped in $...$ or $$...$$.
 * Non-LaTeX text is rendered as-is.
 */
function LatexRenderer({ text, className = "", inline = false }: LatexRendererProps) {
  const html = useMemo(() => renderLatex(text), [text]);

  const Tag = inline ? "span" : "div";

  return (
    <Tag
      className={`latex-renderer ${inline ? "latex-renderer--inline" : ""} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default memo(LatexRenderer);
