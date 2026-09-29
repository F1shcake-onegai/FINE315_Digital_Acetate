import { SRGBColorSpace, Texture } from 'three';
import { config } from '../config';

/**
 * A contact-sheet scan from public/, or a procedural placeholder (logged) when the file is missing
 * or unreadable. "Missing" is detected by decoding rather than by status code, because the dev
 * server answers unknown paths with index.html (200).
 */
export async function loadScan(path: string, makePlaceholder: () => HTMLCanvasElement, anisotropy: number): Promise<Texture> {
  const image = await loadImage(import.meta.env.BASE_URL + path);
  let source: TexImageSource;
  if (image) {
    source = fitScan(image, path);
  } else {
    console.warn(`[assets] public/${path} is missing or unreadable; using a procedural placeholder.`);
    source = makePlaceholder();
  }
  const texture = new Texture(source);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy;  // mipmaps + trilinear filtering are Texture defaults
  texture.needsUpdate = true;
  return texture;
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    return image;
  } catch {
    return null;
  }
}

/** Warn about scans off the §3 format; downscale anything above the §9 texture budget. */
function fitScan(image: HTMLImageElement, path: string): TexImageSource {
  const { scanMinPx, scanMaxPx, aspectTolerance } = config.assets;
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const longSide = Math.max(width, height);
  const paperAspect = config.paper.w / config.paper.h;
  if (Math.abs(width / height / paperAspect - 1) > aspectTolerance) {
    console.warn(`[assets] ${path} is ${width}×${height}, not 8×10 portrait; it will be stretched onto the paper.`);
  }
  if (longSide < scanMinPx) {
    console.warn(`[assets] ${path} is ${width}×${height}; scans should be at least ${scanMinPx} px on the long side.`);
  }
  if (longSide <= scanMaxPx) return image;

  const scale = scanMaxPx / longSide;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return image;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  console.info(`[assets] ${path} downscaled from ${width}×${height} to ${canvas.width}×${canvas.height}.`);
  return canvas;
}
