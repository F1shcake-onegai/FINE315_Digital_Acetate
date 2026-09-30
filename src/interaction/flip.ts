import { MathUtils, Matrix4, Ray, Raycaster, Vector2, type PerspectiveCamera } from 'three';
import { config } from '../config';
import { hingeHeight } from '../scene/acetate';
import type { SetHandle } from '../scene/set';
import type { Hand } from '../ui/hand';

type Mode = 'closed' | 'dragging' | 'settling' | 'open';

/** Rays this close to parallel with a sheet miss it. */
const GRAZING = 1e-6;
/** An eased value this close to its goal snaps to it. */
const SETTLED = 1e-3;

/** One set's acetate: §6.1 state and variables. */
interface Sheet {
  set: SetHandle;
  mode: Mode;
  theta: number;
  omega: number;
  /** Where a release or a toggle sends the sheet: 0 (closed) or π (open). */
  target: number;
  /** The held point's distance from the hinge as a fraction of the sheet. */
  grip: number;
  /** How much the hand carries the sheet: eases toward 1 while it's dragged and back to 0 once let go. */
  held: number;
  /** The pose changed since the set was last told. */
  moved: boolean;
}

/** A grab in progress. */
interface Drag {
  sheet: Sheet;
  pointerId: number;
  /** §6.1 d0: the grabbed point's distance from the hinge, at least minGrabDist. */
  reach: number;
  /** The axis the pointer turns the sheet about, in the set's (y, z) plane. */
  axisY: number;
  axisZ: number;
  startX: number;
  startY: number;
  startTime: number;
  /** Moved further than clickPx, so it isn't a click. */
  dragged: boolean;
  /** Where a click sends the sheet. */
  clickTarget: number;
}

export interface SheetState {
  mode: Mode;
  theta: number;
  omega: number;
}

export interface Flip {
  /** Advance drags and landings by dt seconds and pose the sets. Call once per frame, before rendering. */
  update(dt: number): void;
  /** Send set `index` the other way (click, keys 1/2). */
  toggle(index: number): void;
  /** Pose every sheet at θ without animating, as the dev handle does. */
  pose(theta: number): void;
  /** Whether a pointer event is over an acetate. */
  isOverAcetate(event: MouseEvent): boolean;
  /** Each sheet's mode and angle, for the dev handle. */
  states(): SheetState[];
}

/**
 * §6.1 flip, per set: grab an acetate with the left button (or one finger) and turn it about its
 * hinge; on release it springs to open or closed, whichever way it was heading; a click or key
 * 1/2 flips it. The hand-shaped pointer shows over the acetates, pinching while one is held.
 */
