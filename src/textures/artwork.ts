import type { DataTexture } from 'three';
import { config } from '../config';
import { imagePixels, loadImage } from './loader';
import { dataTexture } from './procedural';

/**
 * The user's drawing for one sheet: white strokes on a transparent PNG, drawn on the scan's canvas.
 * Returns a map holding 1 − alpha in every channel, for transmissionMap and clearcoatMap (R) and
 * specularIntensityMap (A): where there is paint the sheet stops being clear plastic and becomes
 * opaque, matte white. Its transform lays the scan-sized drawing over the paper area of the
 * acetate. Null (logged) when the file is missing, which leaves the sheet clear.
 */
export async function loadArtwork(path: string, anisotropy: number): Promise<DataTexture | null> {
  const image = await loadImage(import.meta.env.BASE_URL + path);
  if (!image) {
    console.warn(`[assets] optional public/${path} is missing or unreadable; that acetate stays clear.`);
    return null;
  }
  const { width, height, data: rgba } = imagePixels(image, config.assets.scanMaxPx);
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const source = (height - 1 - y) * width;  // image rows run top-down, DataTexture rows bottom-up
    for (let x = 0; x < width; x++) {
      const clear = 255 - rgba[(source + x) * 4 + 3];
      data.fill(clear, (y * width + x) * 4, (y * width + x) * 4 + 4);
    }
  }
  const texture = dataTexture(data, width, height, anisotropy, false);

  // The acetate overhangs the paper at the sides and the bottom; the paper starts at the hinge (v = 1).
  const { acetate, paper } = config;
  const uSpan = paper.w / acetate.w;
  const vSpan = paper.h / acetate.h;
  const u0 = (acetate.w - paper.w) / 2 / acetate.w;
  const v0 = 1 - vSpan;
  texture.repeat.set(1 / uSpan, 1 / vSpan);
  texture.offset.set(-u0 / uSpan, -v0 / vSpan);
  return texture;
}
