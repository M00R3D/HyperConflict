let player1, player2;
let projectiles = [];
let tyemanIdleFrames = [];

function preload() {
  for (let i = 0; i < 3; i++) {
    let path = `src/tyeman/tyeman_idle/sprite_tyeman_idle${i}.png`;
    tyemanIdleFrames[i] = loadImage(path);
  }
}

function setup() {
  createCanvas(800, 400);
    
  player1 = new Fighter(100, color(255, 100, 100), 'p1', tyemanIdleFrames);
  player2 = new Fighter(600, color(100, 100, 255), 'p2');
}

function draw() {
  background(50, 180, 50);
  
  // Dibujar suelo
  fill(80, 50, 20);
  rect(0, height - 40, width, 40);
  
  player1.update();
  player2.update();
  
  player1.display();
  player2.display();
  
  // Dibujar proyectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    projectiles[i].update();
    projectiles[i].display();
    
    // Checar colisión con los jugadores
    if (projectiles[i].from === 'p1' && projectiles[i].hits(player2)) {
      player2.hit();
      projectiles.splice(i, 1);
    } else if (projectiles[i].from === 'p2' && projectiles[i].hits(player1)) {
      player1.hit();
      projectiles.splice(i, 1);
    } else if (projectiles[i].offscreen()) {
      projectiles.splice(i, 1);
    }
  }
  
  // Dibujar vidas
  fill(255);
  textSize(20);
  text(`P1 HP: ${player1.hp}`, 20, 30);
  text(`P2 HP: ${player2.hp}`, width - 120, 30);
}

function keyPressed() {
  player1.handleInput(key, true);
  player2.handleInput(key, true);
}

function keyReleased() {
  player1.handleInput(key, false);
  player2.handleInput(key, false);
}

class Fighter {
  constructor(x, col, id, idleFrames = []) {
    this.x = x;
    this.y = height - 52;
    this.w = 32;
    this.h = 32;
    this.col = col;
    this.speed = 5;
    this.hp = 10;
    this.id = id;
    this.action = 'idle';

    this.idleFrames = idleFrames;
    this.frameIndex = 0;
    this.frameDelay = 10;
  }
  
    update() {
    if (this.action === 'moveLeft') {
      this.x -= this.speed;
    } else if (this.action === 'moveRight') {
      this.x += this.speed;
    }

    this.x = constrain(this.x, 0, width - this.w);

    // Ciclar animación idle
    if (this.action === 'idle' && this.idleFrames.length > 0) {
      if (frameCount % this.frameDelay === 0) {
        this.frameIndex = (this.frameIndex + 1) % this.idleFrames.length;
      }
    }
  }

  
    display() {
    if (this.id === 'p1' && this.action === 'idle' && this.idleFrames.length > 0) {
      image(this.idleFrames[this.frameIndex], this.x, this.y, this.w, this.h);
    } else {
      fill(this.col);
      rect(this.x, this.y, this.w, this.h);
    }

    // Mostrar texto con acción
    fill(255);
    textSize(12);
    textAlign(CENTER);
    text(this.action, this.x + this.w / 2, this.y - 10);
  }

  
  handleInput(k, isPressed) {
    if (this.id === 'p1') {
      if (isPressed) {
        if (k === 'a') this.action = 'moveLeft';
        else if (k === 'd') this.action = 'moveRight';
        else if (k === 'w') this.punch();
        else if (k === 's') this.kick();
        else if (k === 'q') this.shoot();
      } else {
        if (k === 'a' || k === 'd') this.action = 'idle';
      }
    }
    
    if (this.id === 'p2') {
      if (isPressed) {
        if (kCode === LEFT_ARROW) this.action = 'moveLeft';
        else if (kCode === RIGHT_ARROW) this.action = 'moveRight';
        else if (kCode === UP_ARROW) this.punch();
        else if (kCode === DOWN_ARROW) this.kick();
        else if (k === 'm') this.shoot();
      } else {
        if (kCode === LEFT_ARROW || kCode === RIGHT_ARROW) this.action = 'idle';
      }
    }
  }
  
  punch() {
    this.action = 'punch';
    this.dealDamage(1);
  }
  
  kick() {
    this.action = 'kick';
    this.dealDamage(2);
  }
  
  shoot() {
    this.action = 'power';
    let dir = this.id === 'p1' ? 1 : -1;
    projectiles.push(new Projectile(this.x + this.w / 2, this.y + this.h / 2, dir, this.id));
  }
  
  dealDamage(damage) {
    let other = this.id === 'p1' ? player2 : player1;
    if (abs(this.x - other.x) < 60) {
      other.hp -= damage;
    }
  }
  
  hit() {
    this.hp -= 1;
  }
}

class Projectile {
  constructor(x, y, dir, from) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.speed = 7;
    this.size = 10;
    this.from = from;
  }
  
  update() {
    this.x += this.speed * this.dir;
  }
  
  display() {
    fill(255, 200, 0);
    ellipse(this.x, this.y, this.size);
  }
  
  hits(fighter) {
    return this.x > fighter.x && this.x < fighter.x + fighter.w &&
           this.y > fighter.y && this.y < fighter.y + fighter.h;
  }
  
  offscreen() {
    return this.x < 0 || this.x > width;
  }
}
