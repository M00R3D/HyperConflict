import createSelectionScene from '../ui/selection.js';
import { loadTyemanAssets, loadSbluerAssets, loadSlotAssets, loadHeartFrames, loadBootFrames } from './assetLoader.js';
import createGameplay from './gameplay.js';
import { showStagePicker } from '../ui/stageEditor.js'; // <-- add import

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
      // after character selection, show level picker and then start gameplay using chosen or default stage
      try {
        showStagePicker(async (selectedRecord) => {
          // if user chose a saved stage, load it into stageEditor (picker already does that)
          // proceed to create gameplay regardless; gameplay can read editor items if needed
          currentScene = createGameplay({ p1Choice, p2Choice, tyeman, sbluer, heartFrames, bootFrames, slotAssets: slots });
        });
      } catch (e) {
        // fallback: create gameplay immediately if picker fails
        console.warn('stage picker failed or was cancelled, starting gameplay', e);
        currentScene = createGameplay({ p1Choice, p2Choice, tyeman, sbluer, heartFrames, bootFrames, slotAssets: slots });
      }
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