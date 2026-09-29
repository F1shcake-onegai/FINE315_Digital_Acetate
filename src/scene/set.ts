import {
  CustomBlending, Group, Mesh, MeshBasicMaterial, OneFactor, OneMinusSrcAlphaFactor, PlaneGeometry, SrcAlphaFactor,
  type MeshPhysicalMaterial, type MeshStandardMaterial, type Texture,
} from 'three';
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { config } from '../config';
import { createAcetate } from './acetate';
import { createPaper } from './paper';
import { createTape } from './tape';

export interface SetParts {
  scan: Texture;
  acetateMaterial: MeshPhysicalMaterial;
  /** Shared by both sets. */
  rimMaterial: LineMaterial;
  /** footprintShadow alpha map, shared by both decals of both sets. */
  footprint: Texture;
  /** Null while the tape is hidden (config.tape.visible). */
  tapeMaterial: MeshStandardMaterial | null;
}

export interface SetHandle {
  group: Group;
  /** Hinge angle θ of this set's acetate in radians (0 closed … π open) and its angular velocity ω. */
  setAngle(theta: number, omega?: number): void;
}

/**
 * One set, centered at x = offsetX: the contact print, its acetate, the tape that hinges them
 * (unless hidden) and the acetate's two contact shadows. Local frame: origin at the paper center
 * on the table; the hinge runs along the paper's far edge, z = −paper.h / 2.
 */
export function createSet(name: string, offsetX: number, parts: SetParts): SetHandle {
  const group = new Group();
  group.name = `set-${name}`;
  group.position.x = offsetX;

  const acetate = createAcetate(parts.acetateMaterial, parts.rimMaterial);
  const tape = parts.tapeMaterial && createTape(parts.tapeMaterial, offsetX);
  const closedShadow = createFootprintShadow(parts.footprint, 1);
  const openShadow = createFootprintShadow(parts.footprint, -1);
  group.add(createPaper(parts.scan), acetate.mesh, closedShadow, openShadow);
  if (tape) group.add(tape.mesh);

  function setAngle(theta: number, omega = 0): void {
    acetate.setPose(theta, omega);
    tape?.setPose(theta);
    const open = theta / Math.PI;
    closedShadow.material.opacity = config.contact.closedOpacity * (1 - open);
    openShadow.material.opacity = config.contact.openOpacity * open;
  }

  setAngle(0);
  return { group, setAngle };
}

/**
 * §5.7 soft contact shadow under the acetate's footprint: closed (side 1, over the paper) or open
 * (side −1, past the hinge), nudged away from the key light. It is drawn in the opaque pass with
 * hand-set blending so that it is part of what the transmissive acetate looks through; a regular
 * transparent material would vanish under the sheet.
 */
function createFootprintShadow(alphaMap: Texture, side: 1 | -1): Mesh<PlaneGeometry, MeshBasicMaterial> {
  const { w, h } = config.acetate;
  const { softEdge } = config.textures.footprint;
  const { lightOffset, decalLift, color } = config.contact;
  const geometry = new PlaneGeometry(w + softEdge, h + softEdge);
  geometry.rotateX(-Math.PI / 2);
  const material = new MeshBasicMaterial({
    color,
    alphaMap,
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    // Alpha as three's NormalBlending does it (a + dst·(1 − a)), so the canvas, which three
    // always creates with an alpha channel, stays opaque instead of showing the page through.
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
  });

  const shadow = new Mesh(geometry, material);
  shadow.name = side > 0 ? 'acetate-shadow-closed' : 'acetate-shadow-open';
  shadow.renderOrder = 1;  // after the table and paper in the opaque pass

  // A directional light's shadows fall away from it, along its horizontal direction.
  const key = config.light.keyPosition;
  const horizontal = Math.hypot(key.x, key.z);
  shadow.position.set(
    (-key.x / horizontal) * lightOffset,
    decalLift,
    -config.paper.h / 2 + (side * h) / 2 - (key.z / horizontal) * lightOffset,
  );
  return shadow;
}
