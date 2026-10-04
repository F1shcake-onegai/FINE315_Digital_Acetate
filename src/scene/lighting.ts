import { Box3, DirectionalLight, Group, HemisphereLight, Vector3 } from 'three';
import { config } from '../config';

export function createLighting(): Group {
  const light = config.light;
  const lights = new Group();
  lights.name = 'lighting';

  const key = new DirectionalLight(light.keyColor, light.keyIntensity);
  key.name = 'key';
  key.position.set(light.keyPosition.x, light.keyPosition.y, light.keyPosition.z);
  key.castShadow = true;
  key.shadow.mapSize.set(light.shadowMap, light.shadowMap);
  key.shadow.radius = light.shadowRadius;
  key.shadow.bias = light.shadowBias;
  key.shadow.normalBias = light.shadowNormalBias;
  lights.add(key, key.target);
  fitShadowCamera(key, shadowRegion());

  const fill = new HemisphereLight(light.fillSky, light.fillGround, light.fillIntensity);
  fill.name = 'fill';
  lights.add(fill);
  return lights;
}

function shadowRegion(): Box3 {
  const { paper, acetate, layout } = config;
  const hingeZ = -paper.h / 2;
  const halfX = layout.setOffsetX + acetate.w / 2;
  return new Box3(
    new Vector3(-halfX, 0, hingeZ - acetate.h),
    new Vector3(halfX, 0, hingeZ + acetate.h),
  );
}

function fitShadowCamera(light: DirectionalLight, region: Box3): void {
  const margin = config.light.shadowMargin;
  const camera = light.shadow.camera;
  camera.position.copy(light.position);
  camera.lookAt(light.target.position);
  camera.updateMatrixWorld();

  const bounds = new Box3();
  const corner = new Vector3();
  for (const x of [region.min.x, region.max.x]) {
    for (const y of [region.min.y, region.max.y]) {
      for (const z of [region.min.z, region.max.z]) {
        bounds.expandByPoint(corner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse));
      }
    }
  }
  camera.left = bounds.min.x - margin;
  camera.right = bounds.max.x + margin;
  camera.bottom = bounds.min.y - margin;
  camera.top = bounds.max.y + margin;
  camera.near = -bounds.max.z - margin;
  camera.far = -bounds.min.z + margin;
  camera.updateProjectionMatrix();
}
