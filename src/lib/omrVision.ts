// Browser OMR recogniser - a faithful TypeScript port of omr/recognizer.py from
// the local OMR engine.  It runs on OpenCV.js inside the page, so a teacher
// needs nothing installed and photos never leave the computer.
//
// The pipeline is the same one the Python engine proved on 1440 test bubbles:
//   1. find the thick black frame of the answer area
//   2. perspective-correct it to a canonical rectangle (1200 px wide)
//   3. verify the four sides and read the marker row (columns / question blocks)
//   4. line up the bubble grid (layout fractions + projection refinement)
//   5. score every bubble and decide which option was marked

import {
  BUBBLE_R,
  BOX_BORDER,
  BOX_PAD_X,
  COLUMN_GAP,
  COLUMN_W,
  COLUMNS_CHOICES,
  MARKER_BAR_H,
  MARKER_BAR_W,
  MARKER_BOTTOM_BORDER,
  MARKER_GAP,
  MARKER_GROUP_GAP,
  MARKER_H,
  MARKER_PAD,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  ROW_GAP,
  ROW_H,
  ROW_PITCH,
  boxHeight,
  boxWidth,
  bubbleCentersInColumn,
  bubbleSlots,
  rowsPerColumn,
} from "@/lib/omrLayout";

export type Cv = any;

const WORK_MAX_DIM = 1700;
const WARP_W = 1200;

let cvPromise: Promise<Cv> | null = null;

/** Load the OpenCV.js build that ships with the app (cached after first use). */
export const loadOpenCv = async (): Promise<Cv> => {
  if (!cvPromise) {
    cvPromise = (async () => {
      const imported: any = await import("@techstark/opencv-js");
      const candidate: any = imported?.default ?? imported;
      if (candidate instanceof Promise) return await candidate;
      if (candidate?.Mat) return candidate;
      await new Promise<void>((resolve) => {
        candidate.onRuntimeInitialized = () => resolve();
      });
      return candidate;
    })();
  }
  return cvPromise;
};

export class OmrVisionError extends Error {
  code: string;
  details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "OmrVisionError";
    this.code = code;
    this.details = details;
  }
}

/** Same Bengali texts the local engine uses, so the pages read the same. */
export const VISION_ERROR_MESSAGES: Record<string, string> = {
  BORDER_NOT_FOUND:
    "OMR Area খুঁজে পাওয়া যায়নি ছবিতে। ফুল OMR যেন ছবিতে স্পষ্ট থাকে এমন ভাবে ছবি তুলুন। আরেকটি কারণ হতে পারে ছবির কোয়ালিটি অনেক খারাপ।",
  MISMATCH_TOKEN:
    "Mismatch OMR Token and OMR Sheet। টোকেনে দেওয়া OMR Code এর সাথে আপলোডকৃত OMR এর মিল নেই। ছবিতে অবাঞ্ছিত দাগ, ছায়া, অপর্যাপ্ত আলো বা নয়েজ থাকলে এমন হয়। CamScanner দিয়ে ছবির কোয়ালিটি ঠিক করে আবার চেষ্টা করুন।",
  ANSWER_SCRIPT_EMPTY: "টোকেনের উত্তরপত্র এখনও সম্পূর্ণ হয়নি। টোকেন থেকে উত্তরপত্র আপডেট করুন।",
  BAD_IMAGE: "ছবিটি পড়া যায়নি। অন্য ছবি দিয়ে চেষ্টা করুন।",
};

// ----------------------------------------------------------------------
// layout fractions (port of layout.box_fractions)
// ----------------------------------------------------------------------

export interface BoxFractions {
  columns: number;
  questions: number;
  rowsPerColumn: number;
  boxWidth: number;
  boxHeight: number;
  aspect: number;
  marker: { top: number; bottom: number };
  gridTop: number;
  rowPitch: number;
  rowCenter: number;
  questionGroups: number;
  slots: { number: number; option: number; fx: number; fy: number; fr: number }[];
  columnBoxes: { x0: number; x1: number; bubbleX: number[] }[];
}

export const boxFractions = (columns: number, questions: number): BoxFractions => {
  const width = boxWidth(columns);
  const height = boxHeight(columns, questions);
  const rows = rowsPerColumn(columns, questions);
  const slots = bubbleSlots(columns, questions).map((slot) => ({
    number: slot.number,
    option: slot.option,
    fx: slot.x / width,
    fy: slot.y / height,
    fr: BUBBLE_R / width,
  }));
  const centres = bubbleCentersInColumn();
  const columnBoxes: { x0: number; x1: number; bubbleX: number[] }[] = [];
  for (let column = 0; column < columns; column += 1) {
    const x0 = BOX_BORDER + BOX_PAD_X + column * (COLUMN_W + COLUMN_GAP);
    columnBoxes.push({
      x0: x0 / width,
      x1: (x0 + COLUMN_W) / width,
      bubbleX: centres.map((offset) => (x0 + offset) / width),
    });
  }
  return {
    columns,
    questions,
    rowsPerColumn: rows,
    boxWidth: width,
    boxHeight: height,
    aspect: height / width,
    marker: {
      top: (BOX_BORDER + MARKER_PAD) / height,
      bottom: (BOX_BORDER + MARKER_H - MARKER_BOTTOM_BORDER) / height,
    },
    gridTop: (BOX_BORDER + MARKER_H) / height,
    rowPitch: ROW_PITCH / height,
    rowCenter: (BOX_BORDER + MARKER_H + ROW_GAP + ROW_H / 2) / height,
    questionGroups: Math.ceil(questions / 10),
    slots,
    columnBoxes,
  };
};

