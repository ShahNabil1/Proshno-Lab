/**
 * Shared types + constants for the interactive smartboard.
 *
 * All geometry is stored in "board units" - the logical A4 canvas
 * (BOARD_WIDTH x BOARD_HEIGHT). The surface is scaled with a CSS transform, so
 * the same drawing stays aligned with the question text at any zoom level or
 * window size.
 */

export type ToolId =
  | "select"
  | "pen"
  | "eraser"
  | "rect"
  | "circle"
  | "triangle"
  | "rightTriangle"
  | "ruler"
  | "protractor"
  | "compass"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "star"
  | "line"
  | "arrow"
  | "text";

export type Point = [number, number];

interface ElementBase {
  id: string;
  color: string;
  opacity: number;
  /** Marks a compass construction center so the toolbar can show/hide it. */
  compassCenter?: boolean;
  rotation?: number;
}

export interface PenElement extends ElementBase {
  kind: "pen";
  points: Point[];
  width: number;
}

/** Every closed shape is stored as a bounding box, so one drag covers them all. */
export const SHAPE_KINDS = ["rect", "circle", "triangle", "rightTriangle", "ruler", "protractor", "compass", "diamond", "pentagon", "hexagon", "star"] as const;

export type ShapeElementKind = (typeof SHAPE_KINDS)[number];

export interface ShapeElement extends ElementBase {
  kind: ShapeElementKind;
  x: number;
  y: number;
  w: number;
  h: number;
  strokeWidth: number;
}

export interface ArrowElement extends ElementBase {
  kind: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth: number;
}

/** Straight line: the same geometry as an arrow, drawn without the head. */
export interface LineElement extends ElementBase {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth: number;
}

export interface TextElement extends ElementBase {
  kind: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

export type BoardElement = PenElement | ShapeElement | ArrowElement | LineElement | TextElement;

export interface BoardStyle {
  color: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
}

export const BOARD_WIDTH = 1000;
export const BOARD_HEIGHT = 1414;
export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 3;

export const DEFAULT_BOARD_STYLE: BoardStyle = {
  color: "#ef4444",
  strokeWidth: 6,
  opacity: 1,
  fontSize: 34,
};

/** Pen / shape palette. The last two entries are the "chalk" inks for dark boards. */
export const PEN_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#7c3aed",
  "#ec4899",
  "#0f172a",
  "#ffffff",
];

export const STROKE_WIDTHS = [2, 4, 6, 10, 16, 24];

export function createElementId(): string {
  const cryptoRef = typeof crypto !== "undefined" ? crypto : undefined;
  if (cryptoRef && typeof cryptoRef.randomUUID === "function") {
    return cryptoRef.randomUUID();
  }
  return `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isShapeElement(el: BoardElement): el is ShapeElement {
  return (SHAPE_KINDS as readonly string[]).includes(el.kind);
}

export function isDrawableTool(tool: ToolId): boolean {
  return tool !== "select" && tool !== "eraser" && tool !== "text";
}
