import { MathUtils, Matrix4, Ray, Raycaster, Vector2, type PerspectiveCamera } from 'three';
import { config } from '../config';
import { hingeHeight } from '../scene/acetate';
import type { SetHandle } from '../scene/set';
import type { Hand } from '../ui/hand';

type Mode = 'closed' | 'dragging' | 'settling' | 'open';

interface Sheet {
  set: SetHandle;
  mode: Mode;
  theta: number;
  omega: number;
  target: number;
  grip: number;
  held: number;
  moved: boolean;
}

interface Drag {
  sheet: Sheet;
  pointerId: number;
  reach: number;
  axisY: number;
  axisZ: number;
  startX: number;
  startY: number;
  startTime: number;
  dragged: boolean;
  clickTarget: number;
}

export interface SheetState {
  mode: Mode;
  theta: number;
  omega: number;
}

export interface Flip {
  update(dt: number): void;
  toggle(index: number): void;
  pose(theta: number): void;
  isOverAcetate(event: MouseEvent): boolean;
  states(): SheetState[];
}

export function createFlip(sets: SetHandle[], camera: PerspectiveCamera, canvas: HTMLCanvasElement, hand: Hand): Flip {
  const flip = config.flip;
  const sheets: Sheet[] = sets.map((set) => {
    set.group.updateWorldMatrix(true, false);
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

  function inSet(sheet: Sheet, ray: Ray): Ray {
    worldToSet.copy(sheet.set.group.matrixWorld).invert();
    return setRay.copy(ray).applyMatrix4(worldToSet);
  }

  function hit(ray: Ray): { sheet: Sheet; distance: number } | null {
    let first: { sheet: Sheet; distance: number; t: number } | null = null;
    for (const sheet of sheets) {
      if (!sheet.set.group.visible) continue;
      const found = hitSheet(sheet.theta, inSet(sheet, ray));
      if (found && (!first || found.t < first.t)) first = { sheet, ...found };
    }
    return first;
  }

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

  function follow(held: Drag, step: number): void {
    const { sheet } = held;
    const theta = dragAngle(held, inSet(sheet, rayAt(pointer.x, pointer.y)));
    const rate = MathUtils.clamp((theta - sheet.theta) / step, -flip.maxOmega, flip.maxOmega);
    sheet.omega += (rate - sheet.omega) * (1 - Math.exp(-step / flip.omegaSmoothS));
    sheet.theta = theta;
    sheet.moved = true;
  }

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

  function ease(sheet: Sheet, step: number): void {
    const goal = drag?.sheet === sheet ? 1 : 0;
    if (sheet.held === goal) return;
    sheet.held += (goal - sheet.held) * (1 - Math.exp(-step / flip.holdEaseS));
    if (Math.abs(goal - sheet.held) < 1e-3) sheet.held = goal; // 1e-3 = settled
    sheet.moved = true;
  }

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

function hitSheet(theta: number, ray: Ray): { t: number; distance: number } | null {
  const { w, h } = config.acetate;
  const hingeY = hingeHeight(theta);
  const hingeZ = -config.paper.h / 2;
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  const { origin: o, direction: v } = ray;
  const facing = sin * v.z - cos * v.y;
  if (Math.abs(facing) < 1e-6) return null; // 1e-6 = grazing
  const t = (cos * (o.y - hingeY) - sin * (o.z - hingeZ)) / facing;
  if (t <= 0) return null;
  const x = o.x + t * v.x;
  const distance = sin * (o.y + t * v.y - hingeY) + cos * (o.z + t * v.z - hingeZ);
  if (Math.abs(x) > w / 2 || distance < 0 || distance > h) return null;
  return { t, distance };
}

function dragAngle(drag: Drag, ray: Ray): number {
  const { reach, axisY, axisZ } = drag;
  const oy = ray.origin.y - axisY;
  const oz = ray.origin.z - axisZ;
  const vy = ray.direction.y;
  const vz = ray.direction.z;
  if (vy >= 0) return drag.sheet.theta;
  const s = oz - (oy / vy) * vz;
  const projected = Math.acos(MathUtils.clamp(s / reach, -1, 1));
  const exact = circleAngle(oy, oz, vy, vz, reach);
  if (exact === null) return projected;
  const offTable = Math.min(drag.sheet.theta, Math.PI - drag.sheet.theta);
  const blend = MathUtils.smoothstep(offTable, 0, MathUtils.degToRad(config.flip.trackBlendDeg));
  return MathUtils.lerp(projected, exact, blend);
}

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
