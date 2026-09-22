// Draws an OMR sheet straight onto a canvas.
//
// Two jobs:
//  1. "সিস্টেম পরীক্ষা" needs a sheet the engine is known to understand - it is
//     drawn here with the very same geometry the printer uses, then pushed
//     through the normal scan path.
//  2. The result view wants the teacher's photo back with the detected bubbles
//     circled, which the Python engine used to render server side.

import {
  A4_H_PX,
  A4_W_PX,
  BOX_BORDER,
  BOX_PAD_X,
  BUBBLE_R,
  MARKER_BAR_H,
  MARKER_BAR_W,
  MARKER_GAP,
  MARKER_GROUP_GAP,
  MARKER_PAD,
  OPTION_LETTERS,
  SHEET_BOX_TOP_PX,
  boxHeight,
  boxWidth,
  bubbleSlots,
  markerGroups,
  toBn,
} from "@/lib/omrLayout";
import { loadOpenCv, type VisionOutcome } from "@/lib/omrVision";

export interface SampleSheet {
  canvas: HTMLCanvasElement;
  /** question number -> option index that was darkened */
  answers: Record<number, number>;
}

/**
 * A filled sample sheet.  `answers` maps question number -> option index; the
 * jitter and the grey shade copy what a hurried student's pencil looks like so
 * the self test exercises the real recogniser instead of a perfect drawing.
 */
