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

async function setup() {
  createCanvas(800, 400);
  // bandera global para debug overlays (asegura valor por defecto)
  window.SHOW_DEBUG_OVERLAYS = window.SHOW_DEBUG_OVERLAYS || false;
  const tyeman = await loadTyemanAssets();
  const sbluer = await loadSbluerAssets();
  player1 = new Fighter({
    x: 100, col: color(255,100,100), id: 'p1', charId: 'tyeman',
    assets: tyeman,
    actions: {
      punch: { duration: 200, frameDelay: 1 }, /* override o extiende */
      // puedes añadir grab/throw actions aquí
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
    charId: 'sbluer',
    assets: sbluer,
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
}

function draw() {
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
          if (!p._hitTargets.has(player1.id)) {
            // determinar owner como attacker para evaluar front/block
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
        // colisión contra player2
        if (p.hits(player2) && p.ownerId !== player2.id) {
          if (!p._hitTargets) p._hitTargets = new Set();
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
