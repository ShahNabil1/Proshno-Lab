function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Embed remote images when permitted and require every image to be printable. */
export async function preparePrintImages(doc: Document) {
  const embedded = new Map<string, Promise<string>>();
  await Promise.all(Array.from(doc.images).map(async image => {
    image.loading = 'eager';
    image.decoding = 'sync';
    const source = image.currentSrc || image.getAttribute('src');
    if (!source) return;
    const url = new URL(source, document.baseURI).href;
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
    if (!embedded.has(url)) {
      embedded.set(url, (async () => {
        if (url.startsWith('data:')) return url;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 20000);
        try {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error('Image download failed');
          return await asDataUrl(await response.blob());
        } catch {
          // Some image hosts allow display but do not allow fetching with CORS.
          return url;
        } finally {
          window.clearTimeout(timeout);
        }
      })());
    }
    image.src = await embedded.get(url)!;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => finish(new Error('PDF image load timed out')), 20000);
      const finish = (error?: Error) => {
        window.clearTimeout(timer);
        image.removeEventListener('load', onLoad);
        image.removeEventListener('error', onError);
        error ? reject(error) : resolve();
      };
      const onLoad = () => image.naturalWidth > 0 ? finish() : onError();
      const onError = () => finish(new Error('PDF image could not be loaded'));
      image.addEventListener('load', onLoad, { once: true });
      image.addEventListener('error', onError, { once: true });
      image.decode().then(onLoad, () => { if (image.complete) onError(); });
    });
  }));
}