export function createFlip(sets: SetHandle[], camera: PerspectiveCamera, canvas: HTMLCanvasElement, hand: Hand): Flip {
  const flip = config.flip;
  const sheets: Sheet[] = sets.map((set) => {
    set.group.updateWorldMatrix(true, false);  // hit tests may run before the next render updates it
    return { set, mode: 'closed', theta: 0, omega: 0, target: 0, grip: 0, held: 0, moved: false };
  });
  const pointer = { x: 0, y: 0, inside: false, buttons: 0, type: '' };
  let drag: Drag | null = null;

  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const worldToSet = new Matrix4();
  const setRay = new Ray();

  function rayAt(clientX: number, clientY: number): Ray {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, 1 - ((clientY - rect.top) / rect.height) * 2);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray;
  }

  /** The ray in the sheet's set frame, where the hinge runs along x at z = −paper.h / 2. */
  function inSet(sheet: Sheet, ray: Ray): Ray {
    worldToSet.copy(sheet.set.group.matrixWorld).invert();
    return setRay.copy(ray).applyMatrix4(worldToSet);
  }

  /** The acetate the ray meets first, and the hit's distance from its hinge; null if it misses both. */
  function hit(ray: Ray): { sheet: Sheet; distance: number } | null {
    let first: { sheet: Sheet; distance: number; t: number } | null = null;
    for (const sheet of sheets) {
      const found = hitSheet(sheet.theta, inSet(sheet, ray));
      if (found && (!first || found.t < first.t)) first = { sheet, ...found };
    }
    return first;
  }

  /** Where a toggle sends the sheet: away from where it rests or is heading. */
  function otherWay(sheet: Sheet): number {
    const opening = sheet.mode === 'settling' ? sheet.target > Math.PI / 2 : sheet.theta > Math.PI / 2;
    return opening ? 0 : Math.PI;
  }

  function trackPointer(event: PointerEvent): void {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.buttons = event.buttons;
    pointer.type = event.pointerType;
    pointer.inside = true;
    hand.move(event.clientX, event.clientY);
  }

  function startDrag(event: PointerEvent): void {
    const grabbed = hit(rayAt(event.clientX, event.clientY));
    if (!grabbed) return;
    const { sheet, distance } = grabbed;
    const reach = Math.max(distance, flip.minGrabDist);
    // A grab nearer the hinge than `reach` turns the sheet about an axis moved back along it, so the
    // grabbed point starts on that axis' circle and the sheet doesn't jump.
    const back = reach - distance;
    drag = {
      sheet,
      pointerId: event.pointerId,
      reach,
      axisY: hingeHeight(sheet.theta) - back * Math.sin(sheet.theta),
      axisZ: -config.paper.h / 2 - back * Math.cos(sheet.theta),
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
      dragged: false,
      clickTarget: otherWay(sheet),
    };
    sheet.mode = 'dragging';
    sheet.grip = distance / config.acetate.h;
    canvas.setPointerCapture(event.pointerId);
  }

  /** §6.1 release, or a click when `click` allows it: the sheet springs to its target. */
  function endDrag(click: boolean, time: number): void {
    if (!drag) return;
    const { sheet, pointerId } = drag;
    const isClick = click && !drag.dragged && time - drag.startTime < flip.clickMs;
    const predicted = sheet.theta + sheet.omega * flip.releaseLookahead;
    sheet.target = isClick ? drag.clickTarget : predicted > Math.PI / 2 ? Math.PI : 0;
    sheet.mode = 'settling';
    drag = null;
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  }

  /** §6.1 drag: the grabbed point follows the pointer. */
  function follow(held: Drag, step: number): void {
    const { sheet } = held;
    const theta = dragAngle(held, inSet(sheet, rayAt(pointer.x, pointer.y)));
    const rate = MathUtils.clamp((theta - sheet.theta) / step, -flip.maxOmega, flip.maxOmega);
    sheet.omega += (rate - sheet.omega) * (1 - Math.exp(-step / flip.omegaSmoothS));
    sheet.theta = theta;
    sheet.moved = true;
  }

  /** §6.1 settling: a spring toward the target. A landing sheet bounces off the table or paper. */
  function land(sheet: Sheet, step: number): void {
    sheet.omega += (flip.K * (sheet.target - sheet.theta) - flip.D * sheet.omega) * step;
    sheet.theta += sheet.omega * step;
    if (sheet.theta > Math.PI || sheet.theta < 0) {
      sheet.theta = sheet.theta > Math.PI ? 2 * Math.PI - sheet.theta : -sheet.theta;
      sheet.omega *= -flip.bounce;
    }
    if (Math.abs(sheet.target - sheet.theta) < flip.settleAngle && Math.abs(sheet.omega) < flip.settleOmega) {
      sheet.theta = sheet.target;
      sheet.omega = 0;
      sheet.mode = sheet.target > Math.PI / 2 ? 'open' : 'closed';
    }
    sheet.moved = true;
  }

  /** The hand takes up the sheet's weight when it grabs, and gives it back when it lets go. */
  function ease(sheet: Sheet, step: number): void {
    const goal = drag?.sheet === sheet ? 1 : 0;
    if (sheet.held === goal) return;
    sheet.held += (goal - sheet.held) * (1 - Math.exp(-step / flip.holdEaseS));
    if (Math.abs(goal - sheet.held) < SETTLED) sheet.held = goal;
    sheet.moved = true;
  }

  /** Pinching while a sheet is held, open over an acetate, otherwise the usual pointer. None for touch. */
  function showHand(): void {
    if (pointer.type === 'touch') return hand.show(null);
    if (drag) return hand.show('pinch');
    const hovering = pointer.inside && pointer.buttons === 0 && hit(rayAt(pointer.x, pointer.y)) !== null;
    hand.show(hovering ? 'open' : null);
  }

  function toggle(index: number): void {
    const sheet = sheets[index];
    if (!sheet || sheet.mode === 'dragging') return;
    sheet.target = otherWay(sheet);
    sheet.mode = 'settling';
  }

  canvas.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    if (drag) {
      // A second finger (pinch zoom, two-finger pan) lets go of the sheet.
      if (event.pointerId !== drag.pointerId) endDrag(false, event.timeStamp);
      return;
    }
    if (event.button === 0) startDrag(event);
  });
  canvas.addEventListener('pointermove', (event) => {
    trackPointer(event);
    if (drag && event.pointerId === drag.pointerId && !drag.dragged) {
      drag.dragged = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > flip.clickPx;
    }
  });
  const release = (event: PointerEvent) => {
    if (drag && event.pointerId === drag.pointerId) endDrag(event.type === 'pointerup', event.timeStamp);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);
  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
  });
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const index = flip.keys.indexOf(event.key);
    if (index < 0) return;
    toggle(index);
    event.preventDefault();
  });

  return {
    update(dt) {
      const step = Math.min(dt, flip.maxStepS);
      camera.updateMatrixWorld();
      if (drag && step > 0) follow(drag, step);
      for (const sheet of sheets) {
        if (sheet.mode === 'settling') land(sheet, step);
        ease(sheet, step);
        if (!sheet.moved) continue;
        sheet.set.setAngle(sheet.theta, sheet.omega, sheet.grip, sheet.held);
        sheet.moved = false;
      }
      showHand();
    },
    toggle,
    pose(theta) {
      if (drag) endDrag(false, 0);
      for (const sheet of sheets) {
        Object.assign(sheet, { theta, omega: 0, grip: 0, held: 0, moved: true });
        sheet.mode = theta > Math.PI / 2 ? 'open' : 'closed';
        sheet.target = sheet.mode === 'open' ? Math.PI : 0;
      }
    },
    isOverAcetate: (event) => hit(rayAt(event.clientX, event.clientY)) !== null,
    states: () => sheets.map(({ mode, theta, omega }) => ({ mode, theta, omega })),
  };
}

