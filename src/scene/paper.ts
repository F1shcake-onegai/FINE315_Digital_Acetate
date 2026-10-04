import { BoxGeometry, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, type Texture } from 'three';
import { config } from '../config';

export function createPaper(scan: Texture): Mesh {
  const { w, h, t, roughness, specularIntensity, envMapIntensity, edgeColor } = config.paper;
  const top = new MeshPhysicalMaterial({ map: scan, roughness, specularIntensity, envMapIntensity });
  const edge = new MeshStandardMaterial({ color: edgeColor, roughness, envMapIntensity });
  const paper = new Mesh(new BoxGeometry(w, t, h), [edge, edge, top, edge, edge, edge]);
  paper.name = 'paper';
  paper.position.y = t / 2;
  paper.castShadow = true;
  paper.receiveShadow = true;
  return paper;
}
