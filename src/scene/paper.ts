import { BoxGeometry, Mesh, MeshStandardMaterial, type Texture } from 'three';
import { config } from '../config';

/**
 * §5.2 contact print: a thin box resting on the table, centered on its set's origin. Only the top
 * face carries the scan; the scan's top edge lands on the hinge edge (−z). Resin-coated pearl
 * paper: a smooth, semi-matte surface with no grain.
 */
export function createPaper(scan: Texture): Mesh {
  const { w, h, t, roughness, envMapIntensity, edgeColor } = config.paper;
  const top = new MeshStandardMaterial({ map: scan, roughness, envMapIntensity });
  const edge = new MeshStandardMaterial({ color: edgeColor, roughness, envMapIntensity });

  // BoxGeometry material groups: +x, −x, +y (top), −y, +z, −z.
  const paper = new Mesh(new BoxGeometry(w, t, h), [edge, edge, top, edge, edge, edge]);
  paper.name = 'paper';
  paper.position.y = t / 2;
  paper.castShadow = true;
  paper.receiveShadow = true;
  return paper;
}
