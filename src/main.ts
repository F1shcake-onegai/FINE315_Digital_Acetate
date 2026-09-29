import './style.css';
import { Scene } from 'three';
import { config } from './config';
import { createRenderer, resizeRenderer, watchPixelRatio } from './scene/renderer';
import { createCamera } from './scene/camera';
import { applyRoomEnvironment } from './scene/environment';
import { createTable } from './scene/table';
import { createLighting } from './scene/lighting';
import { createSet } from './scene/set';
import { createPaperGrain } from './textures/procedural';
import { createPlaceholderSheet } from './textures/placeholderSheet';
import { loadScan } from './textures/loader';
import { exposeDevHandle, markReady } from './dev';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('index.html is missing <canvas id="scene">');

const renderer = createRenderer(canvas);
const scene = new Scene();
const camera = createCamera(window.innerWidth / window.innerHeight);
const anisotropy = renderer.capabilities.getMaxAnisotropy();
const grain = createPaperGrain(anisotropy);

applyRoomEnvironment(renderer, scene);
scene.add(createTable(grain), createLighting());

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  resizeRenderer(renderer, width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
watchPixelRatio(resize);
resize();

exposeDevHandle({ renderer, scene, camera });

let setsAdded = false;
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  if (setsAdded) {
    setsAdded = false;
    markReady();
  }
});

/** Both sets side by side: scans from public/assets, or procedural placeholders when missing. */
async function addSets(): Promise<void> {
  const { assets, placeholder, layout } = config;
  const [scanA, scanB] = await Promise.all([
    loadScan(assets.sheetA, () => createPlaceholderSheet(placeholder.seedA), anisotropy),
    loadScan(assets.sheetB, () => createPlaceholderSheet(placeholder.seedB), anisotropy),
  ]);
  scene.add(
    createSet('A', -layout.setOffsetX, scanA, grain),
    createSet('B', layout.setOffsetX, scanB, grain),
  );
  setsAdded = true;
}

addSets().catch((error: unknown) => console.error('Failed to build the sets:', error));
