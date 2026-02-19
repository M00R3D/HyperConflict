// core/main.js
import { Fighter } from '../../entities/fighter.js';import { Projectile } from '../../entities/projectile.js';
import { updateCamera, applyCamera } from './camera.js';import { initInput, keysPressed, clearFrameFlags, setPlayersReady } from './input.js';import { loadTyemanAssets, loadSbluerAssets } from './assetLoader.js';import { drawInputQueues, drawHealthBars } from '../ui/hud.js';
import { drawBackground } from '../ui/background.js';import { applyHitstop, isHitstopActive } from './hitstop.js';import { registerSpecialsForChar } from '../../entities/fighter/specials.js';import { registerStatsForChar, registerActionsForChar, getStatsForChar, getActionsForChar } from './charConfig.js';
import { initPauseMenu, handlePauseInput, drawPauseMenu, openPauseFor, closePause } from './pauseMenu.js';
import { registerAttackHitboxesForChar } from './hitboxConfig.js';
import { registerCharData } from './registerCharData.js';
import {
  initStageEditor,
  toggleStageEditor,
  isStageEditorActive,
  setStageEditorActive,  // Add this
  drawStageEditor,
  drawSavedItems,
  handleMousePressed as stageHandleMousePressed,
  handleWheel as stageHandleWheel,
  exportItems as stageExportItems,
  loadStageItems as stageLoadItems
} from '../ui/stageEditor.js';
import './sceneManager.js';

registerCharData();

let player1, player2;
let projectiles = [];
let playersReady = false;
let cam = { x: 0, y: 0, zoom: 1 };
let PAUSED = false;
let appliedCamZoom = cam.zoom || 1;
let appliedHUDAlpha = 1;
let MATCH_OVER = false;            // <-- new: match state
let MATCH_WINNER = null;          // <-- new: winner id when match ends
window.MATCH_OVER = window.MATCH_OVER || false;
window.MATCH_WINNER = window.MATCH_WINNER || null;

// NEW: menu state for MATCH_OVER overlay (behaves like pause menu)
const _matchMenu = {
  items: ['Rematch', 'Character Select'],
  idx: 0,
  lastInputAt: 0,
  debounceMs: 220, // cooldown to avoid immediate selection when overlay appears
  active: false
};
window._matchMenu = window._matchMenu || _matchMenu;
const MAX_HP_QUARTERS = 24;
let _hitEffect = { active: false, start: 0, end: 0, duration: 0, mag: 0, zoom: 0, targetPlayerId: null };
let _prevHp = { p1: null, p2: null };
let _hsPrevActive = false;
let _hsStartedAt = 0;
let _prevBlockstun = { p1: false, p2: false };
let _blockstunZoom = { active: false, start: 0, duration: 360, targetAdd: 0.16, playerId: null };
function computeFramesPerHitFor(player) {
  const base = 3;
  const perQuarterBonus = 2;
  const maxQ = (typeof MAX_HP_QUARTERS === 'number') ? MAX_HP_QUARTERS : 24;
  const hpNow = (player && typeof player.hp === 'number') ? player.hp : maxQ;
  const missing = Math.max(0, maxQ - hpNow);
  return base + (missing * perQuarterBonus);
}
function startDamageEffect(player, quartersRemoved) {
  if (!player) return;
  const now = millis();
  const remaining = Math.max(0, Math.min(MAX_HP_QUARTERS, player.hp));
  const lowFactor = 1 - (remaining / MAX_HP_QUARTERS);
  const duration = Math.min(500, 220 + 160 * Math.max(1, quartersRemoved));
  const baseMag = Math.min(100, 6 * Math.max(1, quartersRemoved) * (1 + lowFactor * 3));
  const mag = baseMag * 0.065;
  const zoomAdd = Math.min(0.3, 0.035 * Math.max(1, quartersRemoved) * (1 + lowFactor * 4));
  _hitEffect = { active: true, start: now, end: now + duration, duration, mag, zoom: zoomAdd, targetPlayerId: player.id };
}

