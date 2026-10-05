import { englishPaperSections, englishSectionInstruction, englishItemLabel, englishPassageInstruction } from './englishPaperSections';
import { languageSubject, patternGrade } from './languageQuestionTypes';
import { isLanguageType, questionMarks, questionTypeLabel } from "@/lib/languageQuestionTypes";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
  ImportedXmlComponent,
  Packer,
  Paragraph,
  SectionType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from "docx";
import katex from "katex";
import { mml2omml } from "mathml2omml";

export interface QuestionRow {
  id: number;
  question: string;
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  correct_answer?: string | null;
  type: string;
  explanation?: string | null;
  board_references?: any[] | null;
  university_references?: any[] | null;
  creative_data?: any | null;
  stimulus_group_id?: string | null;
  stimulus_text?: string | null;
  class_id?: number;
  subject_id?: number;
  chapter_id?: number;
}

export interface PaperMeta {
  instituteName: string;
  instituteUpazila?: string;
  instituteDistrict?: string;
  instituteDivision?: string;
  institutePhone?: string;
  instituteSpecificAddress?: string;
  className: string;
  subjectName: string;
  chapterNames: string[];
  programName: string;
  subjectCode?: string;
  teacherName?: string;
  topicNames?: string[];
}

export interface PaperSettings {
  paperSize?: string;
  fontSize?: number;
  fontLang?: string;
  columns?: number;
  columnGap?: number;
  columnDivider?: boolean;
  questionGap?: number;
  pageMarginTop?: number;
  pageMarginBottom?: number;
  pageMarginLeft?: number;
  pageMarginRight?: number;
  optionStyle?: string;
  showMarksBox?: boolean;
  showSetCode?: boolean;
  showSubjectCode?: boolean;
  showInstruction?: boolean;
  showStudentInfo?: boolean;
  showAddress?: boolean;
  showAddressSpecific?: boolean;
  showAddressUpazila?: boolean;
  showAddressDistrict?: boolean;
  showAddressDivision?: boolean;
  addressText?: string;
  showProgramName?: boolean;
  showClassName?: boolean;
  showSubjectName?: boolean;
  showChapterName?: boolean;
  showQuestionInfo?: boolean;
  showAnswerSheet?: boolean;
  cqToAnswer?: number;
  shortToAnswer?: number;
  descToAnswer?: number;
  [key: string]: any;
}

const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
export const toBanglaNum = (n: number | string): string =>
  String(n)
    .split("")
    .map((d) => banglaDigits[Number(d)] ?? d)
    .join("");

const padPaperNumber = (n: number, english: boolean): string => {
  const str = english ? String(n) : toBanglaNum(n);
  return str.length < 2 ? `${english ? "0" : "০"}${str}` : str;
};

// Zero-border definition that disables outer AND inner grid lines in Word
const noBorder = { style: BorderStyle.NONE, size: 0, color: "auto" };
const noBorders = {
  top: noBorder,
  bottom: noBorder,
  left: noBorder,
  right: noBorder,
  insideHorizontal: noBorder,
  insideVertical: noBorder,
};
const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const allThinBorders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
  insideHorizontal: thinBorder,
  insideVertical: thinBorder,
};

// Converts LaTeX into an Office Math Markup Language (OMML) ImportedXmlComponent
function latexToOmml(tex: string): ImportedXmlComponent | null {
  try {
    let cleanTex = tex
      .replace(/^\$\$?|\$\$?$/g, "")
      .replace(/^\\\(|\\\)$/g, "")
      .replace(/^\\\[|\\\]$/g, "")
      .trim();
    if (!cleanTex) return null;

    const rawMml = katex.renderToString(cleanTex, {
      output: "mathml",
      throwOnError: false,
    });
    const mathMatch = rawMml.match(/<math[\s\S]*?<\/math>/i);
    if (!mathMatch) return null;

    const cleanMml = mathMatch[0].replace(
      /<annotation[\s\S]*?<\/annotation>/gi,
      ""
    );
    let omml = typeof mml2omml === "function" ? mml2omml(cleanMml) : "";
    if (!omml) return null;

    // Eliminate Word's dotted empty square placeholder boxes for prescripts/combinations (e.g. ^7C_0)
    // Eliminate Word's dotted empty square placeholder boxes for prescripts/combinations (e.g. ^7C_0)
    omml = omml.replace(/<m:e\/>/g, '<m:e><m:r><m:t>\u200B</m:t></m:r></m:e>');

    // Safely XML-encode unescaped characters (&, <, >) inside <m:t>...</m:t> tags.
    // mathml2omml does not escape < or > inside text nodes (e.g. <m:t xml:space="preserve"><190}</m:t>),
    // which causes ImportedXmlComponent.fromXmlString() strict SAX parser to throw 'Unencoded <'.
    omml = omml.replace(/(<m:t\b[^>]*>)([\s\S]*?)(<\/m:t>)/g, (_match, open, content, close) => {
      const safeContent = content
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return open + safeContent + close;
    });

    const parsed = ImportedXmlComponent.fromXmlString(omml);
    return (parsed as any).root && (parsed as any).root[0]
      ? (parsed as any).root[0]
      : parsed;
  } catch {
    return null;
  }
}

function decodeHtml(value?: string | null): string {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function cleanHtmlText(source?: string | null): string {
  if (!source) return "";
  // Strip HTML tags FIRST before entity decoding, to prevent deleting mathematical inequalities like < 190
  const stripped = String(source)
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(
      /<\/?(?:p|div|li|ul|ol|table|tbody|thead|tfoot|tr|td|th|span|strong|b|em|i|u|h[1-6]|small|sub|sup|label|button|a)[^>]*>/gi,
      ""
    )
    .replace(/<[a-zA-Z\/][^>]*>/g, "")
    .replace(/\r\n/g, "\n");

  // Rich-text editors often save an empty <p><br></p> or &nbsp; paragraph
  // between each line of a multiple-statement MCQ. Browsers visually collapse
  // it, but Word preserves it as a full blank line. Keep intentional line
  // breaks while removing whitespace-only/duplicate lines.
  return decodeHtml(stripped)
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

type ExportImage = {
  data: ArrayBuffer;
  type: "jpg" | "png" | "gif" | "bmp";
  width: number;
  height: number;
};

type ExportImageMap = Map<string, ExportImage>;

const getImageSources = (value: unknown, sources = new Set<string>()): Set<string> => {
  if (typeof value === "string") {
    for (const match of value.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
      if (match[1]) sources.add(decodeHtml(match[1].trim()));
    }
  } else if (Array.isArray(value)) {
    value.forEach((item) => getImageSources(item, sources));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) =>
      getImageSources(item, sources)
    );
  }
  return sources;
};

