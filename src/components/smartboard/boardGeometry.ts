import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  isShapeElement,
  type BoardElement,
  type Point,
  type ShapeElementKind,
  type TextElement,
} from "./boardTypes";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export type ArrowHandle = "arrow-start" | "arrow-end";
export type AnyHandle = ResizeHandle | ArrowHandle;

export const SHAPE_HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
export const ARROW_HANDLES: ArrowHandle[] = ["arrow-start", "arrow-end"];

const TEXT_LINE_HEIGHT = 1.3;
const TEXT_CHAR_WIDTH = 0.62;
const MIN_SHAPE_SIZE = 14;

export function textMetrics(el: TextElement) {
  const lines = el.text.length > 0 ? el.text.split("\n") : [""];
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  return {
    lines: lines.length,
    width: Math.max(el.fontSize, longest * el.fontSize * TEXT_CHAR_WIDTH),
    height: Math.max(el.fontSize, lines.length * el.fontSize * TEXT_LINE_HEIGHT),
  };
}

export function elementBounds(el: BoardElement): Rect {
  switch (el.kind) {
    case "pen": {
      if (el.points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
      let minX = el.points[0][0];
      let maxX = minX;
      let minY = el.points[0][1];
      let maxY = minY;
      for (const [px, py] of el.points) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    case "rect":
    case "circle":
    case "triangle":
    case "diamond":
    case "pentagon":
    case "hexagon":
    case "star":
      return { x: el.x, y: el.y, w: el.w, h: el.h };
    case "arrow":
    case "line":
      return {
        x: Math.min(el.x1, el.x2),
        y: Math.min(el.y1, el.y2),
        w: Math.abs(el.x2 - el.x1),
        h: Math.abs(el.y2 - el.y1),
      };
    case "text": {
      const { width, height } = textMetrics(el);
      const lineHeight = el.fontSize * TEXT_LINE_HEIGHT;
      return { x: el.x, y: el.y - lineHeight / 2, w: width, h: height };
    }
    default:
      return { x: 0, y: 0, w: 0, h: 0 };
  }
}

export function elementHandles(el: BoardElement): Array<{ handle: AnyHandle; x: number; y: number }> {
  if (el.kind === "arrow" || el.kind === "line") {
    return [
      { handle: "arrow-start", x: el.x1, y: el.y1 },
      { handle: "arrow-end", x: el.x2, y: el.y2 },
    ];
  }
  if (!isShapeElement(el)) return [];
  const midX = el.x + el.w / 2;
  const midY = el.y + el.h / 2;
  const right = el.x + el.w;
  const bottom = el.y + el.h;
  const map: Record<ResizeHandle, [number, number]> = {
    nw: [el.x, el.y],
    n: [midX, el.y],
    ne: [right, el.y],
    e: [right, midY],
    se: [right, bottom],
    s: [midX, bottom],
    sw: [el.x, bottom],
    w: [el.x, midY],
  };
  return SHAPE_HANDLES.map((handle) => ({ handle, x: map[handle][0], y: map[handle][1] }));
}

export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  let t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy));
}

export function hitTest(el: BoardElement, point: Point, tolerance = 0): boolean {
  switch (el.kind) {
    case "pen": {
      const reach = el.width / 2 + tolerance + 4;
      for (let i = 1; i < el.points.length; i += 1) {
        if (distanceToSegment(point, el.points[i - 1], el.points[i]) <= reach) return true;
      }
      if (el.points.length === 1) {
        return Math.hypot(point[0] - el.points[0][0], point[1] - el.points[0][1]) <= reach;
      }
      return false;
    }
    case "arrow":
    case "line":
      return distanceToSegment(point, [el.x1, el.y1], [el.x2, el.y2]) <= el.strokeWidth / 2 + tolerance + 6;
    case "text": {
      const bounds = elementBounds(el);
      return (
        point[0] >= bounds.x - tolerance &&
        point[0] <= bounds.x + bounds.w + tolerance &&
        point[1] >= bounds.y - tolerance &&
        point[1] <= bounds.y + bounds.h + tolerance
      );
    }
    default: {
      const bounds = elementBounds(el);
      return (
        point[0] >= bounds.x - tolerance &&
        point[0] <= bounds.x + bounds.w + tolerance &&
        point[1] >= bounds.y - tolerance &&
        point[1] <= bounds.y + bounds.h + tolerance
      );
    }
  }
}

export function translateElement<T extends BoardElement>(el: T, dx: number, dy: number): T {
  switch (el.kind) {
    case "pen":
      return { ...el, points: el.points.map(([px, py]) => [px + dx, py + dy] as Point) };
    case "arrow":
    case "line":
      return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
    case "rect":
    case "circle":
    case "triangle":
    case "diamond":
    case "pentagon":
    case "hexagon":
    case "star":
      return { ...el, x: el.x + dx, y: el.y + dy };
    case "text":
      return { ...el, x: el.x + dx, y: el.y + dy };
    default:
      return el;
  }
}