// ----------------------------------------------------------------------
// small helpers
// ----------------------------------------------------------------------

type Quad = number[][] | { x: number; y: number }[];

const asPairs = (quad: Quad): number[][] =>
  quad.map((point: any) => (Array.isArray(point) ? [Number(point[0]), Number(point[1])] : [Number(point.x), Number(point.y)]));

/** top-left, top-right, bottom-right, bottom-left */
const orderQuad = (quad: Quad): number[][] => {
  const points = asPairs(quad);
  const ordered: number[][] = [[0, 0], [0, 0], [0, 0], [0, 0]];
  const sums = points.map((p) => p[0] + p[1]);
  const diffs = points.map((p) => p[1] - p[0]);
  ordered[0] = points[sums.indexOf(Math.min(...sums))];
  ordered[2] = points[sums.indexOf(Math.max(...sums))];
  ordered[1] = points[diffs.indexOf(Math.min(...diffs))];
  ordered[3] = points[diffs.indexOf(Math.max(...diffs))];
  return ordered;
};

const quadSideLengths = (quad: number[][]): [number, number] => {
  const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const top = distance(quad[1], quad[0]);
  const bottom = distance(quad[2], quad[3]);
  const left = distance(quad[3], quad[0]);
  const right = distance(quad[2], quad[1]);
  return [Math.max((top + bottom) / 2, 1), Math.max((left + right) / 2, 1)];
};

const runs = (values: ArrayLike<number>, threshold: number, minWidth: number): [number, number][] => {
  const found: [number, number][] = [];
  let start: number | null = null;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value >= threshold && start === null) start = index;
    else if (value < threshold && start !== null) {
      if (index - start >= minWidth) found.push([start, index]);
      start = null;
    }
  }
  if (start !== null && values.length - start >= minWidth) found.push([start, values.length]);
  return found;
};

const percentile = (values: number[], percentileValue: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * (percentileValue / 100);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};

/** Mean of every column of a CV_8UC1 Mat, scaled to 0..1. */
const columnProfile = (mat: any, y0: number, y1: number): Float64Array => {
  const width = mat.cols;
  const profile = new Float64Array(width);
  const data = mat.data as Uint8Array;
  const rows = Math.max(0, y1 - y0);
  if (rows === 0) return profile;
  for (let y = y0; y < y1; y += 1) {
    const rowStart = y * width;
    for (let x = 0; x < width; x += 1) profile[x] += data[rowStart + x];
  }
  for (let x = 0; x < width; x += 1) profile[x] /= rows * 255;
  return profile;
};

/** Mean of every row of a CV_8UC1 Mat (optionally over an x range), 0..1. */
const rowProfile = (mat: any, x0: number, x1: number): Float64Array => {
  const width = mat.cols;
  const height = mat.rows;
  const profile = new Float64Array(height);
  const data = mat.data as Uint8Array;
  const columns = Math.max(0, x1 - x0);
  if (columns === 0) return profile;
  for (let y = 0; y < height; y += 1) {
    let total = 0;
    const rowStart = y * width;
    for (let x = x0; x < x1; x += 1) total += data[rowStart + x];
    profile[y] = total / (columns * 255);
  }
  return profile;
};

// ----------------------------------------------------------------------
// 1. find the answer-area frame
// ----------------------------------------------------------------------