async function convertBlobToExportImage(blob: Blob): Promise<ExportImage> {
  const bitmap = await createImageBitmap(blob);
  const originalWidth = Math.max(1, bitmap.width);
  const originalHeight = Math.max(1, bitmap.height);
  const mime = blob.type.toLowerCase();
  const directType = mime.includes("jpeg") || mime.includes("jpg")
    ? "jpg"
    : mime.includes("png")
    ? "png"
    : mime.includes("gif")
    ? "gif"
    : mime.includes("bmp")
    ? "bmp"
    : null;

  if (directType) {
    bitmap.close();
    return {
      data: await blob.arrayBuffer(),
      type: directType,
      width: originalWidth,
      height: originalHeight,
    };
  }

  // Word/docx does not accept WebP/AVIF directly. Convert those formats to PNG.
  const canvas = document.createElement("canvas");
  canvas.width = originalWidth;
  canvas.height = originalHeight;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  bitmap.close();
  const pngBlob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Image conversion failed"))),
      "image/png"
    )
  );
  return {
    data: await pngBlob.arrayBuffer(),
    type: "png",
    width: originalWidth,
    height: originalHeight,
  };
}

async function preloadExportImages(questions: QuestionRow[]): Promise<ExportImageMap> {
  const sources = [...getImageSources(questions)];
  const entries = await Promise.all(
    sources.map(async (src): Promise<[string, ExportImage] | null> => {
      try {
        // Keep cross-origin image CDNs fetchable. `include` turns this into a
        // credentialed CORS request, which common CDNs correctly reject.
        const response = await fetch(src, { credentials: "same-origin" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return [src, await convertBlobToExportImage(await response.blob())];
      } catch (error) {
        console.warn("Word export could not embed image:", src, error);
        return null;
      }
    })
  );
  return new Map(entries.filter((entry): entry is [string, ExportImage] => Boolean(entry)));
}

function imageRunFromTag(
  imageTag: string,
  images?: ExportImageMap,
  maxWidth = 280
): ImageRun | null {
  const srcMatch = imageTag.match(/\bsrc=["']([^"']+)["']/i);
  if (!srcMatch) return null;
  const src = decodeHtml(srcMatch[1].trim());
  const image = images?.get(src);
  if (!image) return null;

  const widthMatch = imageTag.match(/\bwidth=["']?(\d+(?:\.\d+)?)/i);
  const heightMatch = imageTag.match(/\bheight=["']?(\d+(?:\.\d+)?)/i);
  const styleWidth = imageTag.match(/\bwidth\s*:\s*(\d+(?:\.\d+)?)px/i);
  const styleHeight = imageTag.match(/\bheight\s*:\s*(\d+(?:\.\d+)?)px/i);
  let width = Number(styleWidth?.[1] || widthMatch?.[1] || image.width);
  let height = Number(styleHeight?.[1] || heightMatch?.[1] || image.height);
  if (!width || !height) {
    width = image.width;
    height = image.height;
  }
  const scale = Math.min(1, maxWidth / width);
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  return new ImageRun({
    data: image.data,
    type: image.type,
    transformation: { width, height },
  });
}

// Matches math formulas across multiple lines, including aligned environments
const comprehensiveMathPattern =
  /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$]+?\$|\s*\\begin\{[a-zA-Z*]+\}[\s\S]*?\\end\{[a-zA-Z*]+\})/g;

const isMathToken = (token: string): boolean =>
  /^(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$]+?\$|\s*\\begin\{[a-zA-Z*]+\}[\s\S]*?\\end\{[a-zA-Z*]+\})$/.test(
    token
  );

/**
 * Splits text into non-math runs and native OMML math equation components.
 * CRUCIAL: Splits by math blocks FIRST so multi-line equations (\begin{aligned}) stay whole,
 * then inserts <w:br/> for newlines in plain text!
 */
function createFormattedRuns(
  rawText?: string | null,
  font = "SolaimanLipi",
  options: Record<string, any> = {}
): Array<TextRun | ImportedXmlComponent | ImageRun> {
  if (!rawText) return [];
  // Normalize HTML <sup> and <sub> tags to LaTeX notation so exponents and subscripts render cleanly
  let normalized = String(rawText)
    .replace(/([a-zA-Z0-9)\]]+)\s*<sup>([\s\S]*?)<\/sup>/gi, (_, base, exp) => `$${base}^{${exp}}$`)
    .replace(/([a-zA-Z0-9)\]]+)\s*<sub>([\s\S]*?)<\/sub>/gi, (_, base, sub) => `$${base}_{${sub}}$`)
    .replace(/<sup>([\s\S]*?)<\/sup>/gi, (_, exp) => `$^{${exp}}$`)
    .replace(/<sub>([\s\S]*?)<\/sub>/gi, (_, sub) => `$_{${sub}}$`);

  const mathTokenSource = comprehensiveMathPattern.source.slice(1, -1);
  const tokenPattern = new RegExp(`(<img\\b[^>]*>|${mathTokenSource})`, "gi");
  const parts = normalized.split(tokenPattern);
  const runs: Array<TextRun | ImportedXmlComponent | ImageRun> = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    if (/^<img\b[^>]*>$/i.test(part.trim())) {
      const image = imageRunFromTag(
        part,
        options.images,
        Number(options.maxImageWidth) || 280
      );
      if (image) runs.push(image);
    } else if (isMathToken(part)) {
      const omml = latexToOmml(part);
      if (omml) {
        runs.push(omml);
      } else {
        const fallback = part.replace(
          /^(\$\$|\$|\\\(|\\\[)|(\$\$|\$|\\\)|\\])$/g,
          ""
        );
        runs.push(
          new TextRun({
            text: fallback,
            font: "Cambria Math",
            ...options,
          })
        );
      }
    } else {
      // Plain text: split by \n and insert <w:br/> line breaks
      const lines = cleanHtmlText(part).split("\n");
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        if (li > 0) {
          runs.push(new TextRun({ break: 1 }));
        }
        if (line) {
          runs.push(new TextRun({ text: line, font, ...options }));
        }
      }
    }
  }

  return runs;
}

const tableBorderDef = { style: BorderStyle.SINGLE, size: 4, color: "555555" };
const allThinTableBorders = {
  top: tableBorderDef,
  bottom: tableBorderDef,
  left: tableBorderDef,
  right: tableBorderDef,
  insideHorizontal: tableBorderDef,
  insideVertical: tableBorderDef,
};

