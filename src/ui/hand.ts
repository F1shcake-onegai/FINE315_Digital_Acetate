import { config } from '../config';
import openHand from './cursors/hand-open.svg?raw';
import pinchingHand from './cursors/hand-pinch.svg?raw';

/** Side of the drawings' square viewBox. */
const VIEWBOX = 64;

export type HandPose = 'open' | 'pinch';

export interface Hand {
  /** Show the hand in `pose` in place of the system pointer, or hide it and bring the pointer back. */
  show(pose: HandPose | null): void;
  /** Put the pinch point at client coordinates (x, y). */
  move(x: number, y: number): void;
}

/**
 * The hand-shaped pointer (user): a drawn hand that stands in for the pointer over the acetates,
 * open while hovering and pinching while dragging. It is a page element rather than a CSS cursor,
 * so it keeps its drawn size and detail on any display.
 */
export function createHand(canvas: HTMLCanvasElement): Hand {
  const { sizePx, hotspot } = config.ui.hand;
  const hand = document.createElement('div');
  hand.className = 'hand';
  hand.style.width = `${sizePx}px`;
  hand.style.height = `${sizePx}px`;
  hand.innerHTML = `<div class="hand-open">${openHand}</div><div class="hand-pinch">${pinchingHand}</div>`;
  document.body.append(hand);

  const offsetX = (hotspot.x / VIEWBOX) * sizePx;
  const offsetY = (hotspot.y / VIEWBOX) * sizePx;
  let shown: HandPose | null = null;
  return {
    show(pose) {
      if (pose === shown) return;
      shown = pose;
      hand.classList.toggle('visible', pose !== null);
      hand.classList.toggle('pinching', pose === 'pinch');
      canvas.style.cursor = pose ? 'none' : '';
    },
    move(x, y) {
      hand.style.transform = `translate(${x - offsetX}px, ${y - offsetY}px)`;
    },
  };
}
