// core\main.js
import { Fighter } from '../../entities/fighter.js';
import { Projectile } from '../../entities/projectile.js';
import { loadPiskel } from './loader.js';
import { updateCamera, applyCamera } from './camera.js';

let player1, player2;
let projectiles = [];
let playersReady = false;
let cam = { x: 0, y: 0, zoom: 1 };

let keysDown = {};
let keysUp = {};
let keysPressed = {}; // 👈 nuevo

export { keysDown, keysUp, keysPressed, projectiles };

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (!keysDown[key]) {     // 👈 solo si estaba en false
    keysPressed[key] = true; // marcar como "just pressed"
  }
  keysDown[key] = true;
  keysUp[key] = false;
});

window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  keysDown[key] = false;
  keysUp[key] = true;
});
async function setup() {
  createCanvas(800, 400);

  const tyemanIdleLayers = await loadPiskel('src/tyeman/tyeman_idle.piskel');
  const tyemanWalkLayers = await loadPiskel('src/tyeman/tyeman_walk.piskel');
  const tyemanJumpLayers = await loadPiskel('src/tyeman/tyeman_jump.piskel');
  const tyemanFallLayers = await loadPiskel('src/tyeman/tyeman_fall.piskel');
  const tyemanRunLayers = await loadPiskel('src/tyeman/tyeman_run.piskel');
  const tyemanPunchLayers = await loadPiskel('src/tyeman/tyeman_punch.piskel');
  const tyemanPunch2Layers = await loadPiskel('src/tyeman/tyeman_punch_2.piskel');
  const tyemanPunch3Layers = await loadPiskel('src/tyeman/tyeman_punch_3.piskel');
  const tyemanKickLayers = await loadPiskel('src/tyeman/tyeman_kick.piskel');
  const tyemanCrouchLayers = await loadPiskel('src/tyeman/tyeman_crouch.piskel');
  const tyemanCrouchWalkLayers = await loadPiskel('src/tyeman/tyeman_crouch_walk.piskel');
  const tyemanHitLayers = await loadPiskel('src/tyeman/tyeman_hit.piskel');

  const sbluerIdleLayers = await loadPiskel('src/sbluer/sbluer_idle.piskel');
  const sbluerWalkLayers = await loadPiskel('src/sbluer/sbluer_walk.piskel');
  const sbluerJumpLayers = await loadPiskel('src/sbluer/sbluer_jump.piskel');
  const sbluerFallLayers = await loadPiskel('src/sbluer/sbluer_fall.piskel');
  const sbluerRunLayers = await loadPiskel('src/sbluer/sbluer_run.piskel');
  const sbluerPunchLayers = await loadPiskel('src/sbluer/sbluer_punch.piskel');
  const sbluerPunch2Layers = await loadPiskel('src/sbluer/sbluer_punch_2.piskel');
  const sbluerPunch3Layers = await loadPiskel('src/sbluer/sbluer_punch_3.piskel');
  const sbluerKickLayers = await loadPiskel('src/sbluer/sbluer_kick.piskel');
  const sbluerCrouchLayers = await loadPiskel('src/sbluer/sbluer_crouch.piskel');
  const sbluerCrouchWalkLayers = await loadPiskel('src/sbluer/sbluer_crouch_walk.piskel');
  const sbluerHitLayers = await loadPiskel('src/sbluer/sbluer_hit.piskel');
  
  player1 = new Fighter(100, color(255, 100, 100), 'p1',tyemanIdleLayers, tyemanWalkLayers, tyemanJumpLayers, tyemanFallLayers,tyemanRunLayers, tyemanPunchLayers,tyemanPunch2Layers,tyemanPunch3Layers, tyemanKickLayers, tyemanCrouchLayers, tyemanCrouchWalkLayers, tyemanHitLayers);
  player2 = new Fighter(600, color(100, 100, 255), 'p2',sbluerIdleLayers, sbluerWalkLayers, sbluerJumpLayers, sbluerFallLayers,sbluerRunLayers, sbluerPunchLayers,sbluerPunch2Layers,sbluerPunch3Layers, sbluerKickLayers, sbluerCrouchLayers, sbluerCrouchWalkLayers, sbluerHitLayers);

  // 🔹 Asignar oponentes para auto-facing
  player1.opponent = player2;
  player2.opponent = player1;
  playersReady = true;
}

function draw() {
  if (!playersReady) {
    background(0);
    fill(255);
    textSize(24);
    textAlign(CENTER, CENTER);
    text("Cargando animaciones...", width / 2, height / 2);
    return;
  }

  // Actualizar input y física
  player1.handleInput();
  player2.handleInput();

  if (player1.attackHits(player2)) player2.hit();
  if (player2.attackHits(player1)) player1.hit();

  player1.update();
  player2.update();
  projectiles.forEach(p => p.update());

  // Actualizar cámara
  cam = updateCamera(player1, player2, cam);

  // ------------------- MUNDO -------------------
  push();
  applyCamera(cam);  // Todo lo que se dibuja aquí se mueve con la cámara

  drawBackground();

  // Piso del mundo
  fill(80, 50, 20);
  rect(0, height - 40, width, 40);

  // Personajes
  player1.display();
  player2.display();

  // Proyectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    projectiles[i].display();
    if (projectiles[i].hits(player2)) player2.hit();
    if (projectiles[i].hits(player1)) player1.hit();
    if (projectiles[i].offscreen()) projectiles.splice(i, 1);
  }
  pop();  // FIN MUNDO

  // ------------------- HUD -------------------
  // Health bars y cualquier info en pantalla fija
  fill(255);
  textSize(20);
  drawHealthBars(player1, player2);
  for (let k in keysPressed) {
    keysPressed[k] = false;
  }
  for (let k in keysUp) {
    keysUp[k] = false;
  }

}


