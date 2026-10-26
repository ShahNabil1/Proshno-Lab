import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BoardCanvas from "./BoardCanvas";
import { BOARD_WIDTH, BOARD_HEIGHT, type ToolId } from "./boardTypes";

const renderBoard = (tool: ToolId) =>
  render(
    <BoardCanvas
      tool={tool}
      color="#ef4444"
      strokeWidth={6}
      opacity={1}
      fontSize={34}
      elements={[]}
      onCommit={vi.fn()}
    />,
  );

const boardSvg = (container: HTMLElement): SVGSVGElement => {
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("board surface not rendered");
  return svg;
};

describe("BoardCanvas pointer", () => {
  it("resizes the compass from its pencil drag target", () => {
    const onCompassRadiusChange = vi.fn();
    const { container } = render(
      <BoardCanvas tool="compass" color="#ef4444" strokeWidth={6} opacity={1} fontSize={34}
        elements={[]} onCommit={vi.fn()} compassRadius={180} onCompassRadiusChange={onCompassRadiusChange} />,
    );
    const svg = boardSvg(container);
    Object.defineProperty(svg, "setPointerCapture", { value: vi.fn() });
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: BOARD_WIDTH, bottom: BOARD_HEIGHT, width: BOARD_WIDTH, height: BOARD_HEIGHT, toJSON: () => ({}) });
    const pointer = (type: string, clientX: number, clientY: number, pointerId: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        button: { value: 0 }, clientX: { value: clientX }, clientY: { value: clientY }, pointerId: { value: pointerId },
      });
      return event;
    };
    fireEvent(svg, pointer("pointerdown", 300, 300, 1));
    const resizeLine = container.querySelector('[aria-label="পেন্সিল ধরে ব্যাসার্ধ পরিবর্তন করুন"] line');
    expect(resizeLine).not.toBeNull();
    fireEvent(resizeLine!, pointer("pointerdown", 480, 300, 2));
    fireEvent(svg, pointer("pointermove", 600, 300, 2));
    expect(onCompassRadiusChange).toHaveBeenCalledWith(300);
  });

  it("draws with a high contrast pen cursor instead of the faint crosshair", () => {
    const { container } = renderBoard("pen");
    const { cursor } = boardSvg(container).style;

    expect(cursor).toContain("data:image/svg+xml");
    expect(cursor).not.toBe("crosshair");
  });

  it.each<ToolId>(["eraser", "rect", "circle", "triangle", "arrow"])(
    "keeps the %s tool on a visible custom cursor",
    (tool) => {
      const { container } = renderBoard(tool);

      expect(boardSvg(container).style.cursor).toContain("data:image/svg+xml");
    },
  );

  it("leaves the select cursor and the text caret untouched", () => {
    expect(boardSvg(renderBoard("select").container).style.cursor).toBe("default");
    expect(boardSvg(renderBoard("text").container).style.cursor).toBe("text");
  });

  it("shows the brush preview ring for the writing tools only", () => {
    const penRing = renderBoard("pen").container.querySelector('[data-testid="board-brush-cursor"]');

    expect(penRing).not.toBeNull();
    expect(penRing).toHaveAttribute("opacity", "0");
    // Light halo plus dark core, so the ring stays readable on any board.
    const strokes = Array.from(penRing!.querySelectorAll("circle")).map((circle) => circle.getAttribute("stroke"));
    expect(strokes).toEqual(["#ffffff", "#0f172a", "#ffffff"]);

    expect(renderBoard("select").container.querySelector('[data-testid="board-brush-cursor"]')).toBeNull();
    expect(renderBoard("text").container.querySelector('[data-testid="board-brush-cursor"]')).toBeNull();
  });
});
