import {
  CustomBlending, Group, Mesh, MeshBasicMaterial, OneFactor, OneMinusSrcAlphaFactor, PlaneGeometry, SrcAlphaFactor,
  type MeshPhysicalMaterial, type Texture,
} from 'three';
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { config } from '../config';
import { createAcetate } from './acetate';
import { createPaper } from './paper';

export interface SetParts {
  scan: Texture;
  acetateMaterial: MeshPhysicalMaterial;
  rimMaterial: LineMaterial;
  footprint: Texture;
}

export interface SetHandle {
  group: Group;
  setAngle(theta: number, omega?: number, grip?: number, held?: number): void;
}

export function createSet(name: string, offsetX: number, parts: SetParts): SetHandle {
  const group = new Group();
  group.name = `set-${name}`;
  group.position.x = offsetX;

  const acetate = createAcetate(parts.acetateMaterial, parts.rimMaterial);
  const closedShadow = createFootprintShadow(parts.footprint, 1);
  const openShadow = createFootprintShadow(parts.footprint, -1);
  group.add(createPaper(parts.scan), acetate.mesh, closedShadow, openShadow);

  function setAngle(theta: number, omega = 0, grip = 0, held = 0): void {
    acetate.setPose(theta, omega, grip, held);
    const open = theta / Math.PI;
    closedShadow.material.opacity = config.contact.closedOpacity * (1 - open);
    openShadow.material.opacity = config.contact.openOpacity * open;
  }

  setAngle(0);
  return { group, setAngle };
}

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
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
  });

  const shadow = new Mesh(geometry, material);
  shadow.name = side > 0 ? 'acetate-shadow-closed' : 'acetate-shadow-open';
  shadow.renderOrder = 1;

  const key = config.light.keyPosition;
  const horizontal = Math.hypot(key.x, key.z);
  shadow.position.set(
    (-key.x / horizontal) * lightOffset,
    decalLift,
    -config.paper.h / 2 + (side * h) / 2 - (key.z / horizontal) * lightOffset,
  );
  return shadow;
}
