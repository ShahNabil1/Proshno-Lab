/**
 * Imported rich text can start with an invisible non-breaking space. When the
 * first meaningful node is a block element (for example a table), that space
 * creates an otherwise empty line above it.
 */
export const trimLeadingRichTextWhitespace = (html: string): string =>
  html.replace(/^(?:(?:\s|\u00a0)+|&(?:nbsp|ensp|emsp|thinsp);|&#(?:160|x0*a0);)+/gi, "");
