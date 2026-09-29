import { Mesh, MeshStandardMaterial, PlaneGeometry, Vector2 } from 'three';
import { config } from '../config';
import type { PaperGrain } from '../textures/procedural';

/** §5.1: off-white table top, a plane at y = 0 centered under the sets, with tiled paper grain. */
export function createTable(grain: PaperGrain): Mesh {
  const { size, color, roughness, normalRepeat, normalScale } = config.table;
  const geometry = new PlaneGeometry(size, size);
  geometry.rotateX(-Math.PI / 2);

  const normalMap = grain.normalMap.clone();
  normalMap.repeat.set(normalRepeat, normalRepeat);
  const material = new MeshStandardMaterial({
    color,
    roughness,
    normalMap,
    normalScale: new Vector2(normalScale, normalScale),
  });

  const table = new Mesh(geometry, material);
  table.name = 'table';
  table.receiveShadow = true;
  return table;
}
