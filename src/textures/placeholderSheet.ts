import { MathUtils } from 'three';
import { config } from '../config';
import { createRng, randInt, randRange, type Rng } from './procedural';

const MM_PER_M = 1000;
/** Canvas units per mm while drawing text, so font sizes stay well above 1 px before the mm → px transform. */
const TEXT_UNITS_PER_MM = 10;
/** Resolution of the per-frame tone lookup table. */
const TONE_STEPS = 1024;

type Rgb = [number, number, number];

/** Paints one frame into a reusable canvas and returns that canvas. */
type FramePainter = (rng: Rng) => HTMLCanvasElement;

interface StripPlacement {
  x: number;
  y: number;
  angle: number;
  firstFrame: number;
  film: string;
}

/**
 * §4.2 placeholder contact sheet, drawn in mm on a 2D canvas: white easel border, near-black
 * exposed paper, 35 mm strips with sprocket holes, grey "photos" and edge markings.
 * The same seed always produces the same sheet.
 */
export function createPlaceholderSheet(seed: number): HTMLCanvasElement {
  const p = config.placeholder;
  const sheetW = config.paper.w * MM_PER_M;
  const sheetH = config.paper.h * MM_PER_M;
  const pxPerMm = { x: p.widthPx / sheetW, y: p.heightPx / sheetH };

  const canvas = document.createElement('canvas');
  canvas.width = p.widthPx;
  canvas.height = p.heightPx;
  const ctx = context2d(canvas);
  ctx.setTransform(pxPerMm.x, 0, 0, pxPerMm.y, 0, 0);

  const rng = createRng(seed);
  const film = p.marks.filmNames[Math.floor(rng() * p.marks.filmNames.length)];
  const paintFrame = createFramePainter(
    Math.round(p.frame.wMm * pxPerMm.x),
    Math.round(p.frame.hMm * pxPerMm.y),
    pxPerMm.x,
  );

  drawExposedPaper(ctx, sheetW, sheetH);

  const stackH = p.strips * p.stripMm + (p.strips - 1) * p.stripGapMm;
  const firstY = (sheetH - stackH) / 2 + p.stripMm / 2;
  for (let s = 0; s < p.strips; s++) {
    drawStrip(ctx, rng, paintFrame, {
      x: sheetW / 2 + jitter(rng, p.stripJitterMm),
      y: firstY + s * (p.stripMm + p.stripGapMm) + jitter(rng, p.stripJitterMm),
      angle: MathUtils.degToRad(jitter(rng, p.stripJitterDeg)),
      firstFrame: 1 + s * p.framesPerStrip,
      film,
    });
  }

  drawEaselBorder(ctx, sheetW, sheetH);
  return canvas;
}

function drawExposedPaper(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const { exposedColor, vignette } = config.placeholder;
  ctx.fillStyle = exposedColor;
  ctx.fillRect(0, 0, w, h);
  const vignetteGradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
  vignetteGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignetteGradient.addColorStop(1, `rgba(0, 0, 0, ${vignette})`);
  ctx.fillStyle = vignetteGradient;
  ctx.fillRect(0, 0, w, h);
}

/** The easel blades mask everything outside the image area, strips included. */
function drawEaselBorder(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const { borderMm: b, borderColor } = config.placeholder;
  ctx.fillStyle = borderColor;
  ctx.fillRect(0, 0, w, b);
  ctx.fillRect(0, h - b, w, b);
  ctx.fillRect(0, b, b, h - 2 * b);
  ctx.fillRect(w - b, b, b, h - 2 * b);
}

/** One film strip in its own frame: x along the film, y across it, origin at the strip center. */
function drawStrip(ctx: CanvasRenderingContext2D, rng: Rng, paintFrame: FramePainter, strip: StripPlacement): void {
  const { stripMm, stripColor, framesPerStrip, frame, sprocket, marks } = config.placeholder;
  const pitch = frame.wMm + frame.gapMm;
  const length = framesPerStrip * pitch;  // strips are cut through the gaps between frames
  const halfW = length / 2;
  const halfH = stripMm / 2;

  ctx.save();
  ctx.translate(strip.x, strip.y);
  ctx.rotate(strip.angle);
  ctx.beginPath();
  ctx.rect(-halfW, -halfH, length, stripMm);
  ctx.clip();  // holes and edge print stop where the film was cut

  ctx.fillStyle = stripColor;
  ctx.fillRect(-halfW, -halfH, length, stripMm);

  ctx.fillStyle = sprocket.color;
  ctx.beginPath();
  for (let x = -halfW - rng() * sprocket.pitchMm; x < halfW; x += sprocket.pitchMm) {
    ctx.roundRect(x, -halfH + sprocket.edgeMm, sprocket.alongMm, sprocket.acrossMm, sprocket.cornerMm);
    ctx.roundRect(x, halfH - sprocket.edgeMm - sprocket.acrossMm, sprocket.alongMm, sprocket.acrossMm, sprocket.cornerMm);
  }
  ctx.fill();

  for (let f = 0; f < framesPerStrip; f++) {
    const left = -halfW + frame.gapMm / 2 + f * pitch;
    ctx.drawImage(paintFrame(rng), left, -frame.hMm / 2, frame.wMm, frame.hMm);
  }

  // Edge print sits in the band between the film edge and the holes: frame numbers along the
  // bottom ("12" under its frame, "12A" between frames), the film name along the top.
  const bandY = halfH - sprocket.edgeMm / 2;
  ctx.fillStyle = marks.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let f = 0; f < framesPerStrip; f++) {
    const center = -halfW + pitch / 2 + f * pitch;
    const number = strip.firstFrame + f;
    drawMark(ctx, String(number), center, bandY);
    drawMark(ctx, `${number}A`, center + pitch / 2, bandY);
    if (f % marks.nameEvery === 0) drawMark(ctx, strip.film, center, -bandY);
  }
  ctx.restore();
}

