import { SRGBColorSpace, Texture } from 'three';

export async function loadScan(path: string, anisotropy: number): Promise<Texture> {
  const image = await loadImage(import.meta.env.BASE_URL + path);
  if (!image) throw new Error(path);
  const texture = new Texture(image);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

export async function loadImage(url: string): Promise<HTMLImageElement | null> {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    return image;
  } catch {
    return null;
  }
}

export function imagePixels(image: HTMLImageElement, maxLongSide = Infinity): ImageData {
  const scale = Math.min(1, maxLongSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no canvas 2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
