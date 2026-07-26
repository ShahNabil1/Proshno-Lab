import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface LatexRendererProps {
  text: string;
  className?: string;
  inline?: boolean;
}

/**
 * Renders text with inline LaTeX expressions wrapped in $...$ or $$...$$.
 * Non-LaTeX text is rendered as-is.
 */
export default function LatexRenderer({ text, className = "", inline = false }: LatexRendererProps) {
  const html = useMemo(() => {
    if (!text) return "";
    // Match $$...$$, \[...\] (display) and $...$, \(...\) (inline)
    const pattern = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\$([\s\S]*?)\$|\\\(([\s\S]*?)\\\)/g;
    return text.replace(pattern, (match, dd, db, si, sp) => {
      const display = dd ?? db;
      const expr = display ?? si ?? sp;
      const isDisplay = display !== undefined;
      if (expr === undefined) return match;
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
  }, [text]);


  const Tag = inline ? "span" : "div";

  return (
    <Tag
      className={`latex-renderer ${inline ? "latex-renderer--inline" : ""} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}