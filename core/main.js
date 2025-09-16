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
  // instalar listeners de input desde el inicio para que el menú detecte teclas
  initInput(); // <-- ADICIÓN

  // bandera global para debug overlays (asegura valor por defecto)
  window.SHOW_DEBUG_OVERLAYS = window.SHOW_DEBUG_OVERLAYS || false;
  // cargar assets pero NO crear players todavía — primero pantalla de selección
  _tyemanAssets = await loadTyemanAssets();
  _sbluerAssets = await loadSbluerAssets();

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

  player1 = new Fighter({
    x: 100, col: color(255,100,100), id: 'p1', charId: choices[p1Choice],
    assets: choices[p1Choice] === 'tyeman' ? tyeman : sbluer,
    actions: {
      punch: { duration: 200, frameDelay: 1 }, /* override o extiende */
      punch: { duration: 400, frameDelay: 4 },
      punch2: { duration: 400, frameDelay: 4 },
      punch3: { duration: 500, frameDelay: 6 },
      kick: { duration: 400, frameDelay: 7 },
      kick2: { duration: 400, frameDelay: 6 }
    }
  });

  player2 = new Fighter({
    x: 600,
    col: color(100,100,255),
    id: 'p2',
    charId: choices[p2Choice],
    assets: choices[p2Choice] === 'tyeman' ? tyeman : sbluer,
    actions: {
      // overrides para alargar ataques de sbluer
      punch: { duration: 700, frameDelay: 7 },
      punch2: { duration: 1000, frameDelay: 6 },
      punch3: { duration: 1000, frameDelay: 6 },
      kick: { duration: 700, frameDelay: 7 },
      kick2: { duration: 1000, frameDelay: 6 },
      kick3: { duration: 1000, frameDelay: 6 },
    }
  });

  // ajustar parámetros de movimiento de player2 para que corra/camine más lento que p1
  player2.maxSpeed = 2.4;      // velocidad de caminata
  player2.runMaxSpeed = 5.0;   // velocidad de correr
  player2.acceleration = 0.9;  // aceleración al andar
  player2.runAcceleration = 0.95; // aceleración al correr
  // opcional: ajustar fricción para cambiar sensación
  player2.friction = 0.12;
  player2.runFriction = 0.06;
  
  player1.opponent = player2;
  player2.opponent = player1;

  registerSpecialsForChar('tyeman', {
    // override o definiciones adicionales sólo para tyeman
    hadouken: { seq: ['↓','↘','→','P'], direction: 'forward' },
    bun: { seq: ['→','↓','↘','P'], direction: 'forward' },
    ty_tats: { seq: ['↓','↙','←','K'], direction: 'backward' },
    taunt: { seq: ['T'], direction: 'any' },
    supersalto: { seq: ['↓','↑'], direction: 'any' }
  });

  registerSpecialsForChar('sbluer', {
    // sbluer podría tener un special exclusivo (ejemplo)
    shoryuken: { seq: ['→','↓','↘','P'], direction: 'forward' },
    supersalto: { seq: ['↓','↑'], direction: 'any' },
    taunt: { seq: ['T'], direction: 'any' }
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
      // cell background
      noStroke();
      fill(18, 22, 30);
      rect(ix, iy, cellSize, cellSize, 6);

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

  // draw selection cursors (blue for p1, red for p2)
  function drawCursorAt(index, colr) {
    const r = Math.floor(index / cols);
    const c = index % cols;
    const ix = gridX + c * (cellSize + cellGap);
    const iy = gridY + r * (cellSize + cellGap);
    push();
    noFill();
    stroke(colr);
    strokeWeight(4);
    rect(ix - 4, iy - 4, cellSize + 8, cellSize + 8, 8);
    pop();
  }
 
  // Si ambos cursores están sobre la misma celda y NINGUNO confirmó, dibujar borde que parpadee entre azul y rojo.
  if (!p1Confirmed && !p2Confirmed && p1SelIndex === p2SelIndex) {
    const blinkMs = 300; // intervalo de cambio (ms)
    const blinkOn = Math.floor(millis() / blinkMs) % 2 === 0;
    const blinkColor = blinkOn ? color(80,150,255) : color(255,80,80);
    drawCursorAt(p1SelIndex, blinkColor);
  } else {
    // dibujar únicamente los cursores de los jugadores que NO han confirmado aún
    if (!p1Confirmed) drawCursorAt(p1SelIndex, color(80,150,255));
    if (!p2Confirmed) drawCursorAt(p2SelIndex, color(255,80,80));
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
      if (player2.blocking && isAttackerInFront(player1, player2)) {
        applyHitstop(240); // feedback corto por bloqueo
        // entrar en block-stun (usar crouchBlockStun si está agachado)
        const stunState = player2.crouching ? 'crouchBlockStun' : 'blockStun';
        player2.blockStunStartTime = millis();
        player2.blockStunDuration = player2.crouching
          ? (player2.crouchBlockStunDuration || (player2.actions?.crouchBlockStun?.duration))
          : (player2.blockStunDuration || (player2.actions?.blockStun?.duration));
        player2.setState && player2.setState(stunState);
        player2.vx = 0;
      } else {
        const atk = player1.attackType;
        const hs = (player1.actions && player1.actions[atk] && player1.actions[atk].hitstop) || 180;
        applyHitstop(hs);
        player2.hit(player1);
      }
    }

    if (player2 && typeof player2.attackHits === 'function' && player2.attackHits(player1)) {
      if (player1.blocking && isAttackerInFront(player2, player1)) {
        applyHitstop(240);
        const stunState = player1.crouching ? 'crouchBlockStun' : 'blockStun';
        player1.blockStunStartTime = millis();
        player1.blockStunDuration = player1.crouching
          ? (player1.crouchBlockStunDuration || (player1.actions?.crouchBlockStun?.duration))
          : (player1.blockStunDuration || (player1.actions?.blockStun?.duration));
        player1.setState && player1.setState(stunState);
        player1.vx = 0;
      } else {
        const atk = player2.attackType;
        const hs = (player2.actions && player2.actions[atk] && player2.actions[atk].hitstop) || 180;
        applyHitstop(hs);
        player1.hit(player2);
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

  drawHealthBars(player1, player2);
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