export const findBoxCandidates = (cv: Cv, gray: any, limit = 8): number[][][] => {
  const height = gray.rows;
  const width = gray.cols;
  const scale = Math.min(1, WORK_MAX_DIM / Math.max(height, width));
  let work = gray;
  let resized: any = null;
  if (scale < 1) {
    resized = new cv.Mat();
    cv.resize(gray, resized, new cv.Size(Math.round(width * scale), Math.round(height * scale)), 0, 0, cv.INTER_AREA);
    work = resized;
  }

  const blur = new cv.Mat();
  cv.GaussianBlur(work, blur, new cv.Size(5, 5), 0);
  const area = work.rows * work.cols;

  const configs: [number, number, number, number][] = [
    [51, 12, 3, 1],
    [35, 10, 3, 1],
    [75, 15, 3, 1],
    [51, 12, 7, 2],
    [35, 10, 5, 2],
    [75, 15, 9, 3],
  ];
  const attempts: any[] = [];
  for (const [block, c, ksize, iters] of configs) {
    const binary = new cv.Mat();
    cv.adaptiveThreshold(blur, binary, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, block, c);
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(ksize, ksize));
    const closed = new cv.Mat();
    cv.morphologyEx(binary, closed, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), iters);
    binary.delete();
    kernel.delete();
    attempts.push(closed);
  }

  const found: { area: number; quad: number[][] }[] = [];
  for (const binary of attempts) {
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const areas: { index: number; area: number }[] = [];
    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index);
      areas.push({ index, area: cv.contourArea(contour) });
      contour.delete();
    }
    areas.sort((a, b) => b.area - a.area);
    for (const entry of areas.slice(0, 10)) {
      const contourArea = entry.area;
      if (contourArea < 0.05 * area) continue;
      const contour = contours.get(entry.index);
      const perimeter = cv.arcLength(contour, true);
      let quad: number[][] | null = null;
      let rough: number[][] | null = null;
      for (const epsilon of [0.02, 0.03, 0.05]) {
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, epsilon * perimeter, true);
        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          const flat = approx.data32S as Int32Array;
          const candidate = [
            [flat[0], flat[1]],
            [flat[2], flat[3]],
            [flat[4], flat[5]],
            [flat[6], flat[7]],
          ];
          const areaMat = cv.matFromArray(4, 1, cv.CV_32SC2, candidate.flat());
          const candidateArea = cv.contourArea(areaMat);
          areaMat.delete();
          if (candidateArea >= 0.7 * contourArea) {
            quad = candidate;
            approx.delete();
            break;
          }
          if (rough === null) rough = candidate;
        }
        approx.delete();
      }
      if (quad === null) quad = rough;
      if (quad === null) {
        const rect = cv.minAreaRect(contour);
        const rectW = rect.size.width;
        const rectH = rect.size.height;
        if (rectW < 10 || rectH < 10) {
          contour.delete();
          continue;
        }
        const aspect = Math.max(rectW, rectH) / Math.max(1, Math.min(rectW, rectH));
        if (aspect > 4) {
          contour.delete();
          continue;
        }
        if (contourArea < 0.7 * (rectW * rectH)) {
          contour.delete();
          continue;
        }
        quad = cv.RotatedRect.points(rect).map((point: any) => [point.x, point.y]);
      }
      contour.delete();
      const ordered = orderQuad(quad);
      const [sideW, sideH] = quadSideLengths(ordered);
      const ratio = sideH / sideW;
      if (ratio < 0.15 || ratio > 4) continue;
      found.push({ area: contourArea, quad: ordered });
    }
    contours.delete();
    hierarchy.delete();
    binary.delete();
  }
  blur.delete();
  if (resized) resized.delete();

  found.sort((a, b) => b.area - a.area);
  const quads: number[][][] = [];
  for (const item of found) {
    const duplicate = quads.some((other) =>
      item.quad.every((point, index) => Math.abs(point[0] - other[index][0]) <= 4 && Math.abs(point[1] - other[index][1]) <= 4),
    );
    if (duplicate) continue;
    quads.push(item.quad);
    if (quads.length >= limit) break;
  }
  return scale < 1 ? quads.map((quad) => quad.map((point) => [point[0] / scale, point[1] / scale])) : quads;
};

/** All four sides of the warped image must carry a solid border line. */
export const checkFrame = (ink: any): { ok: boolean; sides: Record<string, number> } => {
  const height = ink.rows;
  const width = ink.cols;
  if (height < 24 || width < 24) return { ok: false, sides: {} };
  const band = Math.max(2, Math.round(Math.min(height, width) * 0.02));
  const reach = Math.max(3, Math.round(Math.min(height, width) * 0.04));
  const data = ink.data as Uint8Array;

  /** Share of scanlines that carry ink: columns for a horizontal line, rows otherwise. */
  const coverage = (y0: number, y1: number, x0: number, x1: number, horizontal: boolean): number => {
    if (y1 <= y0 || x1 <= x0) return 0;
    const total = horizontal ? x1 - x0 : y1 - y0;
    if (total <= 0) return 0;
    let hits = 0;
    if (horizontal) {
      for (let x = x0; x < x1; x += 1) {
        for (let y = y0; y < y1; y += 1) {
          if (data[y * width + x] > 0) {
            hits += 1;
            break;
          }
        }
      }
    } else {
      for (let y = y0; y < y1; y += 1) {
        const rowStart = y * width;
        for (let x = x0; x < x1; x += 1) {
          if (data[rowStart + x] > 0) {
            hits += 1;
            break;
          }
        }
      }
    }
    return hits / total;
  };

  const sides: Record<string, number> = {};
  for (const [name, fromStart] of [["top", true], ["bottom", false]] as [string, boolean][]) {
    let best = 0;
    for (let offset = 0; offset < reach; offset += 1) {
      const y0 = fromStart ? offset : height - band - offset;
      const y1 = y0 + band;
      if (y0 < 0 || y1 > height) continue;
      best = Math.max(best, coverage(y0, y1, 0, width, true));
    }
    sides[name] = Math.round(best * 1000) / 1000;
  }
  for (const [name, fromStart] of [["left", true], ["right", false]] as [string, boolean][]) {
    let best = 0;
    for (let offset = 0; offset < reach; offset += 1) {
      const x0 = fromStart ? offset : width - band - offset;
      const x1 = x0 + band;
      if (x0 < 0 || x1 > width) continue;
      best = Math.max(best, coverage(0, height, x0, x1, false));
    }
    sides[name] = Math.round(best * 1000) / 1000;
  }
  const ok = Object.values(sides).every((value) => value >= 0.85);
  return { ok, sides };
};

const candidateOrder = (candidates: number[][][], lf: BoxFractions): number[][][] => {
  const expected = lf.aspect;
  if (expected <= 0 || candidates.length < 2) return [...candidates];
  const deviation = (quad: number[][]) => {
    const [, sideH] = quadSideLengths(quad);
    const [sideW] = quadSideLengths(quad);
    return Math.abs(sideH / sideW - expected) / expected;
  };
  return [...candidates].sort((a, b) => deviation(a) - deviation(b));
};

