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

// Global log toggle: press '9' to mute/unmute `console.log` and `console.info`.
// Certain important messages remain visible (whitelisted substrings).
import cleanup from './cleanup.js';
if (typeof window !== 'undefined') {
  window._hcLogsEnabled = (typeof window._hcLogsEnabled === 'boolean') ? window._hcLogsEnabled : true;
  (function() {
    const origLog = console.log.bind(console);
    const origInfo = (console.info && console.info.bind) ? console.info.bind(console) : origLog;
    const whitelist = [
      'Live reload enabled',
      'you have used a p5.js reserved function',
      'p5.js dice'
    ];
    function msgToString(args) {
      try {
        return args.map(a => (typeof a === 'string') ? a : (typeof a === 'undefined' ? 'undefined' : (a && a.toString && a.toString() ) || JSON.stringify(a))).join(' ');
      } catch (e) {
        try { return String(args); } catch (ee) { return ''; }
      }
    }
    function isWhitelisted(s) {
      if (!s) return false;
      for (const w of whitelist) if (s.indexOf(w) !== -1) return true;
      return false;
    }

    console.log = function(...args) {
      try {
        const s = msgToString(args);
        if (window._hcLogsEnabled || isWhitelisted(s)) origLog(...args);
      } catch (e) { origLog(...args); }
    };

    console.info = function(...args) {
      try {
        const s = msgToString(args);
        if (window._hcLogsEnabled || isWhitelisted(s)) origInfo(...args);
      } catch (e) { origInfo(...args); }
    };

    const _hc_logs_key = function(ev) {
      try {
        if (ev && ev.key === '9') {
          window._hcLogsEnabled = !window._hcLogsEnabled;
          origLog('[HC Logs] toggled', window._hcLogsEnabled ? 'ON' : 'OFF');
        }
      } catch (e) {}
    };
    try {
      if (cleanup && typeof cleanup.registerListener === 'function') cleanup.registerListener(window, 'keydown', _hc_logs_key, false);
      else window.addEventListener('keydown', _hc_logs_key);
      window._hcLogsToggleHandler = _hc_logs_key;
    } catch (e) { try { window.addEventListener('keydown', _hc_logs_key); window._hcLogsToggleHandler = _hc_logs_key; } catch (ee) {} }
  })();
}

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
  try { state._lifebarFrames = await loadLifebarFrames(); } catch (e) { state._lifebarFrames = null; console.error('loadLifebarFrames failed', e); }

  state.selectionActive = true;
  state.playersReady = false;
  state.p1Confirmed = false;
  state.p2Confirmed = false;
  state.p1Choice = 0;
  state.p2Choice = 1;

  initStageEditor(undefined, { autoLoadSlot: null });

  // forward mouse / wheel to editor when active
  try {
    const _setup_mousedown = function(e) { try { if (isStageEditorActive()) { stageHandleMousePressed(e, state.cam); e.preventDefault(); } } catch (err) {} };
    const _setup_context = function(e) { try { if (isStageEditorActive()) e.preventDefault(); } catch (err) {} };
    const _setup_wheel = function(e) { try { if (isStageEditorActive()) { stageHandleWheel(e.deltaY, state.cam); e.preventDefault(); } } catch (err) {} };
    try {
      if (typeof cleanup !== 'undefined' && cleanup && typeof cleanup.registerListener === 'function') {
        cleanup.registerListener(window, 'mousedown', _setup_mousedown, { passive: false });
        cleanup.registerListener(window, 'contextmenu', _setup_context, { passive: false });
        cleanup.registerListener(window, 'wheel', _setup_wheel, { passive: false });
      } else {
        window.addEventListener('mousedown', _setup_mousedown, { passive: false });
        window.addEventListener('contextmenu', _setup_context, { passive: false });
        window.addEventListener('wheel', _setup_wheel, { passive: false });
      }
      window._setupMouseDownHandler = _setup_mousedown;
      window._setupContextHandler = _setup_context;
      window._setupWheelHandler = _setup_wheel;
      console.log('[setup] registered global stage editor handlers');
    } catch (e) { try { window.addEventListener('mousedown', _setup_mousedown, { passive: false }); window.addEventListener('contextmenu', _setup_context, { passive: false }); window.addEventListener('wheel', _setup_wheel, { passive: false }); } catch (ee) {} }
  } catch (err) {}

  // Also bind directly to the canvas element using pointer events to avoid cases
  // where canvas consumes mouse events before they reach window.
  try {
    const bindCanvasHandlers = () => {
      try {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const _canvas_pointer = function(ev) { try { if (isStageEditorActive()) { stageHandleMousePressed(ev, state.cam); ev.preventDefault(); } } catch (e) {} };
        const _canvas_wheel = function(ev) { try { if (isStageEditorActive()) { stageHandleWheel(ev.deltaY, state.cam); ev.preventDefault(); } } catch (e) {} };
        // prefer pointerdown for broader device support
        canvas.addEventListener('pointerdown', _canvas_pointer, { passive: false });
        canvas.addEventListener('wheel', _canvas_wheel, { passive: false });
        // expose references so cleanup can remove them if needed
        window._stageCanvasPointer = _canvas_pointer;
        window._stageCanvasWheel = _canvas_wheel;
        console.log('[setup] bound stage editor to canvas pointer/wheel events');
      } catch (e) {
        console.warn('[setup] failed to bind canvas handlers for stage editor', e);
      }
    };
    // bind now if canvas exists, otherwise poll until canvas appears (robust for p5 timing)
    (function tryBind(retries = 0) {
      try {
        const canvas = document.querySelector('canvas');
        if (canvas) { bindCanvasHandlers(); return; }
      } catch (e) {}
      if (retries < 40) setTimeout(() => tryBind(retries + 1), 200);
      else console.warn('[setup] giving up binding canvas handlers for stage editor after retries');
    })(0);
  } catch (e) {}

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
  window._lifebarFrames = state._lifebarFrames;

  window.selectionActive = state.selectionActive;
  window.playersReady = state.playersReady;
  window.p1Confirmed = state.p1Confirmed;
  window.p2Confirmed = state.p2Confirmed;
  window.p1Choice = state.p1Choice;
  window.p2Choice = state.p2Choice;
  }
