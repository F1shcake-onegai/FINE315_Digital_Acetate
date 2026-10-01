import { buildWear, maskFromPixels, type Mask } from './wearPixels';

// Builds the acetates' wear maps off the main thread (see loadWear in wear.ts): fetches and decodes
// the masks, runs buildWear, and hands the pixels back without copying them.

self.onmessage = async (event: MessageEvent<{ urls: string[]; sheets: number }>) => {
  try {
    if (typeof OffscreenCanvas === 'undefined' || !new OffscreenCanvas(1, 1).getContext('2d')) {
      throw new Error('no OffscreenCanvas 2D in workers');
    }
    const { urls, sheets } = event.data;
    const built = await buildWear(await Promise.all(urls.map(loadMask)), sheets);
    const pixels = [...built.smudges, built.scratches].filter((image) => image !== null);
    self.postMessage(built, { transfer: pixels.map((image) => image.data.buffer as ArrayBuffer) });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};

/** A mask, or null when the file is missing or isn't an image (the dev server answers unknown paths with index.html). */
async function loadMask(url: string): Promise<Mask | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    const { width, height } = bitmap;
    const context = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();  // its width and height read 0 from here on
    return maskFromPixels(context.getImageData(0, 0, width, height));
  } catch {
    return null;
  }
}
