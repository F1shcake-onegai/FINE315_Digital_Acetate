import { MathUtils, MOUSE, TOUCH, type PerspectiveCamera, type WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { config } from '../config';
import { placeCamera } from '../scene/camera';

/** MouseEvent.button value of the middle button. */
const MIDDLE_BUTTON = 1;

export interface ViewControls {
  /** Call once per frame with its duration in seconds: page slides, damping, pan bounds, transmission resolution. */
  update(dt: number): void;
  zoomIn(): void;
  zoomOut(): void;
  /** Frame the current page again, sliding there. */
  reset(): void;
  /** Look at table point (x, z) from `distance`, keeping the camera angle. */
  lookAt(distance: number, x: number, z: number): void;
  /**
   * Make the sheet centered at table x the page: frame it to fit the screen, sliding there over
   * mobile.slideS if `slide`, else at once. `arrived` runs once the view is there.
   */
  showPage(x: number, slide: boolean, arrived?: () => void): void;
}

interface Slide {
  fromX: number;
  fromZ: number;
  fromDistance: number;
  toX: number;
  toZ: number;
  toDistance: number;
  /** 0 … 1 */
  t: number;
  arrived?: () => void;
}

/**
 * §6.2, one page at a time (mobile copy): wheel or pinch dollies toward the cursor; middle or right
 * drag, or two fingers, pans within reach of the current page; no rotation. The left button and
 * one-finger touch are left free for grabbing the acetate. The camera never changes its angle.
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

  // A middle press would otherwise start the browser's autoscroll mode.
  renderer.domElement.addEventListener('mousedown', (event) => {
    if (event.button === MIDDLE_BUTTON) event.preventDefault();
  });

  let pageX = -config.layout.setOffsetX;  // sheet A
  let slide: Slide | null = null;
  const distance = () => camera.position.distanceTo(controls.target);
  const lookAt = (d: number, x: number, z: number) => {
    controls.target.set(x, 0, z);
    placeCamera(camera, controls.target, d);
    controls.update();
  };

  function showPage(x: number, animate: boolean, arrived?: () => void): void {
    pageX = x;
    const toZ = pageCenterZ();
    const toDistance = fitDistance(camera);
    if (!animate) {
      slide = null;
      controls.enabled = true;
      lookAt(toDistance, x, toZ);
      arrived?.();
      return;
    }
    const { x: fromX, z: fromZ } = controls.target;
    slide = { fromX, fromZ, fromDistance: distance(), toX: x, toZ, toDistance, t: 0, arrived };
    controls.enabled = false;  // the view is busy until it gets there
  }

  showPage(pageX, false);

  return {
    update(dt) {
      if (slide) {
        slide.t = Math.min(1, slide.t + dt / config.mobile.slideS);
        const e = MathUtils.smootherstep(slide.t, 0, 1);
        lookAt(
          MathUtils.lerp(slide.fromDistance, slide.toDistance, e),
          MathUtils.lerp(slide.fromX, slide.toX, e),
          MathUtils.lerp(slide.fromZ, slide.toZ, e),
        );
        if (slide.t >= 1) {
          const { arrived } = slide;
          slide = null;
          controls.enabled = true;
          arrived?.();
        }
      } else {
        controls.update();
        clampTarget(controls, camera, pageX);
      }
      updateTransmissionScale(renderer, distance());
    },
    zoomIn: () => controls.dollyIn(1 / view.zoomStep),
    zoomOut: () => controls.dollyOut(1 / view.zoomStep),
    reset: () => showPage(pageX, true),
    lookAt,
    showPage,
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

/** Middle of a closed sheet's acetate, along the table's depth (z). */
function pageCenterZ(): number {
  return -config.paper.h / 2 + config.acetate.h / 2;
}

/** Camera distance at which a closed sheet's acetate fills the screen, with a margin, in either orientation. */
function fitDistance(camera: PerspectiveCamera): number {
  const { w, h } = config.acetate;
  const margin = config.mobile.fitMargin;
  const tanHalf = Math.tan(MathUtils.degToRad(camera.fov / 2));
  const fit = Math.max(((h / 2) * margin) / tanHalf, ((w / 2) * margin) / (tanHalf * camera.aspect));
  return MathUtils.clamp(fit, config.camera.minDistance, config.camera.maxDistance);
}

/** Keep the target within reach of the page and the pan bounds, moving the camera by the same amount. */
function clampTarget(controls: OrbitControls, camera: PerspectiveCamera, pageX: number): void {
  const { panZMin, panZMax } = config.camera;
  const reach = config.mobile.panX;
  const target = controls.target;
  const dx = MathUtils.clamp(target.x, pageX - reach, pageX + reach) - target.x;
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
