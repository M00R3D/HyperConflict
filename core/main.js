// core/main.js
import { Fighter } from '../../entities/fighter.js';
import { Projectile } from '../../entities/projectile.js';
import { updateCamera, applyCamera } from './camera.js';
import { initInput, clearFrameFlags, keysPressed } from './input.js';
import { loadTyemanAssets, loadSbluerAssets } from './assetLoader.js';
import { drawInputQueues, drawHealthBars } from '../ui/hud.js';
import { drawBackground } from '../ui/background.js';
import { applyHitstop, isHitstopActive } from './hitstop.js';
import { registerSpecialsForChar } from '../../entities/fighter/specials.js';
import { registerStatsForChar, registerActionsForChar, getStatsForChar, getActionsForChar } from './charConfig.js';

// --- REGISTRO DE STATS Y ACCIONES ---
registerStatsForChar('tyeman', {
  maxSpeed: 3,
  runMaxSpeed: 6,
  acceleration: 1.1,
  runAcceleration: 1.11,
  friction: 0.1,
  runFriction: 0.081
});
registerActionsForChar('tyeman', {
  punch: { duration: 400, frameDelay: 6 },
  punch2: { duration: 400, frameDelay: 6 },
  punch3: { duration: 800, frameDelay: 5 },
  kick: { duration: 400, frameDelay: 6 },
  kick2: { duration: 700, frameDelay: 6 },
  kick3: { duration: 1000, frameDelay: 6 },
  grab: { duration: 500, frameDelay: 3 }
});

registerStatsForChar('sbluer', {
  maxSpeed: 2.4,
  runMaxSpeed: 5.0,
  acceleration: 0.9,
  runAcceleration: 0.95,
  friction: 0.12,
  runFriction: 0.06
});
registerActionsForChar('sbluer', {
  punch: { duration: 700, frameDelay: 7 },
  punch2: { duration: 1000, frameDelay: 6 },
  punch3: { duration: 1000, frameDelay: 6 },
  kick: { duration: 700, frameDelay: 7 },
  kick2: { duration: 1000, frameDelay: 6 },
  kick3: { duration: 1000, frameDelay: 6 },
  grab: { duration: 500, frameDelay: 3 }
});

let player1, player2;
let projectiles = [];
let playersReady = false;
let cam = { x: 0, y: 0, zoom: 1 };
let PAUSED = false; // bandera de pausa (toggle con Enter)
// variable para suavizar el zoom aplicado en pantalla (no modifica `cam` real)
let appliedCamZoom = cam.zoom || 1;
// suavizado para HUD (0..1)
let appliedHUDAlpha = 1;
// exponer pausa globalmente para display.js
window.PAUSED = window.PAUSED || false;

// assets refs (llenadas en setup)
let _tyemanAssets = null;
let _sbluerAssets = null;
let _heartFrames = null;
let _slotAssets = null; // { empty, rounderP1, rounderP2 }
 
// character selection state
let selectionActive = false;
const choices = ['tyeman', 'sbluer'];
let p1Choice = 0; // index in choices (final chosen char index)
let p2Choice = 1;
let p1Confirmed = false;
let p2Confirmed = false;

// GRID selection state (3x2 matrix)
let p1SelIndex = 0; // 0..5 cursor pos for jugador1
let p2SelIndex = 1; // 0..5 cursor pos for jugador2

async function setup() {
  createCanvas(800, 400);
  // Force pixel-perfect rendering for pixel-art: disable smoothing and use 1:1 pixel density
  // (important on high-DPI displays and when scaling sprites)
  pixelDensity(1);
  noSmooth();
  if (typeof drawingContext !== 'undefined' && drawingContext) drawingContext.imageSmoothingEnabled = false;
  // instalar listeners de input desde el inicio para que el menú detecte teclas
  initInput(); // <-- ADICIÓN

  // mostrar hit/attack hitboxes en pantalla para debug (desactivar cuando confirmes)
  window.SHOW_DEBUG_OVERLAYS = true;

  // bandera global para debug overlays (asegura valor por defecto)
  window.SHOW_DEBUG_OVERLAYS = window.SHOW_DEBUG_OVERLAYS || false;
  // cargar assets pero NO crear players todavía — primero pantalla de selección
  _tyemanAssets = await loadTyemanAssets();
  _sbluerAssets = await loadSbluerAssets();
  // cargar assets de slots (pantalla de selección)
  try {
    _slotAssets = await loadSlotAssets();
    console.log('loadSlotAssets ->', _slotAssets);
  } catch (e) {
    _slotAssets = null;
    console.warn('loadSlotAssets failed', e);
  }
  // cargar frames del corazón (HUD)
  try {
    _heartFrames = await loadHeartFrames();
    console.log('loadHeartFrames ->', Array.isArray(_heartFrames) ? `${_heartFrames.length} layers` : _heartFrames);
    if (Array.isArray(_heartFrames)) {
      _heartFrames.forEach((layer, idx) => {
        console.log(`heart layer[${idx}] -> type: ${Array.isArray(layer) ? 'frames[]' : typeof layer}, frames: ${Array.isArray(layer) ? layer.length : 'n/a'}`);
      });
    }
  } catch (e) {
    _heartFrames = null;
    console.error('loadHeartFrames failed', e);
  }
  // iniciar pantalla de selección
  selectionActive = true;
  playersReady = false;
  // asegurar confirm flags iniciales
  p1Confirmed = false;
  p2Confirmed = false;
  p1Choice = 0;
  p2Choice = 1;
}

