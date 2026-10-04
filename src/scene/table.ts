import { Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { config } from '../config';

export function createTable(): Mesh {
  const { size, color, roughness } = config.table;
  const geometry = new PlaneGeometry(size, size);
  geometry.rotateX(-Math.PI / 2);
  const material = new MeshStandardMaterial({ color, roughness });
  const table = new Mesh(geometry, material);
  table.name = 'table';
  table.receiveShadow = true;
  return table;
}