/** Perspective-correct the frame to a canonical rectangle. */
export const warpBox = (cv: Cv, gray: any, quad: number[][], aspect: number): { warped: any; matrix: any } => {
  const [sideW, sideH] = quadSideLengths(quad);
  const outW = WARP_W;
  let outH = outW * (sideH / sideW);
  if (aspect > 0 && Math.abs(outH / outW - aspect) / aspect > 0.35) outH = outW * aspect;
  outH = Math.max(120, outH);
  const source = cv.matFromArray(4, 1, cv.CV_32FC2, [
    quad[0][0], quad[0][1],
    quad[1][0], quad[1][1],
    quad[2][0], quad[2][1],
    quad[3][0], quad[3][1],
  ]);
  const destination = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, outW - 1, 0, outW - 1, outH - 1, 0, outH - 1]);
  const matrix = cv.getPerspectiveTransform(source, destination);
  const warped = new cv.Mat();
  cv.warpPerspective(
    gray,
    warped,
    matrix,
    new cv.Size(Math.trunc(outW), Math.trunc(outH)),
    cv.INTER_CUBIC,
    cv.BORDER_CONSTANT,
    new cv.Scalar(255, 255, 255, 255),
  );
  source.delete();
  destination.delete();
  return { warped, matrix };
};

/** Flat-field correction + Otsu -> binary ink mask (shadows on phone photos). */
export const inkMask = (cv: Cv, warped: any): any => {
  const sigma = Math.max(6, warped.cols / 20);
  const background = new cv.Mat();
  cv.GaussianBlur(warped, background, new cv.Size(0, 0), sigma);
  const normalized = new cv.Mat(warped.rows, warped.cols, cv.CV_8UC1);
  const gray = warped.data as Uint8Array;
  const back = background.data as Uint8Array;
  const out = normalized.data as Uint8Array;
  for (let index = 0; index < gray.length; index += 1) {
    const value = (gray[index] / Math.max(back[index], 1)) * 200;
    out[index] = value > 255 ? 255 : value < 0 ? 0 : Math.trunc(value);
  }
  const blur = new cv.Mat();
  cv.GaussianBlur(normalized, blur, new cv.Size(3, 3), 0);
  const ink = new cv.Mat();
  cv.threshold(blur, ink, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
  const opened = new cv.Mat();
  cv.morphologyEx(ink, opened, cv.MORPH_OPEN, kernel);
  background.delete();
  normalized.delete();
  blur.delete();
  ink.delete();
  kernel.delete();
  return opened;
};

// ----------------------------------------------------------------------
// 2. marker row: how many columns / question blocks does this sheet have?
// ----------------------------------------------------------------------

const markerBarPositions = (lf: BoxFractions): number[] => {
  const positions: number[] = [];
  let cursor = BOX_BORDER + BOX_PAD_X;
  const groups = [1, lf.columns, 1, lf.questionGroups];
  groups.forEach((count, groupIndex) => {
    if (groupIndex === groups.length - 1) {
      const width = count * (MARKER_BAR_W + MARKER_GAP) - MARKER_GAP;
      cursor = lf.boxWidth - BOX_BORDER - BOX_PAD_X - width;
    }
    for (let bar = 0; bar < count; bar += 1) {
      positions.push(cursor);
      cursor += MARKER_BAR_W + MARKER_GAP;
    }
    cursor += MARKER_GROUP_GAP - MARKER_GAP;
  });
  return positions;
};

const rectMean = (mat: any, x0: number, y0: number, x1: number, y1: number): number => {
  const width = mat.cols;
  const height = mat.rows;
  const left = Math.max(0, Math.min(width, x0));
  const right = Math.max(0, Math.min(width, x1));
  const top = Math.max(0, Math.min(height, y0));
  const bottom = Math.max(0, Math.min(height, y1));
  if (right <= left || bottom <= top) return 0;
  const data = mat.data as Uint8Array;
  let total = 0;
  for (let y = top; y < bottom; y += 1) {
    const rowStart = y * width;
    for (let x = left; x < right; x += 1) total += data[rowStart + x];
  }
  return total / ((right - left) * (bottom - top)) / 255;
};

/** Verify the marker row of the uploaded sheet against the token layout. */
export const checkMarkerPattern = (ink: any, lf: BoxFractions) => {
  const height = ink.rows;
  const width = ink.cols;
  const scaleX = width / lf.boxWidth;
  const scaleY = height / lf.boxHeight;
  const y0 = Math.trunc((BOX_BORDER + MARKER_PAD) * scaleY);
  const y1 = Math.max(y0 + 2, Math.trunc((BOX_BORDER + MARKER_PAD + MARKER_BAR_H) * scaleY));
  const barW = Math.max(2, Math.trunc(MARKER_BAR_W * scaleX));
  const search = Math.max(1, Math.trunc(barW * 0.45));
  const step = Math.max(1, Math.trunc(search / 4));
  const values: number[] = [];
  for (const xLayout of markerBarPositions(lf)) {
    let best = 0;
    for (let offset = -search; offset <= search; offset += step) {
      const x0 = Math.trunc(xLayout * scaleX) + offset;
      const x1 = x0 + barW;
      if (x0 < 0 || x1 > width) continue;
      best = Math.max(best, rectMean(ink, x0, y0, x1, y1));
    }
    values.push(best);
  }
  const expected = values.length;
  const present = values.filter((value) => value > 0.45).length;
  return {
    ok: expected > 0 && present >= Math.ceil(expected * 0.8),
    present,
    expected,
    values: values.map((value) => Math.round(value * 100) / 100),
  };
};

/** Read the marker row as runs: column count and question-block count. */
export const detectMarkers = (ink: any, lf: BoxFractions, expectedColumns: number) => {
  const height = ink.rows;
  const width = ink.cols;
  const bandTop = Math.max(0, Math.trunc(lf.marker.top * height) - Math.trunc(0.02 * height));
  const bandBottom = Math.min(height, Math.trunc(lf.marker.bottom * height) + Math.trunc(0.02 * height));
  if (bandBottom <= bandTop) return { ok: false as const };
  const projection = columnProfile(ink, bandTop, bandBottom);
  const scale = width / lf.boxWidth;
  const barW = Math.max(3, MARKER_BAR_W * scale);
  const intraGap = MARKER_GAP * scale;
  const interGap = MARKER_GROUP_GAP * scale;
  let bars = runs(projection, 0.35, Math.max(2, Math.trunc(barW * 0.35)));
  bars = bars.filter((bar) => bar[1] - bar[0] <= barW * 2);
  if (!bars.length) return { ok: false as const };
  const groups: [number, number][][] = [[bars[0]]];
  const splitGap = 0.55 * (intraGap + interGap);
  for (let index = 1; index < bars.length; index += 1) {
    const previous = bars[index - 1];
    const current = bars[index];
    if (current[0] - previous[1] > splitGap) groups.push([current]);
    else groups[groups.length - 1].push(current);
  }
  const counts = groups.map((group) => group.length);
  const info: Record<string, unknown> = {
    ok: groups.length >= 3,
    groups: counts,
    bar_width: Math.round(barW * 10) / 10,
  };
  if (groups.length >= 4) {
    info.columns = counts[1];
    info.question_blocks = counts[3];
  } else if (groups.length === 3) {
    info.columns = counts[1];
    info.question_blocks = counts[2];
  } else {
    info.columns = expectedColumns;
    info.question_blocks = null;
  }
  return info as { ok: boolean; groups: number[]; columns: number; question_blocks: number | null; bar_width: number };
};

// ----------------------------------------------------------------------
// 3. line the bubble grid up with this particular photo
// ----------------------------------------------------------------------

const smoothRows = (centers: number[], pitch: number): number[] => {
  if (centers.length < 3) return centers;
  const count = centers.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let index = 0; index < count; index += 1) {
    sumX += index;
    sumY += centers[index];
    sumXY += index * centers[index];
    sumXX += index * index;
  }
  const denominator = count * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (count * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / count;
  const fitted = centers.map((_, index) => intercept + slope * index);
  const residual = fitted.reduce((total, value, index) => total + Math.abs(value - centers[index]), 0) / count;
  return residual > pitch * 0.35 ? centers : fitted;
};

/** y centre of every bubble row, for every column. */
export const refineRows = (ink: any, columnBoxes: { x0: number; x1: number }[], lf: BoxFractions): number[][] => {
  const height = ink.rows;
  const gridTop = lf.gridTop * height;
  const pitch = lf.rowPitch * height;
  const rows = lf.rowsPerColumn;
  const refined: number[][] = [];
  for (const box of columnBoxes) {
    const x0 = Math.trunc(box.x0);
    const x1 = Math.max(x0 + 1, Math.trunc(box.x1));
    const projection = rowProfile(ink, x0, x1);
    const columnRows: number[] = [];
    for (let row = 0; row < rows; row += 1) {
      const expected = gridTop + (row + 0.5) * pitch;
      const window = Math.trunc(pitch * 0.42);
      const lo = Math.max(0, Math.trunc(expected - window));
      const hi = Math.min(height, Math.trunc(expected + window));
      let placed = false;
      if (hi > lo) {
        const local = projection.slice(lo, hi);
        const max = local.length ? Math.max(...local) : 0;
        if (max > 0.05) {
          const segments: [number, number][] = [];
          let start: number | null = null;
          local.forEach((value, index) => {
            const isInk = value > 0.4 * max;
            if (isInk && start === null) start = index;
            else if (!isInk && start !== null) {
              segments.push([start, index]);
              start = null;
            }
          });
          if (start !== null) segments.push([start, local.length]);
          if (segments.length) {
            const widest = segments.reduce((best, item) => (item[1] - item[0] > best[1] - best[0] ? item : best), segments[0]);
            const centre = lo + (widest[0] + widest[1]) / 2;
            if (Math.abs(centre - expected) <= window) {
              columnRows.push(centre);
              placed = true;
            }
          }
        }
      }
      if (!placed) columnRows.push(expected);
    }
    refined.push(smoothRows(columnRows, pitch));
  }
  return refined;
};

// ----------------------------------------------------------------------
// 4. score every bubble
// ----------------------------------------------------------------------

/** Returns [ink ratio, blob ratio] for one bubble. */
export const bubbleScores = (cv: Cv, ink: any, cx: number, cy: number, radius: number): [number, number] => {
  const inner = Math.max(2, radius * 0.62);
  const size = Math.ceil(inner * 2 + 4);
  const x0 = Math.round(cx - size / 2);
  const y0 = Math.round(cy - size / 2);
  const width = ink.cols;
  const height = ink.rows;
  if (x0 < 0 || y0 < 0 || y0 + size > height || x0 + size > width) return [0, 0];
  const data = ink.data as Uint8Array;
  const patch = new cv.Mat(size, size, cv.CV_8UC1);
  const patchData = patch.data as Uint8Array;
  let maskCount = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - size / 2;
      const dy = y - size / 2;
      const inside = dx * dx + dy * dy <= inner * inner;
      const value = inside ? data[(y0 + y) * width + (x0 + x)] : 0;
      patchData[y * size + x] = value > 127 ? 255 : 0;
      if (inside) maskCount += 1;
    }
  }
  if (maskCount === 0) {
    patch.delete();
    return [0, 0];
  }
  let inkCount = 0;
  for (let index = 0; index < patchData.length; index += 1) if (patchData[index] > 127) inkCount += 1;
  const inkRatio = inkCount / maskCount;

  const erodeRadius = Math.max(1, Math.round(radius * 0.12));
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(2 * erodeRadius + 1, 2 * erodeRadius + 1));
  const solid = new cv.Mat();
  cv.erode(patch, solid, kernel, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, new cv.Scalar(0));
  const labels = new cv.Mat();
  const stats = new cv.Mat();
  const centroids = new cv.Mat();
  cv.connectedComponentsWithStats(solid, labels, stats, centroids, 8, cv.CV_32S);
  let blob = 0;
  const count = stats.rows;
  for (let index = 1; index < count; index += 1) {
    const area = stats.intAt(index, cv.CC_STAT_AREA);
    if (area > blob) blob = area;
  }
  patch.delete();
  kernel.delete();
  solid.delete();
  labels.delete();
  stats.delete();
  centroids.delete();
  return [inkRatio, blob / maskCount];
};

