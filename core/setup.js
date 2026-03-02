// core/setup.js
import { state } from './state.js';
import { state as gameState } from './gameState.js';
import { initInput } from './input.js';
import { loadTyemanAssets, loadSbluerAssets, loadFernandoAssets } from './assetLoader.js';
import { initPauseMenu } from './pauseMenu.js';
import {
  initStageEditor,
  toggleStageEditor,
  isStageEditorActive,
  setStageEditorActive,
  exportItems as stageExportItems,
  loadStageItems as stageLoadItems,
  handleMousePressed as stageHandleMousePressed,
  handleWheel as stageHandleWheel
} from '../ui/stageEditor.js';

export async function setup() {
  createCanvas(800, 400);
  pixelDensity(1);
  noSmooth();
  if (typeof drawingContext !== 'undefined' && drawingContext) drawingContext.imageSmoothingEnabled = false;

  initInput();

  initPauseMenu({
    onResume: () => { state.PAUSED = false; window.PAUSED = false; },
    onReturnToCharSelect: () => {
      // ensure game is unpaused before switching to character select
      state.PAUSED = false;
      if (typeof window !== 'undefined') window.PAUSED = false;
      if (typeof window.resetToSelection === 'function') window.resetToSelection();
    }
  });

  // Exponer toggles globales mínimos (como estaba en main)
  window.toggleStageEditor = toggleStageEditor;
  window.stageExportItems = stageExportItems;
  window.stageLoadItems = stageLoadItems;

  state._tyemanAssets = await loadTyemanAssets();
  state._sbluerAssets = await loadSbluerAssets();
  try { state._fernandoAssets = await loadFernandoAssets(); } catch (e) { state._fernandoAssets = null; console.warn('loadFernandoAssets failed', e); }

  // Mirror to core/gameState if present so lifecycle can read assets
  try {
    if (gameState) {
      gameState._tyemanAssets = state._tyemanAssets;
      gameState._sbluerAssets = state._sbluerAssets;
      gameState._fernandoAssets = state._fernandoAssets;
      gameState._slotAssets = state._slotAssets;
      gameState._heartFrames = state._heartFrames;
      gameState._bootFrames = state._bootFrames;
    }
  } catch (e) {}

  try { state._slotAssets = await loadSlotAssets(); } catch (e) { state._slotAssets = null; console.warn('loadSlotAssets failed', e); }
  try { state._heartFrames = await loadHeartFrames(); } catch (e) { state._heartFrames = null; console.error('loadHeartFrames failed', e); }
  try { state._bootFrames = await loadBootFrames(); } catch (e) { state._bootFrames = null; console.error('loadBootFrames failed', e); }

  state.selectionActive = true;
  state.playersReady = false;
  state.p1Confirmed = false;
  state.p2Confirmed = false;
  state.p1Choice = 0;
  state.p2Choice = 1;

  initStageEditor(undefined, { autoLoadSlot: null });

  // forward mouse / wheel to editor when active
  try {
    window.addEventListener('mousedown', (e) => {
    try {
      if (isStageEditorActive()) {
        stageHandleMousePressed(e, state.cam);
        e.preventDefault();
      }
    } catch (err) {}
  }, { passive: false });

  window.addEventListener('contextmenu', (e) => {
    if (isStageEditorActive()) e.preventDefault();
  }, { passive: false });

  window.addEventListener('wheel', (e) => {
    try {
      if (isStageEditorActive()) {
        stageHandleWheel(e.deltaY, state.cam);
        e.preventDefault();
      }
    } catch (err) {}
  }, { passive: false });

  // mantener compatibilidad global si otros módulos lo esperan
  window.SHOW_DEBUG_OVERLAYS = window.SHOW_DEBUG_OVERLAYS || false;
  window.MATCH_OVER = window.MATCH_OVER || false;
  window.MATCH_WINNER = window.MATCH_WINNER || null;
  window._matchMenu = window._matchMenu || state._matchMenu;

  // keep match/menu debug flags in sync
  window._tyemanAssets = state._tyemanAssets;
  window._sbluerAssets = state._sbluerAssets;
  window._fernandoAssets = state._fernandoAssets;
  window._slotAssets = state._slotAssets;
  window._heartFrames = state._heartFrames;
  window._bootFrames = state._bootFrames;

  window.selectionActive = state.selectionActive;
  window.playersReady = state.playersReady;
  window.p1Confirmed = state.p1Confirmed;
  window.p2Confirmed = state.p2Confirmed;
  window.p1Choice = state.p1Choice;
  window.p2Choice = state.p2Choice;
  } catch (e) {
    console.warn('setup: unable to mirror state to window globals', e);
  }
}