function parseHtmlTableToDocxTable(
  tableHtml: string,
  font = "SolaimanLipi",
  options: Record<string, any> = {}
): Table | null {
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi;

  const rawRows: Array<
    Array<{ text: string; isHeader: boolean; bold: boolean; align?: string }>
  > = [];
  let trMatch;
  while ((trMatch = trRegex.exec(tableHtml)) !== null) {
    const rowHtml = trMatch[1];
    const cells: Array<{
      text: string;
      isHeader: boolean;
      bold: boolean;
      align?: string;
    }> = [];
    let cellMatch;
    cellRegex.lastIndex = 0;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const tag = cellMatch[1].toLowerCase();
      const attrs = cellMatch[2] || "";
      const content = cellMatch[3] || "";
      const isHeader = tag === "th";
      const isBold =
        isHeader ||
        /font-weight:\s*(?:bold|[6-9]00)/i.test(attrs) ||
        /<(strong|b)[^>]*>/i.test(content);
      const alignMatch = attrs.match(/text-align:\s*(center|left|right)/i);
      const align = alignMatch
        ? alignMatch[1].toLowerCase()
        : "center";
      cells.push({
        text: content.trim(),
        isHeader,
        bold: isBold,
        align,
      });
    }
    if (cells.length > 0) rawRows.push(cells);
  }

  if (rawRows.length === 0) return null;

  const maxCols = Math.max(...rawRows.map((r) => r.length));
  const colWidthPct = Math.max(5, Math.floor(100 / maxCols));

  const tableRows = rawRows.map((row) => {
    const tableCells = row.map((c) => {
      const alignment =
        c.align === "left"
          ? AlignmentType.LEFT
          : c.align === "right"
          ? AlignmentType.RIGHT
          : AlignmentType.CENTER;

      return new TableCell({
        width: { size: colWidthPct, type: WidthType.PERCENTAGE },
        borders: allThinTableBorders,
        shading: c.isHeader ? { fill: "F3F4F6" } : undefined,
        margins: { top: 40, bottom: 40, left: 30, right: 30 },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment,
            children: createFormattedRuns(c.text, font, {
              size: (options.size || 18) - 3,
              bold: c.bold,
              color: options.color,
            }),
            spacing: { line: 200, before: 0, after: 0 },
          }),
        ],
      });
    });

    return new TableRow({
      children: tableCells,
    });
  });

  return new Table({
    width: { size: options.indent?.left ? 95 : 100, type: WidthType.PERCENTAGE },
    indent: options.indent?.left ? { size: options.indent.left, type: WidthType.DXA } : undefined,
    borders: allThinTableBorders,
    rows: tableRows,
  });
}

interface HtmlBlockOptions {
  size?: number;
  color?: string;
  prefixRuns?: Array<TextRun | ImportedXmlComponent | ImageRun>;
  suffixRuns?: Array<TextRun | ImportedXmlComponent | ImageRun>;
  indent?: { left: number };
  spacing?: Record<string, any>;
  alignment?: AlignmentType;
  images?: ExportImageMap;
  maxImageWidth?: number;
}

/**
 * Splits HTML content into Paragraphs and native docx Tables.
 * Correctly renders <table>...</table> without stripping the table structure.
 */
function renderHtmlToBlocksCore(
  source?: string | null,
  font = "SolaimanLipi",
  options: HtmlBlockOptions = {}
): Array<Paragraph | Table> {
  if (!source) return [];

  const tablePattern = /(<table[\s\S]*?<\/table>)/gi;
  if (!tablePattern.test(source)) {
    const runs = createFormattedRuns(source, font, {
      size: options.size,
      color: options.color,
      images: options.images,
      maxImageWidth: options.maxImageWidth,
    });
    if (
      runs.length === 0 &&
      (!options.prefixRuns || options.prefixRuns.length === 0)
    ) {
      return [];
    }
    return [
      new Paragraph({
        indent: options.indent,
        alignment: options.alignment,
        children: [
          ...(options.prefixRuns || []),
          ...runs,
          ...(options.suffixRuns || []),
        ],
        spacing: options.spacing || { after: 12 },
      }),
    ];
  }

  const blocks: Array<Paragraph | Table> = [];
  const parts = source.split(/(<table[\s\S]*?<\/table>)/gi);
  let prefixRunsRemaining = options.prefixRuns ? [...options.prefixRuns] : null;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part || !part.trim()) continue;

    if (/^<table[\s\S]*?<\/table>$/i.test(part.trim())) {
      if (prefixRunsRemaining && prefixRunsRemaining.length > 0) {
        blocks.push(
          new Paragraph({
            indent: options.indent,
            alignment: options.alignment,
            children: prefixRunsRemaining,
            spacing: { before: 10, after: 6 },
          })
        );
        prefixRunsRemaining = null;
      }

      const docxTable = parseHtmlTableToDocxTable(part, font, options);
      if (docxTable) {
        blocks.push(docxTable);
        blocks.push(new Paragraph({ children: [], spacing: { after: 30 } }));
      }
    } else {
      const runs = createFormattedRuns(part, font, {
        size: options.size,
        color: options.color,
        images: options.images,
        maxImageWidth: options.maxImageWidth,
      });
      if (
        runs.length > 0 ||
        (prefixRunsRemaining && prefixRunsRemaining.length > 0)
      ) {
        const paragraphChildren: Array<TextRun | ImportedXmlComponent | ImageRun> = [];
        if (prefixRunsRemaining && prefixRunsRemaining.length > 0) {
          paragraphChildren.push(...prefixRunsRemaining);
          prefixRunsRemaining = null;
        }
        paragraphChildren.push(...runs);

        if (i === parts.length - 1 && options.suffixRuns) {
          paragraphChildren.push(...options.suffixRuns);
        }

        blocks.push(
          new Paragraph({
            indent: options.indent,
            alignment: options.alignment,
            children: paragraphChildren,
            spacing: options.spacing || { after: 12 },
          })
        );
      }
    }
  }

  return blocks;
}

function getPaperDimensions(size?: string) {
  switch (size) {
    case "Letter":
      return { width: 12240, height: 15840 };
    case "Legal":
      return { width: 12240, height: 20160 };
    case "A5":
      return { width: 8391, height: 11906 };
    default:
      return { width: 11906, height: 16838 }; // A4
  }
}

// Option label formatter: always standard (ক), (খ), (গ), (ঘ) unless paren/dot specified
function formatOptionLabel(label: string, style = "bracket"): string {
  switch (style) {
    case "paren":
      return `${label}) `;
    case "dot":
      return `${label}. `;
    case "none":
    case "bracket":
    default:
      return `(${label}) `;
  }
}

