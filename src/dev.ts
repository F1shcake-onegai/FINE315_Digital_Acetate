import { MathUtils, type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three';
import { config } from './config';
import type { ViewControls } from './interaction/viewControls';
import type { SetHandle } from './scene/set';

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
 * M2 dev toggle: F tilts both flat acetates to fresnelTestDeg about the hinge and back, to check
 * the Fresnel flash at grazing angles. Dev server only.
 */
export function bindFresnelTest(sets: SetHandle[]): void {
  if (!import.meta.env.DEV || !window.__app) return;
  const setAngle = (degrees: number) => sets.forEach((set) => set.setAngle(MathUtils.degToRad(degrees)));
  window.__app.acetateAngle = setAngle;
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