function tryCreatePlayers() {
  // sólo crear si ambos confirmaron
  if (!p1Confirmed || !p2Confirmed) return;

  // evitar crear dos veces
  if (player1 || player2) return;

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

  // ASIGNAR OPONENTES MUTUAMENTE PARA AUTO-FACING
  player1.opponent = player2;
  player2.opponent = player1;

  registerSpecialsForChar('tyeman', {
    // override o definiciones adicionales sólo para tyeman
    hadouken: { seq: ['↓','↘','→','P'], direction: 'forward' },
    bun: { seq: ['→','↓','↘','P'], direction: 'forward' },
    ty_tats: { seq: ['↓','↙','←','K'], direction: 'backward' },
    taunt: { seq: ['T'], direction: 'any' },
    supersalto: { seq: ['↓','↑'], direction: 'any' },
    grab: { seq: ['G'], direction: 'any' }
  });

  registerSpecialsForChar('sbluer', {
    // sbluer podría tener un special exclusivo (ejemplo)
    shoryuken: { seq: ['→','↓','↘','P'], direction: 'forward' },
    supersalto: { seq: ['↓','↑'], direction: 'any' },
    taunt: { seq: ['T'], direction: 'any' },
    grab: { seq: ['G'], direction: 'any' }
  });
  
  // asegurar facing inicial basado en la posición relativa (source of truth = Fighter.facing)
  player1.facing = (player1.x < player2.x) ? 1 : -1;
  player2.facing = (player2.x < player1.x) ? 1 : -1;

  initInput({ p1: player1, p2: player2, ready: true });
  playersReady = true;
  selectionActive = false;
}