function shouldStackOptions(q: QuestionRow, columns = 2): boolean {
  const rawOpts = [q.option_a, q.option_b, q.option_c, q.option_d].filter(
    (o): o is string => Boolean(o && o.trim())
  );
  if (rawOpts.length === 0) return false;

  const visualLen = (text: string): number => {
    let plain = text;
    let latexLen = 0;
    plain = plain.replace(comprehensiveMathPattern, (m) => {
      const stripped = m.replace(/[{}^_$\\]/g, "").replace(/\s+/g, "");
      latexLen += stripped.length * 1.15;
      return "";
    });
    return plain.length + latexLen;
  };

  const lengths = rawOpts.map(visualLen);
  const maxLen = Math.max(...lengths);
  const totalLen = lengths.reduce((a, b) => a + b, 0);
  const longCount = lengths.filter((l) => l > 24).length;

  const maxThreshold = columns >= 3 ? 16 : columns === 2 ? 24 : 34;
  const totalThreshold = columns >= 3 ? 46 : columns === 2 ? 70 : 110;

  if (rawOpts.some((o) => /<br\s*\/?>|\n/i.test(o))) return true;
  return maxLen > maxThreshold || totalLen > totalThreshold || longCount >= 2;
}

function formatRefs(q: QuestionRow): string {
  const refs: string[] = [];
  if (q.board_references && Array.isArray(q.board_references)) {
    q.board_references.forEach((r: any) => {
      if (r.board && r.year) refs.push(`${r.board} '${r.year}`);
    });
  }
  if (q.university_references && Array.isArray(q.university_references)) {
    q.university_references.forEach((r: any) => {
      if ((r.name || r.university) && r.year)
        refs.push(`${r.name || r.university} '${r.year}`);
    });
  }
  return refs.length > 0 ? ` [${refs.join(", ")}]` : "";
}

function answerLabel(q: QuestionRow, english: boolean): string {
  const raw = String(q.correct_answer || "").trim();
  if (!raw) return "";
  const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
  const exactIndex = opts.findIndex((o) => String(o || "").trim() === raw);
  const rawIndex = ["a", "b", "c", "d", "ক", "খ", "গ", "ঘ"].indexOf(
    raw.toLowerCase()
  );
  const finalIndex =
    exactIndex >= 0 ? exactIndex : rawIndex >= 0 ? rawIndex % 4 : -1;
  if (finalIndex < 0) return raw;
  return english
    ? ["a", "b", "c", "d"][finalIndex]
    : ["ক", "খ", "গ", "ঘ"][finalIndex];
}

/**
 * Main function to export a paper to Microsoft Word (.docx) matching the preview.
 */