export const renderSampleSheet = (
  columns: number,
  questions: number,
  answers: Record<number, number>,
  scale = 2,
): SampleSheet => {
  const pageW = Math.round(A4_W_PX * scale);
  const pageH = Math.round(A4_H_PX * scale);
  const canvas = document.createElement("canvas");
  canvas.width = pageW;
  canvas.height = pageH;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("ক্যানভাস তৈরি করা যায়নি");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, pageW, pageH);

  const boxW = Math.round(boxWidth(columns) * scale);
  const boxH = Math.round(boxHeight(columns, questions) * scale);
  const boxX = Math.round((pageW - boxW) / 2);
  // same place the printed sheet puts the box, so the sample proves that a
  // sheet this size really does fit on one page
  const boxY = Math.round(SHEET_BOX_TOP_PX * scale);

  // header lines - just enough furniture to look like a real printed sheet
  context.fillStyle = "#141414";
  context.fillRect(boxX, Math.round(40 * scale), boxW, Math.round(6 * scale));
  context.fillStyle = "#787878";
  for (let index = 0; index < 6; index += 1) {
    const y = Math.round((60 + index * 14) * scale);
    context.fillRect(boxX, y, Math.round((90 + (index % 3) * 60) * scale), Math.round(3 * scale));
  }

  // border
  const border = Math.max(1, Math.round(BOX_BORDER * scale));
  context.strokeStyle = "#000000";
  context.lineWidth = border;
  context.strokeRect(boxX + border / 2, boxY + border / 2, boxW - border, boxH - border);

  // marker row: [1, columns, 1, question blocks]
  const barW = MARKER_BAR_W * scale;
  const barH = MARKER_BAR_H * scale;
  const barGap = MARKER_GAP * scale;
  const groupGap = MARKER_GROUP_GAP * scale;
  const pad = MARKER_PAD * scale;
  const groups = markerGroups(columns, questions);
  const markerY = boxY + border + pad;
  let cursor = boxX + border + BOX_PAD_X * scale;
  context.fillStyle = "#000000";
  groups.forEach((count, groupIndex) => {
    if (groupIndex === groups.length - 1) {
      const groupWidth = count * (barW + barGap) - barGap;
      cursor = boxX + boxW - border - BOX_PAD_X * scale - groupWidth;
    }
    for (let bar = 0; bar < count; bar += 1) {
      context.fillRect(cursor, markerY, barW, barH);
      cursor += barW + barGap;
    }
    if (groupIndex !== groups.length - 1) cursor += groupGap - barGap;
  });

  // bubbles + letters
  const radius = BUBBLE_R * scale;
  const slots = bubbleSlots(columns, questions);
  context.lineWidth = Math.max(1, scale);
  context.strokeStyle = "#282828";
  context.fillStyle = "#323232";
  context.font = `500 ${Math.max(8, Math.round(radius))}px "Nirmala UI", "Vrinda", system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const slot of slots) {
    const cx = boxX + slot.x * scale;
    const cy = boxY + slot.y * scale;
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.stroke();
    context.fillText(OPTION_LETTERS[slot.option], cx, cy);
  }

  // darkened answers, matching the Python sample renderer's jitter/shade
  const fillRadius = radius * 0.72;
  context.fillStyle = "#1e1e1e";
  for (const slot of slots) {
    if (answers[slot.number] !== slot.option) continue;
    const jitter = 0.12;
    const dx = (((slot.number * 7 + slot.option * 3) % 5) - 2) * (jitter / 2) * BUBBLE_R * scale;
    const dy = (((slot.number * 5 + slot.option * 11) % 5) - 2) * (jitter / 2) * BUBBLE_R * scale;
    context.beginPath();
    context.arc(boxX + slot.x * scale + dx, boxY + slot.y * scale + dy, fillRadius, 0, Math.PI * 2);
    context.fill();
  }

  return { canvas, answers };
};

const STATUS_COLORS: Record<string, string> = {
  correct: "#059669",
  incorrect: "#dc2626",
  multiple: "#d97706",
  unanswered: "#64748b",
};

/**
 * The teacher's own photo with every read bubble circled - green correct, red
 * wrong, orange for a double mark.  `perQuestion[].center` is in rectified
 * coordinates, so the homography of the detected box maps it back.
 */
export const annotateScan = async (
  source: HTMLCanvasElement,
  outcome: VisionOutcome,
): Promise<string> => {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) return source.toDataURL("image/jpeg", 0.9);
  context.drawImage(source, 0, 0);

  const [warpedW, warpedH] = outcome.detected.warpedSize;
  const box = outcome.detected.box;
  if (!warpedW || !warpedH || box.length !== 4) return canvas.toDataURL("image/jpeg", 0.9);

  const cv = await loadOpenCv();
  const from = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, warpedW - 1, 0, warpedW - 1, warpedH - 1, 0, warpedH - 1]);
  const to = cv.matFromArray(4, 1, cv.CV_32FC2, [
    box[0][0], box[0][1],
    box[1][0], box[1][1],
    box[2][0], box[2][1],
    box[3][0], box[3][1],
  ]);
  const matrix = cv.getPerspectiveTransform(from, to);
  from.delete();
  to.delete();

  // the rectified sheet is ~1200px wide; scale the pen to the photo
  const side = Math.hypot(box[1][0] - box[0][0], box[1][1] - box[0][1]);
  const radius = Math.max(7, (18 * side) / Math.max(1, warpedW));
  context.lineWidth = Math.max(2, radius * 0.22);
  context.font = `700 ${Math.round(radius * 1.1)}px "Nirmala UI", system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  for (const question of outcome.perQuestion) {
    const spot = question.markedCenter ?? question.center;
    const point = cv.matFromArray(1, 1, cv.CV_32FC2, [spot[0], spot[1]]);
    const mapped = new cv.Mat();
    cv.perspectiveTransform(point, mapped, matrix);
    const x = mapped.data32F[0];
    const y = mapped.data32F[1];
    point.delete();
    mapped.delete();
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const color = STATUS_COLORS[question.status] ?? STATUS_COLORS.unanswered;
    context.strokeStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.stroke();

    // the student's own mark for this question gets a filled dot
    if (question.marked !== null && question.status !== "unanswered") {
      context.fillStyle = color;
      context.beginPath();
      context.arc(x, y, Math.max(2.5, radius * 0.24), 0, Math.PI * 2);
      context.fill();
    }
  }

  matrix.delete();

  // score badge so a shared screenshot carries its own result
  const label = `${toBn(outcome.result.result)} / ${toBn(outcome.result.totalQuestions)}`;
  const badgeFont = Math.max(11, Math.round(radius * 0.95));
  context.font = `700 ${badgeFont}px "Nirmala UI", system-ui, sans-serif`;
  context.textAlign = "left";
  context.textBaseline = "middle";
  const textW = context.measureText(label).width;
  const padX = radius * 0.7;
  const badgeH = badgeFont * 2;
  context.fillStyle = "rgba(17, 17, 17, 0.75)";
  context.fillRect(radius, radius, textW + padX * 2, badgeH);
  context.fillStyle = "#ffffff";
  context.fillText(label, radius + padX, radius + badgeH / 2);

  return canvas.toDataURL("image/jpeg", 0.9);
};
