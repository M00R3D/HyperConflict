// core/main.js
import { Fighter } from '../../entities/fighter.js';import { Projectile } from '../../entities/projectile.js';
import { updateCamera, applyCamera } from './camera.js';import { initInput, keysPressed, clearFrameFlags, setPlayersReady, pollGamepads } from './input.js';import { loadTyemanAssets, loadSbluerAssets } from './assetLoader.js';import { drawInputQueues, drawHealthBars } from '../ui/hud.js';
import { drawBackground } from '../ui/background.js';import { applyHitstop, isHitstopActive } from './hitstop.js';import { registerSpecialsForChar } from '../entities/fighter/specials.js';import { registerStatsForChar, registerActionsForChar, getStatsForChar, getActionsForChar } from './charConfig.js';
import { initPauseMenu, handlePauseInput, drawPauseMenu, openPauseFor, closePause } from './pauseMenu.js';
import { registerAttackHitboxesForChar } from './hitboxConfig.js'; 
import { registerCharData, registerSpecials } from './registerCharData.js';
import{startDamageEffect,computeFramesPerHitFor} from './effectManager.js';
import { drawCharacterSelect, handleSelectionInput } from './selectionManager.js';

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
import { state as gameState, assignFrom as assignGameState } from './gameState.js';

import { handleHUDAndMatch, resetToSelection as _resetToSelection } from './hudAndMatch.js';
import { tryCreatePlayers, clearMatchOverState } from './lifecycle.js';

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


let _tyemanAssets = null;let _sbluerAssets = null;let _heartFrames = null;let _slotAssets = null;let _bootFrames = null;let selectionActive = false;
const choices = ['tyeman', 'sbluer'];let p1Choice = 0;
let p2Choice = 1;let p1Confirmed = false;let p2Confirmed = false;let p1SelIndex = 0;let p2SelIndex = 1;

