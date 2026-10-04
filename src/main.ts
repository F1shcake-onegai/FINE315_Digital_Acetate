import './style.css';
import { Scene, Timer, type MeshPhysicalMaterial } from 'three';
import { config } from './config';
import { createRenderer, resizeRenderer, watchPixelRatio } from './scene/renderer';
import { createCamera } from './scene/camera';
import { applyEnvironment, createAcetateEnvironment } from './scene/environment';
import { createTable } from './scene/table';
import { createLighting } from './scene/lighting';
import { createAcetateMaterial, createRimMaterial } from './scene/acetate';
import { createSet } from './scene/set';
import { createCreaseNormalTexture, createFootprintTexture } from './textures/procedural';
import { loadScan } from './textures/loader';
import { loadArtwork } from './textures/artwork';
import { bindViewShortcuts, createViewControls } from './interaction/viewControls';
import { createFlip, type Flip } from './interaction/flip';
import { createOverlay } from './ui/overlay';
import { createPager } from './ui/pager';
import { loadingDone, loadingFailed } from './ui/loading';
import { createHand } from './ui/hand';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('index.html is missing <canvas id="scene">');

const renderer = createRenderer(canvas);
const scene = new Scene();
const camera = createCamera(window.innerWidth / window.innerHeight);
const anisotropy = renderer.capabilities.getMaxAnisotropy();
const acetateEnvironment = createAcetateEnvironment(renderer);
const rimMaterial = createRimMaterial();
const footprint = createFootprintTexture(anisotropy);
const acetateMaterials: MeshPhysicalMaterial[] = [];

applyEnvironment(renderer, scene);
scene.add(createTable(), createLighting());

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  resizeRenderer(renderer, width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  rimMaterial.resolution.set(width, height);
}
window.addEventListener('resize', resize);
watchPixelRatio(resize);
resize();

const view = createViewControls(camera, renderer);
const hand = createHand(canvas);
let flip: Flip | null = null;
bindViewShortcuts(view, canvas, (event) => flip?.isOverAcetate(event) ?? false);
createOverlay(view);

let portrait = window.innerHeight >= window.innerWidth;
window.addEventListener('resize', () => {
  const nowPortrait = window.innerHeight >= window.innerWidth;
  if (nowPortrait === portrait) return;
  portrait = nowPortrait;
  view.reset();
});

const timer = new Timer();
timer.connect(document);
let setsAdded = false;
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = timer.getDelta();
  view.update(dt);
  flip?.update(dt);
  renderer.render(scene, camera);
  if (setsAdded) {
    setsAdded = false;
    loadingDone();
  }
});

async function addSets(): Promise<void> {
  const { assets, layout, acetate } = config;
  const [scanA, scanB, paintA, paintB] = await Promise.all([
    loadScan(assets.sheetA, anisotropy),
    loadScan(assets.sheetB, anisotropy),
    loadArtwork(acetate.artwork[0], anisotropy),
    loadArtwork(acetate.artwork[1], anisotropy),
  ]);
  const crease = createCreaseNormalTexture(anisotropy);
  const sheets = [
    { name: 'A', x: -layout.setOffsetX, scan: scanA, paint: paintA },
    { name: 'B', x: layout.setOffsetX, scan: scanB, paint: paintB },
  ];
  const sets = sheets.map((sheet) => {
    const acetateMaterial = createAcetateMaterial(acetateEnvironment, { crease, paint: sheet.paint });
    acetateMaterials.push(acetateMaterial);
    return createSet(sheet.name, sheet.x, { scan: sheet.scan, acetateMaterial, rimMaterial, footprint });
  });
  scene.add(...sets.map((set) => set.group));
  const showOnly = (index: number) => sets.forEach((set, i) => { set.group.visible = i === index; });
  showOnly(0);
  createPager(sets.length, (index) => {
    for (const set of sets) set.group.visible = true;
    view.showPage(sheets[index].x, true, () => showOnly(index));
  });
  flip = createFlip(sets, camera, renderer.domElement, hand);
  setsAdded = true;
}

addSets().catch((error: unknown) => {
  console.error(error);
  loadingFailed();
});