export const bubbleRadiusPx = (lf: BoxFractions, warpedWidth: number): number =>
  Math.max(2.5, lf.slots[0].fr * warpedWidth);

/** Small per-column horizontal correction (print / scan skew). */
export const columnOffsets = (
  ink: any,
  columnBoxes: { x0: number; x1: number; bubbleX: number[] }[],
  rowCenters: number[][],
  lf: BoxFractions,
  warpedWidth: number,
  radius: number,
): number[] => {
  const height = ink.rows;
  const scale = warpedWidth / lf.boxWidth;
  const bubbleD = 24 * scale;
  const offsets: number[] = [];
  const data = ink.data as Uint8Array;
  columnBoxes.forEach((box, index) => {
    const rows = rowCenters[index] ?? [];
    const strips: [number, number][] = [];
    for (const yCenter of rows) {
      const y0 = Math.max(0, Math.trunc(yCenter - radius * 0.6));
      const y1 = Math.min(height, Math.trunc(yCenter + radius * 0.6) + 1);
      if (y1 > y0) strips.push([y0, y1]);
    }
    if (!strips.length) {
      offsets.push(0);
      return;
    }
    const projection = new Float64Array(ink.cols);
    let counted = 0;
    for (const [y0, y1] of strips) {
      for (let y = y0; y < y1; y += 1) {
        const rowStart = y * ink.cols;
        for (let x = 0; x < projection.length; x += 1) projection[x] += data[rowStart + x];
      }
      counted += y1 - y0;
    }
    if (!counted) {
      offsets.push(0);
      return;
    }
    for (let x = 0; x < projection.length; x += 1) projection[x] /= counted * 255;
    const shifts: number[] = [];
    for (const fraction of box.bubbleX) {
      const expected = fraction * warpedWidth;
      const window = Math.max(3, bubbleD * 0.45);
      const lo = Math.max(0, Math.trunc(expected - window));
      const hi = Math.min(projection.length, Math.trunc(expected + window) + 1);
      if (hi - lo < 3) continue;
      let min = Infinity;
      for (let x = lo; x < hi; x += 1) min = Math.min(min, projection[x]);
      let weightSum = 0;
      let weighted = 0;
      for (let x = lo; x < hi; x += 1) {
        const weight = Math.max(0, projection[x] - min);
        weightSum += weight;
        weighted += x * weight;
      }
      if (weightSum <= 1e-6) continue;
      shifts.push(weighted / weightSum - expected);
    }
    if (!shifts.length) {
      offsets.push(0);
      return;
    }
    shifts.sort((a, b) => a - b);
    const median = shifts[Math.floor(shifts.length / 2)];
    const limit = bubbleD * 0.4;
    offsets.push(Math.max(-limit, Math.min(limit, median)));
  });
  return offsets;
};

