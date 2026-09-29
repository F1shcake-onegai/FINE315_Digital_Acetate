import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { config } from './config';
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

export function markReady(): void {
  if (window.__app) window.__app.ready = true;
}
