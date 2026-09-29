import { MathUtils, type DataTexture } from 'three';
import { config } from '../config';
import { imagePixels, loadImage } from './loader';
import { createRng, dataTexture, heightToNormals, randInt, randRange } from './procedural';

/** One ambientCG mask as grey levels 0–1. The masks are tileable. */
interface Mask {
  width: number;
  height: number;
  values: Float32Array;
}

export interface WearSources {
  fingerprints: Mask[];
  spots: Mask | null;
  scratches: Mask | null;
}

/** The ambientCG masks named in config.acetate.wear; a missing one is logged and left out. */
export async function loadWearSources(): Promise<WearSources> {
  const wear = config.acetate.wear;
  const [spots, scratches, ...fingerprints] = await Promise.all(
    [wear.spots, wear.scratches, ...wear.fingerprints].map(loadMask),
  );
  return { fingerprints: fingerprints.filter((mask) => mask !== null), spots, scratches };
}

async function loadMask(path: string): Promise<Mask | null> {
  const image = await loadImage(import.meta.env.BASE_URL + path);
  if (!image) {
    console.warn(`[assets] public/${path} is missing or unreadable; that wear layer is left out.`);
    return null;
  }
  const { width, height, data } = imagePixels(image);
  const values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i++) values[i] = data[i * 4] / 255;
  return { width, height, values };
}

/**
 * One sheet's smudges in acetate UV space: fingerprints showing through a few soft windows, over a
 * faint water-spot haze. Stored for roughnessMap and clearcoatRoughnessMap (both read G) as
 * clean + (1 − clean) · smudge, where clean = roughness / smudgeRoughness, so the material's
 * roughness values are the heaviest smudge and the map scales them down elsewhere.
 */
export function createSmudgeTexture(sources: WearSources, sheet: number, anisotropy: number): DataTexture | null {
  const { w, h, roughness } = config.acetate;
  const wear = config.acetate.wear;
  const fingerprints = sources.fingerprints.length > 0 ? sources.fingerprints[sheet % sources.fingerprints.length] : null;
  if (!fingerprints && !sources.spots) return null;

  const rng = createRng(wear.seeds[sheet % wear.seeds.length]);
  const windows = Array.from({ length: randInt(rng, wear.fingerprintWindows) }, () => ({
    x: rng() * w,
    d: rng() * h,
    radius: randRange(rng, wear.windowRadius),
  }));

  const rows = wear.mapPx;
  const width = Math.round((rows * w) / h);
  const clean = roughness / wear.smudgeRoughness;
  const data = new Uint8Array(width * rows * 4);
  for (let r = 0; r < rows; r++) {
    const d = (1 - (r + 0.5) / rows) * h;  // distance from the hinge
    for (let c = 0; c < width; c++) {
      const x = ((c + 0.5) / width) * w;
      let smudge = 0;
      if (fingerprints) {
        let through = 0;
        for (const win of windows) {
          const inside = win.radius - Math.hypot(x - win.x, d - win.d);
          through = Math.max(through, MathUtils.smoothstep(inside, 0, win.radius * wear.windowFeather));
        }
        if (through > 0) smudge += through * sample(fingerprints, x / wear.fingerprintTile, d / wear.fingerprintTile);
      }
      if (sources.spots) smudge += wear.spotsWeight * sample(sources.spots, x / wear.spotsTile, d / wear.spotsTile);
      const g = Math.round((clean + (1 - clean) * Math.min(smudge, 1)) * 255);
      data.fill(g, (r * width + c) * 4, (r * width + c) * 4 + 4);
    }
  }
  return dataTexture(data, width, rows, anisotropy, false);
}

/**
 * Tileable scratch normals from the scratch mask (bright = scratch, cut into the surface), for
 * clearcoatNormalMap: scratches live in the glossy top surface and only show where light catches them.
 */
export function createScratchNormalTexture(sources: WearSources, anisotropy: number): DataTexture | null {
  const mask = sources.scratches;
  if (!mask) return null;
  const wear = config.acetate.wear;
  // Keep the real scratches, not the faint brushing under them, and soften by a pixel.
  const kept = mask.values.map((v) => MathUtils.smoothstep(v, wear.scratchThreshold, 1));
  const depth = boxBlur(kept, mask.width, mask.height, wear.scratchBlurPx).map((v) => -v);
  const normals = heightToNormals(depth, mask.width, mask.height, wear.scratchSlopeRms, { rmsOver: 'relief' });
  const texture = dataTexture(normals, mask.width, mask.height, anisotropy);
  texture.repeat.set(config.acetate.w / wear.scratchTile, config.acetate.h / wear.scratchTile);
  return texture;
}

/** Separable box blur with wrap-around (the masks tile). */
function boxBlur(values: Float32Array, width: number, height: number, radius: number): Float32Array {
  if (radius < 1) return values;
  const span = radius * 2 + 1;
  const pass = (source: Float32Array, horizontal: boolean) => {
    const out = new Float32Array(source.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const sx = horizontal ? (x + k + width) % width : x;
          const sy = horizontal ? y : (y + k + height) % height;
          sum += source[sy * width + sx];
        }
        out[y * width + x] = sum / span;
      }
    }
    return out;
  };
  return pass(pass(values, true), false);
}

/** Bilinear, wrapping sample of a tileable mask; u and v are in tiles. */
function sample(mask: Mask, u: number, v: number): number {
  const fx = (u - Math.floor(u)) * mask.width - 0.5;
  const fy = (v - Math.floor(v)) * mask.height - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const at = (x: number, y: number) =>
    mask.values[((y + mask.height) % mask.height) * mask.width + ((x + mask.width) % mask.width)];
  const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
  const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
  return top + (bottom - top) * ty;
}
