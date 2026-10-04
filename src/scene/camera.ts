import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { config } from '../config';

export function createCamera(aspect: number): PerspectiveCamera {
  const { fov, near, far, distance } = config.camera;
  const camera = new PerspectiveCamera(fov, aspect, near, far);
  placeCamera(camera, new Vector3(), distance);
  return camera;
}

export function placeCamera(camera: PerspectiveCamera, target: Vector3, distance: number): void {
  const tilt = MathUtils.degToRad(config.camera.tiltDeg);
  camera.position.set(target.x, target.y + distance * Math.cos(tilt), target.z + distance * Math.sin(tilt));
  camera.rotation.set(tilt - Math.PI / 2, 0, 0);
}
