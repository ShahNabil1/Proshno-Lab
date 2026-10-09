import { describe, it, expect, vi } from "vitest";
import { fitAnswerLine, prepareAnswerLines } from "./answerLineFit";

describe("answer-only line fitting", () => {
  it("keeps authored breaks and math rows separate", () => {
    const root = document.createElement("div");
    root.innerHTML = '<p>first<br>second</p><span class="math-authored-rows"><span class="math-authored-row">x=1</span><span class="math-authored-row">y=2</span></span>';
    const lines = prepareAnswerLines(root);
    expect(lines.map(line => line.textContent)).toEqual(["first", "second", "x=1", "y=2"]);
    expect(prepareAnswerLines(root)).toEqual(lines);
  });
  it("shrinks overflowing lines, keeps adjusted sizes and wraps at 8", () => {
    const line = document.createElement("span");
    document.body.appendChild(line);
    vi.spyOn(window, "getComputedStyle").mockReturnValue({ fontSize: "16px" } as CSSStyleDeclaration);
    Object.defineProperty(line, "clientWidth", { get: () => 100 });
    Object.defineProperty(line, "scrollWidth", { get: () => 15 * parseFloat(line.style.fontSize || "16") });
    expect(fitAnswerLine(line, 8)).toBe(8);
    expect(line.classList.contains("answer-fit-measuring")).toBe(false);
    expect(fitAnswerLine(line, 8, 8)).toBe(8);
    vi.restoreAllMocks(); line.remove();
  });
  it("lets lines that already fit inherit the main font", () => {
    const line = document.createElement("span");
    Object.defineProperty(line, "clientWidth", { value: 100 });
    Object.defineProperty(line, "scrollWidth", { value: 80 });
    expect(fitAnswerLine(line, 8)).toBeUndefined();
    expect(line.style.fontSize).toBe("");
  });
});
