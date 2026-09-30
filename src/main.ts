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
import { createQuality, type Quality } from './scene/quality';
import { createTapeMaterial } from './scene/tape';
import { createCreaseNormalTexture, createFootprintTexture, createPaperGrain } from './textures/procedural';
import { createPlaceholderSheet } from './textures/placeholderSheet';
import { loadScan } from './textures/loader';
import { loadArtwork } from './textures/artwork';
import { createTearTexture, loadKraft } from './textures/kraft';
import { createScratchNormalTexture, createSmudgeTexture, loadWearSources } from './textures/wear';
import { bindViewShortcuts, createViewControls } from './interaction/viewControls';
import { createParallax } from './interaction/parallax';
import { createFlip, type Flip } from './interaction/flip';
import { createOverlay } from './ui/overlay';
import { createHand } from './ui/hand';
import { bindDevPose, exposeDevHandle, markReady } from './dev';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('index.html is missing <canvas id="scene">');

const renderer = createRenderer(canvas);
const scene = new Scene();
const camera = createCamera(window.innerWidth / window.innerHeight);
const anisotropy = renderer.capabilities.getMaxAnisotropy();
const grain = createPaperGrain(anisotropy);
const acetateEnvironment = createAcetateEnvironment(renderer);
const rimMaterial = createRimMaterial();
const footprint = createFootprintTexture(anisotropy);
const acetateMaterials: MeshPhysicalMaterial[] = [];

applyEnvironment(renderer, scene);
scene.add(createTable(grain), createLighting());

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
const parallax = createParallax(scene, canvas);
const hand = createHand(canvas);
let flip: Flip | null = null;  // once the sets exist
let quality: Quality | null = null;  // likewise
bindViewShortcuts(view, canvas, (event) => flip?.isOverAcetate(event) ?? false);
createOverlay(view);

exposeDevHandle({ renderer, scene, camera }, view);

const timer = new Timer();
timer.connect(document);  // no long step after the tab was hidden
let setsAdded = false;
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = timer.getDelta();
  view.update();
  parallax.update();
  flip?.update(dt);
  quality?.update(dt);
  // The acetate's own studio turns with the room, so its highlights drift with the pointer too.
  for (const material of acetateMaterials) material.envMapRotation.copy(scene.environmentRotation);
  renderer.render(scene, camera);
  if (setsAdded) {
    setsAdded = false;
    markReady();
  }
});

/**
 * Both sets side by side. Scans come from public/assets (procedural placeholders when missing);
 * each acetate gets its own smudges and, if present, the user's drawing; each tape (unless hidden)
 * its own torn ends.
 */
async function addSets(): Promise<void> {
  const { assets, placeholder, layout, acetate } = config;
  const [scanA, scanB, paintA, paintB, wear, kraft] = await Promise.all([
    loadScan(assets.sheetA, () => createPlaceholderSheet(placeholder.seedA), anisotropy),
    loadScan(assets.sheetB, () => createPlaceholderSheet(placeholder.seedB), anisotropy),
    loadArtwork(acetate.artwork[0], anisotropy),
    loadArtwork(acetate.artwork[1], anisotropy),
    loadWearSources(),
    config.tape.visible ? loadKraft(anisotropy) : null,
  ]);
  const crease = createCreaseNormalTexture(anisotropy);
  const scratches = createScratchNormalTexture(wear, anisotropy);
  const sheets = [
    { name: 'A', x: -layout.setOffsetX, scan: scanA, paint: paintA },
    { name: 'B', x: layout.setOffsetX, scan: scanB, paint: paintB },
  ];
  const sets = sheets.map((sheet, index) => {
    const smudge = createSmudgeTexture(wear, index, anisotropy);
    const acetateMaterial = createAcetateMaterial(acetateEnvironment, { smudge, crease, scratches, paint: sheet.paint });
    acetateMaterials.push(acetateMaterial);
    const tapeMaterial = kraft && createTapeMaterial(kraft, grain.normalMap, createTearTexture(index, anisotropy));
    return createSet(sheet.name, sheet.x, { scan: sheet.scan, acetateMaterial, rimMaterial, footprint, tapeMaterial });
  });
  scene.add(...sets.map((set) => set.group));
  flip = createFlip(sets, camera, renderer.domElement, hand);
  quality = createQuality(renderer, acetateMaterials);
  bindDevPose(flip);
  setsAdded = true;
}

addSets().catch((error: unknown) => console.error('Failed to build the sets:', error));
