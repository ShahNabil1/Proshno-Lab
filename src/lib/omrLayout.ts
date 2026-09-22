// OMR sheet geometry - TypeScript port of omr/layout.py from the local OMR
// engine.  The printed sheet and the recognizer must describe the very same
// sheet, so every number here mirrors the Python module.  src/lib/omrLayout.test.ts
// compares this file against fixtures generated from the engine.
//
// All sizes are CSS pixels at 96 DPI (1 px = 1/96 inch), exactly like the
// original eproshnobank sheet.

export const DPI = 96;
export const PX_PER_MM = DPI / 25.4;

export const A4_W_MM = 210;
export const A4_H_MM = 297;
export const A4_W_PX = 794;
export const A4_H_PX = 1123;

// --- answer box ----------------------------------------------------------
export const BOX_BORDER = 3;
export const BOX_PAD_X = 4;

export const COLUMN_W = 145;
export const COLUMN_GAP = 24;

export const NUMBER_W = 15;
export const NUMBER_GAP = 10;
export const BUBBLE_ZONE_W = 120;
export const BUBBLE_D = 24;
export const BUBBLE_R = BUBBLE_D / 2;

export const ROW_H = 24;
export const ROW_GAP = 4;
export const ROW_PITCH = ROW_H + 2 * ROW_GAP;

// --- marker row ----------------------------------------------------------
export const MARKER_BAR_W = 12;
export const MARKER_BAR_H = 16;
export const MARKER_GAP = 4;
export const MARKER_GROUP_GAP = 8;
export const MARKER_PAD = 4;
export const MARKER_BOTTOM_BORDER = 1;
export const MARKER_H = MARKER_PAD * 2 + MARKER_BAR_H + MARKER_BOTTOM_BORDER;

export const COLUMNS_CHOICES = [2, 3, 4] as const;
export const QUESTIONS_CHOICES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
export const MIN_QUESTIONS = 10;
export const MAX_QUESTIONS = 100;

export const OPTION_LETTERS = ["ক", "খ", "গ", "ঘ"] as const;
export const OPTION_COUNT = OPTION_LETTERS.length;

export type ColumnCount = (typeof COLUMNS_CHOICES)[number];

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** Bengali digits, e.g. 12 -> "১২" */
export const toBn = (value: number | string): string =>
  String(value)
    .split("")
    .map((char) => (/[0-9]/.test(char) ? BN_DIGITS[Number(char)] : char))
    .join("");

export const columnsWidth = (columns: number): number =>
  columns * COLUMN_W + (columns - 1) * COLUMN_GAP;

export const boxWidth = (columns: number): number =>
  2 * BOX_BORDER + 2 * BOX_PAD_X + columnsWidth(columns);

export const rowsPerColumn = (columns: number, questions: number): number =>
  Math.ceil(questions / columns);

export const boxHeight = (columns: number, questions: number): number =>
  2 * BOX_BORDER + MARKER_H + rowsPerColumn(columns, questions) * ROW_PITCH;

/**
 * The printed A4 page has 30px padding and the answer box starts below the
 * printed header (logo, institute, exam title, OMR code line).  A taller box
 * spills onto a second sheet of paper, which no scanner can read, so the sheet
 * builder and the token code check both refuse combinations above this line.
 */
export const SHEET_BOX_TOP_PX = 192;
export const SHEET_BOTTOM_PAD_PX = 30;

export const sheetFitsPage = (columns: number, questions: number): boolean =>
  boxHeight(columns, questions) <= A4_H_PX - SHEET_BOX_TOP_PX - SHEET_BOTTOM_PAD_PX;

/** The question-count choices that still print on one A4 page. */
export const questionsThatFit = (columns: number): number[] => {
  const limit = maxQuestionsForColumns(columns);
  const fits = QUESTIONS_CHOICES.filter((value) => value <= limit);
  return fits.length ? fits : [QUESTIONS_CHOICES[0]];
};

/** Largest question count that still prints on one A4 page for these columns. */
export const maxQuestionsForColumns = (columns: number): number => {
  const rows = Math.floor(
    (A4_H_PX - SHEET_BOX_TOP_PX - SHEET_BOTTOM_PAD_PX - 2 * BOX_BORDER - MARKER_H) / ROW_PITCH,
  );
  return Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, rows * columns));
};

/** Centre x of the four bubbles, relative to the left edge of a column. */
export const bubbleCentersInColumn = (): number[] => {
  const left = NUMBER_W + NUMBER_GAP;
  const gap = (BUBBLE_ZONE_W - OPTION_COUNT * BUBBLE_D) / (OPTION_COUNT + 1);
  return Array.from(
    { length: OPTION_COUNT },
    (_, index) => left + (index + 1) * gap + BUBBLE_R + index * BUBBLE_D,
  );
};

export const BUBBLE_CENTERS_IN_COLUMN = bubbleCentersInColumn();

/** Centre y of the first question row, relative to the box top-left. */
export const firstRowCenterY = (): number =>
  BOX_BORDER + MARKER_H + ROW_GAP + ROW_H / 2;

/** Left edge of a column, relative to the box top-left. */
export const columnLeft = (column: number): number =>
  BOX_BORDER + BOX_PAD_X + column * (COLUMN_W + COLUMN_GAP);

