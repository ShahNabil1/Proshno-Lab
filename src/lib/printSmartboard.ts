/** Print an isolated, complete slide deck using native Save as PDF. */
export async function printSmartboard(slides: string[], width: number, height: number) {
  const frame = document.createElement('iframe');
  frame.title = 'Smartboard PDF';
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:800px;border:0';
  document.body.append(frame);
  try {
    const doc = frame.contentDocument!;
    const styles = Array.from(document.querySelectorAll('style,link[rel="stylesheet"]')).map(node => node.outerHTML).join('');
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Smartboard slides</title>${styles}<style>
      @page { size: 297mm ${297 * height / width}mm; margin: 0; }
      html,body { margin:0!important;padding:0!important;background:white; }
      * { print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important; }
      .board-pdf-slide { position:relative;width:${width}px;height:${height}px;overflow:hidden;break-after:page; }
      .board-pdf-slide:last-child { break-after:auto; }
      .board-pdf-page { width:297mm;height:${297 * height / width}mm;overflow:hidden;break-after:page;position:relative; }
      .board-pdf-page:last-child { break-after:auto; }
      .board-pdf-slide { transform:scale(${1122.519685 / width});transform-origin:top left;break-after:auto; }
    </style></head><body>${slides.map(html => `<section class="board-pdf-page">${html}</section>`).join('')}</body></html>`);
    doc.close();
    await Promise.all(Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(link => (link as HTMLLinkElement).sheet ? Promise.resolve() : new Promise<void>(resolve => { link.addEventListener('load', () => resolve(), { once: true }); link.addEventListener('error', () => resolve(), { once: true }); })));
    await doc.fonts.ready;
    await Promise.all(Array.from(doc.images).map(image => image.decode().catch(() => {})));
    await new Promise<void>(resolve => frame.contentWindow!.requestAnimationFrame(() => frame.contentWindow!.requestAnimationFrame(() => resolve())));
    frame.contentWindow!.addEventListener('afterprint', () => frame.remove(), { once: true });
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
  } catch (error) { frame.remove(); throw error; }
}
