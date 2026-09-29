import { DoubleSide, MathUtils, Mesh, MeshPhysicalMaterial, PlaneGeometry, type Texture } from 'three';
import { config } from '../config';

export interface Acetate {
  /** The sheet in its set's frame, hinged along the paper's far edge. */
  mesh: Mesh;
  /** Hinge angle θ in radians: 0 = closed over the paper, π = open on the table past the hinge. */
  setAngle(theta: number): void;
}

/**
 * §5.3 material: clear, slightly hazy acetate under a glossy clear coat. It reflects its own
 * studio environment (config.acetateStudio), not the room that lights the prints.
 */
export function createAcetateMaterial(envMap: Texture): MeshPhysicalMaterial {
  const a = config.acetate;
  return new MeshPhysicalMaterial({
    color: a.tint,
    transmission: a.transmission,
    thickness: a.thickness,
    ior: a.ior,
    roughness: a.roughness,
    metalness: a.metalness,
    clearcoat: a.clearcoat,
    clearcoatRoughness: a.clearcoatRoughness,
    envMap,
    envMapIntensity: a.envMapIntensity,
    side: DoubleSide,  // seen from both sides mid-flip
  });
}

/**
 * §5.3 geometry: a segX × segY grid rebuilt from flat rest coordinates (x across the sheet, d =
 * distance from the hinge) whenever the angle changes, never accumulated. The sheet is flat for
 * now; the rest shape (M3) and sag (M5) slot into the same §5.5 formula.
 */
export function createAcetate(material: MeshPhysicalMaterial): Acetate {
  const { w, h, segX, segY, gap } = config.acetate;
  const geometry = new PlaneGeometry(w, h, segX, segY);
  const position = geometry.attributes.position;
  const rest = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    rest[i * 2] = position.getX(i);
    rest[i * 2 + 1] = h / 2 - position.getY(i);  // the plane's top row becomes the hinge (d = 0)
  }

  const mesh = new Mesh(geometry, material);
  mesh.name = 'acetate';
  mesh.position.z = -config.paper.h / 2;  // hinge line = the paper's far edge
  mesh.frustumCulled = false;            // bounds change as the sheet moves
  mesh.castShadow = false;               // a transmissive mesh would cast a solid shadow (§5.7)

  function setAngle(theta: number): void {
    // §5.5: z0 is the height of the hinge side: on the paper when closed, on the table when open.
    const z0 = MathUtils.lerp(config.paper.t + gap, gap, theta / Math.PI);
    const sin = Math.sin(theta);
    const cos = Math.cos(theta);
    for (let i = 0; i < position.count; i++) {
      const d = rest[i * 2 + 1];
      position.setXYZ(i, rest[i * 2], z0 + d * sin, d * cos);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }

  setAngle(0);
  return { mesh, setAngle };
}
