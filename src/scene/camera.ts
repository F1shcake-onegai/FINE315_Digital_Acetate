import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { config } from '../config';

/** §3: fov 35°, tilted 20° from vertical toward the viewer, looking at the center of both sets (the origin). */
export function createCamera(aspect: number): PerspectiveCamera {
  const { fov, near, far, distance } = config.camera;
  const camera = new PerspectiveCamera(fov, aspect, near, far);
  placeCamera(camera, new Vector3(), distance);
  return camera;
}

/** Put the camera `distance` from `target` along the fixed tilt, on the viewer's (+z) side. */
export function placeCamera(camera: PerspectiveCamera, target: Vector3, distance: number): void {
  const tilt = MathUtils.degToRad(config.camera.tiltDeg);
  camera.position.set(target.x, target.y + distance * Math.cos(tilt), target.z + distance * Math.sin(tilt));
  camera.lookAt(target);
}
