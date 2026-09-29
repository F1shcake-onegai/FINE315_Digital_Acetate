import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';
import { config } from '../config';

/** §3: ACES filmic, sRGB output, soft PCF shadows (softness from shadow.radius). */
export function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = config.light.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  return renderer;
}

/** Size the drawing buffer to the canvas' CSS size; pixel ratio capped per §3. */
export function resizeRenderer(renderer: WebGLRenderer, width: number, height: number): void {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, config.perf.maxPixelRatio));
  renderer.setSize(width, height, false);
}

/** Call `onChange` whenever devicePixelRatio changes (window moved to another monitor, browser zoom). */
export function watchPixelRatio(onChange: () => void): void {
  const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  query.addEventListener('change', () => {
    onChange();
    watchPixelRatio(onChange);
  }, { once: true });
}
