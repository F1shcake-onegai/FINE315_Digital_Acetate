import { Color, MathUtils, RepeatWrapping, SRGBColorSpace, Texture, type DataTexture } from 'three';
import { config } from '../config';
import { imagePixels, loadImage } from './loader';
import { createRng, dataTexture, fbm, randInt, randRange, type Rng } from './procedural';

/** The tape's kraft color: a seamless texture tiled in meters of tape, and the tint that goes with it. */
export interface Kraft {
  map: Texture;
  /** Linear material color: scales the texture so that its mean is config.tape.color. */
  tint: Color;
}

/**
 * The kraft scan named in config.tape.kraft, or the §4.3 procedural fiber noise (logged) when the
 * file is missing or unreadable. The scan keeps its own texture; the tint moves its mean color to
 * tape.color.
 */
export async function loadKraft(anisotropy: number): Promise<Kraft> {
  const { kraft: path, kraftTile, color } = config.tape;
  const image = await loadImage(import.meta.env.BASE_URL + path);
  let map: Texture;
  const tint = new Color(1, 1, 1);
  if (image) {
    map = new Texture(image);
    const mean = meanColor(image);
    const target = new Color(color);
    tint.setRGB(target.r / mean.r, target.g / mean.g, target.b / mean.b);
  } else {
    console.warn(`[assets] public/${path} is missing or unreadable; the tape uses procedural kraft.`);
    map = createKraftPlaceholder(anisotropy);
  }
  map.colorSpace = SRGBColorSpace;
  map.wrapS = RepeatWrapping;
  map.wrapT = RepeatWrapping;
  map.repeat.set(1 / kraftTile, 1 / kraftTile);
  map.anisotropy = anisotropy;
  map.needsUpdate = true;
  return { map, tint };
}

/** Mean color of an sRGB image, averaged in linear light. */
function meanColor(image: HTMLImageElement): Color {
  const toLinear = Array.from({ length: 256 }, (_, v) => new Color().setRGB(v / 255, 0, 0, SRGBColorSpace).r);
  const { data } = imagePixels(image);
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) sum[c] += toLinear[data[i + c]];
  }
  const count = data.length / 4;
  return new Color(sum[0] / count, sum[1] / count, sum[2] / count);
}

/** §4.3 kraft: seamless fBm on tape.color with ±valueVar value variation. */
function createKraftPlaceholder(anisotropy: number): DataTexture {
  const { valueVar, px, octaves, baseCells, persistence, seed } = config.textures.kraft;
  const noise = fbm(px, octaves, baseCells, persistence, createRng(seed));
  const base = new Color(config.tape.color).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  const data = new Uint8Array(px * px * 4);
  const toByte = (v: number) => Math.round(MathUtils.clamp(v, 0, 1) * 255);
  for (let i = 0; i < noise.length; i++) {
    const value = 1 + valueVar * (2 * noise[i] - 1);
    data[i * 4] = toByte(base.r * value);
    data[i * 4 + 1] = toByte(base.g * value);
    data[i * 4 + 2] = toByte(base.b * value);
    data[i * 4 + 3] = 255;
  }
  return dataTexture(data, px, px, anisotropy);
}

/**
 * One tape's hand-torn ends, read through uv1 (see createTape): u 0–0.5 is the left end's tear
 * zone and 0.5–1 the right end's, v runs across the tape. G is alpha (three's alphaMap channel):
 * 1 on the tape side of each tear, 0 past it, ramping over one texel so that alphaTest cuts the
 * tear smoothly between texels. R is the light fiber fringe along the tear (see createTapeMaterial).
 */
