import { afterEach, describe, expect, it, vi } from "vitest";
import { preparePrintImages } from "./preparePrintImages";

afterEach(() => vi.unstubAllGlobals());

function imageDocument(count = 1, loaded = true) {
  const doc = document.implementation.createHTMLDocument();
  for (let i = 0; i < count; i++) {
    const img = doc.createElement('img');
    img.src = 'https://example.com/diagram.png';
    img.loading = 'lazy';
    img.srcset = 'https://example.com/small.png 1x';
    Object.defineProperties(img, {
      naturalWidth: { value: loaded ? 100 : 0 },
      complete: { value: true },
    });
    img.decode = loaded ? vi.fn().mockResolvedValue(undefined) : vi.fn().mockRejectedValue(new Error('broken'));
    doc.body.append(img);
  }
  return doc;
}

describe('PDF image preparation', () => {
  it('embeds and decodes duplicate images once, disabling lazy and responsive loading', async () => {
    const fetchImage = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['image'], { type: 'image/png' }) });
    vi.stubGlobal('fetch', fetchImage);
    const doc = imageDocument(2);
    await preparePrintImages(doc);
    expect(fetchImage).toHaveBeenCalledTimes(1);
    for (const img of Array.from(doc.images)) {
      expect(img.src).toMatch(/^data:image\/png;base64,/);
      expect(img.loading).toBe('eager');
      expect(img.hasAttribute('srcset')).toBe(false);
      expect(img.decode).toHaveBeenCalledOnce();
    }
  });
  it('keeps displayable images when the host blocks fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('CORS')));
    const doc = imageDocument();
    await expect(preparePrintImages(doc)).resolves.toBeUndefined();
    expect(doc.images[0].src).toBe('https://example.com/diagram.png');
  });
  it('rejects broken images instead of silently printing an incomplete PDF', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(preparePrintImages(imageDocument(1, false))).rejects.toThrow('could not be loaded');
  });
});
