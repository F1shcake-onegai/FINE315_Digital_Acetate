import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, MeshStandardMaterial, Vector2, type Texture } from 'three';
import { config } from '../config';
import type { Kraft } from '../textures/kraft';
import { hingeHeight } from './acetate';

export interface Tape {
  /** The strip in its set's frame. */
  mesh: Mesh;
  /** Follow the acetate's hinge angle θ (0 closed … π open). */
  setPose(theta: number): void;
}

/** End to end, before tearing: the acetate's top edge plus the overhang at each end. */
function tapeLength(): number {
  return config.acetate.w + 2 * config.tape.overhang;
}

/**
 * §5.4 material: matte kraft paper. The color tiles in meters of tape (uv), the torn ends are an
 * alpha map on uv1 (see createTearTexture), and the paperGrain normals give the fibers some relief.
 */
export function createTapeMaterial(kraft: Kraft, grain: Texture, tear: Texture): MeshStandardMaterial {
  const { roughness, normalRepeat, normalScale, alphaTest } = config.tape;
  const normalMap = grain.clone();
  const perMeter = normalRepeat / tapeLength();
  normalMap.repeat.set(perMeter, perMeter);
  const material = new MeshStandardMaterial({
    map: kraft.map,
    color: kraft.tint,
    roughness,
    normalMap,
    normalScale: new Vector2(normalScale, normalScale),
    alphaMap: tear,
    alphaTest,
    side: DoubleSide,  // the glued side shows through the acetate when the sheet is open
  });
  shadeTornAndGlued(material);
  return material;
}

const ALPHA_MAP_CHUNK = '#include <alphamap_fragment>';

/**
 * Two touches three's material lacks: the light fibers along each tear (the tear map's R channel)
 * and the adhesive side's damp look, on back faces, since front faces are the tape's outer side.
 */
function shadeTornAndGlued(material: MeshStandardMaterial): void {
  const { adhesiveGamma, tear } = config.tape;
  const fiberColor = new Color(tear.fringe.color);
  const glsl = (v: number) => v.toFixed(4);
  material.onBeforeCompile = (shader) => {
    if (!shader.fragmentShader.includes(ALPHA_MAP_CHUNK)) {
      console.warn('[tape] three.js shader chunks changed; the tape shows no tear fibers or glued side.');
      return;
    }
    shader.fragmentShader = shader.fragmentShader.replace(ALPHA_MAP_CHUNK, `${ALPHA_MAP_CHUNK}
      #ifdef USE_ALPHAMAP
        diffuseColor.rgb = mix( diffuseColor.rgb, vec3( ${glsl(fiberColor.r)}, ${glsl(fiberColor.g)}, ${glsl(fiberColor.b)} ), texture2D( alphaMap, vAlphaMapUv ).r );
      #endif
      if ( ! gl_FrontFacing ) diffuseColor.rgb = pow( diffuseColor.rgb, vec3( ${glsl(adhesiveGamma)} ) );`);
  };
  material.customProgramCacheKey = () => 'tape-torn-glued';
}

/**
 * §5.4 one strip of tape across the hinge, posed on the CPU like the acetate. Its first half lies on
 * the acetate's top face and turns with the sheet (which has no sag at the hinge); the second is
 * glued to the back of the paper (user) and stays put. Between them the strip bends around the
 * top edge along a cubic Bézier rebuilt from θ: half a turn around the stacked edges when closed,
 * nearly flat when open. Normals are analytic, so the glued halves shade flat.
 *
 * Rows run across the tape, from the acetate half's free edge over the fold to the paper half's;
 * columns run along it: the tear zone at each end, then the plain middle. uv is in meters, x in
 * table space so the two tapes show different kraft, skewed so the texture doesn't repeat along a
 * tape; uv1 places the tear map. `offsetX` is the set's position on the table.
 */