function drawMark(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  const { sizeMm, font } = config.placeholder.marks;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 / TEXT_UNITS_PER_MM, 1 / TEXT_UNITS_PER_MM);
  ctx.font = `bold ${sizeMm * TEXT_UNITS_PER_MM}px ${font}`;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/**
 * Frames: a mid-grey gradient with low-frequency mottle, 2–4 soft darker/lighter rectangles,
 * per-pixel grain and a per-frame exposure shift, mapped from print black to paper white.
 * The rounded film-gate corners stay transparent so the rebate shows through.
 */
function createFramePainter(width: number, height: number, pxPerMm: number): FramePainter {
  const { frame, exposedColor, borderColor } = config.placeholder;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = context2d(canvas);
  const image = ctx.createImageData(width, height);
  const data = image.data;
  const alpha = roundedRectCoverage(width, height, frame.cornerMm * pxPerMm);
  const black = hexToRgb(exposedColor);
  const white = hexToRgb(borderColor);
  const tones = new Uint8ClampedArray(TONE_STEPS * 3);
  const cells = frame.mottleCells;
  const mottle = new Float32Array((cells + 1) * (cells + 1));

  return (rng) => {
    const angle = rng() * Math.PI * 2;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const toneA = randRange(rng, frame.tone);
    const toneB = randRange(rng, frame.tone);
    for (let i = 0; i < mottle.length; i++) mottle[i] = (rng() * 2 - 1) * frame.mottle;

    const rects = Array.from({ length: randInt(rng, frame.rects) }, () => {
      const w = randRange(rng, frame.rectSize) * width;
      const h = randRange(rng, frame.rectSize) * height;
      const x0 = rng() * (width - w);
      const y0 = rng() * (height - h);
      const sign = rng() < 0.5 ? -1 : 1;
      return { x0, y0, x1: x0 + w, y1: y0 + h, delta: sign * randRange(rng, frame.rectDelta), soft: randRange(rng, frame.rectSoftMm) * pxPerMm };
    });

    const gamma = 2 ** ((rng() * 2 - 1) * frame.exposureVar);
    for (let i = 0; i < TONE_STEPS; i++) {
      const t = (i / (TONE_STEPS - 1)) ** gamma;
      for (let c = 0; c < 3; c++) tones[i * 3 + c] = black[c] + (white[c] - black[c]) * t;
    }

    for (let y = 0; y < height; y++) {
      const py = y + 0.5;
      const v = py / height;
      for (let x = 0; x < width; x++) {
        const px = x + 0.5;
        const u = px / width;
        let tone = toneA + (toneB - toneA) * MathUtils.clamp(0.5 + (u - 0.5) * dirX + (v - 0.5) * dirY, 0, 1);
        tone += sampleGrid(mottle, cells, u, v);
        for (const r of rects) {
          const inside = Math.min(px - r.x0, r.x1 - px, py - r.y0, r.y1 - py);
          tone += r.delta * MathUtils.smoothstep(inside, -r.soft, r.soft);
        }
        tone += (rng() - 0.5) * frame.grain;
        const k = Math.round(MathUtils.clamp(tone, 0, 1) * (TONE_STEPS - 1)) * 3;
        const o = (y * width + x) * 4;
        data[o] = tones[k];
        data[o + 1] = tones[k + 1];
        data[o + 2] = tones[k + 2];
        data[o + 3] = alpha[y * width + x];
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  };
}

/** Smoothly interpolated value of a (cells + 1)² grid at (u, v) in [0, 1]². */
function sampleGrid(grid: Float32Array, cells: number, u: number, v: number): number {
  const gx = u * cells;
  const gy = v * cells;
  const x0 = Math.min(Math.floor(gx), cells - 1);
  const y0 = Math.min(Math.floor(gy), cells - 1);
  const tx = MathUtils.smoothstep(gx - x0, 0, 1);
  const ty = MathUtils.smoothstep(gy - y0, 0, 1);
  const row = cells + 1;
  const a = grid[y0 * row + x0];
  const b = grid[y0 * row + x0 + 1];
  const c = grid[(y0 + 1) * row + x0];
  const d = grid[(y0 + 1) * row + x0 + 1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

/** Per-pixel alpha (0–255) of a w × h rectangle with rounded corners, antialiased over one pixel. */
function roundedRectCoverage(w: number, h: number, radius: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const qy = Math.abs(y + 0.5 - h / 2) - (h / 2 - radius);
    for (let x = 0; x < w; x++) {
      const qx = Math.abs(x + 0.5 - w / 2) - (w / 2 - radius);
      const distance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
      out[y * w + x] = MathUtils.clamp(0.5 - distance, 0, 1) * 255;
    }
  }
  return out;
}

function jitter(rng: Rng, amount: number): number {
  return (rng() * 2 - 1) * amount;
}

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  return ctx;
}
