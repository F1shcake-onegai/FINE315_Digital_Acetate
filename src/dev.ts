import { MathUtils, type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three';
import { config } from './config';
import type { Flip } from './interaction/flip';
import type { ViewControls } from './interaction/viewControls';

/** Dev-server-only handle on window.__app for poking at the scene from the console. */
export interface DevHandle {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  config: typeof config;
  /** True once the scene is fully built and a frame of it has been rendered. */
  ready: boolean;
  /** Look at table point (x, z) from `distance`, keeping the camera angle. */
  view(distance: number, x?: number, z?: number): void;
  /** Set both acetates' hinge angle in degrees (0 closed … 180 open). Available once the sets exist. */
  acetateAngle?(degrees: number): void;
  /** The flip controller, e.g. flip.states() or flip.toggle(0). Available once the sets exist. */
  flip?: Flip;
}

declare global {
  interface Window {
    __app?: DevHandle;
  }
}

export function exposeDevHandle(parts: Pick<DevHandle, 'renderer' | 'scene' | 'camera'>, controls: ViewControls): void {
  if (!import.meta.env.DEV) return;
  window.__app = {
    ...parts,
    config,
    ready: false,
    view: (distance, x = 0, z = 0) => controls.lookAt(distance, x, z),
  };
}

/**
 * Dev posing through the flip controller: acetateAngle(degrees), and the M2 toggle F, which tilts
 * both acetates to fresnelTestDeg about the hinge and back to check the Fresnel flash at grazing
 * angles. Dev server only.
 */
export function bindDevPose(flip: Flip): void {
  if (!import.meta.env.DEV || !window.__app) return;
  const setAngle = (degrees: number) => flip.pose(MathUtils.degToRad(degrees));
  window.__app.acetateAngle = setAngle;
  window.__app.flip = flip;
  let tilted = false;
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'f' && event.key !== 'F') return;
    tilted = !tilted;
    setAngle(tilted ? config.acetate.fresnelTestDeg : 0);
  });
}

export function markReady(): void {
  if (window.__app) window.__app.ready = true;
}