/** Measure the real bubble radius of this sheet (other printers scale it). */
export const estimateRadius = (
  ink: any,
  columnBoxes: { bubbleX: number[] }[],
  rowCenters: number[][],
  warpedWidth: number,
  layoutRadius: number,
): number => {
  const height = ink.rows;
  const diameters: number[] = [];
  columnBoxes.forEach((box, index) => {
    const rows = rowCenters[index] ?? [];
    for (const yCenter of rows) {
      const y0 = Math.max(0, Math.trunc(yCenter - layoutRadius * 0.5));
      const y1 = Math.min(height, Math.trunc(yCenter + layoutRadius * 0.5) + 1);
      if (y1 <= y0) continue;
      const band = columnProfile(ink, y0, y1);
      for (const fraction of box.bubbleX) {
        const centre = fraction * warpedWidth;
        const window = Math.max(3, Math.trunc(layoutRadius * 0.85));
        const lo = Math.max(0, Math.trunc(centre - window));
        const hi = Math.min(band.length, Math.trunc(centre + window) + 1);
        if (hi - lo < 4) continue;
        const local = band.slice(lo, hi);
        if (Math.max(...local) < 0.2) continue;
        const middle = Math.floor(local.length / 2);
        const left = local.slice(0, middle);
        const right = local.slice(middle);
        if (left.length < 2 || right.length < 2) continue;
        let leftPeak = 0;
        for (let index = 1; index < left.length; index += 1) if (left[index] > left[leftPeak]) leftPeak = index;
        let rightPeak = 0;
        for (let index = 1; index < right.length; index += 1) if (right[index] > right[rightPeak]) rightPeak = index;
        const diameter = lo + middle + rightPeak - (lo + leftPeak);
        if (diameter >= layoutRadius * 0.6 && diameter <= layoutRadius * 3) diameters.push(diameter);
      }
    }
  });
  if (diameters.length < 8) return layoutRadius;
  diameters.sort((a, b) => a - b);
  const measured = diameters[Math.floor(diameters.length / 2)] / 2;
  return Math.min(Math.max(measured, layoutRadius * 0.6), layoutRadius * 1.25);
};