export function resizeElement(el: BoardElement, handle: AnyHandle, dx: number, dy: number): BoardElement {
  if (el.kind === "arrow" || el.kind === "line") {
    if (handle === "arrow-start") return { ...el, x1: el.x1 + dx, y1: el.y1 + dy };
    if (handle === "arrow-end") return { ...el, x2: el.x2 + dx, y2: el.y2 + dy };
    return el;
  }
  if (!isShapeElement(el) || handle === "arrow-start" || handle === "arrow-end") return el;

  let { x, y, w, h } = el;
  if (handle.includes("w")) {
    x += dx;
    w -= dx;
  }
  if (handle.includes("e")) w += dx;
  if (handle.includes("n")) {
    y += dy;
    h -= dy;
  }
  if (handle.includes("s")) h += dy;

  if (w < MIN_SHAPE_SIZE) {
    if (handle.includes("w")) x -= MIN_SHAPE_SIZE - w;
    w = MIN_SHAPE_SIZE;
  }
  if (h < MIN_SHAPE_SIZE) {
    if (handle.includes("n")) y -= MIN_SHAPE_SIZE - h;
    h = MIN_SHAPE_SIZE;
  }
  return { ...el, x, y, w, h };
}

export function rectFromPoints(a: Point, b: Point): Rect {
  return {
    x: Math.min(a[0], b[0]),
    y: Math.min(a[1], b[1]),
    w: Math.abs(b[0] - a[0]),
    h: Math.abs(b[1] - a[1]),
  };
}

export function clampPoint(point: Point): Point {
  return [
    Math.max(0, Math.min(BOARD_WIDTH, point[0])),
    Math.max(0, Math.min(BOARD_HEIGHT, point[1])),
  ];
}

/** Head geometry for the arrow marker, in board units. */
export function arrowHead(el: { x1: number; y1: number; x2: number; y2: number; strokeWidth: number }) {
  const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
  const size = Math.max(12, el.strokeWidth * 3.2);
  const spread = 0.42;
  return {
    points: [
      [el.x2, el.y2],
      [el.x2 - size * Math.cos(angle - spread), el.y2 - size * Math.sin(angle - spread)],
      [el.x2 - size * Math.cos(angle + spread), el.y2 - size * Math.sin(angle + spread)],
    ] as Point[],
  };
}

export function penPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const [x, y] = points[0];
    return `M ${x} ${y} L ${x + 0.01} ${y}`;
  }
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    path += ` Q ${cx} ${cy} ${(cx + nx) / 2} ${(cy + ny) / 2}`;
  }
  const last = points[points.length - 1];
  path += ` L ${last[0]} ${last[1]}`;
  return path;
}

/** Regular polygon with `sides` corners, normalised to fill the 0..1 drag box. */
function unitPolygon(sides: number, rotation: number): Point[] {
  const raw: Point[] = Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (index * 2 * Math.PI) / sides;
    return [0.5 + 0.5 * Math.cos(angle), 0.5 + 0.5 * Math.sin(angle)] as Point;
  });
  return normalisePolygon(raw);
}

/** Star with `points` spikes, normalised to fill the 0..1 drag box. */
function unitStar(points: number, innerRatio = 0.44): Point[] {
  const raw: Point[] = Array.from({ length: points * 2 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / points;
    const radius = index % 2 === 0 ? 0.5 : 0.5 * innerRatio;
    return [0.5 + radius * Math.cos(angle), 0.5 + radius * Math.sin(angle)] as Point;
  });
  return normalisePolygon(raw);
}

function normalisePolygon(points: Point[]): Point[] {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX || 1;
  const height = Math.max(...ys) - minY || 1;
  return points.map(([x, y]) => [(x - minX) / width, (y - minY) / height] as Point);
}

/** Unit polygons for the shape tools, so a new shape only needs an entry here. */
export const SHAPE_POLYGONS: Partial<Record<ShapeElementKind, Point[]>> = {
  triangle: unitPolygon(3, -Math.PI / 2),
  diamond: [
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
  ],
  pentagon: unitPolygon(5, -Math.PI / 2),
  hexagon: unitPolygon(6, 0),
  star: unitStar(5),
};

/** SVG `points` for a polygon shape inside its bounding box. */
export function shapePolygonPoints(kind: ShapeElementKind, rect: Rect): string {
  const polygon = SHAPE_POLYGONS[kind];
  if (!polygon) return "";
  return polygon.map(([ux, uy]) => `${rect.x + ux * rect.w},${rect.y + uy * rect.h}`).join(" ");
}
