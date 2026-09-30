import type { MeshPhysicalMaterial, WebGLRenderer } from 'three';
import { config } from '../config';

const MS_PER_S = 1000;

export interface Quality {
  /**
   * Call once per frame with its duration in seconds, after the view controls have set the
   * transmission resolution for the zoom; caps it once frames have been slow.
   */
  update(dt: number): void;
}

/**
 * §9 slow-frame fallback: when frames stay slower than slowFrameMs for slowForS, drop the acetate's
 * transmission resolution to degradedTransmission; if they stay slow, turn its clearcoat off. Each
 * step is logged. The first slowGraceS seconds don't count: shaders compile and textures upload then.
 */
export function createQuality(renderer: WebGLRenderer, acetateMaterials: MeshPhysicalMaterial[]): Quality {
  const { slowFrameMs, slowForS, slowGraceS, degradedTransmission } = config.perf;
  let age = 0;
  let slowFor = 0;
  let step = 0;
  const steps = [
    () => console.info(`[perf] frames slower than ${slowFrameMs} ms for ${slowForS} s: see-through resolution down to ${degradedTransmission}.`),
    () => {
      for (const material of acetateMaterials) material.clearcoat = 0;
      console.info('[perf] still slow: the acetate\'s clearcoat is off.');
    },
  ];
  return {
    update(dt) {
      age += dt;
      if (step > 0) renderer.transmissionResolutionScale = Math.min(renderer.transmissionResolutionScale, degradedTransmission);
      if (age < slowGraceS || step >= steps.length) return;
      slowFor = dt * MS_PER_S > slowFrameMs ? slowFor + dt : 0;
      if (slowFor < slowForS) return;
      steps[step++]();
      slowFor = 0;
    },
  };
}
