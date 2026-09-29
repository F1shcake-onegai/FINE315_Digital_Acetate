import {
  BackSide, BoxGeometry, Color, DoubleSide, Mesh, MeshBasicMaterial, PMREMGenerator, PlaneGeometry, Scene,
  type Texture, type WebGLRenderer,
} from 'three';
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

/**
 * What the acetate reflects (config.acetateStudio): a dark room with a light floor and a few
 * softboxes, pre-filtered with PMREM. Keeps the flat sheet from mirroring the bright room over
 * the prints while leaving highlights for bends, tilts and edges.
 */
export function createAcetateEnvironment(renderer: WebGLRenderer): Texture {
  const studio = config.acetateStudio;
  const scene = new Scene();

  // BoxGeometry groups: +x, −x, +y, −y (floor), +z, −z; seen from inside.
  const wall = new MeshBasicMaterial({ color: studio.wallColor, side: BackSide });
  const floor = new MeshBasicMaterial({
    color: new Color(studio.floor.color).multiplyScalar(studio.floor.intensity),
    side: BackSide,
  });
  const size = studio.roomSize;
  scene.add(new Mesh(new BoxGeometry(size, size, size), [wall, wall, wall, floor, wall, wall]));

  for (const box of studio.softboxes) {
    const panel = new Mesh(
      new PlaneGeometry(box.width, box.height),
      new MeshBasicMaterial({ color: new Color().setScalar(box.intensity), side: DoubleSide }),
    );
    panel.position.set(box.position.x, box.position.y, box.position.z);
    panel.lookAt(0, 0, 0);
    scene.add(panel);
  }

  const pmrem = new PMREMGenerator(renderer);
  const texture = pmrem.fromScene(scene, studio.blur).texture;
  pmrem.dispose();
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    for (const material of [object.material].flat()) material.dispose();
  });
  return texture;
}
