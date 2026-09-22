import { memo, useLayoutEffect, useMemo, useRef } from "react";
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

function renderLatex(text: string): string {
  if (!text) return "";
  const cached = renderCache.get(text);
  if (cached !== undefined) return cached;

  const pattern = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\$([\s\S]*?)\$|\\\(([\s\S]*?)\\\)/g;
  const html = text.replace(pattern, (match, dd, db, si, sp) => {
    const display = dd ?? db;
    const rawExpr = display ?? si ?? sp;
    const isDisplay = display !== undefined;
    if (rawExpr === undefined) return match;

    // Rich-text editors can place paragraph/line-break markup between a math
    // delimiter pair. KaTeX otherwise interprets strings such as </p><p> as
    // mathematical symbols, producing duplicate/overlapping rows and stray
    // equals signs in detailed answer sheets.
    const expr = rawExpr
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(?:p|div)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'");
    try {
      return katex.renderToString(expr, {
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
  const rootRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !root.closest(".answer-content")) return;

    let frame = 0;
    const fitAnswerMath = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rootRect = root.getBoundingClientRect();
        if (rootRect.width <= 0) return;

        root.querySelectorAll<HTMLElement>(".katex").forEach(math => {
          math.style.fontSize = "1em";
        });

        root.querySelectorAll<HTMLElement>(".katex").forEach(math => {
          // Nested KaTeX nodes do not occur, but only fit the outer renderer if
          // a future KaTeX version introduces them.
          if (math.parentElement?.closest(".katex")) return;
          const mathRect = math.getBoundingClientRect();
          const availableWidth = Math.max(1, rootRect.right - mathRect.left - 2);
          const naturalWidth = Math.max(math.scrollWidth, mathRect.width);
          if (naturalWidth > availableWidth + 0.5) {
            const scale = Math.max(0.6, Math.min(1, availableWidth / naturalWidth));
            math.style.fontSize = `${scale}em`;
          }
        });
      });
    };

    fitAnswerMath();
    const observer = new ResizeObserver(fitAnswerMath);
    observer.observe(root);
    window.addEventListener("beforeprint", fitAnswerMath);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("beforeprint", fitAnswerMath);
    };
  }, [html]);

  const Tag = inline ? "span" : "div";

  return (
    <Tag
      ref={rootRef as any}
      className={`latex-renderer ${inline ? "latex-renderer--inline" : ""} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default memo(LatexRenderer);
