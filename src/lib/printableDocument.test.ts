import { describe, expect, it, vi } from "vitest";
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
  it.each([40, 60])("prints OMR once after all questions (attachment height %i)", async (omrHeight) => {
    const source = paper();
    const branding = document.createElement('div');
    branding.innerHTML = '<img data-paper-first-page-only alt="Institute logo"><span>Institute name</span>';
    branding.querySelector('img')!.style.position = omrHeight === 40 ? 'relative' : 'absolute';
    source.prepend(branding);
    source.querySelector('.combined-question-flow')!.innerHTML = '<div>First</div><div>Second</div><div>Third</div>';
    const omr = document.createElement('section');
    omr.className = 'in-paper-omr-container';
    omr.textContent = 'OMR Area';
    source.append(omr);
    const geometry = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      let bottom = 0;
      if (this.hasAttribute('data-print-paper')) bottom = 100;
      if (this.classList.contains('paper-explicit-column')) bottom = this.children.length * 60;
      if (this.classList.contains('in-paper-omr-container')) {
        const column = this.parentElement?.querySelector('.paper-explicit-column');
        bottom = (column?.children.length || 0) * 60 + omrHeight;
      }
      return { x: 0, y: 0, top: 0, left: 0, right: 100, width: 100, height: bottom, bottom, toJSON() {} };
    });
    try {
      const pages = await buildPrintablePages(source, layout);
      expect(pages).toHaveLength(omrHeight === 40 ? 3 : 4);
      expect(pages.join('').match(/OMR Area/g)).toHaveLength(1);
      expect(pages.at(-1)).toContain('OMR Area');
      expect(pages[0]).toContain('alt="Institute logo"');
      expect(pages.slice(1).join('')).not.toContain('alt="Institute logo"');
      expect(pages.every(page => page.includes('Institute name'))).toBe(true);
      expect(source.querySelector('[data-paper-first-page-only]')).not.toBeNull();
      expect(pages.slice(0, -1).join('')).not.toContain('OMR Area');
      for (const question of ['First', 'Second', 'Third']) {
        expect(pages.join('').match(new RegExp(question, 'g'))).toHaveLength(1);
      }
      expect(source.querySelectorAll('.in-paper-omr-container')).toHaveLength(1);
    } finally {
      geometry.mockRestore();
    }
  });
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
