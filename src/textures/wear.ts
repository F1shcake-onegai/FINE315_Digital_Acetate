import type { DataTexture } from 'three';
import { config } from '../config';
import { imagePixels, loadImage } from './loader';
import { dataTexture } from './procedural';
import { buildWear, maskFromPixels, wearPaths, type WearPixels } from './wearPixels';

/**
 * Each sheet's smudges (roughnessMap and clearcoatRoughnessMap) and the shared scratches
 * (clearcoatNormalMap); null where their masks are missing.
 */
export interface Wear {
  smudges: (DataTexture | null)[];
  scratches: DataTexture | null;
}

/**
 * The acetates' wear from the ambientCG masks in config.acetate.wear (a missing one is logged and
 * left out): `sheets` smudge maps and the shared scratches. Building them takes about a second of
 * CPU on a desktop and several on a phone, so a worker does it while the page keeps running; where
 * a worker can't decode images, it runs here instead, a step per frame.
 */
export async function loadWear(sheets: number, anisotropy: number): Promise<Wear> {
  const built = (await inWorker(sheets).catch((error: unknown) => {
    console.info('[assets] building the wear maps on the main thread:', error);
    return null;
  })) ?? (await onMainThread(sheets));
  for (const path of built.missing) console.warn(`[assets] public/${path} is missing or unreadable; that wear layer is left out.`);

  const { w, h, wear } = config.acetate;
  const scratches = built.scratches && dataTexture(built.scratches.data, built.scratches.width, built.scratches.height, anisotropy);
  scratches?.repeat.set(w / wear.scratchTile, h / wear.scratchTile);
  return {
    smudges: built.smudges.map((pixels) => pixels && dataTexture(pixels.data, pixels.width, pixels.height, anisotropy, false)),
    scratches,
  };
}

/**
 * Stand-ins for the wear maps until they're built (they follow the sheets, see addSets in main.ts):
 * a clean smudge map and flat scratch normals. They look the same as no maps, but the acetate's
 * shader is built with the maps from the start, so swapping the real ones in doesn't recompile it.
 */
export function createCleanWear(): { smudge: DataTexture; scratches: DataTexture } {
  const clean = Math.round((config.acetate.roughness / config.acetate.wear.smudgeRoughness) * 255);
  return {
    smudge: dataTexture(new Uint8Array([clean, clean, clean, 255]), 1, 1, 1, false),
    scratches: dataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1, 1),
  };
}

/** buildWear in a worker (wearWorker.ts), which fetches and decodes the masks itself. */
function inWorker(sheets: number): Promise<WearPixels> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./wearWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WearPixels | { error: string }>) => {
      worker.terminate();
      if ('error' in event.data) reject(new Error(event.data.error));
      else resolve(event.data);
    };
    worker.onerror = (event) => {
      event.preventDefault();  // handled: the fallback takes over
      worker.terminate();
      reject(new Error(event.message || 'the wear worker failed to start'));
    };
    // Absolute URLs: the worker would resolve relative ones against its own script.
    const urls = wearPaths().map((path) => new URL(import.meta.env.BASE_URL + path, document.baseURI).href);
    worker.postMessage({ urls, sheets });
  });
}

/** The fallback: the same work on the main thread, a frame between the long steps. */
async function onMainThread(sheets: number): Promise<WearPixels> {
  const masks = await Promise.all(wearPaths().map(async (path) => {
    const image = await loadImage(import.meta.env.BASE_URL + path);
    return image && maskFromPixels(imagePixels(image));
  }));
  return buildWear(masks, sheets, () => new Promise((resolve) => requestAnimationFrame(() => resolve())));
}