/** A filled bubble is one big dark blob; a printed letter is not. */
export const scoreValue = (inkRatio: number, blobRatio: number): number =>
  0.7 * Math.min(1, blobRatio / 0.6) + 0.3 * inkRatio;

// ----------------------------------------------------------------------
// 5. public API
// ----------------------------------------------------------------------

export interface VisionToken {
  columns: number;
  questions: number;
  /** answerIndex per question, -1 = no answer */
  answerKey: number[];
  negativeMarking?: number;
  /** include raw (ink, blob) ratios per option in the result */
  debug?: boolean;
}

export interface VisionPerQuestion {
  number: number;
  marked: number | null;
  correct: number;
  status: "correct" | "incorrect" | "multiple" | "unanswered";
  scores: number[];
  /** row anchor (first option) in rectified px - same meaning as the Python engine */
  center: [number, number];
  /** where the marked option actually sits, for drawing on the photo */
  markedCenter: [number, number] | null;
  pairs?: [number, number][];
}

export interface VisionOutcome {
  result: {
    result: number;
    touched: number;
    multipleTouched: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    totalNegative: number;
    totalQuestions: number;
  };
  perQuestion: VisionPerQuestion[];
  detected: {
    columns: number;
    questionBlocks: number | null;
    markerGroups: number[] | null;
    box: number[][];
    /** size of the rectified sheet the engine actually measured */
    warpedSize: [number, number];
  };
  processingTime: number;
  debug?: Record<string, unknown>;
}

const imageDataToMat = (cv: Cv, source: ImageData | HTMLCanvasElement | HTMLImageElement): any => {
  if (typeof ImageData !== "undefined" && source instanceof ImageData) return cv.matFromImageData(source);
  return cv.imread(source as any);
};

