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
    // Match $$...$$ (display) and $...$ (inline)
    return text.replace(/\$\$([\s\S]*?)\$\$|\$([\s\S]*?)\$/g, (match, display, inlineExpr) => {
      const expr = display ?? inlineExpr;
      const isDisplay = display !== undefined;
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