let _tyemanAssets = null;let _sbluerAssets = null;let _heartFrames = null;let _slotAssets = null;let _bootFrames = null;let selectionActive = false;
const choices = ['tyeman', 'sbluer'];let p1Choice = 0;
let p2Choice = 1;let p1Confirmed = false;let p2Confirmed = false;let p1SelIndex = 0;let p2SelIndex = 1;
async function setup() {
  createCanvas(800, 400);pixelDensity(1);noSmooth();
  if (typeof drawingContext !== 'undefined' && drawingContext) drawingContext.imageSmoothingEnabled = false;
  initInput();
  // init pause menu with callbacks
  initPauseMenu({
    onResume: () => { PAUSED = false; window.PAUSED = false; },
    onReturnToCharSelect: () => {
      // use the centralized reset helper to fully restart selection state
      resetToSelection();
    }
  });

  window.SHOW_DEBUG_OVERLAYS = true;window.SHOW_DEBUG_OVERLAYS = window.SHOW_DEBUG_OVERLAYS || false;
  _tyemanAssets = await loadTyemanAssets();_sbluerAssets = await loadSbluerAssets();
  try {_slotAssets = await loadSlotAssets();} catch (e) {
    _slotAssets = null;console.warn('loadSlotAssets failed', e);}
  try {
    _heartFrames = await loadHeartFrames();
    if (Array.isArray(_heartFrames)) {
      _heartFrames.forEach((layer, idx) => {});
    }
  } catch (e) {_heartFrames = null;console.error('loadHeartFrames failed', e);}
  try {
    _bootFrames = await loadBootFrames();
    if (Array.isArray(_bootFrames)) {
      _bootFrames.forEach((layer, idx) => {
      });
    }
  } catch (e) {
    _bootFrames = null;console.error('loadBootFrames failed', e);
  }
  selectionActive = true;
  playersReady = false;
  p1Confirmed = false;
  p2Confirmed = false;
  p1Choice = 0;
  p2Choice = 1;
  initStageEditor(undefined, { autoLoadSlot: null });// asegura que el editor cargue sus frames

  // forward mouse / wheel to editor when active
  // NOTE: passive:false para poder call e.preventDefault()
  window.addEventListener('mousedown', (e) => {
    try {
      if (isStageEditorActive()) {
        stageHandleMousePressed(e, cam);
        e.preventDefault();
      }
    } catch (err) {}
  }, { passive: false });

  window.addEventListener('contextmenu', (e) => {
    if (isStageEditorActive()) {
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener('wheel', (e) => {
    try {
      if (isStageEditorActive()) {
        stageHandleWheel(e.deltaY, cam);
        e.preventDefault();
      }
    } catch (err) {}
  }, { passive: false });

  // expose quick toggles
  if (typeof window !== 'undefined') {
    window.toggleStageEditor = toggleStageEditor;
    window.stageExportItems = stageExportItems;
    window.stageLoadItems = stageLoadItems;
  }
}
function clearMatchOverState() {
  MATCH_OVER = false;
  MATCH_WINNER = null;
  window.MATCH_OVER = false;
  window.MATCH_WINNER = null;

  if (_matchMenu) {
    _matchMenu.active = false;
    _matchMenu.idx = 0;
    _matchMenu.lastInputAt = 0;
  }

  // clear per-player life-processing/handled flags so deaths can be detected again
  [player1, player2].forEach(p => {
    if (!p) return;
    p._lifeProcessing = false;
    p._lifeHandled = false;
    // also ensure any blocking flags that might persist are cleared
    if (p._lifeHandledAt) delete p._lifeHandledAt;
  });
}

function tryCreatePlayers() {
  // Guard clauses must return when conditions not met
  if (!p1Confirmed || !p2Confirmed) return;
  if (player1 || player2) return;

  // If there are saved stages, open the picker first (one-time per selection)
  try {
    if (typeof window !== 'undefined' && typeof window.stageGetSaved === 'function') {
      const saved = window.stageGetSaved();
      if (Array.isArray(saved) && saved.length && !window._stageSelectionDone) {
        // Hide character selection so the picker/editor overlay can render
        selectionActive = false;
        // open picker and wait for callback to resume creation
        window.stageShowPicker(function(selected) {
          // selected may be null or a saved record {name, json, ts}
          window._selectedStageRecord = selected || null;
          window._stageSelectionDone = true;
          // resume creation after user picked (or cancelled)
          tryCreatePlayers();
        });
        return; // wait for user pick
      }
    }
  } catch (e) {
    // ignore picker errors and continue creating players
    console.warn('stage picker errored, continuing', e);
  }

  // proceed to create players
  const tyeman = _tyemanAssets;
  const sbluer = _sbluerAssets;
  const p1Stats = getStatsForChar(choices[p1Choice]);
  const p2Stats = getStatsForChar(choices[p2Choice]);
  const p1Actions = getActionsForChar(choices[p1Choice]);
  const p2Actions = getActionsForChar(choices[p2Choice]);

  player1 = new Fighter({
    x: 100,
    col: color(255,100,100),
    id: 'p1',
    charId: choices[p1Choice],
    assets: choices[p1Choice] === 'tyeman' ? tyeman : sbluer,
    actions: p1Actions,
    ...p1Stats
  });
  player2 = new Fighter({
    x: 600,
    col: color(100,100,255),
    id: 'p2',
    charId: choices[p2Choice],
    assets: choices[p2Choice] === 'tyeman' ? tyeman : sbluer,
    actions: p2Actions,
    ...p2Stats
  });
  player1.opponent = player2;
  player2.opponent = player1;

  // If a stage record was chosen, try to load it into the editor items
  try {
    if (typeof window !== 'undefined' && window._selectedStageRecord) {
      const rec = window._selectedStageRecord;
      if (rec && rec.json) {
        try { loadStageItems(JSON.parse(rec.json)); } catch (e) { console.warn('failed to load selected stage json', e); }
      }
      window._selectedStageRecord = null;
    }
  } catch (e) { /* ignore */ }

  // Ensure any previous MATCH_OVER state is cleared when we actually enter combat
  clearMatchOverState();

  registerSpecialsForChar('tyeman', {
    hadouken: { seq: ['↓','↘','→','P'], direction: 'forward' },
    bun: { seq: ['←','→','P'], direction: 'forward' },
    ty_tats: { seq: ['↓','↙','←','K'], direction: 'backward' },
    taunt: { seq: ['T'], direction: 'any' },
    supersalto: { seq: ['↓','↑'], direction: 'any' },
    grab: { seq: ['G'], direction: 'any' }
  });
  registerSpecialsForChar('sbluer', {
    shoryuken: { seq: ['→','↓','↘','P'], direction: 'forward' },
    supersalto: { seq: ['↓','↑'], direction: 'any' },
    taunt: { seq: ['T'], direction: 'any' },
    grab: { seq: ['G'], direction: 'any' }
  });
  player1.facing = (player1.x < player2.x) ? 1 : -1;
  player2.facing = (player2.x < player1.x) ? 1 : -1;

  // ensure animations/frames are initialized and not blocked by PAUSED
  try {
    // force globals for a clean start
    PAUSED = false; window.PAUSED = false;
    // reset animation state explicitly so sprites render their frames immediately
    player1.setState('idle'); player1.frameIndex = 0; player1.frameTimer = 0;
    player2.setState('idle'); player2.frameIndex = 0; player2.frameTimer = 0;
  } catch (e) { /* silent */ }

  initInput({ p1: player1, p2: player2, ready: true }); playersReady = true;
  selectionActive = false; _prevHp.p1 = player1.hp; _prevHp.p2 = player2.hp;
}
function drawCharacterSelect() {
  background(12, 18, 28);
  fill(255);textAlign(CENTER, CENTER);textSize(28);
  text("Selecciona tu personaje", width/2, 48);const cols = 3;const rows = 2;
  const cellSize = 72;const cellGap = 12;const gridW = cols * cellSize + (cols - 1) * cellGap;
  const gridH = rows * cellSize + (rows - 1) * cellGap;const gridX = Math.round((width - gridW) / 2);const gridY = Math.round((height - gridH) / 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const ix = gridX + c * (cellSize + cellGap);const iy = gridY + r * (cellSize + cellGap);
      push();noStroke();
      let slotImg = null;
      try {
        if (_slotAssets && _slotAssets.empty) {
          const res = _slotAssets.empty;
          if (Array.isArray(res)) {const layer = res.find(l => Array.isArray(l) && l.length > 0);
            if (layer && layer.length > 0) slotImg = layer[0];}
        }
      } catch (e) { slotImg = null; }
      if (slotImg && slotImg.width && slotImg.height) {
        push();imageMode(CORNER);
        const dx = Math.round(ix);const dy = Math.round(iy);
        const dw = Math.round(cellSize);const dh = Math.round(cellSize);
        image(slotImg, dx, dy, dw, dh, 0, 0, slotImg.width, slotImg.height);pop();
      } else {fill(18, 22, 30);rect(ix, iy, cellSize, cellSize, 6);}
      if (idx < choices.length) {
        const charId = choices[idx];
        const assets = (charId === 'tyeman') ? _tyemanAssets : _sbluerAssets;
        const idleLayer = (assets?.idle && assets.idle[1]) ? assets.idle[1] : (assets?.idle && assets.idle[0]) ? assets.idle[0] : null;
        const frameImg = (idleLayer && idleLayer.length) ? idleLayer[0] : null; 
        if (frameImg) {
          imageMode(CENTER);
          const frameCount = (idleLayer && idleLayer.length) ? idleLayer.length : 1;const srcFrameW = Math.max(1, Math.floor(frameImg.width / frameCount));
          const srcFrameH = frameImg.height;const maxW = cellSize - 12;const maxH = cellSize - 12;
          const ratio = Math.min(maxW / srcFrameW, maxH / srcFrameH, 1);const dw = Math.round(srcFrameW * ratio);const dh = Math.round(srcFrameH * ratio);
          image(frameImg,ix + cellSize/2, iy + cellSize/2,dw, dh,0, 0,srcFrameW, srcFrameH);
        } else {fill(120);noStroke();ellipse(ix + cellSize/2, iy + cellSize/2, cellSize * 0.45);}
      } else {push();noFill();stroke(80);strokeWeight(1);rect(ix + 6, iy + 6, cellSize - 12, cellSize - 12, 4);pop();}
      pop();
    }
  }

  const baseTauntW = 56, baseTauntH = 56;
  const p1SelectedIdx = p1Confirmed ? (p1Choice < choices.length ? p1Choice : null)
                                    : (p1SelIndex < choices.length ? p1SelIndex : null);
  if (p1SelectedIdx !== null) {
    const charId = choices[p1SelectedIdx];
    const assets = charId === 'tyeman' ? _tyemanAssets : _sbluerAssets;
    const tauntLayer = (assets?.taunt && assets.taunt[1]) ? assets.taunt[1] : (assets?.taunt && assets.taunt[0]) ? assets.taunt[0] : null;
    const tauntImg = (tauntLayer && tauntLayer.length) ? tauntLayer[0] : null;
    if (tauntImg) {
      push();
      imageMode(CORNER);
      tint(255, 240);
      const tCount = (tauntLayer && tauntLayer.length) ? tauntLayer.length : 1;
      const tSrcW = Math.max(1, Math.floor(tauntImg.width / tCount));
      const tSrcH = tauntImg.height;const tRatio = Math.min(baseTauntW / tSrcW, baseTauntH / tSrcH, 1);
      const tDrawW = Math.round(tSrcW * tRatio);const tDrawH = Math.round(tSrcH * tRatio);
      const leftSlotX = gridX - baseTauntW - 18;const leftSlotY = gridY + Math.round((gridH - baseTauntH) / 2);
      const tauntDestX = leftSlotX + Math.round((baseTauntW - tDrawW) / 2);const tauntDestY = leftSlotY + Math.round((baseTauntH - tDrawH) / 2);
      image(tauntImg, tauntDestX, tauntDestY, tDrawW, tDrawH, 0, 0, tSrcW, tSrcH);
      noTint();fill(220);textSize(12);textAlign(CENTER, TOP);text(charId.toUpperCase(), tauntDestX + tDrawW/2, tauntDestY + tDrawH + 6);pop();
    } else {push();noFill();stroke(120);
      rect(gridX - baseTauntW - 18, gridY + Math.round((gridH - baseTauntH) / 2), baseTauntW, baseTauntH, 6);fill(220);textSize(12);textAlign(CENTER, TOP);
      text(choices[p1SelectedIdx].toUpperCase(), gridX - baseTauntW - 18 + baseTauntW/2, gridY + Math.round((gridH - baseTauntH) / 2) + baseTauntH + 6);pop();
    }
  }
  const p2SelectedIdx = p2Confirmed ? (p2Choice < choices.length ? p2Choice : null)
                                    : (p2SelIndex < choices.length ? p2SelIndex : null);
  if (p2SelectedIdx !== null) {
    const charId = choices[p2SelectedIdx];
    const assets = charId === 'tyeman' ? _tyemanAssets : _sbluerAssets;
    const tauntLayer = (assets?.taunt && assets.taunt[1]) ? assets.taunt[1] : (assets?.taunt && assets.taunt[0]) ? assets.taunt[0] : null;
    const tauntImg = (tauntLayer && tauntLayer.length) ? tauntLayer[0] : null;
    if (tauntImg) {
      push();
      imageMode(CORNER);
      tint(255, 240);

      const tCount2 = (tauntLayer && tauntLayer.length) ? tauntLayer.length : 1;
      const tSrcW2 = Math.max(1, Math.floor(tauntImg.width / tCount2));
      const tSrcH2 = tauntImg.height;
      const tRatio2 = Math.min(baseTauntW / tSrcW2, baseTauntH / tSrcH2, 1);
      const tDrawW2 = Math.round(tSrcW2 * tRatio2);
      const tDrawH2 = Math.round(tSrcH2 * tRatio2);

      const rightSlotX = gridX + gridW + 18;
      const rightSlotY = gridY + Math.round((gridH - baseTauntH) / 2);

      const tauntDestX2 = rightSlotX + Math.round((baseTauntW - tDrawW2) / 2);
      const tauntDestY2 = rightSlotY + Math.round((baseTauntH - tDrawH2) / 2);

      image(tauntImg, tauntDestX2, tauntDestY2, tDrawW2, tDrawH2, 0, 0, tSrcW2, tSrcH2);

      noTint();
      fill(220);
      textSize(12);
      textAlign(CENTER, TOP);
      text(charId.toUpperCase(), tauntDestX2 + tDrawW2/2, tauntDestY2 + tDrawH2 + 6);

      pop();
    } else {
      push();
      noFill();
      stroke(120);
      rect(gridX + gridW + 18, gridY + Math.round((gridH - baseTauntH) / 2), baseTauntW, baseTauntH, 6);
      fill(220);
      textSize(12);
      textAlign(CENTER, TOP);
      text(choices[p2SelectedIdx].toUpperCase(), gridX + gridW + 18 + baseTauntW/2, gridY + Math.round((gridH - baseTauntH) / 2) + baseTauntH + 6);
      pop();
    }
  }

  // draw selection cursors (replaced: now use slot_rounder_p1 / slot_rounder_p2 animated sprites)
  function drawCursorAt(index, playerId, forcedFi = null, baseFrameCountOverride = null) {
     const r = Math.floor(index / cols);
     const c = index % cols;
     const ix = gridX + c * (cellSize + cellGap);
     const iy = gridY + r * (cellSize + cellGap);
 
     push();
     noTint();
     imageMode(CORNER);
 
     // choose the rounder asset based on playerId ('p1' or 'p2')
     let framesArr = null;
     try {
       if (_slotAssets) {
         const res = (playerId === 'p1') ? _slotAssets.rounderP1
                   : (playerId === 'p2') ? _slotAssets.rounderP2
                   : null;
         if (res && Array.isArray(res)) {
           // pick first non-empty layer (the loader returns layers[] = frames[])
           const layer = res.find(l => Array.isArray(l) && l.length > 0);
           if (layer && layer.length > 0) framesArr = layer;
         }
       }
     } catch (e) { framesArr = null; }
 
     if (framesArr && framesArr.length > 0) {
      // animate at high speed (allow forcedFi / override when caller wants precise sync)
      const frameMs = 36; // normal cursor FPS (can be overridden by caller)
 
      // Determine logical frame count:
      let baseFrameCount = baseFrameCountOverride || Math.max(1, framesArr.length);
      const sheetCandidate = framesArr[0];
      if (baseFrameCount === 1 && sheetCandidate && sheetCandidate.width && sheetCandidate.height) {
        const internal = Math.max(1, Math.round(sheetCandidate.width / sheetCandidate.height));
        baseFrameCount = internal;
      }
 
      // compute frame index (allow caller to force it)
      let fi = (typeof forcedFi === 'number') ? (forcedFi % baseFrameCount) : (Math.floor(millis() / frameMs) % baseFrameCount);
      // if P2 and we don't have a forced index, offset start by half to desync visual when drawn alone
      if (playerId === 'p2' && forcedFi === null) {
        const halfOffset = Math.floor(baseFrameCount / 2);
        fi = (fi + halfOffset) % baseFrameCount;
      }
 
      const candidate = (framesArr[fi]) ? framesArr[fi] : framesArr[0];
 
       // compute drawing rect (slightly larger than the slot to act like a border/ring)
       const pad = 6;
       const dx = Math.round(ix - pad);
       const dy = Math.round(iy - pad);
       const dw = Math.round(cellSize + pad * 2);
       const dh = Math.round(cellSize + pad * 2);
 
       if (candidate && candidate.width && candidate.height) {
         // If candidate itself is a spritesheet (width >= height * N), slice subframe.
         // Determine internal frame count inside this image.
         const internalFrames = Math.max(1, Math.round(candidate.width / candidate.height));
         if (internalFrames > 1) {
           // If framesArr had multiple entries, internalFrames may still be >1 (handle robustly)
           // Use fi modulo internalFrames to pick subframe.
           const subIndex = fi % internalFrames;
           const srcW = Math.round(candidate.width / internalFrames);
           const srcX = Math.round(subIndex * srcW);
           image(candidate, dx, dy, dw, dh, srcX, 0, srcW, candidate.height);
         } else {
           // simple single-frame image
           image(candidate, dx, dy, dw, dh, 0, 0, candidate.width, candidate.height);
         }
       } else {
         // fallback border
         noFill();
         stroke(playerId === 'p1' ? color(80,150,255) : color(255,80,80));
         strokeWeight(4);
         rect(ix - 4, iy - 4, cellSize + 8, cellSize + 8, 8);
       }
     } else {
       // fallback: legacy rect border using player colour
       noFill();
       stroke(playerId === 'p1' ? color(80,150,255) : color(255,80,80));
       strokeWeight(4);
       rect(ix - 4, iy - 4, cellSize + 8, cellSize + 8, 8);
     }
 
     pop();
   }
 
  // Si ambos cursores están sobre la misma celda y NINGUNO confirmó, dibujar alternancia rápida entre P1/P2
  if (!p1Confirmed && !p2Confirmed && p1SelIndex === p2SelIndex) {
    // Joint-slot fast alternation: much faster and frame-synced so visuals don't "cut".
    const jointFrameMs = 18;      // much faster frame step for joint mode
    const alternationMs = 90;     // alternate which player is shown every 90ms

    // load both frame arrays to compute a common baseFrameCount
    const p1Frames = (_slotAssets?.rounderP1 || []).find(l => Array.isArray(l) && l.length > 0) || [];
    const p2Frames = (_slotAssets?.rounderP2 || []).find(l => Array.isArray(l) && l.length > 0) || [];
    let baseCount = Math.max(1, p1Frames.length || 0, p2Frames.length || 0);
    // if only a single sheet exists, detect internal frames by width/height
    if (baseCount === 1) {
      const cand = p1Frames[0] || p2Frames[0];
      if (cand && cand.width && cand.height) baseCount = Math.max(1, Math.round(cand.width / cand.height));
    }

    const jointFi = Math.floor(millis() / jointFrameMs) % baseCount;
    const showP1 = Math.floor(millis() / alternationMs) % 2 === 0;
    drawCursorAt(p1SelIndex, showP1 ? 'p1' : 'p2', jointFi, baseCount);
  } else {
    // dibujar únicamente los cursores de los jugadores que NO han confirmado aún (modo normal)
    if (!p1Confirmed) drawCursorAt(p1SelIndex, 'p1');
    if (!p2Confirmed) drawCursorAt(p2SelIndex, 'p2');
  }

  // confirmations overlay
  if (p1Confirmed) {
    push();
    fill(80,150,255,40);
    rect(gridX, gridY + gridH + 12, gridW, 28, 6);
    fill(220);
    textSize(12);
    textAlign(LEFT, CENTER);
    text("Jugador 1: CONFIRMADO", gridX + 8, gridY + gridH + 26);
    pop();
  }
  if (p2Confirmed) {
    push();
    fill(255,80,80,40);
    rect(gridX, gridY + gridH + 44, gridW, 28, 6);
    fill(220);
    textSize(12);
    textAlign(LEFT, CENTER);
    text("Jugador 2: CONFIRMADO", gridX + 8, gridY + gridH + 58);
    pop();
  }

  // footer hint
  push();
  fill(180);
  textSize(12);
  textAlign(CENTER, TOP);
  text("P1: A/D/W/S mover, I confirmar.  P2: ←/→/↑/↓ mover, B confirmar.", width/2, gridY + gridH + 96);
  pop();
}

function handleSelectionInput() {
  // --- P1 movement (A/D/W/S) ---
  if (keysPressed['a'] || keysPressed['a']) {
    // left
    if ((keysPressed['a'])) {
      const cols = 3;
      const c = p1SelIndex % cols;
      const r = Math.floor(p1SelIndex / cols);
      if (c > 0) p1SelIndex = r * cols + (c - 1);
      keysPressed['a'] = false;
    }
  }
  if (keysPressed['d'] || keysPressed['d']) {
    if ((keysPressed['d'])) {
      const cols = 3;
      const c = p1SelIndex % cols;
      const r = Math.floor(p1SelIndex / cols);
      if (c < cols - 1) p1SelIndex = r * cols + (c + 1);
      keysPressed['d'] = false;
    }
  }
  if (keysPressed['w']) {
    const cols = 3;
    const c = p1SelIndex % cols;
    const r = Math.floor(p1SelIndex / cols);
    if (r > 0) p1SelIndex = (r - 1) * cols + c;
    keysPressed['w'] = false;
  }
  if (keysPressed['s']) {
    const cols = 3, rows = 2;
    const c = p1SelIndex % cols;
    const r = Math.floor(p1SelIndex / cols);
    if (r < rows - 1) p1SelIndex = (r + 1) * cols + c;
    keysPressed['s'] = false;
  }

  // P1 confirm (only if pointing to a valid character slot)
  if (!p1Confirmed && (keysPressed['i'] || keysPressed[' '])) {
    if (p1SelIndex < choices.length) {
      p1Choice = p1SelIndex;
      p1Confirmed = true;
    }
    keysPressed['i'] = false; keysPressed[' '] = false;
  }

  // --- P2 movement (arrow keys) ---
  if (keysPressed['arrowleft']) {
    const cols = 3;
    const c = p2SelIndex % cols;
    const r = Math.floor(p2SelIndex / cols);
    if (c > 0) p2SelIndex = r * cols + (c - 1);
    keysPressed['arrowleft'] = false;
  }
  if (keysPressed['arrowright']) {
    const cols = 3;
    const c = p2SelIndex % cols;
    const r = Math.floor(p2SelIndex / cols);
    if (c < cols - 1) p2SelIndex = r * cols + (c + 1);
    keysPressed['arrowright'] = false;
  }
  if (keysPressed['arrowup']) {
    const cols = 3;
    const c = p2SelIndex % cols;
    const r = Math.floor(p2SelIndex / cols);
    if (r > 0) p2SelIndex = (r - 1) * cols + c;
    keysPressed['arrowup'] = false;
  }
  if (keysPressed['arrowdown']) {
    const cols = 3, rows = 2;
    const c = p2SelIndex % cols;
    const r = Math.floor(p2SelIndex / cols);
    if (r < rows - 1) p2SelIndex = (r + 1) * cols + c;
    keysPressed['arrowdown'] = false;
  }

  // P2 confirm (only if pointing to a valid character slot)
  if (!p2Confirmed && (keysPressed['b'] || keysPressed['backspace'])) {
    if (p2SelIndex < choices.length) {
      p2Choice = p2SelIndex;
      p2Confirmed = true;
    }
    keysPressed['b'] = false; keysPressed['backspace'] = false;
  }
}

let pauseStartTime = 0;
let totalPausedTime = 0;

function compensatePauseTimers(dt) {
  // Compensar timers de los jugadores
  [player1, player2].forEach(p => {
    if (!p || typeof dt !== 'number' || dt <= 0) return;
    try {
      // tiempos de ataques/efectos
      if (typeof p.attackStartTime === 'number') p.attackStartTime += dt;
      if (typeof p.hitStartTime === 'number') p.hitStartTime += dt;
      if (typeof p.blockStunStartTime === 'number') p.blockStunStartTime += dt;
      if (typeof p._supersaltoStart === 'number') p._supersaltoStart += dt;
      if (typeof p.dashStartTime === 'number') p.dashStartTime += dt;
      if (typeof p.dashLightStart === 'number') p.dashLightStart += dt;
      if (typeof p._launchedStart === 'number') p._launchedStart += dt;
      if (typeof p._staminaLastRegen === 'number') p._staminaLastRegen += dt;
      if (typeof p._staminaRegenLastTime === 'number') p._staminaRegenLastTime += dt;
      if (typeof p._staminaConsumedAt === 'number') p._staminaConsumedAt += dt;
      // dashLight frozen metadata (if any)
      if (p._dashLightFrozen && typeof p._dashLightFrozen.pauseAt === 'number') {
        p._dashLightFrozen.pauseAt += dt;
      }
    } catch (e) {
      /* ignore per-player compensation errors */
    }
  });

  // Compensar timers de los proyectiles
  projectiles.forEach(proj => {
    if (!proj || typeof dt !== 'number' || dt <= 0) return;
    try {
      if (typeof proj._lastUpdate === 'number') proj._lastUpdate += dt;
      if (typeof proj._spawnTimer === 'number') proj._spawnTimer += dt;
      if (typeof proj.spawnedAt === 'number') proj.spawnedAt += dt;
      if (typeof proj.age === 'number') proj.age += dt;
    } catch (e) {
      /* ignore per-projectile compensation errors */
    }
  });
}

function _respawnPlayer(player) {
  if (!player) return;
  player.hp = player.hpMax || 24;
  player.stamina = player.staminaMax ?? player.stamina;
  player.alive = true;
  player.attacking = false;
  player.attackType = null;
  player.isHit = false;
  player._hitTargets = null;
  player.vx = 0; player.vy = 0;
  player.x = (typeof player.startX === 'number') ? player.startX : (player.id === 'p1' ? 100 : 600);
  player.y = height - 72;
  try { if (typeof player.setState === 'function') player.setState('idle'); } catch (e) {}
  // clear transient flags (delete only properties)
  delete player._knockback;
  delete player._pendingKnockback;
  delete player._forceKnocked;
  delete player._launched;
  delete player._launchedStart;
  delete player._launchedDuration;
  delete player._grabLock;
  delete player._grabHolding;
  delete player._grabVictimOffsetX;
  // reset life tokens
  player._lifeProcessing = false;
  player._lifeHandled = false;
}

// Reemplazar bloque roto por una función consistente para manejo de pérdida de vida
function handlePlayerLifeLost(player) {
  if (!player) return;
  if (player._lifeProcessing) return;
  player._lifeProcessing = true;

  player.lives = Math.max(0, (typeof player.lives === 'number' ? player.lives : player.livesMax) - 1);

  // aplicar visual knocked inmediatamente
  try {
    if (typeof forceSetState === 'function') forceSetState(player, 'knocked');
    else if (typeof player.setState === 'function') player.setState('knocked');
  } catch (e) {}

  if (player.lives > 0) {
    const respawnDelay = 700;
    setTimeout(() => {
      try { _respawnPlayer(player); } catch (e) {}
      try { if (player.opponent) _respawnPlayer(player.opponent); } catch (e) {}
      player._lifeProcessing = false;
    }, respawnDelay);
    return;
  }

  // sin vidas: match over
  MATCH_OVER = true;
  MATCH_WINNER = (player.id === 'p1') ? 'p2' : 'p1';
  window.MATCH_OVER = MATCH_OVER;
  window.MATCH_WINNER = MATCH_WINNER;

  // inicializar menú y prevenir input instantáneo
  _matchMenu.idx = 0;
  _matchMenu.lastInputAt = millis();
  _matchMenu.active = true;
  try {
    if (typeof keysPressed !== 'undefined') {
      keysPressed['i'] = keysPressed['o'] = keysPressed['b'] = keysPressed['n'] = false;
    }
  } catch (e) {}
}

function draw() {
  // allow toggling the stage editor immediately (works even during selection/screens)
  if (typeof keysPressed !== 'undefined' && keysPressed['4']) {
    setStageEditorActive(!isStageEditorActive());
    keysPressed['4'] = false;
  }

  // si estamos en pantalla de selección, manejarla primero
  if (selectionActive) {
    handleSelectionInput();
    drawCharacterSelect();
    // Draw stage editor if active during selection
    if (isStageEditorActive()) {
      drawStageEditor({ x: 0, y: 0, zoom: 1 });
    }
    // si ambos confirmaron, crear jugadores
    tryCreatePlayers();
    // limpiar flags y retornar (no ejecutar game loop aún)
    clearFrameFlags();
    return;
  }

  // esperar a que los players y assets estén listos
  if (!playersReady || !player1 || !player2) {
    // Si el editor/picker está abierto queremos seguir dibujándolo
    if (typeof isStageEditorActive === 'function' && isStageEditorActive()) {
      try {
        // drawStageEditor debe estar importado en este archivo (se hizo antes)
        if (typeof drawStageEditor === 'function') drawStageEditor(cam);
      } catch (e) { console.warn('stage editor draw failed while waiting players', e); }
      // limpiar flags de teclado para evitar input persistente
      clearFrameFlags();
      return;
    }
    // comportamiento original: mostrar estado de carga o esperar
    // (mantén aquí tu lógica previa de "waiting for assets/players" visual)
    background(0);
    fill(255);
    textSize(20);
    textAlign(CENTER, CENTER);
    text("Cargando animaciones...", width / 2, height / 2);
    // sincronizar bandera PAUSED por si se consultara antes
    window.PAUSED = PAUSED;
    clearFrameFlags();
    return;
  }

  // SHORT-CIRCUIT: Si hay hitstop frame-freeze activo, dibujar la captura y terminar el frame
  try {
    if (typeof drawFrozenHitstop === 'function' && drawFrozenHitstop()) {
      // avanzar lógica mínima DURANTE hitstop para que el knockback mueva al golpeado
      try {
        if (player1 && typeof player1.updateDuringHitstop === 'function') player1.updateDuringHitstop();
        if (player2 && typeof player2.updateDuringHitstop === 'function') player2.updateDuringHitstop();

        // actualizar proyectiles mínimo (si quieres que sigan moviéndose durante hitstop)
        for (let i = projectiles.length - 1; i >= 0; i--) {
          const p = projectiles[i];
          if (p && typeof p.update === 'function') p.update();
        }
      } catch (e) {
        // no romper el frame por errores en la lógica de hitstop
        console.warn('[hitstop] updateDuringHitstop error', e);
      }
      clearFrameFlags();
      return;
    }
  } catch (e) {
    // si falla, continuar normalmente (no romper el loop)
  }

  // sincronizar variable global para que otros módulos la lean
  window.PAUSED = PAUSED;

  // --- Detect hitstop transitions to compensate timers when it ends ---
  // hsActive is computed below later in draw(), but we need to check its transition
  // compute current hitstop active state using public helper if available
  let hsActive = false;
  try {
    if (typeof isHitstopActive === 'function') hsActive = isHitstopActive();
  } catch (e) { hsActive = false; }

  if (hsActive && !_hsPrevActive) {
    // hitstop started now
    _hsStartedAt = millis();
  } else if (!hsActive && _hsPrevActive) {
    // hitstop ended -> compensate timers by the frozen duration
    const dur = Math.max(0, millis() - (_hsStartedAt || millis()));
    if (dur > 0) compensatePauseTimers(dur);
    _hsStartedAt = 0;
  }
  _hsPrevActive = hsActive;

  // --- Detect blockStun start to trigger a quick smooth zoom (no screenshake) ---
  // check both players and start a brief zoom when blockStun begins
  try {
    const p1BS = player1 && player1.state && (player1.state.current === 'blockStun' || player1.state.current === 'crouchBlockStun');
    const p2BS = player2 && player2.state && (player2.state.current === 'blockStun' || player2.state.current === 'crouchBlockStun');

    if (p1BS && !_prevBlockstun.p1) {
      _blockstunZoom.active = true;
      _blockstunZoom.start = millis();
      _blockstunZoom.playerId = player1.id;
      // optional: scale target by remaining HP to add drama when low HP
      _blockstunZoom.targetAdd = 0.14;
      _blockstunZoom.duration = 360;
    }
    if (p2BS && !_prevBlockstun.p2) {
      _blockstunZoom.active = true;
      _blockstunZoom.start = millis();
      _blockstunZoom.playerId = player2.id;
      _blockstunZoom.targetAdd = 0.14;
      _blockstunZoom.duration = 360;
    }

    _prevBlockstun.p1 = !!p1BS;
    _prevBlockstun.p2 = !!p2BS;
  } catch (e) {
    // ignore detection errors
  }

  // toggle debug overlays with '1' key (press 1 to toggle)
  if (typeof keysPressed !== 'undefined' && (keysPressed['1'] || keysPressed['Digit1'])) {
    window.SHOW_DEBUG_OVERLAYS = !window.SHOW_DEBUG_OVERLAYS;
    keysPressed['1'] = false; keysPressed['Digit1'] = false;
  }

  // Toggle Stage Editor with '4'
  
  
  // nota: asegúrate de que la variable hsActive usada mas abajo
  // para condicionales coincide con la que hemos calculado aquí:
  const hsActiveFinal = hsActive;
  // toggle PAUSA: P1 opens with Enter, P2 opens with Shift
  if (typeof keysPressed !== 'undefined') {
    if (keysPressed['enter']) {
      // open pause for P1
      PAUSED = true;
      window.PAUSED = true;
      try { openPauseFor('p1'); } catch (e) {}
      keysPressed['enter'] = false;
    }
    if (keysPressed['shift']) {
      // open pause for P2
      PAUSED = true;
      window.PAUSED = true;
      try { openPauseFor('p2'); } catch (e) {}
      keysPressed['shift'] = false;
    }
  }

  // if paused, route input to pause menu and draw it
  if (PAUSED) {
    try {
      handlePauseInput(keysPressed, { p1: player1, p2: player2 });
    } catch (e) { /* ignore pause input errors */ }
  }

  // inputs solo si no está en pausa
  if (!PAUSED) {
    if (player1 && typeof player1.handleInput === 'function') player1.handleInput();
    if (player2 && typeof player2.handleInput === 'function') player2.handleInput();
  }

  // detección de golpes solo si no está en pausa
  if (!PAUSED) {
    const isAttackerInFront = (attacker, defender) => {
      if (!attacker || !defender) return false;
      return (attacker.x > defender.x && defender.facing === 1) || (attacker.x < defender.x && defender.facing === -1);
    };

    if (player1 && typeof player1.attackHits === 'function' && player1.attackHits(player2)) {
      const atk = player1.attackType;
      // si es grab, attackHits ya aplicó grabbed; no ejecutar hit()
      if (atk === 'grab') {
        // ...existing grab handling...
      } else {
        // console.log('[HIT-DETECT] player1 hits player2', { attacker: 'p1', attackType: atk, p2_hp_before: player2.hp });
        // llamar al handler del defensor (esto ya debería restar 1 cuarto si es punch/kick)
        try { player2.hit(player1); } catch (e) { console.warn('player2.hit error', e); }
        // console.log('[HIT-DETECT] after hit player2 hp:', player2.hp);
        // ...existing hit response (apply knockback, hitstop, etc.)...
      }
    }

    if (player2 && typeof player2.attackHits === 'function' && player2.attackHits(player1)) {
      const atk = player2.attackType;
      if (atk === 'grab') {
        // ...existing grab handling...
      } else {
        // console.log('[HIT-DETECT] player2 hits player1', { attacker: 'p2', attackType: atk, p1_hp_before: player1.hp });
        try { player1.hit(player2); } catch (e) { console.warn('player1.hit error', e); }
        // console.log('[HIT-DETECT] after hit player1 hp:', player1.hp);
        // ...existing hit response...
      }
    }
   }
 
   // --- Si hay hitstop o pausa, evitamos updates de lógica ---
   const hsActiveCheck = hsActiveFinal;
   if (!hsActiveCheck && !PAUSED) {
    if (player1 && typeof player1.update === 'function') player1.update();
    if (player2 && typeof player2.update === 'function') player2.update();

    // proyectiles y colisiones
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (p && typeof p.update === 'function') p.update();

      if (p && !p.toRemove && typeof p.hits === 'function') {
        // colisión contra player1
        if (p.hits(player1) && p.ownerId !== player1.id) {
          if (!p._hitTargets) p._hitTargets = new Set();

          // SPECIAL: bun behavior (typeId 5) -> if hits and NOT blocked, attract opponent and start return
          if (p.typeId === 5) {
            if (!p._hitTargets.has(player1.id)) {
              const owner = (p.ownerId === player1.id) ? player1 : (p.ownerId === player2.id ? player2 : null);
              const attackerInFront = owner ? ((owner.x > player1.x && player1.facing === 1) || (owner.x < player1.x && player1.facing === -1)) : false;
              if (player1.blocking && attackerInFront) {
                // blocked: normal block reaction
                applyHitstop(30);
                const stunState = player1.crouching ? 'crouchBlockStun' : 'blockStun';
                player1.blockStunStartTime = millis();
                player1.blockStunDuration = player1.crouching
                  ? (player1.crouchBlockStunDuration || (player1.actions?.crouchBlockStun?.duration))
                  : (player1.blockStunDuration || (player1.actions?.blockStun?.duration));
                player1.setState && player1.setState(stunState);
                player1.vx = 0;
                if (!p.persistent) p.toRemove = true;
              } else {
                // successful hit by bun: apply attraction pull towards owner and trigger return
                applyHitstop(160);
                if (owner) {
                  const dx = (owner.x + owner.w/2) - (player1.x + player1.w/2);
                  const pullStrength = 0.12; // ajuste: fuerza de atracción
                  player1.vx = constrain(dx * pullStrength, -12, 12);
                  // ligera elevación para feel
                  player1.vy = Math.min(player1.vy, -2.2);
                }
                // mark projectile to return
                p.returning = true;
                p.dir = -p.dir;
                p._hitTargets.add(player1.id);
                // keep projectile to return (don't remove)
              }
            }
          } else {
            // existing logic for non-bun projectiles
            if (!p._hitTargets.has(player1.id)) {
              const owner = (p.ownerId === player1.id) ? player1 : (p.ownerId === player2.id ? player2 : null);
              const attackerInFront = owner ? ((owner.x > player1.x && player1.facing === 1) || (owner.x < player1.x && player1.facing === -1)) : false;
              if (player1.blocking && attackerInFront) {
                applyHitstop(30);
                // entrar en block-stun por proyectil bloqueado
                const stunState = player1.crouching ? 'crouchBlockStun' : 'blockStun';
                player1.blockStunStartTime = millis();
                player1.blockStunDuration = player1.crouching
                  ? (player1.crouchBlockStunDuration || (player1.actions?.crouchBlockStun?.duration))
                  : (player1.blockStunDuration || (player1.actions?.blockStun?.duration));
                player1.setState && player1.setState(stunState);
                player1.vx = 0;
                if (!p.persistent) p.toRemove = true;
              } else {
                player1.hit(owner);
                if (!p.persistent) p.toRemove = true;
              }
              p._hitTargets.add(player1.id);
            }
          }
        }
        // colisión contra player2
        if (p.hits(player2) && p.ownerId !== player2.id) {
          if (!p._hitTargets) p._hitTargets = new Set();

          if (p.typeId === 5) {
            if (!p._hitTargets.has(player2.id)) {
              const owner = (p.ownerId === player1.id) ? player1 : (p.ownerId === player2.id ? player2 : null);
              const attackerInFront = owner ? ((owner.x > player2.x && player2.facing === 1) || (owner.x < player2.x && player2.facing === -1)) : false;
              if (player2.blocking && attackerInFront) {
                applyHitstop(30);
                const stunState = player2.crouching ? 'crouchBlockStun' : 'blockStun';
                player2.blockStunStartTime = millis();
                player2.blockStunDuration = player2.crouching
                  ? (player2.crouchBlockStunDuration || (player2.actions?.crouchBlockStun?.duration))
                  : (player2.blockStunDuration || (player2.actions?.blockStun?.duration));
                player2.setState && player2.setState(stunState);
                player2.vx = 0;
                if (!p.persistent) p.toRemove = true;
              } else {
                applyHitstop(160);
                const ownerRef = (p.ownerId === player1.id) ? player1 : (p.ownerId === player2.id ? player2 : null);
                if (ownerRef) {
                  const dx = (ownerRef.x + ownerRef.w/2) - (player2.x + player2.w/2);
                  const pullStrength = 0.12;
                  player2.vx = constrain(dx * pullStrength, -12, 12);
                  player2.vy = Math.min(player2.vy, -2.2);
                }
                p.returning = true;
                p.dir = -p.dir;
                p._hitTargets.add(player2.id);
              }
            }
          } else {
            if (!p._hitTargets.has(player2.id)) {
              const owner = (p.ownerId === player1.id) ? player1 : (p.ownerId === player2.id ? player2 : null);
              const attackerInFront = owner ? ((owner.x > player2.x && player2.facing === 1) || (owner.x < player2.x && player2.facing === -1)) : false;
              if (player2.blocking && attackerInFront) {
                applyHitstop(30);
                const stunState = player2.crouching ? 'crouchBlockStun' : 'blockStun';
                player2.blockStunStartTime = millis();
                player2.blockStunDuration = player2.crouching
                  ? (player2.crouchBlockStunDuration || (player2.actions?.crouchBlockStun?.duration))
                  : (player2.blockStunDuration || (player2.actions?.blockStun?.duration));
                player2.setState && player2.setState(stunState);
                player2.vx = 0;
                if (!p.persistent) p.toRemove = true;
              } else {
                player2.hit(owner);
                if (!p.persistent) p.toRemove = true;
              }
              p._hitTargets.add(player2.id);
            }
          }
        }
      }

      if (p && (p.toRemove || (typeof p.offscreen === 'function' && p.offscreen()))) {
        projectiles.splice(i, 1);
      }
    }

    cam = updateCamera(player1, player2, cam);
  } else {
    // DURANTE HITSTOP: NO avanzar timers ni física — la sensación de "pause" es total.
    // (antes aquí se avanzaban timers mínimos; lo removimos para un freeze visual total)
    // No-op
  }

  // --- Detectar cambios de HP después de la lógica / colisiones ---
  // Al detectar pérdida de HP, usar frame-based hitstop (23 frames)
  if (player1) {
    if (_prevHp.p1 == null) {
      _prevHp.p1 = player1.hp;
    } else if (player1.hp < _prevHp.p1) {
      // usar frame-based hitstop calculado dinámicamente según vida restante
      const framesPerHit = computeFramesPerHitFor(player1);
      startDamageEffect(player1, _prevHp.p1 - player1.hp);
      try { if (typeof applyHitstopFrames === 'function') applyHitstopFrames(framesPerHit); else if (typeof applyHitstop === 'function') applyHitstop(Math.max(1, Math.round((framesPerHit / (frameRate ? Math.max(30, Math.round(frameRate())) : 60)) * 1000))); } catch (e) {}
    }
    _prevHp.p1 = player1.hp;
  }
  if (player2) {
    if (_prevHp.p2 == null) {
      _prevHp.p2 = player2.hp;
    } else if (player2.hp < _prevHp.p2) {
      const framesPerHit = computeFramesPerHitFor(player2);
      startDamageEffect(player2, _prevHp.p2 - player2.hp);
      try { if (typeof applyHitstopFrames === 'function') applyHitstopFrames(framesPerHit); else if (typeof applyHitstop === 'function') applyHitstop(Math.max(1, Math.round((framesPerHit / (frameRate ? Math.max(30, Math.round(frameRate())) : 60)) * 1000))); } catch (e) {}
    }
    _prevHp.p2 = player2.hp;
  }

  // render (siempre)
  push();
  // suavizar transición del zoom cuando se pausa/resume:
  // targetZoom = cam.zoom * 2 cuando PAUSED, o cam.zoom cuando no.
  const maxPauseZoom = 3;
  const pauseMultiplier = 2;
  const targetZoom = PAUSED ? Math.min((cam.zoom || 1) * pauseMultiplier, maxPauseZoom) : (cam.zoom || 1);

  // --- calcular shake + zoom add si hay efecto activo ---
  let shakeX = 0, shakeY = 0, zoomAdd = 0;
  if (_hitEffect && _hitEffect.active) {
    const now = millis();
    const elapsed = now - _hitEffect.start;
    if (elapsed >= _hitEffect.duration) {
      _hitEffect.active = false;
    } else {
      const t = Math.max(0, Math.min(1, elapsed / _hitEffect.duration));
      // ease out (strong at start, decay to 0)
      const ease = Math.sin((1 - t) * Math.PI / 2);
      const phase = now / 28;
      // combinar senos para sensación orgánica
      const xAmp = _hitEffect.mag * ease;
      const yAmp = _hitEffect.mag * 0.55 * ease;
      shakeX = (Math.sin(phase * 1.3) + Math.sin(phase * 0.67)) * xAmp * 0.45;
      shakeY = (Math.cos(phase * 1.1) + Math.cos(phase * 0.5)) * yAmp * 0.45;
      zoomAdd = _hitEffect.zoom * ease;
    }
  }

  // --- APPLY BLOCKSTUN ZOOM (smooth, NO screenshake) ---
  if (_blockstunZoom.active) {
    const bev = millis() - _blockstunZoom.start;
    if (bev >= (_blockstunZoom.duration || 0)) {
      _blockstunZoom.active = false;
    } else {
      // fast in, slower out easing
      const t = constrain(bev / (_blockstunZoom.duration || 1), 0, 1);
      // ease: fast ramp up, smooth ease-out
      const eased = 1 - Math.pow(1 - Math.min(1, t * 1.6), 3);
      zoomAdd += (_blockstunZoom.targetAdd || 0.14) * eased;
      // ensure no screenshake: do NOT modify shakeX/shakeY here
    }
  }

  // lerp suave hacia target (ajusta factor 0.08 para más/menos rapidez)
  appliedCamZoom = lerp(appliedCamZoom, targetZoom * (1 + zoomAdd), 0.08);
  // aplicar cámara usando el zoom suavizado + offset de screen-shake, sin modificar `cam` real
  applyCamera({ x: cam.x + shakeX, y: cam.y + shakeY, zoom: appliedCamZoom });
  drawBackground();

  // dibujar el piso del nivel (debe quedar debajo de los items)
  // push();
  // noStroke();
  // fill(80, 50, 20);
  // rect(0, height - 40, width, 40);
  // pop();

  // draw level items saved (always) so levels show even if editor is closed
  try {
    if (typeof drawSavedItems === 'function') {
      drawSavedItems({ x: cam.x + shakeX, y: cam.y + shakeY, zoom: appliedCamZoom });
    }
  } catch (e) {
    console.warn('drawSavedItems failed', e);
  }
  
  // Floor no longer drawn as solid. If debug overlay is active, show floor hitbox outline:
  if (typeof window !== 'undefined' && window.SHOW_DEBUG_OVERLAYS) {
    push();
    // camera is already applied here, so draw in world coords
    noFill();
    stroke(255, 160, 60);
    strokeWeight(2);
    rect(0, height - 40, width, 40);
    pop();
  }

  if (player1 && typeof player1.display === 'function') player1.display();
  if (player2 && typeof player2.display === 'function') player2.display();

  for (let i = 0; i < projectiles.length; i++) {
    const p = projectiles[i];
    if (p && typeof p.display === 'function') p.display();
  }

  // --- Mostrar hitboxes de proyectiles si está activado el overlay ---
  if (window.SHOW_DEBUG_OVERLAYS) {
    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      if (!p) continue;
      const hb = (typeof p.getHitbox === 'function') ? p.getHitbox() : null;
      if (hb) {
        push();
        noFill();
        stroke(0, 255, 255, 180); // color cian para distinguir
        strokeWeight(1.5);
        rect(hb.x, hb.y, hb.w, hb.h);
        pop();
      }
    }
  }

  pop();

  // --- NEW: if a frame-based hitstop was requested earlier, capture the just-rendered frame now ---
  try {
    if (typeof capturePendingHitstopSnapshot === 'function') {
      capturePendingHitstopSnapshot();
    }
  } catch (e) {
    // ignore capture errors, continue
  }

  // Mostrar un pequeño indicador cuando el overlay de debug (tecla '1') está activo.
  // El cuadradito se colorea en verde si hay hitstop activo, rojo en caso contrario.
  if (typeof window !== 'undefined' && window.SHOW_DEBUG_OVERLAYS) {
    try {
      push();
      const size = 12;
      const pad =118;
      const padX = 78;
      const hsActive = (typeof isHitstopActive === 'function') ? !!isHitstopActive() : !!window.HITSTOP_ACTIVE;
      // obtener ms restantes: preferir la función pública que calcula frames+tiempo,
      // si no existe o devuelve 0 usar el fallback global expuesto por hitstop.js
      let msLeft = 0;
      if (typeof remainingHitstopMs === 'function') {
        try { msLeft = Math.max(0, Math.round(remainingHitstopMs())); } catch (e) { msLeft = 0; }
      }
      if ((!msLeft || msLeft === 0) && typeof window !== 'undefined') {
        msLeft = Math.max(0, Math.round(window.HITSTOP_REMAINING_MS || 0));
      }

      noStroke();
      fill(hsActive ? color(80, 220, 120, 220) : color(220, 80, 80, 200));
      rect(pad, padX, size, size, 3);

      // pequeño borde
      stroke(0, 0, 0, 120);
      noFill();
      rect(pad, padX, size, size, 3);

      // escribir ms restantes a la derecha del cuadradito
      noStroke();
      fill(240);
      textSize(12);
      textAlign(LEFT, CENTER);
      text(`${msLeft}ms`, pad + size + 8, padX + size / 2);

      pop();
    } catch (e) {
      // no romper dibujado principal por errores del indicador
    }
  }

  // draw HUD - pasar fallback seguro si player1/player2 no están listos
  try {
    // ensure the HUD module function is available (import/namespace may vary)
    if (typeof drawOffscreenIndicators === 'function') {
      drawOffscreenIndicators(cam, [player1 || null, player2 || null]);
    } else if (window && typeof window.drawOffscreenIndicators === 'function') {
      window.drawOffscreenIndicators(cam, [player1 || null, player2 || null]);
    }
  } catch (e) { /* silent */ }

  drawHealthBars(player1 || null, player2 || null, _heartFrames, _bootFrames);
  drawInputQueues(player1 || { inputBuffer: [], inputBufferDuration:1400 }, player2 || { inputBuffer: [], inputBufferDuration:1400 });

  // draw stage editor overlay if active (screen & world aware) - ensure it's called after camera/pop
  try {
    if (typeof isStageEditorActive === 'function' && isStageEditorActive()) {
      drawStageEditor(cam);
    }
  } catch (e) {
    console.warn('stage editor draw failed', e);
  }

  // overlay de PAUSA: usar el menú personalizado (si PAUSED)
  if (PAUSED) {
    try {
      drawPauseMenu(player1, player2);
    } catch (e) {
      // fallback simple si falla el menú
      push();
      fill(255, 220);
      textSize(42);
      textAlign(CENTER, CENTER);
      text('PAUSA', width / 2, height / 2);
      pop();
    }
  }

  // suavizar la opacidad del HUD (0 = invisible, 1 = visible)
  const hudTarget = PAUSED ? 0 : 1;
  appliedHUDAlpha = lerp(appliedHUDAlpha, hudTarget, 0.12);

  // dim / fade overlay sobre el área del HUD para simular "fade out" de barras
  if (appliedHUDAlpha < 0.999) {
    push();
    noStroke();
    // ajusta rect height si tu HUD ocupa más/menos espacio
    const hudHeight = 60;
    // rellenar con negro semitransparente proporcional a la invisibilidad deseada
    const coverAlpha = Math.round((1 - appliedHUDAlpha) * 220);
    fill(0, coverAlpha);
    rect(0, 0, width, hudHeight);
    pop();
  }

  // --- life -> portrait transitions: poll HP and trigger life-loss handling ----
  try {
    if (player1 && typeof player1.hp === 'number' && player1.hp <= 0 && !MATCH_OVER) {
      if (!player1._lifeHandled) {
        player1._lifeHandled = true;
        handlePlayerLifeLost(player1);
      }
    } else if (player1 && typeof player1.hp === 'number' && player1.hp > 0) {
      player1._lifeHandled = false;
    }

    if (player2 && typeof player2.hp === 'number' && player2.hp <= 0 && !MATCH_OVER) {
      if (!player2._lifeHandled) {
        player2._lifeHandled = true;
        handlePlayerLifeLost(player2);
      }
    } else if (player2 && typeof player2.hp === 'number' && player2.hp > 0) {
      player2._lifeHandled = false;
    }
  } catch (e) {
    // defensive: don't break render on errors here
    console.warn('[life detect] error', e);
  }

  // If match over, draw overlay and accept rematch/return input with menu navigation
  if (MATCH_OVER) {
    _drawMatchOverOverlay(_matchMenu);

    // input handling with small debounce to avoid accidental immediate accept
    const now = millis();
    const canInput = (now - (_matchMenu.lastInputAt || 0)) >= (_matchMenu.debounceMs || 220);

    // navigation: P1 uses W/S, P2 uses arrowUp/arrowDown
    const up = !!( (canInput && typeof keysPressed !== 'undefined') && (keysPressed['w'] || keysPressed['arrowup']) );
    const down = !!( (canInput && typeof keysPressed !== 'undefined') && (keysPressed['s'] || keysPressed['arrowdown']) );

    if (up) {
      _matchMenu.idx = Math.max(0, (_matchMenu.idx || 0) - 1);
      _matchMenu.lastInputAt = now;
      if (keysPressed['w']) keysPressed['w'] = false;
      if (keysPressed['arrowup']) keysPressed['arrowup'] = false;
    } else if (down) {
      _matchMenu.idx = Math.min((_matchMenu.items.length - 1), (_matchMenu.idx || 0) + 1);
      _matchMenu.lastInputAt = now;
      if (keysPressed['s']) keysPressed['s'] = false;
      if (keysPressed['arrowdown']) keysPressed['arrowdown'] = false;
    }

    // selection: P1 (i/o), P2 (b/n) or Enter
    const selP1 = !!(canInput && typeof keysPressed !== 'undefined' && (keysPressed['i'] || keysPressed['o']));
    const selP2 = !!(canInput && typeof keysPressed !== 'undefined' && (keysPressed['b'] || keysPressed['n']));
    const selEnter = !!(canInput && typeof keysPressed !== 'undefined' && (keysPressed['enter'] || keysPressed[' ']));

    if (selP1 || selP2 || selEnter) {
      const choice = _matchMenu.items[_matchMenu.idx || 0] || 'Rematch';
      _matchMenu.lastInputAt = now;
      // consume select keys
      if (keysPressed['i']) keysPressed['i'] = false;
      if (keysPressed['o']) keysPressed['o'] = false;
      if (keysPressed['b']) keysPressed['b'] = false;
      if (keysPressed['n']) keysPressed['n'] = false;
      if (keysPressed['enter']) keysPressed['enter'] = false;
      if (keysPressed[' ']) keysPressed[' '] = false;

      if (choice === 'Rematch') {
        try {
          if (player1) {
            player1.lives = player1.livesMax || 2;
            _respawnPlayer(player1);
            player1._lifeProcessing = false;
            player1._lifeHandled = false;
          }
          if (player2) {
            player2.lives = player2.livesMax || 2;
            _respawnPlayer(player2);
            player2._lifeProcessing = false;
            player2._lifeHandled = false;
          }
          projectiles.length = 0;
          // central reset of match flags & menu
          clearMatchOverState();
        } catch (e) {}
      } else {
        // Character Select
        try {
          clearMatchOverState();
          resetToSelection();
        } catch (e) {}
      }
    }
  }

  clearFrameFlags();
}

