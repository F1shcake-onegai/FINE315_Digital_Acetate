import { Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { config } from '../config';

/** §5.1: off-white table top, a plane at y = 0 centered under the sets. */
export function createTable(): Mesh {
  const { size, color, roughness } = config.table;
  const geometry = new PlaneGeometry(size, size);
  geometry.rotateX(-Math.PI / 2);

  const table = new Mesh(geometry, new MeshStandardMaterial({ color, roughness }));
  table.name = 'table';
  table.receiveShadow = true;
  return table;
}
