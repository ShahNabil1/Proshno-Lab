import { memo, useContext, useLayoutEffect, useMemo, useRef } from "react";
import { EquationBoldContext, AnswerLineFitContext } from "@/contexts/EquationStyleContext";
import { wrappableMathRows, wrappableMathParts } from "@/lib/wrappableMathRows";

import { prepareAnswerLines, fitAnswerLines } from "@/lib/answerLineFit";
import katex from "katex";
import "katex/dist/katex.min.css";

interface LatexRendererProps {
  text: string;
  className?: string;
  inline?: boolean;
  italicMathVariables?: boolean;
}

// Module-level cache so repeated renders (screen + print copies, settings toggles,
// remounts) never re-run KaTeX for the same source string.
const renderCache = new Map<string, string>();
const issueCache = new Map<string, string[]>();
const MAX_CACHE = 5000;

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const repairCommonLatexErrors = (value: string) => {
  let repaired = value;
  const leftCount = (repaired.match(/\\left\b/g) || []).length;
  const rightCount = (repaired.match(/\\right\b/g) || []).length;
  if (rightCount > leftCount) repaired = repaired.replace(/\\right(?=\\?[()[\]{}|.])/g, "");
  if (leftCount > rightCount) repaired = repaired.replace(/\\left(?=\\?[()[\]{}|.])/g, "");
  return repaired;
};

const applyLatexCompatibilityRepairs = (value: string) => repairCommonLatexErrors(
  value.replace(/\\([A-Z])(?=\s|[=)\]}?,;+*/-]|$)/g, "\\setminus $1"),
);

const prepareLatexExpression = (rawExpr: string) => rawExpr
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/?(?:p|div)[^>]*>/gi, "\n")
  .replace(/<[^>]+>/g, "")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'");

/** Returns concise reasons when stored LaTeX needs compatibility repair. */
export function getLatexIssueReasons(text: string | null | undefined): string[] {
  if (!text) return [];
  const cached = issueCache.get(text);
  if (cached !== undefined) return cached;
  const pattern = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\$([\s\S]*?)\$|\\\(([\s\S]*?)\\\)/g;
  const reasons = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const rawExpr = match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
    const expr = applyLatexCompatibilityRepairs(prepareLatexExpression(rawExpr));
    try {
      katex.renderToString(expr, { throwOnError: true, trust: true });
    } catch {
      const invalidCommands = Array.from(expr.matchAll(/\\([A-Z])(?=\s|[=)\]}?,;+*/-]|$)/g)).map((item) => `\\${item[1]}`);
      invalidCommands.forEach((command) => reasons.add(`অবৈধ কমান্ড ${command}`));
      const leftCount = (expr.match(/\\left\b/g) || []).length;
      const rightCount = (expr.match(/\\right\b/g) || []).length;
      if (leftCount !== rightCount) reasons.add("অসম্পূর্ণ \\left/\\right জোড়া");
      if (invalidCommands.length === 0 && leftCount === rightCount) reasons.add("Auto-repair-এর পরও LaTeX গঠনে ভুল");
    }
  }
  if (issueCache.size > MAX_CACHE) issueCache.clear();
  const result = Array.from(reasons);
  issueCache.set(text, result);
  return result;
}

export const hasLatexIssues = (text: string | null | undefined): boolean => getLatexIssueReasons(text).length > 0;