// ---------- NEW: full reset helper to go back to character select ----------
function resetToSelection() {
  // Stop pause/hitstop and clear globals
  PAUSED = false;
  window.PAUSED = false;
  try { window.HITSTOP_ACTIVE = false; window.HITSTOP_PENDING = false; window.HITSTOP_REMAINING_MS = 0; } catch(e){}

  // Ensure match-over menu cleared as we leave gameplay
  clearMatchOverState();

 

  // clear players / projectiles / ready flag
  try { if (player1) { player1 = null; } } catch(e){}
  try { if (player2) { player2 = null; } } catch(e){}
  projectiles.length = 0;
  playersReady = false;
  selectionActive = true;

  // reset selection indexes & confirmations
  p1Confirmed = false; p2Confirmed = false;
  p1SelIndex = 0; p2SelIndex = 1;
  p1Choice = 0; p2Choice = 1;

  // reset camera / hud / effects
  cam = { x: 0, y: 0, zoom: 1 };
  appliedCamZoom = cam.zoom || 1;
  appliedHUDAlpha = 1;
  _hitEffect = { active: false, start: 0, end: 0, duration: 0, mag: 0, zoom: 0, targetPlayerId: null };
  _prevHp = { p1: null, p2: null };
  _hsPrevActive = false;
  _hsStartedAt = 0;
  _prevBlockstun = { p1: false, p2: false };
  _blockstunZoom = { active: false, start: 0, duration: 360, targetAdd: 0.16, playerId: null };

  // clear input flags (defensive)
  try {
    if (typeof keysPressed === 'object') for (const k in keysPressed) keysPressed[k] = false;
    if (typeof keysDown === 'object') for (const k in keysDown) keysDown[k] = false;
    if (typeof keysUp === 'object') for (const k in keysUp) keysUp[k] = false;
  } catch (e) {}

  // re-init input module without players
  try { initInput({ p1: null, p2: null, ready: false }); } catch (e) {}

  // clear any per-player HUD state maps (safe)
  try {
    if (typeof window !== 'undefined') {
      if (window._heartStateByPlayer && typeof window._heartStateByPlayer.clear === 'function') window._heartStateByPlayer.clear();
      if (window._bootStateByPlayer && typeof window._bootStateByPlayer.clear === 'function') window._bootStateByPlayer.clear();
    }
  } catch(e){}

  console.log('[RESET] returned to character select and fully reset state');
}
// ---------- end reset helper ----------

