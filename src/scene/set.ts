import { Group, type Texture } from 'three';
import type { PaperGrain } from '../textures/procedural';
import { createPaper } from './paper';

/**
 * One set, centered at x = offsetX: the contact print (acetate, tape and contact decals join in
 * later milestones). Local frame: origin at the paper center on the table; the hinge runs along
 * the paper's far edge, z = −paper.h / 2.
 */
export function createSet(name: string, offsetX: number, scan: Texture, grain: PaperGrain): Group {
  const set = new Group();
  set.name = `set-${name}`;
  set.position.x = offsetX;
  set.add(createPaper(scan, grain));
  return set;
}
