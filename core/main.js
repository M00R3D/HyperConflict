// core/main.js
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
    tyeman.shoot, tyeman.projectile, tyeman.dash
  );

  player2 = new Fighter(600, color(100, 100, 255), 'p2',
    sbluer.idle, sbluer.walk, sbluer.jump, sbluer.fall, sbluer.run,
    sbluer.punch, sbluer.punch2, sbluer.punch3,
    sbluer.kick, sbluer.kick, sbluer.kick,
    sbluer.crouch, sbluer.crouchWalk, sbluer.hit,
    sbluer.shoot, sbluer.projectile, sbluer.dash
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

  // inputs
  player1.handleInput();
  player2.handleInput();

  // ataque cuerpo a cuerpo
  if (player1.attackHits(player2)) player2.hit();
  if (player2.attackHits(player1)) player1.hit();

  // updates
  player1.update();
  player2.update();

  // actualizar proyectiles y colisiones en un único bucle
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.update();

    // colisión con player1
    if (!p.toRemove && p.hits(player1) && p.ownerId !== player1.id) {
      player1.hit();            // pone en estado hit y resta HP usando tu lógica
      p.toRemove = true;       // marcar para eliminar
    }

    // colisión con player2
    else if (!p.toRemove && p.hits(player2) && p.ownerId !== player2.id) {
      player2.hit();
      p.toRemove = true;
    }

    // fuera de pantalla -> eliminar
    if (p.toRemove || p.offscreen()) {
      projectiles.splice(i, 1);
    }
  }

  cam = updateCamera(player1, player2, cam);

  push();
  applyCamera(cam);
  drawBackground();

  fill(80, 50, 20);
  rect(0, height - 40, width, 40);

  player1.display();
  player2.display();

  // dibujar proyectiles (segundo pase para asegurar que players se dibujan antes si quieres)
  for (let i = 0; i < projectiles.length; i++) {
    projectiles[i].display();
  }

  pop();

  drawHealthBars(player1, player2);
  drawInputQueues(player1, player2);

  clearFrameFlags();
}

window.setup = setup;
window.draw = draw;
export { projectiles };
