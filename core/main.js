// core\main.js
import { Fighter } from '../../entities/fighter.js';
import { Projectile } from '../../entities/projectile.js';
import { loadPiskel } from './loader.js';
import { updateCamera, applyCamera } from './camera.js';

let player1, player2;
let projectiles = [];
let playersReady = false;
let cam = { x: 0, y: 0, zoom: 1 };

function preload() {}
let keysDown = {};
export { keysDown }; // 👈 exportar

window.addEventListener("keydown", (e) => {
  keysDown[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (e) => {
  keysDown[e.key.toLowerCase()] = false;
});

async function setup() {
  createCanvas(800, 400);

  const tyemanIdleLayers = await loadPiskel('src/tyeman/tyeman_idle.piskel');
  const tyemanWalkLayers = await loadPiskel('src/tyeman/tyeman_walk.piskel');
  const tyemanJumpLayers = await loadPiskel('src/tyeman/tyeman_jump.piskel');
  const tyemanFallLayers = await loadPiskel('src/tyeman/tyeman_fall.piskel');
  const tyemanRunLayers = await loadPiskel('src/tyeman/tyeman_run.piskel');
  const tyemanPunchLayers = await loadPiskel('src/tyeman/tyeman_punch.piskel');
  const tyemanCrouchLayers = await loadPiskel('src/tyeman/tyeman_crouch.piskel');
  const tyemanCrouchWalkLayers = await loadPiskel('src/tyeman/tyeman_crouch_walk.piskel');

  player1 = new Fighter(100, color(255, 100, 100), 'p1',
    tyemanIdleLayers, tyemanWalkLayers, tyemanJumpLayers, tyemanFallLayers, tyemanRunLayers, tyemanPunchLayers, tyemanCrouchLayers,tyemanCrouchWalkLayers);
  player2 = new Fighter(600, color(100, 100, 255), 'p2');

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
player1.handleInput();
player2.handleInput();

  player1.update();
  player2.update();

  cam = updateCamera(player1, player2, cam);

  push();
  applyCamera(cam);

  background(50, 180, 50);
  fill(80, 50, 20);
  rect(0, height - 40, width, 40);

  player1.display();
  player2.display();

  for (let i = projectiles.length - 1; i >= 0; i--) {
    projectiles[i].update();
    projectiles[i].display();
    if (projectiles[i].hits(player2)) player2.hit();
    if (projectiles[i].hits(player1)) player1.hit();
    if (projectiles[i].offscreen()) projectiles.splice(i, 1);
  }

  pop();

  fill(255);
  textSize(20);
  text(`P1 HP: ${player1.hp}`, 20, 30);
  text(`P2 HP: ${player2.hp}`, width - 120, 30);
}

function keyPressed() {
  if (!playersReady) return;
  player1.handleInput(key, true);
  player2.handleInput(key, true);
}

function keyReleased() {
  if (!playersReady) return;
  player1.handleInput(key, false);
  player2.handleInput(key, false);
}

export { projectiles };
window.setup = setup;
window.draw = draw;
window.keyPressed = keyPressed;
window.keyReleased = keyReleased;
