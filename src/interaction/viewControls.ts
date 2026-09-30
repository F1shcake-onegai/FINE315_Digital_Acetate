import { MathUtils, MOUSE, TOUCH, type PerspectiveCamera, type WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { config } from '../config';
import { placeCamera } from '../scene/camera';

/** MouseEvent.button value of the middle button. */
const MIDDLE_BUTTON = 1;

export interface ViewControls {
  /** Call once per frame: damping, pan bounds, transmission resolution. */
  update(): void;
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
  /** Look at table point (x, z) from `distance`, keeping the camera angle. */
  lookAt(distance: number, x: number, z: number): void;
}

/**
 * §6.2: wheel or pinch dollies toward the cursor; middle or right drag pans along the table; no
 * rotation. The left button and one-finger touch are left free for grabbing the acetate. The
 * target stays over the sets and the camera moves with it, so the angle never changes.
 */
export function createViewControls(camera: PerspectiveCamera, renderer: WebGLRenderer): ViewControls {
  const view = config.camera;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false;
  controls.enablePan = true;
  controls.enableDamping = true;
  controls.dampingFactor = view.dampingFactor;
  controls.zoomToCursor = true;
  controls.screenSpacePanning = false;  // pan along the table plane
  controls.minDistance = view.minDistance;
  controls.maxDistance = view.maxDistance;
  controls.mouseButtons = { LEFT: null, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.PAN };
  controls.touches = { ONE: null, TWO: TOUCH.DOLLY_PAN };
  controls.update();
  controls.saveState();

  // A middle press would otherwise start the browser's autoscroll mode.
  renderer.domElement.addEventListener('mousedown', (event) => {
    if (event.button === MIDDLE_BUTTON) event.preventDefault();
  });

  return {
    update() {
      controls.update();
      clampTarget(controls, camera);
      updateTransmissionScale(renderer, camera.position.distanceTo(controls.target));
    },
    zoomIn: () => controls.dollyIn(1 / view.zoomStep),
    zoomOut: () => controls.dollyOut(1 / view.zoomStep),
    reset: () => controls.reset(),
    lookAt(distance, x, z) {
      controls.target.set(x, 0, z);
      placeCamera(camera, controls.target, distance);
      controls.update();
    },
  };
}

/**
 * §6.2 keys: + and − zoom, 0 resets. Double-clicking the table resets too, but not where
 * `onAcetate` says the pointer is over an acetate: clicks there flip it.
 */
export function bindViewShortcuts(view: ViewControls, canvas: HTMLCanvasElement, onAcetate: (event: MouseEvent) => boolean): void {
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;  // leave browser zoom alone
    switch (event.key) {
      case '+':
      case '=':
        view.zoomIn();
        break;
      case '-':
      case '_':
        view.zoomOut();
        break;
      case '0':
        view.reset();
        break;
      default:
        return;
    }
    event.preventDefault();
  });
  canvas.addEventListener('dblclick', (event) => {
    if (!onAcetate(event)) view.reset();
  });
}

/** Keep the target inside the pan bounds, moving the camera by the same amount. */
function clampTarget(controls: OrbitControls, camera: PerspectiveCamera): void {
  const { panX, panZMin, panZMax } = config.camera;
  const target = controls.target;
  const dx = MathUtils.clamp(target.x, -panX, panX) - target.x;
  const dz = MathUtils.clamp(target.z, panZMin, panZMax) - target.z;
  if (dx === 0 && dz === 0) return;
  target.x += dx;
  target.z += dz;
  camera.position.x += dx;
  camera.position.z += dz;
}

/** Full-resolution transmission up close, reduced when zoomed out; lerp in between. */
function updateTransmissionScale(renderer: WebGLRenderer, distance: number): void {
  const { transmissionNear, transmissionFar, transmissionNearDist, transmissionFarDist } = config.perf;
  const t = MathUtils.clamp((distance - transmissionNearDist) / (transmissionFarDist - transmissionNearDist), 0, 1);
  renderer.transmissionResolutionScale = MathUtils.lerp(transmissionNear, transmissionFar, t);
}
