import { Color, DoubleSide, MathUtils, Mesh, MeshPhysicalMaterial, PlaneGeometry, ShaderChunk, Vector2, type Texture } from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { config } from '../config';

export interface AcetateMaps {
  crease: Texture | null;
  paint: Texture | null;
}

export interface Acetate {
  mesh: Mesh;
  setPose(theta: number, omega?: number, grip?: number, held?: number): number;
}

export function createAcetateMaterial(envMap: Texture, maps: AcetateMaps): MeshPhysicalMaterial {
  const a = config.acetate;
  const material = new MeshPhysicalMaterial({
    color: a.tint,
    transmission: a.transmission,
    transmissionMap: maps.paint,
    thickness: a.thickness,
    ior: a.ior,
    roughness: a.roughness,
    metalness: a.metalness,
    clearcoat: a.clearcoat,
    clearcoatRoughness: a.clearcoatRoughness,
    clearcoatMap: maps.paint,
    normalMap: maps.crease,
    normalScale: new Vector2(a.normalScale, a.normalScale),
    specularIntensityMap: maps.paint,
    envMap,
    envMapIntensity: a.envMapIntensity,
    side: DoubleSide,
  });
  hazeTransmission(material);
  return material;
}

const TRANSMISSION_SAMPLE = 'return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );';

function hazeTransmission(material: MeshPhysicalMaterial): void {
  const { haze } = config.acetate;
  const chunk = ShaderChunk.transmission_pars_fragment;
  if (!chunk.includes(TRANSMISSION_SAMPLE)) return;
  const glsl = (v: number) => v.toFixed(4);
  const patched = chunk.replace(TRANSMISSION_SAMPLE, `return mix(
			textureLod( transmissionSamplerMap, fragCoord.xy, 0.0 ),
			textureLod( transmissionSamplerMap, fragCoord.xy, ${glsl(haze.glowLod)} ),
			${glsl(haze.share)} );`);
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_pars_fragment>', patched);
  };
  material.customProgramCacheKey = () => `acetate-haze-${haze.share}-${haze.glowLod}`;
}

export function createRimMaterial(): LineMaterial {
  const { color, widthPx, opacity } = config.acetate.rim;
  return new LineMaterial({ color: new Color(color), linewidth: widthPx, transparent: true, opacity });
}

export function createAcetate(material: MeshPhysicalMaterial, rimMaterial: LineMaterial): Acetate {
  const a = config.acetate;
  const geometry = new PlaneGeometry(a.w, a.h, a.segX, a.segY);
  const position = geometry.attributes.position;
  const rest = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const d = a.h / 2 - position.getY(i);
    rest[i * 3] = x;
    rest[i * 3 + 1] = d;
    rest[i * 3 + 2] = restLift(x, d / a.h);
  }

  const mesh = new Mesh(geometry, material);
  mesh.name = 'acetate';
  mesh.position.z = -config.paper.h / 2;
  mesh.frustumCulled = false;
  mesh.castShadow = false;

  const ring = outerRing(a.segX, a.segY);
  const ringPositions = new Float32Array(ring.length * 3);
  const rimGeometry = new LineGeometry();
  const rim = new Line2(rimGeometry, rimMaterial);
  rim.name = 'acetate-rim';
  rim.frustumCulled = false;
  mesh.add(rim);

  function setPose(theta: number, omega = 0, grip = 0, held = 0): number {
    const z0 = hingeHeight(theta);
    const trail = a.sagMax * Math.tanh((omega * a.sagGain) / a.sagMax);
    const pivot = grip * held;
    const droop = -a.droop * held * Math.cos(theta);
    for (let i = 0; i < position.count; i++) {
      const d = rest[i * 3 + 1];
      const lift = rest[i * 3 + 2];
      const u = d / a.h;
      const bent = -trail * (u - pivot) + droop * droopShape(u, grip);
      const angle = ontoSurface(theta + bent, Math.abs(bent) * a.contactSoftness);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
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
    const leaving = trail * pivot + droop * droopShape(0, grip);
    return ontoSurface(theta + leaving, Math.abs(leaving) * a.contactSoftness);
  }

  setPose(0);
  return { mesh, setPose };
}

export function hingeHeight(theta: number): number {
  const a = config.acetate;
  return MathUtils.lerp(config.paper.t + a.gap, a.gap, theta / Math.PI);
}

function droopShape(u: number, grip: number): number {
  if (u <= grip) return grip - u;
  const past = u - grip;
  return (past * ((config.acetate.droopHang * past) / 2 - grip)) / u;
}

function ontoSurface(angle: number, soft: number): number {
  const above = (x: number) => (x >= soft ? x : x <= -soft ? 0 : (x + soft) ** 2 / (4 * soft));
  return Math.PI - above(Math.PI - above(angle));
}

function restLift(x: number, u: number): number {
  const a = config.acetate;
  const wave = ({ a: amplitude, lambda, phase }: { a: number; lambda: number; phase: number }) =>
    amplitude * (0.5 + 0.5 * Math.sin((Math.PI * 2 * x) / lambda + phase));
  const hold = MathUtils.smoothstep(u, 0, a.holdEnd);
  const curl = (Math.max(0, u - a.curlStart) ** 2 / (1 - a.curlStart) ** 2)
    * MathUtils.smoothstep(Math.abs(x) / (a.w / 2), a.curlCorner.min, a.curlCorner.max);
  return (wave(a.wave1) + wave(a.wave2)) * hold + a.curl * curl;
}

function outerRing(segX: number, segY: number): number[] {
  const columns = segX + 1;
  const ring: number[] = [];
  for (let ix = 0; ix <= segX; ix++) ring.push(ix);
  for (let iy = 1; iy <= segY; iy++) ring.push(iy * columns + segX);
  for (let ix = segX - 1; ix >= 0; ix--) ring.push(segY * columns + ix);
  for (let iy = segY - 1; iy >= 0; iy--) ring.push(iy * columns);
  return ring;
}