export function createTearTexture(sheet: number, anisotropy: number): DataTexture {
  const { w, tear } = config.tape;
  const { fringe } = tear;
  const rng = createRng(tear.seeds[sheet % tear.seeds.length]);
  const along = tear.pxAlong;
  const width = along * 2;
  const rows = tear.pxAcross;
  const texel = { along: tear.zone / along, across: w / rows };  // m
  const data = new Uint8Array(width * rows * 4);
  for (let end = 0; end < 2; end++) {
    // Within this end's zone, positions are in meters: `across` the tape from its acetate-side
    // edge, and `outward` past the nominal end, which is −x at the left end and +x at the right.
    const sign = end === 0 ? -1 : 1;
    const outwardAt = (column: number) => sign * ((column + 0.5) / along - 0.5) * tear.zone;
    const columnAt = (outward: number) => ((sign * outward) / tear.zone + 0.5) * along - 0.5;
    const reach = tearProfile(rng, rows, w);
    const margin = jagged(rng, w, fringe.wavelength);
    const alpha = new Float32Array(rows * along);
    const fringeLevel = new Float32Array(rows * along);
    for (let r = 0; r < rows; r++) {
      const fringeWidth = fringe.width * MathUtils.clamp(0.5 + 0.5 * margin((r + 0.5) * texel.across), 0, 1);
      for (let c = 0; c < along; c++) {
        const inside = reach[r] - outwardAt(c);
        alpha[r * along + c] = MathUtils.clamp(0.5 + inside / texel.along, 0, 1);
        fringeLevel[r * along + c] = inside < 0 ? 1 : 1 - MathUtils.smoothstep(inside, 0, fringeWidth);
      }
    }

    // Loose fibers: thin strands rooted just inside the tear, fanning out past it.
    for (let n = randInt(rng, fringe.fibers); n > 0; n--) {
      const root = Math.floor(rng() * rows);
      const angle = MathUtils.degToRad(fringe.fiberSpreadDeg) * (2 * rng() - 1);
      const length = randRange(rng, fringe.fiberLength);
      const a0 = (root + 0.5) * texel.across;
      const o0 = reach[root] - fringe.fiberWidth;
      const a1 = a0 + length * Math.sin(angle);
      const o1 = o0 + length * Math.cos(angle);
      const r0 = Math.max(0, Math.floor(Math.min(a0, a1) / texel.across) - 1);
      const r1 = Math.min(rows - 1, Math.ceil(Math.max(a0, a1) / texel.across) + 1);
      const [cA, cB] = [columnAt(o0), columnAt(o1)];
      const c0 = Math.max(0, Math.floor(Math.min(cA, cB)) - 1);
      const c1 = Math.min(along - 1, Math.ceil(Math.max(cA, cB)) + 1);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const distance = segmentDistance((r + 0.5) * texel.across, outwardAt(c), a0, o0, a1, o1);
          const strand = MathUtils.clamp(0.5 + (fringe.fiberWidth / 2 - distance) / texel.along, 0, 1);
          alpha[r * along + c] = Math.max(alpha[r * along + c], strand);
          if (strand > 0) fringeLevel[r * along + c] = 1;
        }
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < along; c++) {
        const i = (r * width + end * along + c) * 4;
        data[i] = Math.round(fringe.strength * fringeLevel[r * along + c] * (0.5 + 0.5 * rng()) * 255);
        data[i + 1] = Math.round(alpha[r * along + c] * 255);
        data[i + 2] = data[i + 1];
        data[i + 3] = 255;
      }
    }
  }
  const texture = dataTexture(data, width, rows, anisotropy, false);
  texture.channel = 1;
  return texture;
}

/** Distance from point (x, y) to the segment (x0, y0)–(x1, y1). */
function segmentDistance(x: number, y: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const t = MathUtils.clamp(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(x - x0 - t * dx, y - y0 - t * dy);
}

/**
 * How far a tear reaches past its nominal end (m) at each row across a tape `width` wide: a random
 * slant plus octaves of jagged noise.
 */
function tearProfile(rng: Rng, rows: number, width: number): Float32Array {
  const { slant, jags } = config.tape.tear;
  const skew = slant * (2 * rng() - 1);
  const octaves = jags.map(({ wavelength, amplitude }) => ({ amplitude, noise: jagged(rng, width, wavelength) }));
  const reach = new Float32Array(rows);
  for (let r = 0; r < rows; r++) {
    const across = (r + 0.5) / rows;
    let sum = skew * (across - 0.5);
    for (const octave of octaves) sum += octave.amplitude * octave.noise(across * width);
    reach[r] = sum;
  }
  return reach;
}

/**
 * 1D noise in [−1, 1] over 0…length: random knots every `wavelength`, joined by straight runs,
 * since torn fibers break at angles rather than in curves.
 */
function jagged(rng: Rng, length: number, wavelength: number): (position: number) => number {
  const knots = Array.from({ length: Math.ceil(length / wavelength) + 2 }, () => 2 * rng() - 1);
  const phase = rng();
  return (position) => {
    const p = position / wavelength + phase;
    const k = Math.floor(p);
    return MathUtils.lerp(knots[k], knots[k + 1], p - k);
  };
}
