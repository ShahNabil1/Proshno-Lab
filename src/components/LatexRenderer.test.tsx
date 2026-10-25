import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LatexRenderer from "./LatexRenderer";
import { EquationBoldContext } from "@/contexts/EquationStyleContext";

describe("paper equation weight", () => {
  it("toggles cached equations without changing surrounding text or breaking math", () => {
    const text = "প্রশ্ন English $x^2 + \\frac{1}{y} = \\sqrt{2}$";
    const paper = (bold: boolean) => (
      <EquationBoldContext.Provider value={bold}>
        <LatexRenderer text={text} />
      </EquationBoldContext.Provider>
    );
    const { container, rerender } = render(paper(false));
    const original = container.querySelector(".katex")!.innerHTML;
    rerender(paper(true));
    expect(container.querySelector(".katex-error")).toBeNull();
    expect(container.querySelector(".boldsymbol, .mathbf")).not.toBeNull();
    expect(container.querySelector(".latex-renderer")!.firstChild!.textContent).toBe("প্রশ্ন English ");
    rerender(paper(false));
    expect(container.querySelector(".katex")!.innerHTML).toBe(original);
  });
});

it("renders CQ imported array answers with equation bold enabled", () => {
  const { container } = render(<EquationBoldContext.Provider value={true}>
    <LatexRenderer text={String.raw`$\begin{array}{l}=\left(x+\frac{1}{x}\right)^3-3x\\=42\sqrt{6}\end{array}$`} />
  </EquationBoldContext.Provider>);
  expect(container.querySelector(".latex-fallback, .katex-error")).toBeNull();
  expect(container.querySelectorAll(".math-authored-row")).toHaveLength(2);
});

it("renders nested aligned answers without exposing LaTeX code", () => {
  const { container } = render(<LatexRenderer text={String.raw`\[\begin{aligned} & A=\{1,2\} \\ & \begin{aligned} A\cap B&=\{2\} \\ A'&=U-A \end{aligned} \\ & A'=\{3\} \end{aligned}\]`} />);
  expect(container.querySelector('.katex')).not.toBeNull();
  expect(container.querySelector('.latex-fallback')).toBeNull();
  expect(container.textContent).not.toContain('\\begin{aligned}');
});