function keyPressed() {
  if (!playersReady) return;
  player1.handleInput();
  player2.handleInput();
}

function keyReleased() {
  if (!playersReady) return;
  player1.handleInput();
  player2.handleInput();
}
function drawHealthBars(p1, p2) {
  const barWidth = 200;
  const barHeight = 20;
  const xOffset = 20;
  const yOffset = 10;

  // ---- Función auxiliar para contorno wavy ----
  function drawWavyBorder(x, y, w, h) {
    noFill();
    stroke(0);
    strokeWeight(6);
    beginShape();
    for (let i = 0; i <= w; i += 5) {
      let offset = sin((i + frameCount * 5) * 0.2) * 2;
      vertex(x + i, y + offset); // borde superior
    }
    for (let i = 0; i <= h; i += 5) {
      let offset = cos((i + frameCount * 5) * 0.2) * 2;
      vertex(x + w + offset, y + i); // borde derecho
    }
    for (let i = w; i >= 0; i -= 5) {
      let offset = sin((i + frameCount * 5) * 0.2) * 2;
      vertex(x + i, y + h + offset); // borde inferior
    }
    for (let i = h; i >= 0; i -= 5) {
      let offset = cos((i + frameCount * 5) * 0.2) * 2;
      vertex(x + offset, y + i); // borde izquierdo
    }
    endShape(CLOSE);
  }

  // ---- Player 1 ----
  push();
  translate(xOffset, yOffset);
  noStroke();

  // Fondo infernal con gradiente dinámico
  for (let i = 0; i < barHeight; i++) {
    let fade = map(i, 0, barHeight, 0, 255);
    let r = 200 + 55 * sin(frameCount * 0.1 + i * 0.3);
    let g = 30 + 150 * sin(frameCount * 0.2 + i * 0.5);
    let b = 0 + 100 * cos(frameCount * 0.15 + i * 0.4);
    fill(r, g, b, fade);
    rect(0, i, barWidth, 1);
  }

  // Vida actual con llamas
  const p1HealthWidth = map(p1.hp, 0, 10, 0, barWidth);
  for (let i = 0; i < barHeight; i++) {
    let wave = sin(frameCount * 0.3 + i) * 2;
    let r = 255;
    let g = 50 + 205 * sin(frameCount * 0.1 + i);
    let b = 0;
    fill(r, g, b);
    rect(0, i + wave, p1HealthWidth, 1);
  }

  // Contorno wavy
  drawWavyBorder(0, 0, barWidth, barHeight);
  pop();

  // ---- Player 2 ----
  push();
  translate(width - xOffset - barWidth, yOffset);
  noStroke();

  // Fondo infernal dinámico invertido
  for (let i = 0; i < barHeight; i++) {
    let fade = map(i, 0, barHeight, 0, 255);
    let r = 180 + 75 * cos(frameCount * 0.1 + i * 0.2);
    let g = 0 + 180 * sin(frameCount * 0.15 + i * 0.4);
    let b = 20 + 100 * cos(frameCount * 0.2 + i * 0.3);
    fill(r, g, b, fade);
    rect(0, i, barWidth, 1);
  }

  // Vida actual
  const p2HealthWidth = map(p2.hp, 0, 10, 0, barWidth);
  for (let i = 0; i < barHeight; i++) {
    let wave = cos(frameCount * 0.25 + i) * 2;
    let r = 255;
    let g = 50 + 205 * cos(frameCount * 0.1 + i);
    let b = 0;
    fill(r, g, b);
    rect(barWidth - p2HealthWidth, i + wave, p2HealthWidth, 1);
  }

  // Contorno wavy
  drawWavyBorder(0, 0, barWidth, barHeight);
  pop();
}

function drawBackground() {
  // Definir colores clave
  const skyColors = [
    color(135, 206, 235), // celeste
    color(255, 140, 0),   // naranja atardecer
    color(0, 0, 0),       // negro
    color(25, 25, 112)    // azul oscuro
  ];

  // Velocidad de transición
  const speed = 0.00002; // más pequeño = más lento
  const t = (frameCount * speed) % 1; // ciclo 0-1
  const total = skyColors.length;

  // Determinar los dos colores a interpolar
  const index1 = floor(frameCount * speed) % total;
  const index2 = (index1 + 1) % total;

  // Interpolar colores
  const c = lerpColor(skyColors[index1], skyColors[index2], t);

  background(c);
}




window.setup = setup;
window.draw = draw;
window.keyPressed = keyPressed;
window.keyReleased = keyReleased;
