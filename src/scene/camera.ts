import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { config } from '../config';

/** §3: fov 35°, looking straight down at the center of both sets (the origin), tilt from config. */
export function createCamera(aspect: number): PerspectiveCamera {
  const { fov, near, far, distance } = config.camera;
  const camera = new PerspectiveCamera(fov, aspect, near, far);
  placeCamera(camera, new Vector3(), distance);
  return camera;
}

/**
 * Put the camera `distance` from `target`, tilted from vertical toward the viewer (+z) by tiltDeg.
 * Oriented by rotation rather than lookAt(), which is degenerate when looking straight down;
 * screen-up stays toward −z, so the hinge (far) edge is at the top of the screen.
 */
export function placeCamera(camera: PerspectiveCamera, target: Vector3, distance: number): void {
  const tilt = MathUtils.degToRad(config.camera.tiltDeg);
  camera.position.set(target.x, target.y + distance * Math.cos(tilt), target.z + distance * Math.sin(tilt));
  camera.rotation.set(tilt - Math.PI / 2, 0, 0);
}
