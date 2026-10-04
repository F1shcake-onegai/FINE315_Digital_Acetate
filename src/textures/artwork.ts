import type { DataTexture } from 'three';
import { config } from '../config';
import { imagePixels, loadImage } from './loader';
import { dataTexture } from './procedural';

export async function loadArtwork(path: string, anisotropy: number): Promise<DataTexture | null> {
  const image = await loadImage(import.meta.env.BASE_URL + path);
  if (!image) {
    console.warn(new Error(`missing ${path}`));
    return null;
  }
  const { width, height, data: rgba } = imagePixels(image, 4096); // 4096 = max scan px
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const source = (height - 1 - y) * width;
    for (let x = 0; x < width; x++) {
      const clear = 255 - rgba[(source + x) * 4 + 3];
      data.fill(clear, (y * width + x) * 4, (y * width + x) * 4 + 4);
    }
  }
  const texture = dataTexture(data, width, height, anisotropy, false);

  const { acetate, paper } = config;
  const uSpan = paper.w / acetate.w;
  const vSpan = paper.h / acetate.h;
  const u0 = (acetate.w - paper.w) / 2 / acetate.w;
  const v0 = 1 - vSpan;
  texture.repeat.set(1 / uSpan, 1 / vSpan);
  texture.offset.set(-u0 / uSpan, -v0 / vSpan);
  return texture;
}
