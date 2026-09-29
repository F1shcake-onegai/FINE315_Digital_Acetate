import { PMREMGenerator, type Scene, type WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { config } from '../config';

/** §3: RoomEnvironment through PMREMGenerator as scene.environment. */
export function applyRoomEnvironment(renderer: WebGLRenderer, scene: Scene): void {
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, config.environment.roomBlur).texture;
  room.dispose();
  pmrem.dispose();
}
