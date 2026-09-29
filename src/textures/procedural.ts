import { ClampToEdgeWrapping, DataTexture, LinearFilter, LinearMipmapLinearFilter, MathUtils, RGBAFormat, RepeatWrapping } from 'three';
import { config } from '../config';

const MM_PER_M = 1000;
/** A Gaussian ridge is negligible beyond this many widths from its center. */
const GAUSSIAN_REACH = 3;

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
}

/**
 * §4.3 paperGrain: 3-octave fractal noise, normals from finite differences. Used by the table
 * (the prints are smooth resin-coated paper and carry no grain).
 */
export function createPaperGrain(anisotropy: number): PaperGrain {
  const { size, grain } = config.textures;
  const height = fbm(size, grain.octaves, grain.baseCells, grain.persistence, createRng(grain.seed));
  return { normalMap: dataTexture(heightToNormals(height, size, size, grain.slopeRms), size, size, anisotropy) };
}

/**
 * §4.3 crease: a few faint lines parallel to the hinge within the top `band` of the acetate,
 * as narrow ridges and valleys that drift slightly along their length. Acetate UV space: columns
 * run across the sheet, rows from the free edge (v = 0) up to the hinge (v = 1).
 */
export function createCreaseNormalTexture(anisotropy: number): DataTexture {
  const { w, h } = config.acetate;
  const crease = config.textures.crease;
  const rng = createRng(crease.seed);
  const widest = crease.widthMm.max / MM_PER_M;
  const wander = crease.wanderMm / MM_PER_M;
  const lines = Array.from({ length: randInt(rng, crease.lines) }, () => ({
    distance: randRange(rng, { min: widest, max: crease.band - widest }),
    width: randRange(rng, crease.widthMm) / MM_PER_M,
    depth: randRange(rng, crease.depth) * (rng() < 0.5 ? -1 : 1),
    cycles: randRange(rng, crease.wanderCycles),
    phase: rng() * Math.PI * 2,
  }));

  const width = crease.pxAcross;
  const rows = crease.pxAlong;
  const height = new Float32Array(width * rows);
  for (let r = 0; r < rows; r++) {
    const d = (1 - (r + 0.5) / rows) * h;  // distance from the hinge
    if (d > crease.band + widest * GAUSSIAN_REACH) continue;
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      let sum = 0;
      for (const line of lines) {
        const center = line.distance + wander * Math.sin(Math.PI * 2 * line.cycles * u + line.phase);
        sum += line.depth * Math.exp(-(((d - center) / line.width) ** 2));
      }
      height[r * width + x] = sum;
    }
  }
  const normals = heightToNormals(height, width, rows, crease.slopeRms, {
    spacing: { x: w / width, y: h / rows },
    wrap: false,
    rmsOver: 'relief',
  });
  return dataTexture(normals, width, rows, anisotropy, false);
}

/**
 * §4.3 footprintShadow: alpha 1 over the acetate's footprint, falling to 0 across a softEdge-wide
 * band centred on its outline. The texture covers the footprint plus softEdge / 2 on every side;
 * use it as an alphaMap (three reads G).
 */
export function createFootprintTexture(anisotropy: number): DataTexture {
  const { w, h } = config.acetate;
  const { softEdge, pxPerMm } = config.textures.footprint;
  const planeW = w + softEdge;
  const planeH = h + softEdge;
  const width = Math.round(planeW * MM_PER_M * pxPerMm);
  const height = Math.round(planeH * MM_PER_M * pxPerMm);
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    // Signed distance to the footprint's outline in meters, positive inside.
    const dy = h / 2 - Math.abs((y + 0.5) / height - 0.5) * planeH;
    for (let x = 0; x < width; x++) {
      const dx = w / 2 - Math.abs((x + 0.5) / width - 0.5) * planeW;
      const inside = dx < 0 && dy < 0 ? -Math.hypot(dx, dy) : Math.min(dx, dy);
      const alpha = Math.round(MathUtils.smoothstep(inside, -softEdge / 2, softEdge / 2) * 255);
      data.fill(alpha, (y * width + x) * 4, (y * width + x) * 4 + 4);
    }
  }
  const texture = new DataTexture(data, width, height, RGBAFormat);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
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

interface NormalOptions {
  /** Pixel spacing across (x) and along (y) in one unit; slopes are per that unit. Default 1. */
  spacing?: { x: number; y: number };
  /** Wrap around the borders (tileable maps); otherwise clamp. Default true. */
  wrap?: boolean;
  /** Normalise the RMS slope over every pixel, or only where there is relief (sparse maps). */
  rmsOver?: 'all' | 'relief';
}

/** Pixels whose slope is below this fraction of the steepest count as flat for rmsOver 'relief'. */
const RELIEF_FRACTION = 0.05;

/**
 * Tangent-space normals (RGBA8) from a height field by central differences, scaled so the RMS
 * slope equals `slopeRms`. Rows run along +v (DataTexture is not flipped).
 */
export function heightToNormals(height: Float32Array, width: number, rows: number, slopeRms: number, options: NormalOptions = {}): Uint8Array {
  const { spacing = { x: 1, y: 1 }, wrap = true, rmsOver = 'all' } = options;
  const count = width * rows;
  const at = (i: number, n: number) => (wrap ? (i + n) % n : MathUtils.clamp(i, 0, n - 1));
  const dx = new Float32Array(count);
  const dy = new Float32Array(count);
  for (let y = 0; y < rows; y++) {
    const row = y * width;
    const next = at(y + 1, rows) * width;
    const prev = at(y - 1, rows) * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      dx[i] = (height[row + at(x + 1, width)] - height[row + at(x - 1, width)]) / (2 * spacing.x);
      dy[i] = (height[next + x] - height[prev + x]) / (2 * spacing.y);
    }
  }
  const gain = slopeRms / (rmsSlope(dx, dy, rmsOver) || 1);
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

function rmsSlope(dx: Float32Array, dy: Float32Array, over: 'all' | 'relief'): number {
  let floor = 0;
  if (over === 'relief') {
    let steepest = 0;
    for (let i = 0; i < dx.length; i++) steepest = Math.max(steepest, Math.hypot(dx[i], dy[i]));
    floor = steepest * RELIEF_FRACTION;
  }
  let sumSq = 0;
  let n = 0;
  for (let i = 0; i < dx.length; i++) {
    const sq = dx[i] * dx[i] + dy[i] * dy[i];
    if (over === 'relief' && Math.sqrt(sq) < floor) continue;
    sumSq += sq;
    n++;
  }
  return Math.sqrt(sumSq / (n || 1));
}

/** [-1, 1] → byte */
function encodeUnit(v: number): number {
  return Math.round((v * 0.5 + 0.5) * 255);
}

/** RGBA8 data map, trilinear + anisotropic: these get tiled and seen at grazing angles. */
export function dataTexture(data: Uint8Array, width: number, rows: number, anisotropy: number, wrap = true): DataTexture {
  const texture = new DataTexture(data, width, rows, RGBAFormat);
  texture.wrapS = wrap ? RepeatWrapping : ClampToEdgeWrapping;
  texture.wrapT = wrap ? RepeatWrapping : ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}
