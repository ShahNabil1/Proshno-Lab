/** Expose authored aligned rows to normal browser wrapping, keeping fractions
 * and matrices intact. Nested environments retain their original layout. */
export function wrappableMathRows(source: string): string[] | null {
  const match = source.trim().match(/^\\begin\{(aligned|gathered|array)\}([\s\S]*)\\end\{\1\}$/);
  // Only single-column arrays are authored equation rows. Multi-column arrays
  // remain tables, including matrices and cases nested inside another row.
  const arrayColumn = match?.[1] === "array" ? match[2].match(/^\s*\{([lcr])\}/) : null;
  if (match?.[1] === "array" && !arrayColumn) return null;
  const body = match ? match[2].slice(arrayColumn ? arrayColumn[0].length : 0) : source;
  if (/\\(?:begin|end)\{/.test(body)) return null;
  const rows: string[] = [];
  let depth = 0;
  let row = "";
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char === "\\" && /[{}&]/.test(body[i + 1] || "")) {
      row += char + body[++i];
    } else if (char === "\\" && body[i + 1] === "\\" && depth === 0) {
      rows.push(row.trim()); row = ""; i++;
      const spacing = body.slice(i + 1).match(/^\[[^\]]*\]/);
      if (spacing) i += spacing[0].length;
    } else if (char === "&" && depth === 0) {
      // Alignment anchors are no longer needed outside the aligned table.
    } else {
      if (char === "{") depth++;
      if (char === "}") depth--;
      row += char;
    }
  }
  rows.push(row.trim());
  return match || rows.length > 1 ? rows.filter(Boolean) : null;
}

/** Break only between top-level terms, never inside fractions, roots, scripts
 * or stretchy delimiters. Each term is independently typeset at the same size. */
export function wrappableMathParts(source: string): string[] {
  // Environment contents (including nested aligned rows) must be typeset
  // together. Splitting at an equals sign would separate begin/end pairs.
  if (/\\(?:begin|end)\{/.test(source)) return [source];
  // Explanatory square-bracket notes should wrap like their surrounding row.
  // Leave nested/stretchy fraction delimiters untouched.
  source = source.replace(/\\left\[([\s\S]*?)\\right\]/g, (whole, note: string) =>
    /\\(?:left|right|frac|sqrt)/.test(note) ? whole : `[${note}]`);
  // Long parenthesized sums can wrap at their operators using ordinary
  // delimiters. Braced fractions, roots and exponents remain indivisible.
  source = source.replace(/\\left\(([\s\S]*?)\\right\)/g, (whole, contents: string) =>
    (contents.length > 60 || (contents.match(/[+\-]/g) || []).length >= 4) && !/\\(?:left|right)/.test(contents) ? `(${contents})` : whole);
  const parts: string[] = [];
  let start = 0, depth = 0, fences = 0;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\\") {
      const command = source.slice(i).match(/^\\(?:[a-zA-Z]+|.)/);
      if (command) {
        if (command[0] === "\\left") fences++;
        if (command[0] === "\\right") fences--;
        i += command[0].length - 1;
        continue;
      }
    }
    if (source[i] === "{") depth++;
    if (source[i] === "}") depth--;
    if (depth === 0 && fences === 0 && /[=+\-]/.test(source[i]) && i > start && !/[\^_]/.test(source[i - 1])) {
      parts.push(source.slice(start, i)); start = i;
    }
  }
  parts.push(source.slice(start));
  return parts.filter(part => part.trim());
}