function renderLatex(text: string, italicMathVariables = false, boldMath = false): string {
  if (!text) return "";
  const cacheKey = `${boldMath ? "bold:" : "normal:"}${italicMathVariables ? "italic:" : "original:"}${text}`;
  const cached = renderCache.get(cacheKey);
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
    // Older imported questions contain recoverable shortcuts such as A\B and
    // unmatched \left/\right. Repair them only for display; stored data stays intact.
    let expr = applyLatexCompatibilityRepairs(prepareLatexExpression(rawExpr));
    // Imported variable products and coefficients are often wrapped in roman text.
    // Normalize only in the question picker; preserve units and authored paper output.
    if (italicMathVariables) {
      const romanWords = new Set(["sin", "cos", "tan", "cot", "sec", "csc", "log", "ln", "exp", "lim", "max", "min", "cm", "mm", "km", "kg", "mg", "ms", "mol"]);
      expr = expr.replace(/\\mathrm\{([^{}]+)\}/g, (original, content: string) => {
        const term = content.trim();
        return /^(?:\d+(?:\.\d+)?)?[a-zA-Z]{1,3}$/.test(term) && !romanWords.has(term.toLowerCase())
          ? `{${term}}`
          : original;
      });
    }
    try {
      const renderSingle = (source: string, display = isDisplay) => katex.renderToString(boldMath ? `\\boldsymbol{${source}}` : source, {
        displayMode: display,
        output: "html",
        throwOnError: false,
        trust: true,
      });
      const render = (source: string) => {
        const rows = wrappableMathRows(source);
        const flow = (row: string) => wrappableMathParts(row).map(part =>
          `<span class="math-flow-term" role="math" aria-label="${escapeHtml(part)}">${renderSingle(part, false)}</span>`).join("<wbr>");
        return rows
          ? `<span class="math-authored-rows">${rows.map(row => `<span class="math-authored-row">${flow(row)}</span>`).join("")}</span>`
          : `<span class="math-flow${isDisplay ? " math-authored-row" : ""}">${flow(source)}</span>`;
      };
      let rendered = render(expr);
      if (rendered.includes("katex-error")) {
        const repaired = repairCommonLatexErrors(expr);
        if (repaired !== expr) rendered = render(repaired);
      }
      return rendered.includes("katex-error")
        ? `<span class="latex-fallback text-foreground">${escapeHtml(rawExpr)}</span>`
        : rendered;
    } catch {
      return `<span class="latex-fallback text-foreground">${escapeHtml(rawExpr)}</span>`;
    }
  });

  if (renderCache.size > MAX_CACHE) renderCache.clear();
  renderCache.set(cacheKey, html);
  return html;
}

/**
 * Renders text with inline LaTeX expressions wrapped in $...$ or $$...$$.
 * Non-LaTeX text is rendered as-is.
 */
function LatexRenderer({ text, className = "", inline = false, italicMathVariables = false }: LatexRendererProps) {
  const boldMath = useContext(EquationBoldContext);
  const answerFit = useContext(AnswerLineFitContext);
  const fittedSizes = useRef(new Map<number, number>());
  const fittedLayout = useRef(answerFit.layoutKey);
  const html = useMemo(() => renderLatex(text, italicMathVariables, boldMath), [text, italicMathVariables, boldMath]);
  const rootRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !root.closest(".answer-content")) return;
    if (fittedLayout.current !== answerFit.layoutKey) {
      fittedSizes.current.clear(); fittedLayout.current = answerFit.layoutKey;
    }
    if (!answerFit.enabled) {
      fittedSizes.current.clear();
      root.querySelectorAll<HTMLElement>(".answer-fit-line").forEach(line => { line.style.removeProperty("font-size"); line.classList.remove("answer-fit-single"); });
      return;
    }
    const lines = prepareAnswerLines(root);
    let disposed = false;
    let frame = 0;
    const measure = () => {
      if (disposed) return;
      const paper = root.closest<HTMLElement>("[data-print-paper]");
      const scale = paper ? parseFloat(getComputedStyle(paper).fontSize) / answerFit.fontSize : 1;
      fitAnswerLines(lines, 8 * scale, fittedSizes.current);
    };
    measure();
    const onResize = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(measure);
    return () => { disposed = true; window.removeEventListener("resize", onResize); cancelAnimationFrame(frame); };
  }, [html, answerFit.enabled, answerFit.fontSize, answerFit.layoutKey]);

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
