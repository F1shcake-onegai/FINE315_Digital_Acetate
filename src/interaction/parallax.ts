import { MathUtils, type Scene } from 'three';
import { config } from '../config';

export interface Parallax {
  /** Call once per frame. */
  update(): void;
}

/**
 * §6.3: reflections drift with the pointer. Hovering (not dragging) turns the environment a few
 * degrees; the rotation eases toward that goal every frame.
 */
export function createParallax(scene: Scene, canvas: HTMLCanvasElement): Parallax {
  const { envYawDeg, envPitchDeg, lerp } = config.parallax;
  const goal = { pitch: 0, yaw: 0 };

  canvas.addEventListener('pointermove', (event) => {
    if (event.buttons !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = 1 - ((event.clientY - rect.top) / rect.height) * 2;
    goal.yaw = x * MathUtils.degToRad(envYawDeg);
    goal.pitch = y * MathUtils.degToRad(envPitchDeg);
  });

  return {
    update() {
      const rotation = scene.environmentRotation;
      rotation.x += (goal.pitch - rotation.x) * lerp;
      rotation.y += (goal.yaw - rotation.y) * lerp;
    },
  };
}