function drawCharacterSelect() {
  background(12, 18, 28);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(28);
  text("Selecciona tu personaje", width/2, 48);

  // Grid configuration (3x2)
  const cols = 3;
  const rows = 2;
  const cellSize = 72;
  const cellGap = 12;
  const gridW = cols * cellSize + (cols - 1) * cellGap;
  const gridH = rows * cellSize + (rows - 1) * cellGap;
  const gridX = Math.round((width - gridW) / 2);
  const gridY = Math.round((height - gridH) / 2);

  // draw grid cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const ix = gridX + c * (cellSize + cellGap);
      const iy = gridY + r * (cellSize + cellGap);

      push();
      // cell background: intentar dibujar imagen de slot (estirada al tamaño de la celda).
      noStroke();
      // Siempre usar slot_empty.piskel como fondo del slot (estirado al tamaño de la celda).
      // Si no se cargó, caerá en el rectángulo redondeado legacy.
      let slotImg = null;
      try {
        if (_slotAssets && _slotAssets.empty) {
          const res = _slotAssets.empty;
          if (Array.isArray(res)) {
            const layer = res.find(l => Array.isArray(l) && l.length > 0);
            if (layer && layer.length > 0) slotImg = layer[0];
          }
        }
      } catch (e) { slotImg = null; }

      if (slotImg && slotImg.width && slotImg.height) {
        push();
        imageMode(CORNER);
        const dx = Math.round(ix);
        const dy = Math.round(iy);
        const dw = Math.round(cellSize);
        const dh = Math.round(cellSize);
        // estirar la imagen completa para cubrir la celda (src completa)
        image(slotImg, dx, dy, dw, dh, 0, 0, slotImg.width, slotImg.height);
        pop();
      } else {
        // fallback: rect redondeada si no hay imagen disponible
        fill(18, 22, 30);
        rect(ix, iy, cellSize, cellSize, 6);
      }

      // if this slot maps to a character (only first two slots)
      if (idx < choices.length) {
        const charId = choices[idx];
        const assets = (charId === 'tyeman') ? _tyemanAssets : _sbluerAssets;
        // use only second layer (index 1) if present, otherwise fallback to layer 0
        const idleLayer = (assets?.idle && assets.idle[1]) ? assets.idle[1] : (assets?.idle && assets.idle[0]) ? assets.idle[0] : null;
        const frameImg = (idleLayer && idleLayer.length) ? idleLayer[0] : null; // draw a single static frame

        if (frameImg) {
          imageMode(CENTER);
          // --- calcular ancho de un solo frame (srcFrameW) y mantener aspect ratio con respecto a ese frame ---
          const frameCount = (idleLayer && idleLayer.length) ? idleLayer.length : 1;
          const srcFrameW = Math.max(1, Math.floor(frameImg.width / frameCount));
          const srcFrameH = frameImg.height;
          const maxW = cellSize - 12;
          const maxH = cellSize - 12;
          const ratio = Math.min(maxW / srcFrameW, maxH / srcFrameH, 1);
          const dw = Math.round(srcFrameW * ratio);
          const dh = Math.round(srcFrameH * ratio);

          // dibujar sólo el primer frame (recortando source usando srcFrameW)
          image(
            frameImg,
            ix + cellSize/2, iy + cellSize/2,
            dw, dh,
            0, 0,
            srcFrameW, srcFrameH
          );
        } else {
          // placeholder
          fill(120);
          noStroke();
          ellipse(ix + cellSize/2, iy + cellSize/2, cellSize * 0.45);
        }

        // (Ningún nombre aquí — se dibuja debajo del taunt)
      } else {
        // empty slot placeholder
        push();
        noFill();
        stroke(80);
        strokeWeight(1);
        rect(ix + 6, iy + 6, cellSize - 12, cellSize - 12, 4);
        pop();
      }
      pop();
    }
  }

  // draw taunt sprite: one on left representing jugador1 selection, one on right for jugador2
  const baseTauntW = 56, baseTauntH = 56;
  // player1 taunt: show taunt of whatever character p1 currently has selected (if in first two slots)
  // si el jugador ya confirmó, usar su elección final (p1Choice/p2Choice),
  // si no, usar el cursor (p1SelIndex/p2SelIndex)
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

      // primer frame width
      const tCount = (tauntLayer && tauntLayer.length) ? tauntLayer.length : 1;
      const tSrcW = Math.max(1, Math.floor(tauntImg.width / tCount));
      const tSrcH = tauntImg.height;

      // mantener aspect ratio ajustando al "slot" baseTauntW/baseTauntH
      const tRatio = Math.min(baseTauntW / tSrcW, baseTauntH / tSrcH, 1);
      const tDrawW = Math.round(tSrcW * tRatio);
      const tDrawH = Math.round(tSrcH * tRatio);

      // calcular posición centrada dentro del area reservada a la izquierda
      const leftSlotX = gridX - baseTauntW - 18;
      const leftSlotY = gridY + Math.round((gridH - baseTauntH) / 2);

      const tauntDestX = leftSlotX + Math.round((baseTauntW - tDrawW) / 2);
      const tauntDestY = leftSlotY + Math.round((baseTauntH - tDrawH) / 2);

      image(tauntImg, tauntDestX, tauntDestY, tDrawW, tDrawH, 0, 0, tSrcW, tSrcH);

      // dibujar nombre debajo del taunt
      noTint();
      fill(220);
      textSize(12);
      textAlign(CENTER, TOP);
      text(charId.toUpperCase(), tauntDestX + tDrawW/2, tauntDestY + tDrawH + 6);

      pop();
    } else {
      // placeholder box + name
      push();
      noFill();
      stroke(120);
      rect(gridX - baseTauntW - 18, gridY + Math.round((gridH - baseTauntH) / 2), baseTauntW, baseTauntH, 6);
      fill(220);
      textSize(12);
      textAlign(CENTER, TOP);
      text(choices[p1SelectedIdx].toUpperCase(), gridX - baseTauntW - 18 + baseTauntW/2, gridY + Math.round((gridH - baseTauntH) / 2) + baseTauntH + 6);
      pop();
    }
  }

  // player2 taunt (derecha)
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
    if (!p) return;
    if (typeof p.attackStartTime === 'number') p.attackStartTime += dt;
    if (typeof p.hitStartTime === 'number') p.hitStartTime += dt;
    if (typeof p.blockStunStartTime === 'number') p.blockStunStartTime += dt;
    if (typeof p._supersaltoStart === 'number') p._supersaltoStart += dt;
    if (typeof p.dashStartTime === 'number') p.dashStartTime += dt;
    if (typeof p.dashLightStart === 'number') p.dashLightStart += dt;
    // Si tienes otros timers personalizados, agrégalos aquí
  });

  // Compensar timers de los proyectiles
  projectiles.forEach(proj => {
    if (!proj) return;
    if (typeof proj._lastUpdate === 'number') proj._lastUpdate += dt;
    if (typeof proj._spawnTimer === 'number') proj._spawnTimer += dt;
    if (typeof proj.spawnedAt === 'number') proj.spawnedAt += dt;
    if (typeof proj.age === 'number') proj.age += dt;
    // Si tienes otros timers personalizados, agrégalos aquí
  });
}

