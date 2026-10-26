import { paginatePrintedAnswers } from "@/components/smartboard/answerPagination";
import { preparePrintImages } from "./preparePrintImages";
import { fitCqSlide } from "@/components/smartboard/fitCqSlide";

/** Reference deck: 17 7/9 x 10 inches (1280 x 720 PDF points). */
export const SMARTBOARD_PDF_WIDTH_IN = 160 / 9;
export const SMARTBOARD_PDF_HEIGHT_IN = 10;

/** Print an isolated, complete slide deck using native Save as PDF. */
export async function printSmartboard(slides: string[], width: number, height: number) {
  if (!(width > 0 && height > 0)) throw new Error('Invalid slide dimensions');
  // Uniformly fit legacy callers as well; never stretch fonts or drawings.
  const scale = Math.min(SMARTBOARD_PDF_WIDTH_IN * 96 / width, SMARTBOARD_PDF_HEIGHT_IN * 96 / height);
  const offsetX = (SMARTBOARD_PDF_WIDTH_IN * 96 - width * scale) / 2;
  const offsetY = (SMARTBOARD_PDF_HEIGHT_IN * 96 - height * scale) / 2;
  const frame = document.createElement('iframe');
  frame.title = 'Smartboard PDF';
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:800px;border:0';
  document.body.append(frame);
  try {
    const doc = frame.contentDocument!;
    const styles = Array.from(document.querySelectorAll('style,link[rel="stylesheet"]')).map(node => node.outerHTML).join('');
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Smartboard slides</title>${styles}<style>
      @page { size: ${SMARTBOARD_PDF_WIDTH_IN}in ${SMARTBOARD_PDF_HEIGHT_IN}in; margin: 0; }
      html,body { margin:0!important;padding:0!important;background:white; }
      * { print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important; }
      .board-pdf-slide { position:relative;width:${width}px;height:${height}px;overflow:hidden;break-after:page; }
      .board-pdf-slide:last-child { break-after:auto; }
      .board-pdf-slide[data-board-dark="true"] .latex-renderer img { background:#fff!important;padding:8px;box-sizing:border-box;filter:none!important;mix-blend-mode:normal!important; }

      .board-pdf-slide [data-testid="smartboard-question-meta"] { display:flex!important;align-items:center;flex-wrap:wrap;flex-shrink:0; }
      .board-pdf-slide [data-testid="smartboard-question-meta"] [aria-label="প্রশ্নের রেফারেন্স"] { position:static!important;display:inline-flex!important;float:none!important; }

      .board-pdf-page { width:${SMARTBOARD_PDF_WIDTH_IN}in;height:${SMARTBOARD_PDF_HEIGHT_IN}in;overflow:hidden;break-after:page;position:relative; }
      .board-pdf-page:last-child { break-after:auto; }
      .board-pdf-slide { position:absolute;left:${offsetX}px;top:${offsetY}px;transform:scale(${scale});transform-origin:top left;break-after:auto; }
    </style></head><body>${slides.map(html => `<section class="board-pdf-page">${html}</section>`).join('')}</body></html>`);
    doc.close();
    await Promise.all(Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(link => (link as HTMLLinkElement).sheet ? Promise.resolve() : new Promise<void>(resolve => { link.addEventListener('load', () => resolve(), { once: true }); link.addEventListener('error', () => resolve(), { once: true }); })));
    await doc.fonts.ready;
    await preparePrintImages(doc);
    doc.querySelectorAll<HTMLElement>('[data-testid="smartboard-question-panel"], [data-answer-context]').forEach(fitCqSlide);
    paginatePrintedAnswers(doc);
    await new Promise<void>(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
    frame.contentWindow!.addEventListener('afterprint', () => frame.remove(), { once: true });
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
  } catch (error) { frame.remove(); throw error; }
}
