import { ACESFilmicToneMapping, CustomToneMapping, PCFShadowMap, SRGBColorSpace, ShaderChunk, WebGLRenderer } from 'three';
import { config } from '../config';

/** three's placeholder for CustomToneMapping in the tonemapping_pars_fragment chunk. */
const CUSTOM_TONE_MAPPING_STUB = 'vec3 CustomToneMapping( vec3 color ) { return color; }';

/** §3: ACES filmic plus a black point, sRGB output, soft PCF shadows (softness from shadow.radius). */
export function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = installBlackPointToneMapping(config.light.blackPoint) ? CustomToneMapping : ACESFilmicToneMapping;
  renderer.toneMappingExposure = config.light.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  return renderer;
}

/**
 * CustomToneMapping = ACES filmic, then a Levels-style black point in display (sRGB) space:
 * values at or below `blackPoint` go to black, white stays white. Falls back to plain ACES
 * (returns false) if three's shader chunk no longer has the stub to replace.
 */
function installBlackPointToneMapping(blackPoint: number): boolean {
  const chunk = ShaderChunk.tonemapping_pars_fragment;
  if (!chunk.includes(CUSTOM_TONE_MAPPING_STUB)) {
    console.warn('[renderer] three.js tone-mapping chunk changed; black point disabled, using plain ACES.');
    return false;
  }
  // The colorspace helpers are declared after this chunk, so the sRGB transfer is inlined.
  ShaderChunk.tonemapping_pars_fragment = chunk.replace(CUSTOM_TONE_MAPPING_STUB, /* glsl */ `
vec3 blackPointToDisplay( vec3 c ) {
  return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( vec3( 0.0031308 ), c ) );
}
vec3 blackPointToLinear( vec3 c ) {
  return mix( c / 12.92, pow( ( c + 0.055 ) / 1.055, vec3( 2.4 ) ), step( vec3( 0.04045 ), c ) );
}
vec3 CustomToneMapping( vec3 color ) {
  vec3 display = blackPointToDisplay( ACESFilmicToneMapping( color ) );
  display = saturate( ( display - ${blackPoint.toFixed(4)} ) / ${(1 - blackPoint).toFixed(4)} );
  return blackPointToLinear( display );
}`);
  return true;
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
