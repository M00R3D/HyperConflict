// core/main.js
import { Fighter } from '../../entities/fighter.js';
import { Projectile } from '../../entities/projectile.js';
import { updateCamera, applyCamera } from './camera.js';
import { initInput, clearFrameFlags, keysPressed } from './input.js';
import { loadTyemanAssets, loadSbluerAssets } from './assetLoader.js';
import { drawInputQueues, drawHealthBars } from '../ui/hud.js';
import { drawBackground } from '../ui/background.js';
import { applyHitstop, isHitstopActive } from './hitstop.js';

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

  player1 = new Fighter(100, color(255, 100, 100), 'p1',
    tyeman.idle, tyeman.walk, tyeman.jump, tyeman.fall, tyeman.run,
    tyeman.punch, tyeman.punch2, tyeman.punch3,
    tyeman.kick, tyeman.kick2, tyeman.kick3,
    tyeman.crouch, tyeman.crouchWalk, tyeman.hit,
    tyeman.hit2, tyeman.hit3,
    tyeman.shoot, tyeman.projectile,
    tyeman.tats, // anim "tats" para el personaje
    tyeman.tatsProjFramesByLayer, // frames del proyectil tats
    tyeman.dashLight, // <-- nuevo parámetro para dash overlay
    tyeman.dash
  );

  player2 = new Fighter(600, color(100, 100, 255), 'p2',
    sbluer.idle, sbluer.walk, sbluer.jump, sbluer.fall, sbluer.run,
    sbluer.punch, sbluer.punch2, sbluer.punch3,
    sbluer.kick, sbluer.kick2, sbluer.kick3,
    sbluer.crouch, sbluer.crouchWalk, sbluer.hit,
    sbluer.hit2, sbluer.hit3,
    sbluer.shoot, sbluer.projectile,
    sbluer.tats, // personaje tats (puede ser null)
    sbluer.tatsProjFramesByLayer, // passthrough (may be null)
    sbluer.dashLight, // <-- nuevo parámetro para dash overlay
    sbluer.dash
  );

  player1.opponent = player2;
  player2.opponent = player1;

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
    if (player1 && typeof player1.attackHits === 'function' && player1.attackHits(player2)) {
      const atk = player1.attackType;
      const hs = (player1.actions && player1.actions[atk] && player1.actions[atk].hitstop) || 80;
      applyHitstop(hs);
      player2.hit(player1);
    }
    if (player2 && typeof player2.attackHits === 'function' && player2.attackHits(player1)) {
      const atk = player2.attackType;
      const hs = (player2.actions && player2.actions[atk] && player2.actions[atk].hitstop) || 80;
      applyHitstop(hs);
      player1.hit(player2);
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

      if (p && !p.toRemove && typeof p.hits === 'function' && p.hits(player1) && p.ownerId !== player1.id) {
        player1.hit();
        p.toRemove = true;
      } else if (p && !p.toRemove && typeof p.hits === 'function' && p.hits(player2) && p.ownerId !== player2.id) {
        player2.hit();
        p.toRemove = true;
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