export const rowCenterY = (row: number): number => firstRowCenterY() + row * ROW_PITCH;

export interface BubbleSlot {
  number: number;
  column: number;
  row: number;
  option: number;
  /** centre relative to the box top-left */
  x: number;
  y: number;
}

export const bubbleSlots = (columns: number, questions: number): BubbleSlot[] => {
  const rows = rowsPerColumn(columns, questions);
  const slots: BubbleSlot[] = [];
  for (let column = 0; column < columns; column += 1) {
    const baseX = columnLeft(column);
    for (let row = 0; row < rows; row += 1) {
      const number = column * rows + row + 1;
      if (number > questions) break;
      const cy = rowCenterY(row);
      BUBBLE_CENTERS_IN_COLUMN.forEach((offset, option) => {
        slots.push({ number, column, row, option, x: baseX + offset, y: cy });
      });
    }
  }
  return slots;
};

/** Marker groups printed in the marker row: [1, columns, 1, question blocks]. */
export const markerGroups = (columns: number, questions: number): number[] => [
  1,
  columns,
  1,
  Math.ceil(questions / 10),
];

/**
 * Predicted x (layout px) of every marker bar - mirrors
 * recognizer._marker_bar_positions() so the printed bar lands exactly where
 * the engine looks for it.
 */
export const markerBarPositions = (columns: number, questions: number): number[] => {
  const width = boxWidth(columns);
  const groups = markerGroups(columns, questions);
  const positions: number[] = [];
  let cursor = BOX_BORDER + BOX_PAD_X;
  groups.forEach((count, groupIndex) => {
    if (groupIndex === groups.length - 1) {
      const groupWidth = count * (MARKER_BAR_W + MARKER_GAP) - MARKER_GAP;
      cursor = width - BOX_BORDER - BOX_PAD_X - groupWidth;
    }
    for (let bar = 0; bar < count; bar += 1) {
      positions.push(cursor);
      cursor += MARKER_BAR_W + MARKER_GAP;
    }
    cursor += MARKER_GROUP_GAP - MARKER_GAP;
  });
  return positions;
};

// --- OMR code ------------------------------------------------------------

export const makeCode = (columns: number, questions: number, template = 1): string =>
  `${template}${columns}1${questions}`;

export interface OmrCodeInfo {
  code: string;
  template: number;
  columns: ColumnCount;
  questions: number;
  scannable: boolean;
}

export const parseCode = (value: unknown): OmrCodeInfo | null => {
  const text = String(value ?? "").trim();
  if (!/^[0-9]{4,6}$/.test(text)) return null;
  const template = Number(text[0]);
  const columns = Number(text[1]);
  const marker = Number(text[2]);
  const questions = Number(text.slice(3));
  if (![1, 2, 3, 4].includes(template)) return null;
  if (!COLUMNS_CHOICES.includes(columns as ColumnCount)) return null;
  if (![0, 1].includes(marker)) return null;
  if (questions < MIN_QUESTIONS || questions > MAX_QUESTIONS) return null;
  return {
    code: makeCode(columns, questions, template),
    template,
    columns: columns as ColumnCount,
    questions,
    scannable: template === 1,
  };
};

export const validateScannableCode = (value: unknown): string | null => {
  const info = parseCode(value);
  if (!info) return "OMR কোডটি সঠিক নয় (যেমন: 12110 অথবা 141100)";
  if (!info.scannable) return "Template 1 (স্ক্যানযোগ্য) OMR কোড দিতে হবে";
  if (!sheetFitsPage(info.columns, info.questions)) {
    return `${toBn(info.columns)} কলামে এক পাতায় সর্বোচ্চ ${toBn(maxQuestionsForColumns(info.columns))} প্রশ্ন ধরে - বেশি হলে প্রিন্ট দুই পাতায় ভাগ হয়ে যায়। কলাম বাড়ান বা প্রশ্ন কমান।`;
  }
  return null;
};

/** Placement of one bubble inside the box (px, relative to box top-left). */
export const slotPosition = (columns: number, questions: number, number: number, option: number) => {
  const rows = rowsPerColumn(columns, questions);
  const column = Math.floor((number - 1) / rows);
  const row = (number - 1) % rows;
  return {
    column,
    row,
    x: columnLeft(column) + BUBBLE_CENTERS_IN_COLUMN[option],
    y: rowCenterY(row),
  };
};

/**
 * Parses pasted answer keys.  Accepts Bengali letters (ক খ গ ঘ), Latin letters
 * (A B C D), digits (1-4) and "0"/"-" as "no answer" for the remaining slots.
 */
export const parseAnswerText = (text: string): number[] => {
  const tokens = String(text || "")
    .replace(/[\n,;]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const bangla = new Map<string, number>([
    ["ক", 0], ["খ", 1], ["গ", 2], ["ঘ", 3],
    ["১", 0], ["২", 1], ["৩", 2], ["৪", 3],
  ]);
  return tokens.map((token) => {
    const first = token[0];
    if (bangla.has(first)) return bangla.get(first) as number;
    const upper = first.toUpperCase();
    if (["A", "B", "C", "D"].includes(upper)) return ["A", "B", "C", "D"].indexOf(upper);
    if (["1", "2", "3", "4"].includes(first)) return Number(first) - 1;
    return -1;
  });
};
