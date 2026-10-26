import { describe, expect, it, vi } from "vitest";
import { printSmartboard } from "./printSmartboard";

describe("smartboard PDF reference format", () => {
  it("prints 16:9 pages at 1280 by 720 points with uniform text scaling", async () => {
    const append = document.body.append.bind(document.body);
    const print = vi.fn();
    const spy = vi.spyOn(document.body, "append").mockImplementation((...nodes) => {
      append(...nodes);
      const frame = nodes[0] as HTMLIFrameElement;
      Object.defineProperty(frame.contentDocument!, "fonts", { value: { ready: Promise.resolve() } });
      frame.contentWindow!.print = print;
      frame.contentWindow!.focus = vi.fn();
    });
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { callback(0); return 1; });
    try {
      await printSmartboard(['<div class="board-pdf-slide">one</div>', '<div class="board-pdf-slide">two</div>'], 1920, 1080);
      const frame = document.querySelector('iframe[title="Smartboard PDF"]') as HTMLIFrameElement;
      const doc = frame.contentDocument!;
      expect(doc.querySelectorAll('.board-pdf-page')).toHaveLength(2);
      const css = [...doc.querySelectorAll('style')].at(-1)!.textContent!;
      expect(css).toContain('size: 17.77777777777778in 10in');
      expect(css).toContain('[data-board-dark="true"] .latex-renderer img { background:#fff!important;');
      expect(Number(css.match(/transform:scale\(([^)]+)\)/)![1])).toBeCloseTo(8 / 9);
      expect(48 * (8 / 9) * (72 / 96)).toBe(32);
      expect(print).toHaveBeenCalledOnce();
      frame.contentWindow!.dispatchEvent(new Event('afterprint'));
      expect(document.querySelector('iframe[title="Smartboard PDF"]')).toBeNull();
    } finally { spy.mockRestore(); raf.mockRestore(); }
  });
});
