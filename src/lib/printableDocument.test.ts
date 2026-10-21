import { describe, expect, it } from "vitest";
import { buildPrintablePages, type PrintLayout } from "./printableDocument";

const layout: PrintLayout = { widthMm: 210, heightMm: 297, columns: 1, gap: 15, divider: "", margins: [0, 0, 0, 0] };
function paper(hidden = false) {
  const root = document.createElement("div");
  root.setAttribute("data-print-paper", "");
  if (hidden) root.setAttribute("data-answers-hidden", "true");
  root.innerHTML = '<div class="combined-question-flow"><div>Question<span class="mcq-correct-answer-badge">a</span><div class="paper-answer-block">Worked answer</div></div></div>';
  return root;
}
describe("responsive print pagination", () => {
  it("keeps a single centered watermark on the page without adding it to question flow", async () => {
    const source=paper();
    const mark=document.createElement("div");
    mark.setAttribute("data-paper-watermark","");
    mark.style.cssText="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0.15";
    mark.textContent="Test institute";
    source.prepend(mark);
    const pages=await buildPrintablePages(source,layout);
    expect(pages.length).toBeGreaterThan(0);
    for(const html of pages){
      const page=document.createElement("div");page.innerHTML=html;
      expect(page.querySelectorAll("[data-paper-watermark]")).toHaveLength(1);
      expect(page.querySelector(".combined-question-flow")?.textContent).not.toContain("Test institute");
    }
  });
  it("excludes retained hidden answers and badges from printed pages", async () => {
    const pages = await buildPrintablePages(paper(true), layout);
    expect(pages.join("")).toContain("Question");
    expect(pages.join("")).not.toContain("Worked answer");
    expect(pages.join("")).not.toContain("mcq-correct-answer-badge");
    expect(document.querySelector(".paper-pagination-measure")).toBeNull();
  });
  it("preserves answers when enabled", async () => {
    const progress: number[] = [];
    const pages = await buildPrintablePages(paper(), layout, undefined, percent => progress.push(percent));
    expect(pages.join("")).toContain("Worked answer");
    expect(progress[0]).toBe(2);
    expect(progress.some(percent => percent > 10 && percent < 100)).toBe(true);
    expect(progress.at(-1)).toBe(100);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
  });
  it("cancels an obsolete toggle calculation and cleans up its measurement tree", async () => {
    await expect(buildPrintablePages(paper(), layout, () => true)).rejects.toMatchObject({ name: "AbortError" });
    expect(document.querySelector(".paper-pagination-measure")).toBeNull();
  });
});
