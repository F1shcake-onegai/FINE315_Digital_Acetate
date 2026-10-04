import { ClampToEdgeWrapping, DataTexture, LinearFilter, LinearMipmapLinearFilter, MathUtils, RGBAFormat, RepeatWrapping } from 'three';
import { config } from '../config';

type Rng = () => number;

interface Range { min: number; max: number }

function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng: Rng, range: Range): number {
  return range.min + (range.max - range.min) * rng();
}

function randInt(rng: Rng, range: Range): number {
  return Math.floor(range.min + (range.max - range.min + 1) * rng());
}

export function createCreaseNormalTexture(anisotropy: number): DataTexture {
  const { w, h } = config.acetate;
  const crease = config.textures.crease;
  const rng = createRng(crease.seed);
  const widest = crease.widthMm.max / 1000; // mm→m
  const wander = crease.wanderMm / 1000;
  const lines = Array.from({ length: randInt(rng, crease.lines) }, () => ({
    distance: randRange(rng, { min: widest, max: crease.band - widest }),
    width: randRange(rng, crease.widthMm) / 1000,
    depth: randRange(rng, crease.depth) * (rng() < 0.5 ? -1 : 1),
    cycles: randRange(rng, crease.wanderCycles),
    phase: rng() * Math.PI * 2,
  }));

  const width = crease.pxAcross;
  const rows = crease.pxAlong;
  const height = new Float32Array(width * rows);
  for (let r = 0; r < rows; r++) {
    const d = (1 - (r + 0.5) / rows) * h;
    if (d > crease.band + widest * 3) continue; // 3 = gaussian reach
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

export function createFootprintTexture(anisotropy: number): DataTexture {
  const { w, h } = config.acetate;
  const { softEdge, pxPerMm } = config.textures.footprint;
  const planeW = w + softEdge;
  const planeH = h + softEdge;
  const width = Math.round(planeW * 1000 * pxPerMm); // 1000 = mm/m
  const height = Math.round(planeH * 1000 * pxPerMm);
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
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

function heightToNormals(height: Float32Array, width: number, rows: number, slopeRms: number, options: { spacing?: { x: number; y: number }; wrap?: boolean; rmsOver?: 'all' | 'relief' } = {}): Uint8Array {
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
    out[i * 4] = Math.round((nx * inv * 0.5 + 0.5) * 255);
    out[i * 4 + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
    out[i * 4 + 2] = Math.round(inv * 0.5 * 255 + 127.5);
    out[i * 4 + 3] = 255;
  }
  return out;
}

function rmsSlope(dx: Float32Array, dy: Float32Array, over: 'all' | 'relief'): number {
  let floor = 0;
  if (over === 'relief') {
    let steepest = 0;
    for (let i = 0; i < dx.length; i++) steepest = Math.max(steepest, Math.hypot(dx[i], dy[i]));
    floor = steepest * 0.05; // 0.05 = relief fraction
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