export async function exportPaperToDocx({
  questions,
  meta,
  settings = {},
}: {
  questions: QuestionRow[];
  meta: PaperMeta;
  settings?: PaperSettings;
}): Promise<void> {
  const exportImages = await preloadExportImages(questions);
  const paperColumnCount = languageSubject(meta.subjectName || "") === "english1" && patternGrade(meta.className || "") === 8 ? 1 : Math.max(1, Number(settings.columns) || 2);
  const imageWidthLimit = paperColumnCount > 1 ? 280 : 560;
  const renderHtmlToBlocks = (
    source?: string | null,
    selectedFont = "SolaimanLipi",
    options: HtmlBlockOptions = {}
  ) =>
    renderHtmlToBlocksCore(source, selectedFont, {
      ...options,
      images: exportImages,
      maxImageWidth: options.maxImageWidth || imageWidthLimit,
    });
  const isEnglish = languageSubject(meta.subjectName || "") === "english1" || /english|eglish|ইংলিশ/i.test(
    String(meta.className || "")
  );
  const font =
    settings.fontLang === "kalpurush"
      ? "Kalpurush"
      : settings.fontLang === "timesnewroman"
      ? "Times New Roman"
      : "SolaimanLipi";

  const fontSize = Math.round((Number(settings.fontSize) || 14) * 1.5);
  const headingSize = fontSize + 8;

  const pageSize = getPaperDimensions(settings.paperSize);
  // Preview uses a 38px base padding plus the user's Page Setup value.
  // 1 CSS px is approximately 15 twips at 96 DPI.
  const pageMargins = {
    top: 570 + Math.round(Number(settings.pageMarginTop ?? 0) * 15),
    bottom: 570 + Math.round(Number(settings.pageMarginBottom ?? 0) * 15),
    left: 570 + Math.round(Number(settings.pageMarginLeft ?? 0) * 15),
    right: 570 + Math.round(Number(settings.pageMarginRight ?? 0) * 15),
  };

  const formatQuestionNumber = (number: number): string => {
    const bangla = toBanglaNum(number);
    const paddedBangla = bangla.length < 2 ? `০${bangla}` : bangla;
    const paddedEnglish = String(number).padStart(2, "0");
    const label = settings.questionNumberStyle === "bn-padded-dot"
      ? `${paddedBangla}.`
      : settings.questionNumberStyle === "bn-dot"
      ? `${bangla}.`
      : settings.questionNumberStyle === "en-padded-dot"
      ? `${paddedEnglish}.`
      : `${paddedBangla}।`;
    const gapSpaces = Math.max(1, Math.round(Number(settings.questionNumberGap ?? 6) / 3));
    return `${label}${" ".repeat(gapSpaces)}`;
  };

  const typePriority: Record<string, number> = {
    mcq: 1,
    short: 2,
    cq: 3,
    descriptive: 4,
  };
  const sorted = [...questions].sort(
    (a, b) => (typePriority[a.type] ?? 5) - (typePriority[b.type] ?? 5)
  );
  const isEnglishPaper = !questions.every(q=>q.type === 'mcq') && languageSubject(meta.subjectName || '') === 'english1' && patternGrade(meta.className || '') === 8;
  const englishPaper = englishPaperSections(sorted);
  const mcqs = sorted.filter((q) => q.type === "mcq");
  const shorts = sorted.filter((q) => q.type === "short");
  const cqs = sorted.filter((q) => q.type === "cq");
  const descriptives = sorted.filter((q) => q.type === "descriptive");
  const languageQuestions = sorted.filter(q=>isLanguageType(q.type));
  const languageMarks = isEnglishPaper ? englishPaper.sections.filter(s=>s.type !== "mcq").reduce((sum,s)=>sum+s.marks,0) : languageQuestions.reduce((sum,q)=>sum+questionMarks(q),0);

  const cqToAnswer =
    settings.cqToAnswer && settings.cqToAnswer > 0
      ? Math.min(settings.cqToAnswer, cqs.length)
      : cqs.length;
  const shortToAnswer =
    settings.shortToAnswer && settings.shortToAnswer > 0
      ? Math.min(settings.shortToAnswer, shorts.length)
      : shorts.length;
  const descToAnswer =
    settings.descToAnswer && settings.descToAnswer > 0
      ? Math.min(settings.descToAnswer, descriptives.length)
      : descriptives.length;

  const totalMarks =
    languageMarks + mcqs.length + shortToAnswer * 2 + cqToAnswer * 10 + descToAnswer * 10;
  const totalMinutes = isEnglishPaper && totalMarks === 100 && englishPaper.sections.length === 13 ? 180 : languageMarks +
    (isEnglish ? Math.ceil(mcqs.length * 1.5) : mcqs.length) +
    shortToAnswer * 2 +
    cqToAnswer * 10 +
    descToAnswer * 10;

  // ==========================================
  // SECTION 1: HEADER (1 Column, Full Width)
  // ==========================================
  const headerChildren: Array<Paragraph | Table> = [];

  // Left cell: Obtained Marks Box (compact horizontal badge)
  let leftCellContent: Array<Paragraph | Table> = [
    new Paragraph({ children: [] }),
  ];
  if (settings.showMarksBox !== false) {
    const marksBadge = new Table({
      width: { size: 2200, type: WidthType.DXA },
      borders: allThinBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 1300, type: WidthType.DXA },
              borders: allThinBorders,
              shading: { fill: "000000" },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 20, bottom: 20, left: 30, right: 30 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: isEnglish ? "Obtained Marks" : "প্রাপ্ত নম্বর",
                      bold: true,
                      color: "FFFFFF",
                      size: fontSize - 4,
                      font,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 900, type: WidthType.DXA },
              borders: allThinBorders,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: " " })],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    leftCellContent = [marksBadge];
  }

  // Center cell: Institute Name, Class, Subject, Chapter
  const centerCellParagraphs: Paragraph[] = [];
  if (meta.instituteName) {
    centerCellParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: meta.instituteName,
            bold: true,
            size: headingSize + 6,
            font,
          }),
        ],
        spacing: { after: 20 },
      })
    );
  }

  if (settings.showAddress !== false && meta.instituteSpecificAddress) {
    centerCellParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: meta.instituteSpecificAddress,
            size: fontSize - 2,
            font,
          }),
        ],
        spacing: { after: 15 },
      })
    );
  }

  if (settings.showProgramName !== false && meta.programName) {
    centerCellParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: meta.programName,
            bold: true,
            size: headingSize,
            font,
          }),
        ],
        spacing: { after: 20 },
      })
    );
  }

  if (settings.showClassName !== false && meta.className) {
    centerCellParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: meta.className,
            bold: true,
            size: fontSize + 2,
            font,
          }),
        ],
        spacing: { after: 15 },
      })
    );
  }

  if (settings.showSubjectName !== false && meta.subjectName) {
    centerCellParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: meta.subjectName,
            bold: true,
            underline: { type: UnderlineType.SINGLE },
            size: fontSize + 2,
            font,
          }),
        ],
        spacing: { after: 15 },
      })
    );
  }

  if (
    !isEnglishPaper && settings.showChapterName !== false &&
    Array.isArray(meta.chapterNames) &&
    meta.chapterNames.length > 0
  ) {
    centerCellParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: meta.chapterNames.join(", "),
            size: fontSize,
            font,
          }),
        ],
        spacing: { after: 25 },
      })
    );
  }

  // Right cell: Set Code and Subject Code
  const rightCellParagraphs: Paragraph[] = [];
  if (settings.showSetCode !== false) {
    rightCellParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: isEnglish ? "Set Code: " : "সেট কোড: ",
            bold: true,
            font,
            size: fontSize,
          }),
          new TextRun({
            text: isEnglish ? "[ A ]" : "[ ক ]",
            bold: true,
            font,
            size: fontSize,
          }),
        ],
        spacing: { after: 20 },
      })
    );
  }

  if (settings.showSubjectCode !== false && meta.subjectCode) {
    const codeBoxes = meta.subjectCode
      .split("")
      .map((d) => `[ ${d} ]`)
      .join(" ");
    rightCellParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: isEnglish ? "Subject Code: " : "বিষয় কোড: ",
            bold: true,
            font,
            size: fontSize,
          }),
          new TextRun({
            text: codeBoxes,
            bold: true,
            font,
            size: fontSize,
          }),
        ],
      })
    );
  }

  // 3-Column Top Header Layout Table (ABSOLUTELY ZERO BORDERS)
  const topHeaderTable = new Table({
    width: { size: 10466, type: WidthType.DXA },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 2200, type: WidthType.DXA },
            borders: noBorders,
            verticalAlign: VerticalAlign.TOP,
            children: leftCellContent as any,
          }),
          new TableCell({
            width: { size: 5466, type: WidthType.DXA },
            borders: noBorders,
            verticalAlign: VerticalAlign.TOP,
            children:
              centerCellParagraphs.length > 0
                ? centerCellParagraphs
                : [new Paragraph({ children: [] })],
          }),
          new TableCell({
            width: { size: 2800, type: WidthType.DXA },
            borders: noBorders,
            verticalAlign: VerticalAlign.TOP,
            children:
              rightCellParagraphs.length > 0
                ? rightCellParagraphs
                : [new Paragraph({ children: [] })],
          }),
        ],
      }),
    ],
  });
  headerChildren.push(topHeaderTable);

  // Divider line under institute header
  headerChildren.push(
    new Paragraph({
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 6,
          color: "000000",
          space: 4,
        },
      },
      spacing: { before: 40, after: 60 },
    })
  );

  // Time and Marks row (ZERO BORDERS)
  const timeText = isEnglish
    ? `Time— ${totalMinutes} min`
    : `সময়— ${toBanglaNum(totalMinutes)} মিনিট`;
  const marksText = isEnglish
    ? `Marks— ${totalMarks}`
    : `পূর্ণমান— ${toBanglaNum(totalMarks)}`;

  const timeMarksTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: timeText,
                    bold: true,
                    font,
                    size: fontSize,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: marksText,
                    bold: true,
                    font,
                    size: fontSize,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  headerChildren.push(timeMarksTable);

  // Student Info (if enabled)
  if (settings.showStudentInfo) {
    headerChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: isEnglish
              ? "Student Name: _____________________  Section: _________  Roll: _________"
              : "শিক্ষার্থীর নাম: _____________________  শাখা: _________  রোল: _________",
            font,
            size: fontSize - 2,
          }),
        ],
        spacing: { before: 40, after: 30 },
      })
    );
  }

  // Instructions (if enabled)
  if (settings.showInstruction !== false) {
    const noteText = isEnglish
      ? "Note: In the provided MCQ answer sheet, fill the circle corresponding to the correct answer for each question completely using a ballpoint pen. Each question carries 1 mark."
      : "দ্রষ্টব্য: সরবরাহকৃত বহুনির্বাচনি পরীক্ষার উত্তরপত্রে প্রশ্নের ক্রমিক নম্বরের বিপরীতে প্রদত্ত বর্ণসম্বলিত বৃত্তসমূহ হতে সঠিক উত্তরের বৃত্তটি (●) বল পয়েন্ট কলম দ্বারা সম্পূর্ণ ভরাট করো। প্রতিটি প্রশ্নের মান ১।";
    const noMarkText = isEnglish
      ? "No marks, signs, or symbols are allowed on the question paper."
      : "প্রশ্নপত্রে কোনো প্রকার দাগ/চিহ্ন দেয়া যাবে না।";

    if (!isEnglishPaper) headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: noteText,
            italics: true,
            font,
            size: fontSize - 4,
          }),
        ],
        spacing: { before: 25, after: 15 },
      })
    );
    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: noMarkText,
            bold: true,
            font,
            size: fontSize - 4,
          }),
        ],
        spacing: { after: 30 },
      })
    );
  }

  // Clean horizontal divider line
  headerChildren.push(
    new Paragraph({
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 6,
          color: "999999",
          space: 4,
        },
      },
      spacing: { after: 100 },
    })
  );

  // ==========================================
  // SECTION 2: QUESTIONS (2 Columns with rule)
  // ==========================================
  const questionChildren: Array<Paragraph | Table> = [];

  const columnsCount = isEnglishPaper ? 1 : Number(settings.columns) || 2;
  const columnGapTwips =
    Math.round((Number(settings.columnGap) || 20) * 15) || 567;
  const hasColumnDivider = settings.columnDivider !== false;

  const optionLabels = isEnglish
    ? ["a", "b", "c", "d"]
    : ["ক", "খ", "গ", "ঘ"];
  const optionStyle = settings.optionStyle || "bracket";

  const addSectionHeading = (
    title: string,
    marks: string,
    instruction = ""
  ) => {
    questionChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: title,
            bold: true,
            font,
            size: fontSize + 2,
            underline: { type: UnderlineType.SINGLE },
          }),
        ],
        spacing: { before: 100, after: 20 },
      })
    );
    if (marks) {
      questionChildren.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({
              text: marks,
              bold: true,
              font,
              size: fontSize - 1,
            }),
          ],
          spacing: { after: 20 },
        })
      );
    }
    if (instruction) {
      questionChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: instruction,
              bold: true,
              font,
              size: fontSize - 1,
            }),
          ],
          spacing: { after: 50 },
        })
      );
    }
  };

  // 1. MCQ QUESTIONS
  if (!isEnglishPaper && mcqs.length > 0) {
    if (shorts.length > 0 || cqs.length > 0 || descriptives.length > 0) {
      addSectionHeading(
        isEnglish ? "Multiple Choice Questions" : "বহুনির্বাচনি প্রশ্ন",
        isEnglish
          ? `${mcqs.length} × 1 = ${mcqs.length}`
          : `${toBanglaNum(mcqs.length)} × ১ = ${toBanglaNum(mcqs.length)}`
      );
    }

    const shownStimuli = new Set<string>();

    for (let i = 0; i < mcqs.length; i++) {
      const q = mcqs[i];
      const qNum = isEnglish
        ? `${padPaperNumber(i + 1, true)}.${" ".repeat(Math.max(1, Math.round(Number(settings.questionNumberGap ?? 6) / 3)))}`
        : formatQuestionNumber(i + 1);

      // Stimulus text (if any)
      const stimulusKey =
        q.stimulus_group_id || cleanHtmlText(q.stimulus_text);
      if (
        q.stimulus_text &&
        (!stimulusKey || !shownStimuli.has(stimulusKey))
      ) {
        if (stimulusKey) shownStimuli.add(stimulusKey);
        questionChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: isEnglish
                  ? "Read the following stimulus and answer the questions:"
                  : "নিচের উদ্দীপকটি পড়ে পরবর্তী প্রশ্নগুলোর উত্তর দাও:",
                bold: true,
                italics: true,
                font,
                size: fontSize - 1,
              }),
            ],
            spacing: { before: 60, after: 20 },
          })
        );
        questionChildren.push(
          ...renderHtmlToBlocks(q.stimulus_text, font, {
            indent: { left: 180 },
            size: fontSize - 1,
            spacing: { after: 40 },
          })
        );
      }

      // Question text line
      const refStr = settings.showQuestionInfo ? formatRefs(q) : "";
      questionChildren.push(
        ...renderHtmlToBlocks(q.question, font, {
          prefixRuns: [new TextRun({ text: qNum, bold: true, font, size: fontSize })],
          suffixRuns: refStr
            ? [
                new TextRun({
                  text: refStr,
                  italics: true,
                  size: fontSize - 3,
                  font,
                }),
              ]
            : undefined,
          size: fontSize,
          spacing: {
            before: Math.max(30, Number(settings.questionGap || 6) * 6),
            after: 25,
          },
        })
      );

      // Options
      const isStacked = shouldStackOptions(q, columnsCount);
      const optKeys: Array<"option_a" | "option_b" | "option_c" | "option_d"> =
        ["option_a", "option_b", "option_c", "option_d"];
      const rawOptions = optKeys.map((k) => q[k]);

      if (isStacked) {
        for (let oi = 0; oi < rawOptions.length; oi++) {
          const val = rawOptions[oi];
          if (!val) continue;
          const label = formatOptionLabel(optionLabels[oi], optionStyle);
          const optRuns = [
            new TextRun({ text: label, bold: true, font, size: fontSize - 1 }),
            ...createFormattedRuns(val, font, {
              size: fontSize - 1,
              images: exportImages,
              maxImageWidth: imageWidthLimit / 2,
            }),
          ];
          questionChildren.push(
            new Paragraph({
              indent: { left: 240 },
              children: optRuns,
              spacing: { line: 240, after: 12 },
            })
          );
        }
      } else {
        // 2x2 Table with ABSOLUTELY ZERO BORDERS
        const optCells: TableCell[] = [];
        for (let oi = 0; oi < 4; oi++) {
          const val = rawOptions[oi];
          const label = formatOptionLabel(optionLabels[oi], optionStyle);
          const runs = val
            ? [
                new TextRun({
                  text: label,
                  bold: true,
                  font,
                  size: fontSize - 1,
                }),
                ...createFormattedRuns(val, font, {
                  size: fontSize - 1,
                  images: exportImages,
                  maxImageWidth: imageWidthLimit / 2,
                }),
              ]
            : [new TextRun("")];

          optCells.push(
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: noBorders,
              margins: { top: 10, bottom: 10, left: 20, right: 20 },
              children: [
                new Paragraph({ children: runs, spacing: { line: 240 } }),
              ],
            })
          );
        }

        const optTable = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders,
          rows: [
            new TableRow({ children: [optCells[0], optCells[1]] }),
            new TableRow({ children: [optCells[2], optCells[3]] }),
          ],
        });
        questionChildren.push(optTable);
      }

      // Answer sheet & Explanation (if enabled)
      if (settings.showAnswerSheet && (q.correct_answer || q.explanation)) {
        const ans = answerLabel(q, isEnglish);
        const ansRuns = [
          new TextRun({
            text: isEnglish ? `Answer: ${ans} ✔ ` : `উত্তর: ${ans} ✔ `,
            bold: true,
            color: "1E3577",
            font,
            size: fontSize - 2,
          }),
        ];
        if (q.explanation) {
          questionChildren.push(
            ...renderHtmlToBlocks(q.explanation, font, {
              prefixRuns: [
                new TextRun({
                  text: isEnglish ? `Answer: ${ans} ✔ (${isEnglish ? "Explanation" : "ব্যাখ্যা"}: ` : `উত্তর: ${ans} ✔ (${isEnglish ? "Explanation" : "ব্যাখ্যা"}: `,
                  bold: true,
                  color: "1E3577",
                  font,
                  size: fontSize - 2,
                }),
              ],
              suffixRuns: [
                new TextRun({
                  text: ")",
                  bold: true,
                  color: "1E3577",
                  font,
                  size: fontSize - 2,
                }),
              ],
              color: "1E3577",
              size: fontSize - 2,
              spacing: { before: 15, after: 30 },
            })
          );
        } else {
          questionChildren.push(
            new Paragraph({
              children: ansRuns,
              spacing: { before: 15, after: 30 },
            })
          );
        }
      }
    }
  }

  for (let i=0;!isEnglishPaper && i<languageQuestions.length;i++) {
    const q=languageQuestions[i];
    addSectionHeading(questionTypeLabel(q.type),questionMarks(q)>0?String(questionMarks(q)):"","");
    if(q.stimulus_text) questionChildren.push(...renderHtmlToBlocks(q.stimulus_text,font,{size:fontSize,spacing:{after:25}}));
    questionChildren.push(...renderHtmlToBlocks(q.question,font,{prefixRuns:[new TextRun({text:`${i+1}. `,bold:true,font,size:fontSize})],size:fontSize,spacing:{after:40}}));
    if(settings.showAnswerSheet && (q.correct_answer || q.explanation)) questionChildren.push(...renderHtmlToBlocks([q.correct_answer,q.explanation].filter(Boolean).join('<br/>'),font,{size:fontSize-2,color:"1E3577",spacing:{after:30}}));
  }
  if (isEnglishPaper) {
    for (const [si, section] of englishPaper.sections.entries()) {
      if(si === 0 || englishPaper.sections[si-1].part !== section.part) addSectionHeading(`Part ${section.part === 'reading' ? 'A - Reading' : 'B - Writing'} [Marks - ${englishPaper.sections.filter(s=>s.part === section.part).reduce((sum,s)=>sum+s.marks,0)}]`,'','');
      if (section.passage && (si === 0 || englishPaper.sections[si-1].passage?.question !== section.passage.question)) {
        questionChildren.push(...renderHtmlToBlocks(englishPassageInstruction(englishPaper.sections,si),font,{size:fontSize}));
        questionChildren.push(...renderHtmlToBlocks(section.passage.question,font,{size:fontSize,spacing:{after:40}}));
      }
      questionChildren.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},borders:noBorders,rows:[new TableRow({children:[
        new TableCell({width:{size:5,type:WidthType.PERCENTAGE},borders:noBorders,children:[new Paragraph({children:[new TextRun({text:`${section.number}.`,bold:true,font,size:fontSize})]})]}),
        new TableCell({width:{size:78,type:WidthType.PERCENTAGE},borders:noBorders,children:[new Paragraph({children:[new TextRun({text:`${section.instruction || questionTypeLabel(section.type)}${section.type === 'poem_questions' && section.items.length > section.answerCount ? ` [Any ${section.answerCount} out of ${section.items.length}]` : ''}`,bold:true,font,size:fontSize})]})]}),
        new TableCell({width:{size:17,type:WidthType.PERCENTAGE},borders:noBorders,children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:section.marks > 0 ? section.marksLine : '',font,size:fontSize})]})]})
      ]})]}));
      for (const [index,q] of section.items.entries()) {
        if (q.stimulus_text && !section.passage && (index === 0 || q.stimulus_text !== section.items[index-1].stimulus_text)) questionChildren.push(...renderHtmlToBlocks(q.stimulus_text,font,{size:fontSize}));
        const label=englishItemLabel(section.type,index,section.items.length)+' ';
        questionChildren.push(...renderHtmlToBlocks(q.question,font,{prefixRuns:[new TextRun({text:label,font,size:fontSize})],size:fontSize,indent:{left:450},spacing:{after:30}}));
        if(section.type === 'mcq') questionChildren.push(...renderHtmlToBlocks(['option_a','option_b','option_c','option_d'].map((key,oi)=>`(${['i','ii','iii','iv'][oi]}) ${q[key] || ''}`).join(' &nbsp;&nbsp;&nbsp; '),font,{size:fontSize,indent:{left:900}}));
        if(settings.showAnswerSheet && (q.correct_answer || q.explanation)) questionChildren.push(...renderHtmlToBlocks([q.correct_answer,q.explanation].filter(Boolean).join('<br/>'),font,{size:fontSize-2,color:'1E3577'}));
      }
    }
  }
  // 2. SHORT QUESTIONS
  if (shorts.length > 0) {
    addSectionHeading(
      isEnglish
        ? "Short-answer Questions (2 marks each)"
        : "সংক্ষিপ্ত উত্তর প্রশ্ন (প্রতি প্রশ্নের মান ২)",
      `${
        isEnglish ? String(shortToAnswer) : toBanglaNum(shortToAnswer)
      } × ${isEnglish ? "2" : "২"} = ${
        isEnglish
          ? String(shortToAnswer * 2)
          : toBanglaNum(shortToAnswer * 2)
      }`,
      shorts.length === shortToAnswer
        ? ""
        : isEnglish
        ? `Answer any ${shortToAnswer} questions:`
        : `যেকোনো ${toBanglaNum(shortToAnswer)}টি প্রশ্নের উত্তর দাও :`
    );

    for (let i = 0; i < shorts.length; i++) {
      const q = shorts[i];
      const qNum = isEnglish
        ? `${padPaperNumber(i + 1, true)}.${" ".repeat(Math.max(1, Math.round(Number(settings.questionNumberGap ?? 6) / 3)))}`
        : formatQuestionNumber(i + 1);
      questionChildren.push(
        ...renderHtmlToBlocks(q.question, font, {
          prefixRuns: [new TextRun({ text: qNum, bold: true, font, size: fontSize })],
          size: fontSize,
          spacing: { before: 40, after: 20 },
        })
      );
      if (q.stimulus_text) {
        questionChildren.push(
          ...renderHtmlToBlocks(q.stimulus_text, font, {
            indent: { left: 180 },
            size: fontSize - 1,
            spacing: { after: 25 },
          })
        );
      }
      if (settings.showAnswerSheet && (q.correct_answer || q.explanation)) {
        questionChildren.push(
          ...renderHtmlToBlocks(q.correct_answer || q.explanation || "", font, {
            prefixRuns: [
              new TextRun({
                text: isEnglish ? "Answer: " : "উত্তর: ",
                bold: true,
                color: "1E3577",
                font,
                size: fontSize - 2,
              }),
            ],
            color: "1E3577",
            size: fontSize - 2,
            spacing: { after: 30 },
          })
        );
      }
    }
  }

  // 3. CREATIVE QUESTIONS (CQ)
  if (cqs.length > 0) {
    addSectionHeading(
      isEnglish
        ? "Creative Questions (10 marks each)"
        : "সৃজনশীল প্রশ্ন (প্রতিটি প্রশ্নের মান ১০)",
      `${
        isEnglish ? String(cqToAnswer) : toBanglaNum(cqToAnswer)
      } × ${isEnglish ? "10" : "১০"} = ${
        isEnglish ? String(cqToAnswer * 10) : toBanglaNum(cqToAnswer * 10)
      }`,
      cqs.length === cqToAnswer
        ? ""
        : isEnglish
        ? `Answer any ${cqToAnswer} questions:`
        : `যেকোনো ${toBanglaNum(cqToAnswer)}টি প্রশ্নের উত্তর দাও :`
    );

    const subLabels = isEnglish
      ? ["a", "b", "c", "d"]
      : ["ক", "খ", "গ", "ঘ"];

    for (let i = 0; i < cqs.length; i++) {
      const q = cqs[i];
      const creative = q.creative_data || {};
      const stem = String(creative.stem || q.stimulus_text || q.question || "");
      const qNum = isEnglish
        ? `${padPaperNumber(i + 1, true)}.${" ".repeat(Math.max(1, Math.round(Number(settings.questionNumberGap ?? 6) / 3)))}`
        : formatQuestionNumber(i + 1);

      questionChildren.push(
        ...renderHtmlToBlocks(stem, font, {
          prefixRuns: [new TextRun({ text: qNum, bold: true, font, size: fontSize })],
          size: fontSize,
          spacing: { before: 50, after: 25 },
        })
      );

      const subQuestions = Array.isArray(creative.sub_questions)
        ? (creative.sub_questions as Array<Record<string, any>>)
        : [];
      const keys = ["q_ka", "q_kha", "q_ga", "q_gha"];
      const values = subQuestions.length
        ? subQuestions.map((s) => String(s.question || s.text || ""))
        : keys.map((k) => String(creative[k] || ""));
      const defaultMarks = [1, 2, 3, 4];

      for (let si = 0; si < values.length; si++) {
        if (!values[si]) continue;
        const markNum =
          Number(subQuestions[si]?.marks) || defaultMarks[si] || 1;
        const markStr = isEnglish ? String(markNum) : toBanglaNum(markNum);

        questionChildren.push(
          ...renderHtmlToBlocks(values[si], font, {
            prefixRuns: [
              new TextRun({
                text: `(${subLabels[si]}) `,
                bold: true,
                font,
                size: fontSize - 1,
              }),
            ],
            suffixRuns: [
              new TextRun({
                text: `     ${markStr}`,
                bold: true,
                font,
                size: fontSize - 1,
              }),
            ],
            indent: { left: 240 },
            size: fontSize - 1,
            spacing: { line: 240, after: 12 },
          })
        );
      }

      if (settings.showAnswerSheet) {
        const ansKeys = ["ans_ka", "ans_kha", "ans_ga", "ans_gha"];
        const answers = subQuestions.length
          ? subQuestions.map((s) => String(s.answer || ""))
          : ansKeys.map((k) => String(creative[k] || ""));

        if (answers.some(Boolean) || q.explanation) {
          questionChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: isEnglish ? "Answer:" : "উত্তর:",
                  bold: true,
                  color: "1E3577",
                  font,
                  size: fontSize - 2,
                }),
              ],
              spacing: { before: 15 },
            })
          );
          for (let si = 0; si < answers.length; si++) {
            if (!answers[si]) continue;
            questionChildren.push(
              ...renderHtmlToBlocks(answers[si], font, {
                prefixRuns: [
                  new TextRun({
                    text: `(${subLabels[si]}) `,
                    bold: true,
                    color: "1E3577",
                    font,
                    size: fontSize - 2,
                  }),
                ],
                indent: { left: 240 },
                color: "1E3577",
                size: fontSize - 2,
                spacing: { after: 8 },
              })
            );
          }
        }
      }
    }
  }

  // 4. DESCRIPTIVE QUESTIONS
  if (descriptives.length > 0) {
    addSectionHeading(
      isEnglish
        ? "Descriptive Questions (10 marks each)"
        : "বর্ণনামূলক প্রশ্ন (প্রতি প্রশ্নের মান ১০)",
      `${
        isEnglish ? String(descToAnswer) : toBanglaNum(descToAnswer)
      } × ${isEnglish ? "10" : "১০"} = ${
        isEnglish ? String(descToAnswer * 10) : toBanglaNum(descToAnswer * 10)
      }`,
      descriptives.length === descToAnswer
        ? ""
        : isEnglish
        ? `Answer any ${descToAnswer} questions:`
        : `যেকোনো ${toBanglaNum(descToAnswer)}টি প্রশ্নের উত্তর দাও :`
    );

    for (let i = 0; i < descriptives.length; i++) {
      const q = descriptives[i];
      const qNum = isEnglish
        ? `${padPaperNumber(i + 1, true)}.${" ".repeat(Math.max(1, Math.round(Number(settings.questionNumberGap ?? 6) / 3)))}`
        : formatQuestionNumber(i + 1);
      questionChildren.push(
        ...renderHtmlToBlocks(q.question, font, {
          prefixRuns: [new TextRun({ text: qNum, bold: true, font, size: fontSize })],
          size: fontSize,
          spacing: { before: 50, after: 25 },
        })
      );
    }
  }

  // ==========================================
  // ASSEMBLE DOCUMENT
  // ==========================================
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font, size: fontSize },
          paragraph: { spacing: { line: 250 } },
        },
      },
    },
    sections: [
      // Section 1: Header (1 Column, Full Width)
      {
        properties: {
          type: SectionType.CONTINUOUS,
          page: { size: pageSize, margin: pageMargins },
        },
        children: headerChildren,
      },
      // Section 2: Questions (2 Columns, with optional vertical divider)
      {
        properties: {
          type: SectionType.CONTINUOUS,
          column: {
            count: columnsCount,
            space: columnGapTwips,
            separate: hasColumnDivider,
          },
          page: { size: pageSize, margin: pageMargins },
        },
        children: questionChildren,
      },
    ],
  });

  // Pack and trigger download in browser
  const blob = await Packer.toBlob(doc);
  const filenameBase =
    (meta.programName || meta.instituteName || "question-paper")
      .replace(/[\\/:*?"<>|]/g, "-")
      .trim() || "question-paper";

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filenameBase}.docx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
