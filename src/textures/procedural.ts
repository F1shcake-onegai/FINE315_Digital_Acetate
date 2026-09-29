import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat, RepeatWrapping } from 'three';
import { config } from '../config';

/** Seeded PRNG returning [0, 1). Same seed, same textures on every load. */
export type Rng = () => number;

interface Range {
  min: number;
  max: number;
}

/** mulberry32 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng: Rng, range: Range): number {
  return range.min + (range.max - range.min) * rng();
}

/** Integer in [min, max], both inclusive. */
export function randInt(rng: Rng, range: Range): number {
  return Math.floor(range.min + (range.max - range.min + 1) * rng());
}

export interface PaperGrain {
  /** Tileable tangent-space normal map. Clone it to give each use its own repeat. */
  normalMap: DataTexture;
  /** Paper roughness in G, absolute (paper.roughness ± paper.roughnessVar): use material.roughness = 1. */
  roughnessMap: DataTexture;
}

/** §4.3 paperGrain: 3-octave fractal noise, normals from finite differences. Shared by table, paper and tape. */
export function createPaperGrain(anisotropy: number): PaperGrain {
  const { size, grain } = config.textures;
  const { roughness, roughnessVar } = config.paper;
  const height = fbm(size, grain.octaves, grain.baseCells, grain.persistence, createRng(grain.seed));
  return {
    normalMap: dataTexture(heightToNormals(height, size, grain.slopeRms), size, anisotropy),
    roughnessMap: dataTexture(heightToGrey(height, roughness - roughnessVar, roughness + roughnessVar), size, anisotropy),
  };
}

/**
 * Tileable gradient-noise fBm on a size² grid, normalized to [0, 1]. Octave k has baseCells·2^k
 * lattice cells across the tile and amplitude persistence^k; the lattice wraps, so the tile is seamless.
 */
function fbm(size: number, octaves: number, baseCells: number, persistence: number, rng: Rng): Float32Array {
  const out = new Float32Array(size * size);
  for (let octave = 0, cells = baseCells, amplitude = 1; octave < octaves; octave++, cells *= 2, amplitude *= persistence) {
    addGradientNoise(out, size, cells, amplitude, rng);
  }
  return normalize(out);
}

function addGradientNoise(out: Float32Array, size: number, cells: number, amplitude: number, rng: Rng): void {
  const gradX = new Float32Array(cells * cells);
  const gradY = new Float32Array(cells * cells);
  for (let i = 0; i < gradX.length; i++) {
    const angle = rng() * Math.PI * 2;
    gradX[i] = Math.cos(angle);
    gradY[i] = Math.sin(angle);
  }
  const step = cells / size;
  for (let py = 0; py < size; py++) {
    const fy = (py + 0.5) * step;
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    const sy = fade(ty);
    const row0 = (y0 % cells) * cells;
    const row1 = ((y0 + 1) % cells) * cells;
    for (let px = 0; px < size; px++) {
      const fx = (px + 0.5) * step;
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const c0 = x0 % cells;
      const c1 = (x0 + 1) % cells;
      const n00 = gradX[row0 + c0] * tx + gradY[row0 + c0] * ty;
      const n10 = gradX[row0 + c1] * (tx - 1) + gradY[row0 + c1] * ty;
      const n01 = gradX[row1 + c0] * tx + gradY[row1 + c0] * (ty - 1);
      const n11 = gradX[row1 + c1] * (tx - 1) + gradY[row1 + c1] * (ty - 1);
      const sx = fade(tx);
      const top = n00 + sx * (n10 - n00);
      const bottom = n01 + sx * (n11 - n01);
      out[py * size + px] += amplitude * (top + sy * (bottom - top));
    }
  }
}

/** Perlin's quintic fade. */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function normalize(values: Float32Array): Float32Array {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const span = hi - lo || 1;
  for (let i = 0; i < values.length; i++) values[i] = (values[i] - lo) / span;
  return values;
}

/**
 * Tangent-space normals (RGBA8) from a tileable height field by wrapped central differences,
 * scaled so the RMS slope equals `slopeRms`. Rows run along +v (DataTexture is not flipped).
 */
function heightToNormals(height: Float32Array, size: number, slopeRms: number): Uint8Array {
  const count = size * size;
  const dx = new Float32Array(count);
  const dy = new Float32Array(count);
  let sumSq = 0;
  for (let y = 0; y < size; y++) {
    const row = y * size;
    const next = ((y + 1) % size) * size;
    const prev = ((y - 1 + size) % size) * size;
    for (let x = 0; x < size; x++) {
      const i = row + x;
      dx[i] = (height[row + ((x + 1) % size)] - height[row + ((x - 1 + size) % size)]) / 2;
      dy[i] = (height[next + x] - height[prev + x]) / 2;
      sumSq += dx[i] * dx[i] + dy[i] * dy[i];
    }
  }
  const gain = slopeRms / (Math.sqrt(sumSq / count) || 1);
  const out = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    const nx = -dx[i] * gain;
    const ny = -dy[i] * gain;
    const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
    out[i * 4] = encodeUnit(nx * inv);
    out[i * 4 + 1] = encodeUnit(ny * inv);
    out[i * 4 + 2] = encodeUnit(inv);
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** [-1, 1] → byte */
function encodeUnit(v: number): number {
  return Math.round((v * 0.5 + 0.5) * 255);
}

/** Height [0, 1] remapped to [lo, hi] in RGB (three reads roughness from G). */
function heightToGrey(height: Float32Array, lo: number, hi: number): Uint8Array {
  const out = new Uint8Array(height.length * 4);
  for (let i = 0; i < height.length; i++) {
    const v = Math.round((lo + (hi - lo) * height[i]) * 255);
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Repeating, trilinear + anisotropic: these maps get tiled and seen at grazing angles. */
function dataTexture(data: Uint8Array, size: number, anisotropy: number): DataTexture {
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}
