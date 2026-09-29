import { PMREMGenerator, type Scene, type WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { config } from '../config';

/**
 * §3: scene.environment is a PMREM of RoomEnvironment, swapped for the optional
 * public/assets/env.hdr once that loads. A missing HDRI is logged and the room stays.
 */
export function applyEnvironment(renderer: WebGLRenderer, scene: Scene): void {
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const roomTarget = pmrem.fromScene(room, config.environment.roomBlur);
  scene.environment = roomTarget.texture;
  room.dispose();

  const path = config.assets.env;
  new HDRLoader().load(
    import.meta.env.BASE_URL + path,
    (hdr) => {
      scene.environment = pmrem.fromEquirectangular(hdr).texture;
      scene.environmentIntensity = config.environment.hdrIntensity;
      hdr.dispose();
      roomTarget.dispose();
      pmrem.dispose();
    },
    undefined,
    () => {
      console.warn(`[assets] optional public/${path} is missing or unreadable; using RoomEnvironment.`);
      pmrem.dispose();
    },
  );
}
