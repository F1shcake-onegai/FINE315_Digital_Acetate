import './style.css';
import { Scene } from 'three';
import { createRenderer, resizeRenderer, watchPixelRatio } from './scene/renderer';
import { createCamera } from './scene/camera';
import { applyRoomEnvironment } from './scene/environment';
import { createTable } from './scene/table';
import { exposeDevHandle, markReady } from './dev';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('index.html is missing <canvas id="scene">');

const renderer = createRenderer(canvas);
const scene = new Scene();
const camera = createCamera(window.innerWidth / window.innerHeight);

applyRoomEnvironment(renderer, scene);
scene.add(createTable());

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

let firstFrame = true;
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    markReady();
  }
});
