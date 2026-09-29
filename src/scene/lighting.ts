import { Box3, DirectionalLight, Group, HemisphereLight, Vector3 } from 'three';
import { config } from '../config';

/** §5.6: key directional light with a tightly fitted shadow camera, plus hemisphere fill. */
export function createLighting(): Group {
  const light = config.light;
  const lights = new Group();
  lights.name = 'lighting';

  // The key's target stays at the origin, the sets' center.
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

/**
 * Everything the key's shadow must cover: both sets with the acetate closed (bottom overhang) or
 * open (lying past the hinge), up to the acetate-side tape standing upright mid-flip.
 */
function shadowRegion(): Box3 {
  const { paper, acetate, tape, layout } = config;
  const hingeZ = -paper.h / 2;
  const halfX = layout.setOffsetX + acetate.w / 2 + tape.overhang;
  return new Box3(
    new Vector3(-halfX, 0, hingeZ - acetate.h),
    new Vector3(halfX, tape.w / 2, hingeZ + acetate.h),
  );
}

/**
 * Fit the orthographic shadow camera to `region` as the light sees it, plus a margin. Works in the
 * lighting group's frame and places the camera the way LightShadow.updateMatrices() will each
 * frame (at the light, facing its target), so the fit survives moving the group with the world.
 */
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
  camera.near = -bounds.max.z - margin;  // the camera looks down its −z axis
  camera.far = -bounds.min.z + margin;
  camera.updateProjectionMatrix();
}
