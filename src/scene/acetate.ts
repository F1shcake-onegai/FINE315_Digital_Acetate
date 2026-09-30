import { Color, DoubleSide, MathUtils, Mesh, MeshPhysicalMaterial, PlaneGeometry, ShaderChunk, Vector2, type Texture } from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { config } from '../config';

/** One sheet's surface maps; any may be missing. */
export interface AcetateMaps {
  /** Smudges, acetate UV space: roughnessMap and clearcoatRoughnessMap (see createSmudgeTexture). */
  smudge: Texture | null;
  /** Faint creases along the hinge, acetate UV space: normalMap. */
  crease: Texture | null;
  /** Scratches, tiled: clearcoatNormalMap. */
  scratches: Texture | null;
  /** The user's drawing as 1 − alpha over the paper area: transmission, clearcoat and specular maps. */
  paint: Texture | null;
}

export interface Acetate {
  /** The sheet in its set's frame, hinged along the paper's far edge; the rim line is a child. */
  mesh: Mesh;
  /**
   * Pose the sheet: hinge angle θ (0 closed … π open), angular velocity ω in rad/s (sag), and
   * `grip`, the held point's distance from the hinge as a fraction of the sheet (sag pivots there;
   * 0 when nobody holds it).
   */
  setPose(theta: number, omega?: number, grip?: number): void;
}

/**
 * §5.3 material: clear, slightly hazy acetate under a glossy clear coat, with smudges, creases and
 * scratches, and the user's strokes as opaque matte paint on top. Reflects its own studio
 * (config.acetateStudio), not the room that lights the prints.
 */
export function createAcetateMaterial(envMap: Texture, maps: AcetateMaps): MeshPhysicalMaterial {
  const a = config.acetate;
  // The smudge map scales roughness down from the heaviest smudge (see createSmudgeTexture).
  const smudged = maps.smudge ? a.wear.smudgeRoughness / a.roughness : 1;
  const scratch = a.wear.scratchNormalScale;
  const material = new MeshPhysicalMaterial({
    color: a.tint,
    transmission: a.transmission,
    transmissionMap: maps.paint,
    thickness: a.thickness,
    ior: a.ior,
    metalness: a.metalness,
    roughness: a.roughness * smudged,
    roughnessMap: maps.smudge,
    clearcoat: a.clearcoat,
    clearcoatMap: maps.paint,
    clearcoatRoughness: a.clearcoatRoughness * smudged,
    clearcoatRoughnessMap: maps.smudge,
    normalMap: maps.crease,
    normalScale: new Vector2(a.normalScale, a.normalScale),
    clearcoatNormalMap: maps.scratches,
    clearcoatNormalScale: new Vector2(scratch, scratch),
    specularIntensityMap: maps.paint,
    envMap,
    envMapIntensity: a.envMapIntensity,
    side: DoubleSide,  // seen from both sides mid-flip
  });
  hazeTransmission(material);
  return material;
}

/** How three samples what's seen through a transmissive surface: blurred by a mip level from the roughness. */
const TRANSMISSION_SAMPLE = 'return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );';

/**
 * See the print through the sheet as hazy plastic shows it: sharp, plus a soft glow of scattered
 * light (config.acetate.haze). three blurs instead, by a mip level tied to the surface roughness,
 * which smears the prints even through clean plastic (edges ~3 px wide at 1600 px). The smudge map
 * raises the roughness toward wear.smudgeRoughness under fingerprints; that raises the glow's
 * share, so they read milky. Reflections keep the full roughness. Warns and leaves three's blur if
 * the shader chunk no longer has the line.
 */
function hazeTransmission(material: MeshPhysicalMaterial): void {
  const { roughness, haze, wear } = config.acetate;
  const chunk = ShaderChunk.transmission_pars_fragment;
  if (!chunk.includes(TRANSMISSION_SAMPLE)) {
    console.warn('[acetate] three.js transmission chunk changed; what is seen through the sheet keeps three\'s blur.');
    return;
  }
  const glsl = (v: number) => v.toFixed(4);
  const smudge = `clamp( ( roughness - ${glsl(roughness)} ) / ${glsl(wear.smudgeRoughness - roughness)}, 0.0, 1.0 )`;
  const patched = chunk.replace(TRANSMISSION_SAMPLE, `return mix(
			textureLod( transmissionSamplerMap, fragCoord.xy, 0.0 ),
			textureLod( transmissionSamplerMap, fragCoord.xy, ${glsl(haze.glowLod)} ),
			${glsl(haze.share)} + ${glsl(haze.smudgeShare)} * ${smudge} );`);
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_pars_fragment>', patched);
  };
  material.customProgramCacheKey = () => `acetate-haze-${haze.share}-${haze.smudgeShare}-${haze.glowLod}`;
}