/**
 * Where a ray in the set's frame meets the sheet, taken as the flat rectangle through the hinge at
 * angle θ (waves and sag move it by millimeters): the ray parameter and the point's distance from
 * the hinge. Null if it misses.
 */
function hitSheet(theta: number, ray: Ray): { t: number; distance: number } | null {
  const { w, h } = config.acetate;
  const hingeY = hingeHeight(theta);
  const hingeZ = -config.paper.h / 2;
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  const { origin: o, direction: v } = ray;
  // The sheet's plane holds the hinge line (along x) and runs from it along (0, sin, cos).
  const facing = sin * v.z - cos * v.y;
  if (Math.abs(facing) < GRAZING) return null;
  const t = (cos * (o.y - hingeY) - sin * (o.z - hingeZ)) / facing;
  if (t <= 0) return null;
  const x = o.x + t * v.x;
  const distance = sin * (o.y + t * v.y - hingeY) + cos * (o.z + t * v.z - hingeZ);
  if (Math.abs(x) > w / 2 || distance < 0 || distance > h) return null;
  return { t, distance };
}

/**
 * §6.1 θ_target for the pointer's ray (in the set's frame). The spec projects the pointer onto the
 * table: θ = acos(s / d0). From straight above that leaves a lifted edge centimeters from the
 * pointer on screen, so away from the table the grabbed point instead follows the pointer exactly:
 * the ray is met with the circle the grabbed point sweeps, seen along the hinge. Near closed and
 * open, where the projection is close anyway and the exact answer folds back, the projection
 * rules. The sheet's current angle sets the blend (over trackBlendDeg), so a grab never jumps,
 * whether the sheet lies flat or is caught mid-swing.
 */
function dragAngle(drag: Drag, ray: Ray): number {
  const { reach, axisY, axisZ } = drag;
  const oy = ray.origin.y - axisY;
  const oz = ray.origin.z - axisZ;
  const vy = ray.direction.y;
  const vz = ray.direction.z;
  if (vy >= 0) return drag.sheet.theta;  // looking level or up: no table under the pointer
  const s = oz - (oy / vy) * vz;  // where the ray crosses the axis' height, from the axis
  const projected = Math.acos(MathUtils.clamp(s / reach, -1, 1));
  const exact = circleAngle(oy, oz, vy, vz, reach);
  if (exact === null) return projected;
  const offTable = Math.min(drag.sheet.theta, Math.PI - drag.sheet.theta);
  const blend = MathUtils.smoothstep(offTable, 0, MathUtils.degToRad(config.flip.trackBlendDeg));
  return MathUtils.lerp(projected, exact, blend);
}

/**
 * Where a ray, starting at (oy, oz) from an axis and heading (vy, vz), first meets the circle of
 * `radius` about it, as an angle above the table plane through the axis. Null if it misses the
 * circle's upper half or starts inside the circle.
 */
function circleAngle(oy: number, oz: number, vy: number, vz: number, radius: number): number | null {
  const along = vy * vy + vz * vz;
  const outside = oy * oy + oz * oz - radius * radius;
  if (outside <= 0 || along === 0) return null;
  const half = oy * vy + oz * vz;
  const disc = half * half - along * outside;
  if (disc < 0) return null;
  const t = (-half - Math.sqrt(disc)) / along;
  const y = oy + t * vy;
  return t > 0 && y >= 0 ? Math.atan2(y, oz + t * vz) : null;
}
