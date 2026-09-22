/**
 * Pointer styles for the interactive board.
 *
 * Drawing used to fall back to the browser `crosshair`, which is a one pixel
 * hairline: on a projector, and on the dark board backgrounds, the teacher
 * loses the pointer completely while writing. Each drawing tool therefore gets
 * its own SVG cursor with a white halo around a dark core, which stays visible
 * on every board background and at every zoom level.
 */
import type { ToolId } from "./boardTypes";

const CURSOR_SIZE = 32;

const cursorFromSvg = (body: string, hotSpotX: number, hotSpotY: number): string =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CURSOR_SIZE}" height="${CURSOR_SIZE}" viewBox="0 0 ${CURSOR_SIZE} ${CURSOR_SIZE}">${body}</svg>`,
  )}") ${hotSpotX} ${hotSpotY}, crosshair`;

/** Pen whose nib tip sits exactly on the hot spot, so ink lands under the tip. */
const PEN_CURSOR = cursorFromSvg(
  '<path d="M2 30 L6.5 19.5 L13.5 26.5 Z" fill="#0f172a" stroke="#ffffff" stroke-width="2.6" stroke-linejoin="round"/>' +
    '<path d="M6.5 19.5 L21 5 L27 11 L13.5 26.5 Z" fill="#2563eb" stroke="#ffffff" stroke-width="2.6" stroke-linejoin="round"/>',
  2,
  30,
);

/** Eraser centred on the hot spot because that is where strokes get removed. */
const ERASER_CURSOR = cursorFromSvg(
  '<rect x="5" y="11" width="22" height="10" rx="3" fill="#f8fafc" stroke="#0f172a" stroke-width="2.4"/>' +
    '<rect x="5" y="11" width="8" height="10" rx="3" fill="#f97316" stroke="#0f172a" stroke-width="2.4"/>',
  16,
  16,
);

/** Precision target for the shape and arrow tools. */
const SHAPE_CURSOR = cursorFromSvg(
  '<path d="M16 1 V7 M16 25 V31 M1 16 H7 M25 16 H31" stroke="#ffffff" stroke-width="4.6" stroke-linecap="round"/>' +
    '<path d="M16 1 V7 M16 25 V31 M1 16 H7 M25 16 H31" stroke="#0f172a" stroke-width="2" stroke-linecap="round"/>' +
    '<circle cx="16" cy="16" r="8.5" fill="none" stroke="#ffffff" stroke-width="4.6"/>' +
    '<circle cx="16" cy="16" r="8.5" fill="none" stroke="#0f172a" stroke-width="2"/>' +
    '<circle cx="16" cy="16" r="1.8" fill="#0f172a"/>',
  16,
  16,
);

/** CSS `cursor` value for a board tool. */
export function boardCursor(tool: ToolId): string {
  switch (tool) {
    case "pen":
      return PEN_CURSOR;
    case "eraser":
      return ERASER_CURSOR;
    case "rect":
    case "circle":
    case "triangle":
    case "diamond":
    case "pentagon":
    case "hexagon":
    case "star":
    case "arrow":
    case "line":
      return SHAPE_CURSOR;
    case "text":
      return "text";
    default:
      return "default";
  }
}