export function createTape(material: MeshStandardMaterial, offsetX: number): Tape {
  const { w, lift, foldSegments, kraftTile, tear } = config.tape;
  const { paper, acetate } = config;
  const length = tapeLength();
  const hingeZ = -paper.h / 2;
  // Half a turn around the closed stack (paper, gap, acetate) takes this much tape.
  const foldLength = (Math.PI * (paper.t + acetate.gap)) / 2;
  const glued = (w - foldLength) / 2;  // on each side of the fold
  // Arc length across the tape at each row, from the acetate half's free edge.
  const rowAcross = (row: number) =>
    row === 0 ? 0 : row <= foldSegments + 1 ? glued + (foldLength * (row - 1)) / foldSegments : w;
  const xs = [-length / 2 - tear.zone / 2, -length / 2 + tear.zone / 2, length / 2 - tear.zone / 2, length / 2 + tear.zone / 2];
  const tearU = [0, 0.5, 0.5, 1];
  const skew = w / kraftTile;  // each kraft tile along the table moves one tape width across the texture

  const columns = xs.length;
  const rows = foldSegments + 3;
  const position = new Float32Array(rows * columns * 3);
  const normal = new Float32Array(rows * columns * 3);
  const uv = new Float32Array(rows * columns * 2);
  const uv1 = new Float32Array(rows * columns * 2);
  const index: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const i = r * columns + c;
      const tableX = xs[c] + offsetX;
      position[i * 3] = xs[c];
      uv[i * 2] = tableX;
      uv[i * 2 + 1] = rowAcross(r) + skew * tableX;
      uv1[i * 2] = tearU[c];
      uv1[i * 2 + 1] = rowAcross(r) / w;
      // Wound so that front faces are the tape's outer side, where the normals point.
      if (r < rows - 1 && c < columns - 1) index.push(i, i + 1, i + columns + 1, i, i + columns + 1, i + columns);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('normal', new BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
  geometry.setAttribute('uv1', new BufferAttribute(uv1, 2));
  geometry.setIndex(index);

  const mesh = new Mesh(geometry, material);
  mesh.name = 'tape';
  mesh.frustumCulled = false;  // moves with the acetate
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  /** Place row r at (y, z) in the set's frame; (ty, tz) is the unit direction across the tape there. */
  function setRow(r: number, y: number, z: number, ty: number, tz: number): void {
    for (let c = 0; c < columns; c++) {
      const i = (r * columns + c) * 3;
      position[i + 1] = y;
      position[i + 2] = z;
      normal[i] = 0;
      normal[i + 1] = -tz;  // the across direction turned a quarter toward the tape's outer side
      normal[i + 2] = ty;
    }
  }

  function setPose(theta: number): void {
    // In the (y, z) plane the sheet runs from the hinge along (sin, cos); its top face points (cos, −sin).
    const sin = Math.sin(theta);
    const cos = Math.cos(theta);
    const ay = hingeHeight(theta) + lift * cos;  // the acetate half at the hinge
    const az = hingeZ - lift * sin;
    const by = lift;                             // the paper half at the hinge, between paper and table
    const bz = hingeZ;
    setRow(0, ay + glued * sin, az + glued * cos, -sin, -cos);
    setRow(1, ay, az, -sin, -cos);

    // The fold leaves the acetate half toward the hinge and joins the paper half heading +z. Handles
    // as for a circular arc through the turn between them (π when closed, 0 when open).
    const chord = Math.hypot(by - ay, bz - az);
    const handle = chord / (3 * Math.cos((Math.PI - theta) / 4) ** 2);
    const p1y = ay - handle * sin;
    const p1z = az - handle * cos;
    const p2y = by;
    const p2z = bz - handle;
    for (let k = 1; k < foldSegments; k++) {
      const t = k / foldSegments;
      const s = 1 - t;
      const y = s * s * s * ay + 3 * s * s * t * p1y + 3 * s * t * t * p2y + t * t * t * by;
      const z = s * s * s * az + 3 * s * s * t * p1z + 3 * s * t * t * p2z + t * t * t * bz;
      const ty = 3 * s * s * (p1y - ay) + 6 * s * t * (p2y - p1y) + 3 * t * t * (by - p2y);
      const tz = 3 * s * s * (p1z - az) + 6 * s * t * (p2z - p1z) + 3 * t * t * (bz - p2z);
      const span = Math.hypot(ty, tz) || 1;
      setRow(1 + k, y, z, ty / span, tz / span);
    }

    setRow(foldSegments + 1, by, bz, 0, 1);
    setRow(foldSegments + 2, by, bz + glued, 0, 1);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    geometry.computeBoundingSphere();
  }

  setPose(0);
  return { mesh, setPose };
}