function draw() {
  // si estamos en pantalla de selección, manejarla primero
  if (selectionActive) {
    handleSelectionInput();
    drawCharacterSelect();
    // si ambos confirmaron, crear jugadores
    tryCreatePlayers();
    // limpiar flags y retornar (no ejecutar game loop aún)
    clearFrameFlags();
    return;
  }

  // esperar a que los players y assets estén listos
  if (!playersReady || !player1 || !player2) {
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

   // sincronizar variable global para que otros módulos la lean
   window.PAUSED = PAUSED;

  // toggle debug overlays with '1' key (press 1 to toggle)
  if (typeof keysPressed !== 'undefined' && (keysPressed['1'] || keysPressed['Digit1'])) {
    window.SHOW_DEBUG_OVERLAYS = !window.SHOW_DEBUG_OVERLAYS;
    // evita múltiples toggles por el mismo evento
    keysPressed['1'] = false;
    keysPressed['Digit1'] = false;
  }

  // toggle PAUSA con Enter
  if (typeof keysPressed !== 'undefined' && keysPressed['enter']) {
    if (!PAUSED) {
      // Se va a pausar
      pauseStartTime = millis();
    } else {
      // Se va a despausar
      const dt = millis() - pauseStartTime;
      totalPausedTime += dt;
      compensatePauseTimers(dt);
    }
    PAUSED = !PAUSED;
    keysPressed['enter'] = false;
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
        console.log('[HIT-DETECT] player1 hits player2', { attacker: 'p1', attackType: atk, p2_hp_before: player2.hp });
        // llamar al handler del defensor (esto ya debería restar 1 cuarto si es punch/kick)
        try { player2.hit(player1); } catch (e) { console.warn('player2.hit error', e); }
        console.log('[HIT-DETECT] after hit player2 hp:', player2.hp);
        // ...existing hit response (apply knockback, hitstop, etc.)...
      }
    }

    if (player2 && typeof player2.attackHits === 'function' && player2.attackHits(player1)) {
      const atk = player2.attackType;
      if (atk === 'grab') {
        // ...existing grab handling...
      } else {
        console.log('[HIT-DETECT] player2 hits player1', { attacker: 'p2', attackType: atk, p1_hp_before: player1.hp });
        try { player1.hit(player2); } catch (e) { console.warn('player1.hit error', e); }
        console.log('[HIT-DETECT] after hit player1 hp:', player1.hp);
        // ...existing hit response...
      }
    }
   }
 
   // Si hay hitstop o pausa, evitamos updates de lógica
   const hsActive = isHitstopActive();
   if (!hsActive && !PAUSED) {
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
    // durante hitstop avanzamos timers mínimos (si no está pausado)
    if (!PAUSED) {
      if (player1 && typeof player1.updateDuringHitstop === 'function') player1.updateDuringHitstop();
      if (player2 && typeof player2.updateDuringHitstop === 'function') player2.updateDuringHitstop();
    }
  }

  // render (siempre)
  push();
  // suavizar transición del zoom cuando se pausa/resume:
  // targetZoom = cam.zoom * 2 cuando PAUSED, o cam.zoom cuando no.
  const maxPauseZoom = 3;
  const pauseMultiplier = 2;
  const targetZoom = PAUSED ? Math.min((cam.zoom || 1) * pauseMultiplier, maxPauseZoom) : (cam.zoom || 1);
  // lerp suave hacia target (ajusta factor 0.08 para más/menos rapidez)
  appliedCamZoom = lerp(appliedCamZoom, targetZoom, 0.08);
  // aplicar cámara usando el zoom suavizado, sin modificar `cam` real
  applyCamera({ x: cam.x, y: cam.y, zoom: appliedCamZoom });
  drawBackground();

  fill(80, 50, 20);
  rect(0, height - 40, width, 40);

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

  drawHealthBars(player1, player2, _heartFrames);
  drawInputQueues(player1, player2);

  // overlay de PAUSA
  if (PAUSED) {
    push();
    fill(255, 220);
    textSize(42);
    textAlign(CENTER, CENTER);
    text('PAUSA', width / 2, height / 2);
    pop();
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

  clearFrameFlags();
}

window.setup = setup;
window.draw = draw;
export { projectiles };
