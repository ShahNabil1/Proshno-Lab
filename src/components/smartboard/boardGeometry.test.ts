import { describe, expect, it } from "vitest";
import {
  arrowHead,
  distanceToSegment,
  elementBounds,
  elementHandles,
  hitTest,
  penPath,
  rectFromPoints,
  resizeElement,
  translateElement,
} from "./boardGeometry";
import type { ArrowElement, PenElement, ShapeElement, TextElement } from "./boardTypes";

const pen: PenElement = {
  id: "pen",
  kind: "pen",
  points: [
    [10, 10],
    [50, 10],
    [50, 60],
  ],
  color: "#000000",
  width: 8,
  opacity: 1,
};

const rect: ShapeElement = {
  id: "rect",
  kind: "rect",
  x: 100,
  y: 200,
  w: 120,
  h: 80,
  color: "#000000",
  strokeWidth: 4,
  opacity: 1,
};

const arrow: ArrowElement = {
  id: "arrow",
  kind: "arrow",
  x1: 0,
  y1: 0,
  x2: 100,
  y2: 100,
  color: "#000000",
  strokeWidth: 6,
  opacity: 1,
};

const text: TextElement = {
  id: "text",
  kind: "text",
  x: 300,
  y: 400,
  text: "সমাধান",
  fontSize: 40,
  color: "#000000",
  opacity: 1,
};

describe("elementBounds", () => {
  it("wraps a pen stroke in its bounding box", () => {
    expect(elementBounds(pen)).toEqual({ x: 10, y: 10, w: 40, h: 50 });
  });

  it("returns shape coordinates as-is", () => {
    expect(elementBounds(rect)).toEqual({ x: 100, y: 200, w: 120, h: 80 });
  });

  it("normalises arrow direction", () => {
    const reversed: ArrowElement = { ...arrow, x1: 100, y1: 100, x2: 0, y2: 0 };
    expect(elementBounds(reversed)).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });

  it("centres a text block vertically on its anchor", () => {
    const bounds = elementBounds(text);
    expect(bounds.h).toBeGreaterThanOrEqual(text.fontSize);
    expect(bounds.y).toBeLessThan(text.y);
  });
});

describe("hitTest", () => {
  it("detects strokes near a pen segment", () => {
    expect(hitTest(pen, [30, 12])).toBe(true);
    expect(hitTest(pen, [30, 400])).toBe(false);
  });

  it("detects shapes and arrows", () => {
    expect(hitTest(rect, [150, 240])).toBe(true);
    expect(hitTest(rect, [900, 900])).toBe(false);
    expect(hitTest(arrow, [50, 52])).toBe(true);
    expect(hitTest(arrow, [50, 300])).toBe(false);
  });
});

describe("translateElement", () => {
  it("moves every geometry kind without mutating the source", () => {
    expect(translateElement(pen, 5, -5).points[0]).toEqual([15, 5]);
    expect(translateElement(rect, 5, -5)).toMatchObject({ x: 105, y: 195 });
    expect(translateElement(arrow, 5, -5)).toMatchObject({ x1: 5, y1: -5, x2: 105, y2: 95 });
    expect(translateElement(text, 5, -5)).toMatchObject({ x: 305, y: 395 });
    expect(pen.points[0]).toEqual([10, 10]);
  });
});

describe("resizeElement", () => {
  it("grows a shape from the south-east handle", () => {
    expect(resizeElement(rect, "se", 40, 20)).toMatchObject({ x: 100, y: 200, w: 160, h: 100 });
  });

  it("moves the origin when resizing from the north-west handle", () => {
    expect(resizeElement(rect, "nw", -20, -10)).toMatchObject({ x: 80, y: 190, w: 140, h: 90 });
  });

  it("keeps a minimum size instead of collapsing", () => {
    const tiny = resizeElement(rect, "se", -1000, -1000);
    expect(tiny).toMatchObject({ x: 100, y: 200 });
    expect((tiny as ShapeElement).w).toBeGreaterThan(0);
    expect((tiny as ShapeElement).h).toBeGreaterThan(0);
  });

  it("moves arrow endpoints independently", () => {
    expect(resizeElement(arrow, "arrow-start", 10, 10)).toMatchObject({ x1: 10, y1: 10, x2: 100, y2: 100 });
    expect(resizeElement(arrow, "arrow-end", 10, 10)).toMatchObject({ x1: 0, y1: 0, x2: 110, y2: 110 });
  });
});

describe("helpers", () => {
  it("builds a normalised rect from any drag direction", () => {
    expect(rectFromPoints([100, 100], [40, 20])).toEqual({ x: 40, y: 20, w: 60, h: 80 });
  });

  it("measures distance to a segment", () => {
    expect(distanceToSegment([0, 5], [0, 0], [10, 0])).toBeCloseTo(5);
    expect(distanceToSegment([20, 0], [0, 0], [10, 0])).toBeCloseTo(10);
  });

  it("returns handles for shapes and endpoints for arrows", () => {
    expect(elementHandles(rect)).toHaveLength(8);
    expect(elementHandles(arrow).map((handle) => handle.handle)).toEqual(["arrow-start", "arrow-end"]);
  });

  it("renders a pen path", () => {
    expect(penPath(pen.points)).toMatch(/^M 10 10/);
    expect(arrowHead({ x1: 0, y1: 0, x2: 100, y2: 0, strokeWidth: 6 }).points).toHaveLength(3);
  });
});

