import { BoxGeometry, Mesh, MeshStandardMaterial, Vector2, type Texture } from 'three';
import { config } from '../config';
import type { PaperGrain } from '../textures/procedural';

/**
 * §5.2 contact print: a thin box resting on the table, centered on its set's origin. Only the top
 * face carries the scan; the scan's top edge lands on the hinge edge (−z).
 */
export function createPaper(scan: Texture, grain: PaperGrain): Mesh {
  const { w, h, t, roughness, normalScale, envMapIntensity, edgeColor } = config.paper;

  // Repeat the grain along v by the sheet's aspect so it stays isotropic on the 8×10 sheet.
  const grainRepeat = new Vector2(1, h / w);
  const normalMap = grain.normalMap.clone();
  normalMap.repeat.copy(grainRepeat);
  const roughnessMap = grain.roughnessMap.clone();
  roughnessMap.repeat.copy(grainRepeat);

  const top = new MeshStandardMaterial({
    map: scan,
    roughness: 1,  // roughnessMap holds absolute roughness (paper.roughness ± roughnessVar)
    roughnessMap,
    normalMap,
    normalScale: new Vector2(normalScale, normalScale),
    envMapIntensity,
  });
  const edge = new MeshStandardMaterial({ color: edgeColor, roughness, envMapIntensity });

  // BoxGeometry material groups: +x, −x, +y (top), −y, +z, −z.
  const paper = new Mesh(new BoxGeometry(w, t, h), [edge, edge, top, edge, edge, edge]);
  paper.name = 'paper';
  paper.position.y = t / 2;
  paper.castShadow = true;
  paper.receiveShadow = true;
  return paper;
}
