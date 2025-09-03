import { Fighter } from '../../entities/fighter.js';
import { Projectile } from '../../entities/projectile.js';
import { updateCamera, applyCamera } from './camera.js';
import { initInput, clearFrameFlags } from './input.js';
import { loadTyemanAssets, loadSbluerAssets } from './assetLoader.js';
import { drawInputQueues, drawHealthBars } from '../ui/hud.js';
import { drawBackground } from '../ui/background.js';

let player1, player2;
let projectiles = [];
let playersReady = false;
let cam = { x: 0, y: 0, zoom: 1 };

async function setup() {
  createCanvas(800, 400);

  const tyeman = await loadTyemanAssets();
  const sbluer = await loadSbluerAssets();

  player1 = new Fighter(100, color(255, 100, 100), 'p1',
    tyeman.idle, tyeman.walk, tyeman.jump, tyeman.fall, tyeman.run,
    tyeman.punch, tyeman.punch2, tyeman.punch3,
    tyeman.kick, tyeman.kick, tyeman.kick,
    tyeman.crouch, tyeman.crouchWalk, tyeman.hit,
    tyeman.shoot, tyeman.projectile
  );

  player2 = new Fighter(600, color(100, 100, 255), 'p2',
    sbluer.idle, sbluer.walk, sbluer.jump, sbluer.fall, sbluer.run,
    sbluer.punch, sbluer.punch2, sbluer.punch3,
    sbluer.kick, sbluer.kick, sbluer.kick,
    sbluer.crouch, sbluer.crouchWalk, sbluer.hit,
    tyeman.shoot, tyeman.projectile
  );

  player1.opponent = player2;
  player2.opponent = player1;

  initInput({ p1: player1, p2: player2, ready: true });
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

  if (player1.attackHits(player2)) player2.hit();
  if (player2.attackHits(player1)) player1.hit();

  player1.update();
  player2.update();
  projectiles.forEach(p => p.update());

  cam = updateCamera(player1, player2, cam);

  push();
  applyCamera(cam);
  drawBackground();

  fill(80, 50, 20);
  rect(0, height - 40, width, 40);

  player1.display();
  player2.display();
  // actualizar y dibujar proyectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.update();
    p.display();

    if (p.offscreen()) {
      projectiles.splice(i, 1);
    } else if (p.hits(player1) && p.ownerId !== player1.id) {
      player1.hp -= 1;
      projectiles.splice(i, 1);
    } else if (p.hits(player2) && p.ownerId !== player2.id) {
      player2.hp -= 1;
      projectiles.splice(i, 1);
    }
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    projectiles[i].display();
    if (projectiles[i].hits(player2)) player2.hit();
    if (projectiles[i].hits(player1)) player1.hit();
    if (projectiles[i].offscreen()) projectiles.splice(i, 1);
  }
  pop();

  drawHealthBars(player1, player2);
  drawInputQueues(player1, player2);

  clearFrameFlags();
}

window.setup = setup;
window.draw = draw;
export { projectiles };