// Populate the shared gameState module with initial values from main's locals
try {
  assignGameState({
    player1, player2, projectiles, playersReady, cam,
    PAUSED, appliedCamZoom, appliedHUDAlpha,
    MATCH_OVER, MATCH_WINNER, _matchMenu,
    MAX_HP_QUARTERS, _hitEffect, _prevHp,
    _hsPrevActive, _hsStartedAt, _prevBlockstun, _blockstunZoom,
    _tyemanAssets, _sbluerAssets, _heartFrames, _slotAssets, _bootFrames,
    selectionActive, choices, p1Choice, p2Choice, p1Confirmed, p2Confirmed, p1SelIndex, p2SelIndex
  });
} catch (e) { /* defensive: allow older runtimes during edit */ }
async function setup() {
  createCanvas(800, 400);pixelDensity(1);noSmooth();
  if (typeof drawingContext !== 'undefined' && drawingContext) drawingContext.imageSmoothingEnabled = false;
  initInput();
  // init pause menu with callbacks
  initPauseMenu({
    onResume: () => { PAUSED = false; window.PAUSED = false; },
    onReturnToCharSelect: () => {
      // use the centralized reset helper to fully restart selection state
      try { if (typeof _resetToSelection === 'function') _resetToSelection(); } catch(e) {}
    }
  });

  window.SHOW_DEBUG_OVERLAYS = true;window.SHOW_DEBUG_OVERLAYS = window.SHOW_DEBUG_OVERLAYS || false;
  _tyemanAssets = await loadTyemanAssets();_sbluerAssets = await loadSbluerAssets();
  // Exponer en window para que los módulos de UI/selection accedan (defensivo)
  if (typeof window !== 'undefined') {
    window._tyemanAssets = _tyemanAssets;
    window._sbluerAssets = _sbluerAssets;
  }
  console.log('[setup] assets loaded:', {
    tyeman: !!_tyemanAssets, sbluer: !!_sbluerAssets
  });
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
  // Sync newly loaded assets and selection state into shared gameState
  try {
    assignGameState({
      _tyemanAssets, _sbluerAssets, _heartFrames, _slotAssets, _bootFrames,
      selectionActive, playersReady, p1Confirmed, p2Confirmed, p1Choice, p2Choice
    });
  } catch (e) { /* ignore */ }
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
// clearMatchOverState moved to core/lifecycle.js

// tryCreatePlayers moved to core/lifecycle.js

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
  try { if (typeof pollGamepads === 'function') pollGamepads(); } catch (e) {}
  // Ensure we reflect any externally-created players/state from `gameState`
  try {
    player1 = (gameState && gameState.player1) ? gameState.player1 : player1;
    player2 = (gameState && gameState.player2) ? gameState.player2 : player2;
    projectiles = (gameState && Array.isArray(gameState.projectiles)) ? gameState.projectiles : projectiles;
    playersReady = (gameState && typeof gameState.playersReady !== 'undefined') ? gameState.playersReady : playersReady;
    selectionActive = (gameState && typeof gameState.selectionActive !== 'undefined') ? gameState.selectionActive : selectionActive;
    _prevHp = (gameState && gameState._prevHp) ? gameState._prevHp : _prevHp;
  } catch (e) {
    // non-fatal
  }
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
    try { tryCreatePlayers(); } catch(e) {}
    // sync locals from shared gameState in case lifecycle created players
    try {
      player1 = gameState.player1 || player1;
      player2 = gameState.player2 || player2;
      projectiles = gameState.projectiles || projectiles;
      playersReady = (typeof gameState.playersReady !== 'undefined') ? gameState.playersReady : playersReady;
      selectionActive = (typeof gameState.selectionActive !== 'undefined') ? gameState.selectionActive : selectionActive;
      _prevHp = gameState._prevHp || _prevHp;
    } catch(e) {}
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
      _hitEffect = startDamageEffect(player1, _prevHp.p1 - player1.hp);
      try { if (typeof applyHitstopFrames === 'function') applyHitstopFrames(framesPerHit); else if (typeof applyHitstop === 'function') applyHitstop(Math.max(1, Math.round((framesPerHit / (frameRate ? Math.max(30, Math.round(frameRate())) : 60)) * 1000))); } catch (e) {}
    }
    _prevHp.p1 = player1.hp;
  }
  if (player2) {
    if (_prevHp.p2 == null) {
      _prevHp.p2 = player2.hp;
    } else if (player2.hp < _prevHp.p2) {
      const framesPerHit = computeFramesPerHitFor(player2);
      _hitEffect = startDamageEffect(player2, _prevHp.p2 - player2.hp);
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

  // HUD & match handling (extracted into core/hudAndMatch.js)
  const __hudCtx = {
    PAUSED, appliedHUDAlpha, player1, player2, MATCH_OVER, MATCH_WINNER, _matchMenu,
    keysPressed: (typeof keysPressed !== 'undefined') ? keysPressed : {},
    keysDown: (typeof keysDown !== 'undefined') ? keysDown : {},
    keysUp: (typeof keysUp !== 'undefined') ? keysUp : {},
    projectiles,
    _respawnPlayer: (typeof _respawnPlayer !== 'undefined') ? _respawnPlayer : null,
    clearMatchOverState: (typeof clearMatchOverState !== 'undefined') ? clearMatchOverState : null,
    resetToSelectionFn: _resetToSelection,
    handlePlayerLifeLost: (typeof handlePlayerLifeLost !== 'undefined') ? handlePlayerLifeLost : null,
    initInput: (typeof initInput !== 'undefined') ? initInput : null,
    cam, appliedCamZoom, _hitEffect, _prevHp, _hsPrevActive, _hsStartedAt, _prevBlockstun, _blockstunZoom,
    playersReady, selectionActive, p1Confirmed, p2Confirmed, p1SelIndex, p2SelIndex, p1Choice, p2Choice,
    clearFrameFlags
  };
  handleHUDAndMatch(__hudCtx);
  // copy back mutated values
  appliedHUDAlpha = __hudCtx.appliedHUDAlpha;
  cam = __hudCtx.cam || cam;
  appliedCamZoom = __hudCtx.appliedCamZoom || appliedCamZoom;
  _hitEffect = __hudCtx._hitEffect || _hitEffect;
  _prevHp = __hudCtx._prevHp || _prevHp;
  _hsPrevActive = __hudCtx._hsPrevActive || _hsPrevActive;
  _hsStartedAt = __hudCtx._hsStartedAt || _hsStartedAt;
  _prevBlockstun = __hudCtx._prevBlockstun || _prevBlockstun;
  _blockstunZoom = __hudCtx._blockstunZoom || _blockstunZoom;
  playersReady = (__hudCtx.playersReady === undefined) ? playersReady : __hudCtx.playersReady;
  selectionActive = (__hudCtx.selectionActive === undefined) ? selectionActive : __hudCtx.selectionActive;
  p1Confirmed = (__hudCtx.p1Confirmed === undefined) ? p1Confirmed : __hudCtx.p1Confirmed;
  p2Confirmed = (__hudCtx.p2Confirmed === undefined) ? p2Confirmed : __hudCtx.p2Confirmed;
  p1SelIndex = (__hudCtx.p1SelIndex === undefined) ? p1SelIndex : __hudCtx.p1SelIndex;
  p2SelIndex = (__hudCtx.p2SelIndex === undefined) ? p2SelIndex : __hudCtx.p2SelIndex;
  p1Choice = (__hudCtx.p1Choice === undefined) ? p1Choice : __hudCtx.p1Choice;
  p2Choice = (__hudCtx.p2Choice === undefined) ? p2Choice : __hudCtx.p2Choice;
  projectiles = __hudCtx.projectiles || projectiles;
  player1 = __hudCtx.player1 || player1;
  player2 = __hudCtx.player2 || player2;
  if (typeof keysPressed !== 'undefined') Object.assign(keysPressed, __hudCtx.keysPressed || {});
  if (typeof keysDown !== 'undefined') Object.assign(keysDown, __hudCtx.keysDown || {});
  if (typeof keysUp !== 'undefined') Object.assign(keysUp, __hudCtx.keysUp || {});
  MATCH_OVER = (__hudCtx.MATCH_OVER === undefined) ? MATCH_OVER : __hudCtx.MATCH_OVER;

  // re-expose resetToSelection on window to preserve legacy callers
  try {
    if (typeof window !== 'undefined') {
      window.resetToSelection = function() {
        const ctx = Object.assign({}, __hudCtx, {
          player1,
          player2,
          projectiles,
          keysPressed: (typeof keysPressed !== 'undefined') ? keysPressed : {},
          keysDown: (typeof keysDown !== 'undefined') ? keysDown : {},
          keysUp: (typeof keysUp !== 'undefined') ? keysUp : {},
          clearMatchOverState: (typeof clearMatchOverState !== 'undefined') ? clearMatchOverState : null,
          initInput: (typeof initInput !== 'undefined') ? initInput : null
        });
        _resetToSelection(ctx);
        appliedHUDAlpha = ctx.appliedHUDAlpha;
        cam = ctx.cam || cam;
        appliedCamZoom = ctx.appliedCamZoom || appliedCamZoom;
        _hitEffect = ctx._hitEffect || _hitEffect;
        _prevHp = ctx._prevHp || _prevHp;
        _hsPrevActive = ctx._hsPrevActive || _hsPrevActive;
        _hsStartedAt = ctx._hsStartedAt || _hsStartedAt;
        _prevBlockstun = ctx._prevBlockstun || _prevBlockstun;
        _blockstunZoom = ctx._blockstunZoom || _blockstunZoom;
        playersReady = (ctx.playersReady === undefined) ? playersReady : ctx.playersReady;
        selectionActive = (ctx.selectionActive === undefined) ? selectionActive : ctx.selectionActive;
        p1Confirmed = (ctx.p1Confirmed === undefined) ? p1Confirmed : ctx.p1Confirmed;
        p2Confirmed = (ctx.p2Confirmed === undefined) ? p2Confirmed : ctx.p2Confirmed;
        p1SelIndex = (ctx.p1SelIndex === undefined) ? p1SelIndex : ctx.p1SelIndex;
        p2SelIndex = (ctx.p2SelIndex === undefined) ? p2SelIndex : ctx.p2SelIndex;
        p1Choice = (ctx.p1Choice === undefined) ? p1Choice : ctx.p1Choice;
        p2Choice = (ctx.p2Choice === undefined) ? p2Choice : ctx.p2Choice;
        projectiles = ctx.projectiles || projectiles;
        player1 = ctx.player1 || player1;
        player2 = ctx.player2 || player2;
        if (typeof keysPressed !== 'undefined') Object.assign(keysPressed, ctx.keysPressed || {});
        if (typeof keysDown !== 'undefined') Object.assign(keysDown, ctx.keysDown || {});
        if (typeof keysUp !== 'undefined') Object.assign(keysUp, ctx.keysUp || {});
      };
    }
  } catch (e) {}

  // Sync main's local state back into the shared gameState module each frame
  try {
    // Only merge keys that are defined here to avoid clobbering values
    // (e.g. lifecycle may create players and set them on gameState while
    //  main's local vars are still undefined for a frame)
    const sync = {};
    if (typeof player1 !== 'undefined' && player1 !== null) sync.player1 = player1;
    if (typeof player2 !== 'undefined' && player2 !== null) sync.player2 = player2;
    if (typeof projectiles !== 'undefined' && projectiles !== null) sync.projectiles = projectiles;
    if (typeof playersReady !== 'undefined') sync.playersReady = playersReady;
    if (typeof cam !== 'undefined' && cam !== null) sync.cam = cam;
    if (typeof PAUSED !== 'undefined') sync.PAUSED = PAUSED;
    if (typeof appliedCamZoom !== 'undefined') sync.appliedCamZoom = appliedCamZoom;
    if (typeof appliedHUDAlpha !== 'undefined') sync.appliedHUDAlpha = appliedHUDAlpha;
    if (typeof MATCH_OVER !== 'undefined') sync.MATCH_OVER = MATCH_OVER;
    if (typeof MATCH_WINNER !== 'undefined') sync.MATCH_WINNER = MATCH_WINNER;
    if (typeof _matchMenu !== 'undefined' && _matchMenu !== null) sync._matchMenu = _matchMenu;
    if (typeof _hitEffect !== 'undefined' && _hitEffect !== null) sync._hitEffect = _hitEffect;
    if (typeof _prevHp !== 'undefined' && _prevHp !== null) sync._prevHp = _prevHp;
    if (typeof _hsPrevActive !== 'undefined') sync._hsPrevActive = _hsPrevActive;
    if (typeof _hsStartedAt !== 'undefined') sync._hsStartedAt = _hsStartedAt;
    if (typeof _prevBlockstun !== 'undefined' && _prevBlockstun !== null) sync._prevBlockstun = _prevBlockstun;
    if (typeof _blockstunZoom !== 'undefined' && _blockstunZoom !== null) sync._blockstunZoom = _blockstunZoom;
    if (typeof _tyemanAssets !== 'undefined') sync._tyemanAssets = _tyemanAssets;
    if (typeof _sbluerAssets !== 'undefined') sync._sbluerAssets = _sbluerAssets;
    if (typeof _heartFrames !== 'undefined') sync._heartFrames = _heartFrames;
    if (typeof _slotAssets !== 'undefined') sync._slotAssets = _slotAssets;
    if (typeof _bootFrames !== 'undefined') sync._bootFrames = _bootFrames;
    if (typeof selectionActive !== 'undefined') sync.selectionActive = selectionActive;
    if (typeof choices !== 'undefined') sync.choices = choices;
    if (typeof p1Choice !== 'undefined') sync.p1Choice = p1Choice;
    if (typeof p2Choice !== 'undefined') sync.p2Choice = p2Choice;
    if (typeof p1Confirmed !== 'undefined') sync.p1Confirmed = p1Confirmed;
    if (typeof p2Confirmed !== 'undefined') sync.p2Confirmed = p2Confirmed;
    if (typeof p1SelIndex !== 'undefined') sync.p1SelIndex = p1SelIndex;
    if (typeof p2SelIndex !== 'undefined') sync.p2SelIndex = p2SelIndex;

    assignGameState(sync);
  } catch (e) { /* ignore sync errors */ }
}

// ---------- NEW: full reset helper to go back to character select ----------
// resetToSelection moved to core/hudAndMatch.js (use _resetToSelection)
// ---------- end reset helper ----------

window.setup = setup;
window.draw = draw;
export { projectiles };
// function _drawMatchOverOverlay(menu = null) {
//   push();
//   noStroke();
//   fill(0, 200);
//   rect(0, 0, width, height);

//   const w = Math.min(520, width - 80);
//   const h = 220;
//   const x = (width - w) / 2;
//   const y = (height - h) / 2;
//   fill(28, 34, 42, 230);
//   stroke(255, 28);
//   rect(x, y, w, h, 8);

//   noStroke();
//   fill(255);
//   textAlign(CENTER, TOP);
//   textSize(28);
//   text('MATCH OVER', x + w / 2, y + 12);

//   textSize(18);
//   const winnerLabel = MATCH_WINNER === 'p1' ? (player1?.charId || 'P1') : (MATCH_WINNER === 'p2' ? (player2?.charId || 'P2') : '—');
//   text(`Winner: ${winnerLabel}`, x + w / 2, y + 56);

//   // draw menu options (like pause menu) and highlight selected
//   const items = (menu && Array.isArray(menu.items)) ? menu.items : ['Rematch','Character Select'];
//   const selIdx = menu ? (menu.idx || 0) : 0;
//   textSize(16);
//   const menuX = x + w / 2;
//   let menuY = y + 96;
//   for (let i = 0; i < items.length; i++) {
//     const ty = menuY + i * 36;
//     if (i === selIdx) {
//       fill(80,200,255);
//       rect(x + 36, ty - 8, w - 72, 30, 6);
//       fill(10);
//     } else {
//       fill(220);
//     }
//     textAlign(CENTER, CENTER);
//     text(items[i], menuX, ty + 6);
//   }

//   textSize(12);
//   fill(200);
//   textAlign(CENTER, TOP);
//   text('Navega con W/S (P1) o ↑/↓ (P2). Selecciona con I/O (P1) o B/N (P2).', x + w/2, y + h - 36);

//   pop();
// }