window.setup = setup;
window.draw = draw;
export { projectiles };
function _drawMatchOverOverlay(menu = null) {
  push();
  noStroke();
  fill(0, 200);
  rect(0, 0, width, height);

  const w = Math.min(520, width - 80);
  const h = 220;
  const x = (width - w) / 2;
  const y = (height - h) / 2;
  fill(28, 34, 42, 230);
  stroke(255, 28);
  rect(x, y, w, h, 8);

  noStroke();
  fill(255);
  textAlign(CENTER, TOP);
  textSize(28);
  text('MATCH OVER', x + w / 2, y + 12);

  textSize(18);
  const winnerLabel = MATCH_WINNER === 'p1' ? (player1?.charId || 'P1') : (MATCH_WINNER === 'p2' ? (player2?.charId || 'P2') : '—');
  text(`Winner: ${winnerLabel}`, x + w / 2, y + 56);

  // draw menu options (like pause menu) and highlight selected
  const items = (menu && Array.isArray(menu.items)) ? menu.items : ['Rematch','Character Select'];
  const selIdx = menu ? (menu.idx || 0) : 0;
  textSize(16);
  const menuX = x + w / 2;
  let menuY = y + 96;
  for (let i = 0; i < items.length; i++) {
    const ty = menuY + i * 36;
    if (i === selIdx) {
      fill(80,200,255);
      rect(x + 36, ty - 8, w - 72, 30, 6);
      fill(10);
    } else {
      fill(220);
    }
    textAlign(CENTER, CENTER);
    text(items[i], menuX, ty + 6);
  }

  textSize(12);
  fill(200);
  textAlign(CENTER, TOP);
  text('Navega con W/S (P1) o ↑/↓ (P2). Selecciona con I/O (P1) o B/N (P2).', x + w/2, y + h - 36);

  pop();
}
