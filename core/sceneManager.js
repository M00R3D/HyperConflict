import createSelectionScene from '../ui/selection.js';
import { loadTyemanAssets, loadSbluerAssets, loadSlotAssets, loadHeartFrames, loadBootFrames } from './assetLoader.js';
import createGameplay from './gameplay.js';

let currentScene = null;

export async function initScenes() {
  const tyeman = await loadTyemanAssets();
  const sbluer = await loadSbluerAssets();
  let slots = null;
  try { slots = await loadSlotAssets(); } catch(e){ slots = null; }
  const heartFrames = await loadHeartFrames().catch(()=>null);
  const bootFrames = await loadBootFrames().catch(()=>null);

  const selection = createSelectionScene({
    choices: ['tyeman','sbluer'],
    slotAssets: slots,
    tyemanAssets: tyeman,
    sbluerAssets: sbluer,
    onConfirm: ({p1Choice,p2Choice}) => {
      // arrancar gameplay con elecciones
      currentScene = createGameplay({ p1Choice, p2Choice, tyeman, sbluer, heartFrames, bootFrames, slotAssets: slots });
    }
  });
  currentScene = selection;
}

export function updateSceneInput(keysPressed, keysDown) {
  if (currentScene && currentScene.handleInput) currentScene.handleInput(keysPressed, keysDown);
}

export function renderScene() {
  if (currentScene && currentScene.draw) currentScene.draw();
}

export function isSelectionActive() {
  return currentScene && typeof currentScene.active === 'function' ? currentScene.active() : false;
}