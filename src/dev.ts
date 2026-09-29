import { Vector3, type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three';
import { config } from './config';
import { placeCamera } from './scene/camera';

/** Dev-server-only handle on window.__app for poking at the scene from the console. */
export interface DevHandle {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  config: typeof config;
  /** True once the scene is fully built and a frame of it has been rendered. */
  ready: boolean;
  /** Look at table point (x, z) from `distance`, keeping the §3 tilt. */
  view(distance: number, x?: number, z?: number): void;
}

declare global {
  interface Window {
    __app?: DevHandle;
  }
}

export function exposeDevHandle(parts: Pick<DevHandle, 'renderer' | 'scene' | 'camera'>): void {
  if (!import.meta.env.DEV) return;
  window.__app = {
    ...parts,
    config,
    ready: false,
    view(distance, x = 0, z = 0) {
      placeCamera(parts.camera, new Vector3(x, 0, z), distance);
    },
  };
}

export function markReady(): void {
  if (window.__app) window.__app.ready = true;
}
