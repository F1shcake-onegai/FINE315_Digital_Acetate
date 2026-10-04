import { config } from '../config';
import openHand from './cursors/hand-open.svg?raw';
import pinchingHand from './cursors/hand-pinch.svg?raw';

export type HandPose = 'open' | 'pinch';

export interface Hand {
  show(pose: HandPose | null): void;
  move(x: number, y: number): void;
}

export function createHand(canvas: HTMLCanvasElement): Hand {
  const { sizePx, hotspot } = config.ui.hand;
  const hand = document.createElement('div');
  hand.className = 'hand';
  hand.style.width = `${sizePx}px`;
  hand.style.height = `${sizePx}px`;
  hand.innerHTML = `<div class="hand-open">${openHand}</div><div class="hand-pinch">${pinchingHand}</div>`;
  document.body.append(hand);

  const offsetX = (hotspot.x / 64) * sizePx; // 64 = svg viewBox
  const offsetY = (hotspot.y / 64) * sizePx;
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
