import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BoardCanvas from "./BoardCanvas";
import type { ToolId } from "./boardTypes";

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