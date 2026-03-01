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
  console.log('[setup] sbluer assets loaded keys:', Object.keys(state._sbluerAssets || {}));
  // Diagnostic dump: print brief shapes for key assets to help debug UI indexing
  try {
    function _shapeOf(obj) {
      if (!obj) return 'null';
      if (Array.isArray(obj)) {
        if (obj.length === 0) return 'array(0)';
        // layers-by-layer (each element may be array of frames)
        if (Array.isArray(obj[0])) {
          return 'layers[' + obj.map(l => (Array.isArray(l) ? l.length : (l && l.width ? 'img' : 'null'))).join(',') + ']';
        }
        // flat frames array
        return 'frames[' + obj.length + ']';
      }
      if (obj.width && obj.height) {
        const internal = Math.max(1, Math.round(obj.width / obj.height));
        return `img(${obj.width}x${obj.height})[frames=${internal}]`;
      }
      return typeof obj;
    }
    console.log('[setup] ASSET SHAPES:', {
      tyeman_idle: _shapeOf(state._tyemanAssets?.idle),
      tyeman_taunt: _shapeOf(state._tyemanAssets?.taunt),
      sbluer_idle: _shapeOf(state._sbluerAssets?.idle),
      sbluer_taunt: _shapeOf(state._sbluerAssets?.taunt),
      fernando_idle: _shapeOf(state._fernandoAssets?.idle),
      slot_empty: _shapeOf(state._slotAssets?.empty),
      boot_frames: _shapeOf(state._bootFrames)
    });
  } catch (e) { console.warn('setup: asset shape dump failed', e); }
  try { console.log('[setup] sbluer.spit layers:', (state._sbluerAssets && state._sbluerAssets.spit) ? state._sbluerAssets.spit.length : 0); } catch (e) {}
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
    try { console.log('[setup] mirrored gameState._sbluerAssets.spit present?', !!(gameState._sbluerAssets && gameState._sbluerAssets.spit), 'len=', (gameState._sbluerAssets && gameState._sbluerAssets.spit) ? gameState._sbluerAssets.spit.length : 'null'); } catch (e) {}
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