/** §5.3 rim: a thin bright line along the sheet's outline, shared by both sheets. Keep .resolution at the canvas' CSS size. */
export function createRimMaterial(): LineMaterial {
  const { color, widthPx, opacity } = config.acetate.rim;
  return new LineMaterial({ color: new Color(color), linewidth: widthPx, transparent: true, opacity });
}

/**
 * §5.3 geometry: a segX × segY grid rebuilt from rest coordinates (x across the sheet, d = distance
 * from the hinge, the §5.5 rest lift) whenever the pose changes, never accumulated.
 */
export function createAcetate(material: MeshPhysicalMaterial, rimMaterial: LineMaterial): Acetate {
  const a = config.acetate;
  const geometry = new PlaneGeometry(a.w, a.h, a.segX, a.segY);
  const position = geometry.attributes.position;
  const rest = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const d = a.h / 2 - position.getY(i);  // the plane's top row becomes the hinge (d = 0)
    rest[i * 3] = x;
    rest[i * 3 + 1] = d;
    rest[i * 3 + 2] = restLift(x, d / a.h);
  }

  const mesh = new Mesh(geometry, material);
  mesh.name = 'acetate';
  mesh.position.z = -config.paper.h / 2;  // hinge line = the paper's far edge
  mesh.frustumCulled = false;            // bounds change as the sheet moves
  mesh.castShadow = false;               // a transmissive mesh would cast a solid shadow (§5.7)

  const ring = outerRing(a.segX, a.segY);
  const ringPositions = new Float32Array(ring.length * 3);
  const rimGeometry = new LineGeometry();
  const rim = new Line2(rimGeometry, rimMaterial);
  rim.name = 'acetate-rim';
  rim.frustumCulled = false;
  mesh.add(rim);

  function setPose(theta: number, omega = 0, grip = 0): void {
    const z0 = hingeHeight(theta);
    for (let i = 0; i < position.count; i++) {
      const d = rest[i * 3 + 1];
      const lift = rest[i * 3 + 2];
      const u = d / a.h;
      // Beyond the held point the sheet lags; between it and the hinge it bows ahead a little.
      // Unheld (grip 0) this is §5.5's −ω·sagGain·u².
      const sag = MathUtils.clamp(-omega * a.sagGain * u * (u - grip), -a.sagMax, a.sagMax);
      // No part passes through the paper (0) or the table (π).
      const angle = MathUtils.clamp(theta + sag, 0, Math.PI);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      // |cos| keeps the bulge facing away from the surface on both sides (§5.5).
      position.setXYZ(i, rest[i * 3], z0 + lift * Math.abs(cos) + d * sin, d * cos - lift * sin);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    ring.forEach((vertex, k) => {
      ringPositions[k * 3] = position.getX(vertex);
      ringPositions[k * 3 + 1] = position.getY(vertex);
      ringPositions[k * 3 + 2] = position.getZ(vertex);
    });
    rimGeometry.setPositions(ringPositions);
  }

  setPose(0);
  return { mesh, setPose };
}

/** §5.5 z0: height of the sheet's hinge side, on the paper when closed and on the table when open. */
export function hingeHeight(theta: number): number {
  const a = config.acetate;
  return MathUtils.lerp(config.paper.t + a.gap, a.gap, theta / Math.PI);
}

/**
 * §5.5 rest shape, lift only (≥ 0): two waves across the sheet, held flat near the tape, and the
 * free corners curling up. u is the distance from the hinge as a fraction of the sheet's length.
 */
function restLift(x: number, u: number): number {
  const a = config.acetate;
  const wave = ({ a: amplitude, lambda, phase }: { a: number; lambda: number; phase: number }) =>
    amplitude * (0.5 + 0.5 * Math.sin((Math.PI * 2 * x) / lambda + phase));
  const hold = MathUtils.smoothstep(u, 0, a.holdEnd);
  const curl = (Math.max(0, u - a.curlStart) ** 2 / (1 - a.curlStart) ** 2)
    * MathUtils.smoothstep(Math.abs(x) / (a.w / 2), a.curlCorner.min, a.curlCorner.max);
  return (wave(a.wave1) + wave(a.wave2)) * hold + a.curl * curl;
}

/** Grid vertex indices around the border, once round and closed: hinge edge, right side, free edge, left side. */
function outerRing(segX: number, segY: number): number[] {
  const columns = segX + 1;
  const ring: number[] = [];
  for (let ix = 0; ix <= segX; ix++) ring.push(ix);
  for (let iy = 1; iy <= segY; iy++) ring.push(iy * columns + segX);
  for (let ix = segX - 1; ix >= 0; ix--) ring.push(segY * columns + ix);
  for (let iy = segY - 1; iy >= 0; iy--) ring.push(iy * columns);
  return ring;
}