/** Evaluate one OMR photo against a token, entirely inside the browser. */
export const analyzeOmr = async (
  source: ImageData | HTMLCanvasElement | HTMLImageElement,
  token: VisionToken,
): Promise<VisionOutcome> => {
  const started = Date.now();
  const cv = await loadOpenCv();

  const { columns, questions } = token;
  if (!COLUMNS_CHOICES.includes(columns as 2 | 3 | 4) || questions < MIN_QUESTIONS || questions > MAX_QUESTIONS) {
    throw new OmrVisionError("MISMATCH_TOKEN", VISION_ERROR_MESSAGES.MISMATCH_TOKEN);
  }
  if (token.answerKey.length < questions) {
    throw new OmrVisionError("ANSWER_SCRIPT_EMPTY", VISION_ERROR_MESSAGES.ANSWER_SCRIPT_EMPTY);
  }

  const sourceMat = imageDataToMat(cv, source);
  if (!sourceMat || !sourceMat.rows) throw new OmrVisionError("BAD_IMAGE", VISION_ERROR_MESSAGES.BAD_IMAGE);
  const gray = new cv.Mat();
  cv.cvtColor(sourceMat, gray, cv.COLOR_RGBA2GRAY);

  const lf = boxFractions(columns, questions);
  const candidates = findBoxCandidates(cv, gray);
  if (!candidates.length) {
    sourceMat.delete();
    gray.delete();
    throw new OmrVisionError("BORDER_NOT_FOUND", VISION_ERROR_MESSAGES.BORDER_NOT_FOUND);
  }

  let chosen: { quad: number[][]; warped: any; ink: any; markers: any; matrix: any } | null = null;
  let bestQuad: number[][] = candidates[0];
  let bestMarkers: any = null;
  let bestFrame: any = null;
  let bestScore = -1;

  for (const candidate of candidateOrder(candidates, lf)) {
    const { warped, matrix } = warpBox(cv, gray, candidate, lf.aspect);
    const ink = inkMask(cv, warped);
    const frame = checkFrame(ink);
    const markers = checkMarkerPattern(ink, lf);
    const expected = markers.expected || 1;
    const frameHits = Object.values(frame.sides).filter((value) => value >= 0.85).length;
    const score = frameHits + (markers.present || 0) / expected;
    if (score > bestScore) {
      bestScore = score;
      bestQuad = candidate;
      bestMarkers = markers;
      bestFrame = frame;
    }
    if (markers.ok && frame.ok) {
      chosen = { quad: candidate, warped, ink, markers, matrix };
      break;
    }
    warped.delete();
    ink.delete();
    matrix.delete();
  }

  if (!chosen) {
    const { warped } = warpBox(cv, gray, bestQuad, lf.aspect);
    const ink = inkMask(cv, warped);
    const runBased = detectMarkers(ink, lf, columns);
    warped.delete();
    ink.delete();
    sourceMat.delete();
    gray.delete();
    throw new OmrVisionError("MISMATCH_TOKEN", VISION_ERROR_MESSAGES.MISMATCH_TOKEN, {
      marker_check: bestMarkers ?? {},
      frame_check: bestFrame ?? {},
      run_based: runBased,
    });
  }

  const { warped, ink, markers, quad, matrix } = chosen;
  const warpedW = warped.cols;
  const warpedH = warped.rows;
  const columnBoxes = lf.columnBoxes.map((box) => ({
    x0: box.x0 * warpedW,
    x1: box.x1 * warpedW,
    bubbleX: box.bubbleX.slice(),
  }));
  const rowCenters = refineRows(ink, columnBoxes, lf);
  const layoutRadius = bubbleRadiusPx(lf, warpedW);
  const offsets = columnOffsets(ink, columnBoxes, rowCenters, lf, warpedW, layoutRadius);
  const radius = estimateRadius(ink, columnBoxes, rowCenters, warpedW, layoutRadius);

  const gathered: {
    number: number;
    column: number;
    row: number;
    xCenters: number[];
    y: number;
    values: number[];
    pairs: [number, number][];
  }[] = [];

  for (const slot of lf.slots) {
    if (slot.option !== 0) continue;
    const number = slot.number;
    const slotX = slot.fx * warpedW;
    let column = columnBoxes.findIndex((box) => box.x0 - 0.5 <= slotX && slotX <= box.x1 + 0.5);
    if (column < 0) column = 0;
    const rows = lf.rowsPerColumn;
    let rowIndex = -1;
    for (let index = 0; index < rows; index += 1) {
      if (column * rows + index + 1 === number) {
        rowIndex = index;
        break;
      }
    }
    if (rowIndex < 0 || rowIndex >= rowCenters[column].length) continue;
    const yCenter = rowCenters[column][rowIndex];
    const xCenters = columnBoxes[column].bubbleX.map((fraction) => fraction * warpedW + offsets[column]);
    const values: number[] = [];
    const pairs: [number, number][] = [];
    for (const x of xCenters) {
      const [inkRatio, blobRatio] = bubbleScores(cv, ink, x, yCenter, radius);
      values.push(scoreValue(inkRatio, blobRatio));
      pairs.push([Math.round(inkRatio * 1000) / 1000, Math.round(blobRatio * 1000) / 1000]);
    }
    gathered.push({ number, column, row: rowIndex, xCenters, y: yCenter, values, pairs });
  }

  const allValues = gathered.flatMap((item) => item.values);
  const baseline = allValues.length ? percentile(allValues, 40) : 0;

  const perQuestion: VisionPerQuestion[] = [];
  let touched = 0;
  let correct = 0;
  let incorrect = 0;
  let multiple = 0;
  let unanswered = 0;

  for (const item of gathered) {
    const values = item.values;
    const best = values.length ? Math.max(...values) : 0;
    const threshold = Math.max(0.62, best * 0.65, baseline + 0.2);
    const filled = values.map((value, index) => (value >= threshold ? index : -1)).filter((index) => index >= 0);
    const isMultiple = filled.length > 1;
    const marked: number | null = isMultiple ? values.indexOf(best) : filled.length === 1 ? filled[0] : null;
    const key = item.number - 1 < token.answerKey.length ? token.answerKey[item.number - 1] : -1;
    let outcome: VisionPerQuestion["status"];
    if (marked === null) {
      unanswered += 1;
      outcome = "unanswered";
    } else if (isMultiple) {
      multiple += 1;
      touched += 1;
      incorrect += 1;
      outcome = "multiple";
    } else {
      touched += 1;
      if (marked === key) {
        correct += 1;
        outcome = "correct";
      } else {
        incorrect += 1;
        outcome = "incorrect";
      }
    }
    perQuestion.push({
      number: item.number,
      marked,
      correct: key,
      status: outcome,
      scores: values.map((value) => Math.round(value * 1000) / 1000),
      center: [Math.trunc(item.xCenters[0]), Math.trunc(item.y)],
      markedCenter:
        marked === null ? null : [Math.trunc(item.xCenters[marked]), Math.trunc(item.y)],
      ...(token.debug ? { pairs: item.pairs } : {}),
    });
  }

  const negativeMarking = token.negativeMarking ?? 0;
  const totalNegative = Math.round(incorrect * negativeMarking * 10000) / 10000;
  const marks = Math.round((correct - totalNegative) * 10000) / 10000;

  const debugInfo = token.debug
    ? {
        warped: [warped.cols, warped.rows],
        layoutRadius,
        radius,
        offsets,
        inkSum: (() => {
          const data = ink.data as Uint8Array;
          let total = 0;
          for (let index = 0; index < data.length; index += 1) if (data[index] > 127) total += 1;
          return total;
        })(),
      }
    : undefined;

  warped.delete();
  ink.delete();
  matrix.delete();
  sourceMat.delete();
  gray.delete();

  return {
    result: {
      result: marks,
      touched,
      multipleTouched: multiple,
      correct,
      incorrect,
      unanswered,
      totalNegative,
      totalQuestions: questions,
    },
    perQuestion,
    detected: {
      columns: markers.columns ?? columns,
      questionBlocks: markers.question_blocks ?? null,
      markerGroups: markers.groups ?? null,
      box: orderQuad(quad),
      warpedSize: [warpedW, warpedH] as [number, number],
    },
    processingTime: Date.now() - started,
    ...(debugInfo ? { debug: debugInfo } : {}),
  };
};
