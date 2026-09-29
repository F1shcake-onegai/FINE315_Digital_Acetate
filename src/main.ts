import './style.css';
import { Scene } from 'three';
import { config } from './config';
import { createRenderer, resizeRenderer, watchPixelRatio } from './scene/renderer';
import { createCamera } from './scene/camera';
import { applyEnvironment, createAcetateEnvironment } from './scene/environment';
import { createTable } from './scene/table';
import { createLighting } from './scene/lighting';
import { createAcetateMaterial } from './scene/acetate';
import { createSet } from './scene/set';
import { createFootprintTexture, createPaperGrain } from './textures/procedural';
import { createPlaceholderSheet } from './textures/placeholderSheet';
import { loadScan } from './textures/loader';
import { bindViewShortcuts, createViewControls } from './interaction/viewControls';
import { createParallax } from './interaction/parallax';
import { createOverlay } from './ui/overlay';
import { bindFresnelTest, exposeDevHandle, markReady } from './dev';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('index.html is missing <canvas id="scene">');

const renderer = createRenderer(canvas);
const scene = new Scene();
const camera = createCamera(window.innerWidth / window.innerHeight);
const anisotropy = renderer.capabilities.getMaxAnisotropy();
const grain = createPaperGrain(anisotropy);
const acetateMaterial = createAcetateMaterial(createAcetateEnvironment(renderer));
const footprint = createFootprintTexture(anisotropy);

applyEnvironment(renderer, scene);
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

const view = createViewControls(camera, renderer);
bindViewShortcuts(view, canvas);
const parallax = createParallax(scene, canvas);
createOverlay(view);

exposeDevHandle({ renderer, scene, camera }, view);

let setsAdded = false;
renderer.setAnimationLoop(() => {
  view.update();
  parallax.update();
  acetateMaterial.envMapRotation.copy(scene.environmentRotation);  // highlights drift with the pointer too
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
  const sets = [
    createSet('A', -layout.setOffsetX, { scan: scanA, acetateMaterial, footprint }),
    createSet('B', layout.setOffsetX, { scan: scanB, acetateMaterial, footprint }),
  ];
  scene.add(...sets.map((set) => set.group));
  bindFresnelTest(sets);
  setsAdded = true;
}

addSets().catch((error: unknown) => console.error('Failed to build the sets:', error));
