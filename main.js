let player1, player2;
let projectiles = [];
let playersReady = false;

function preload() {}

async function setup() {
  createCanvas(800, 400);

  const tyemanIdleLayers = await new Promise(resolve => loadPiskel('src/tyeman/tyeman_idle.piskel', resolve));
  const tyemanWalkLayers = await new Promise(resolve => loadPiskel('src/tyeman/tyeman_walk.piskel', resolve));
  const tyemanJumpLayers = await new Promise(resolve => loadPiskel('src/tyeman/tyeman_jump.piskel', resolve));

  player1 = new Fighter(100, color(255, 100, 100), 'p1', tyemanIdleLayers, tyemanWalkLayers,tyemanJumpLayers);
  player2 = new Fighter(600, color(100, 100, 255), 'p2'); // sin animación por ahora

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

  background(50, 180, 50);
  fill(80, 50, 20);
  rect(0, height - 40, width, 40);

  player1.update();
  player2.update();

  player1.display();
  player2.display();

  for (let i = projectiles.length - 1; i >= 0; i--) {
    projectiles[i].update();
    projectiles[i].display();

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

function loadPiskel(jsonPath, callback) {
  loadJSON(jsonPath, (data) => {
    if (!data || !data.piskel || !data.piskel.layers) {
      console.error("Archivo .piskel no tiene la estructura esperada:", data);
      callback([]);
      return;
    }

    let layers = data.piskel.layers;
    if (layers.length === 0) {
      callback([]);
      return;
    }

    if (layers.length === 1) {
      callback([]);
      return;
    }

    let allLayersFrames = [];
    let layersLoaded = 0;

    layers.forEach((layerStr, idx) => {
      let layer;
      try {
        layer = JSON.parse(layerStr);
      } catch (e) {
        console.error("Error parseando layer:", e);
        layersLoaded++;
        if (layersLoaded === layers.length) callback(allLayersFrames);
        return;
      }

      if (!layer.chunks || layer.chunks.length === 0) {
        layersLoaded++;
        if (layersLoaded === layers.length) callback(allLayersFrames);
        return;
      }

      let frames = [];
      let chunks = layer.chunks;
      let loadedCount = 0;
      let totalFrames = 0;
      for (let c = 0; c < chunks.length; c++) {
        totalFrames += chunks[c].layout.flat().length;
      }

      chunks.forEach((chunk) => {
        chunk.layout.forEach((frameIndices) => {
          frameIndices.forEach((frameIndex) => {
            let base64 = chunk.base64PNG;
            if (!base64) {
              loadedCount++;
              if (loadedCount === totalFrames) {
                allLayersFrames[idx] = frames;
                layersLoaded++;
                if (layersLoaded === layers.length) callback(allLayersFrames);
              }
              return;
            }

            loadImage(base64, (img) => {
              frames[frameIndex] = img;
              loadedCount++;
              if (loadedCount === totalFrames) {
                allLayersFrames[idx] = frames;
                layersLoaded++;
                if (layersLoaded === layers.length) callback(allLayersFrames);
              }
            }, () => {
              loadedCount++;
              if (loadedCount === totalFrames) {
                allLayersFrames[idx] = frames;
                layersLoaded++;
                if (layersLoaded === layers.length) callback(allLayersFrames);
              }
            });
          });
        });
      });
    });
  }, (err) => {
    console.error("Error cargando JSON .piskel:", err);
    callback([]);
  });
}

class Fighter {
  constructor(x, col, id, idleFramesByLayer = [], walkFramesByLayer = [],jumpFramesByLayer = []) {
    this.x = x;
    this.y = height - 72;
    this.w = 32;
    this.h = 32;
    this.col = col;
    this.speed = 5;
    this.hp = 10;
    this.id = id;

    // físicas
    this.vy = 0;
    this.gravity = 0.8;
    this.jumpStrength = -22;
    this.onGround = true;

    this.idleFramesByLayer = idleFramesByLayer;
    this.walkFramesByLayer = walkFramesByLayer;
    this.jumpFramesByLayer = jumpFramesByLayer;

    this.frameIndex = 0;
    this.frameDelay = 10;
  
    this.facing = 1; 
    // control de teclas presionadas
    this.keys = { left: false, right: false, up: false };
  }

update() {
  // movimiento horizontal
  if (this.keys.left) {
      this.x -= this.speed;
      this.facing = -1;
    }
    if (this.keys.right) {
      this.x += this.speed;
      this.facing = 1;
    }

  // gravedad y salto
  this.vy += this.gravity;
  this.y += this.vy;

  if (this.y >= height - 72) {
    this.y = height - 72;
    this.vy = 0;
    this.onGround = true;
  } else {
    this.onGround = false;
  }

  // límites de pantalla
  this.x = constrain(this.x, 0, width - this.w);

  // animación
  if (!this.onGround) {
    // Si está en el aire, avanza frames pero para al último
    if (frameCount % this.frameDelay === 0) {
      if (this.frameIndex < this.jumpFramesByLayer[0].length - 1) {
        this.frameIndex++;
      }
    }
  } else {
    // Si está en el suelo: si se mueve, usa walk, si no idle
    let moving = this.keys.left || this.keys.right;
    let framesByLayer = moving ? this.walkFramesByLayer : this.idleFramesByLayer;
    if (framesByLayer.length > 0) {
      if (frameCount % this.frameDelay === 0) {
        this.frameIndex = (this.frameIndex + 1) % framesByLayer[0].length;
      }
    }
  }
}

display() {
  let stateText;
  let framesByLayer;

  if (!this.onGround) {
    stateText = "jumping";
    framesByLayer = this.jumpFramesByLayer;
  } else if (this.keys.left) {
    stateText = "moving left";
    framesByLayer = this.walkFramesByLayer;
  } else if (this.keys.right) {
    stateText = "moving right";
    framesByLayer = this.walkFramesByLayer;
  } else {
    stateText = "idle";
    framesByLayer = this.idleFramesByLayer;
  }

 if (framesByLayer.length > 0) {
      push();

      // Usar this.facing para reflejar si es -1 (izquierda)
      if (this.facing === -1) {
        translate(this.x + this.w / 2, 0);
        scale(-1, 1);
        translate(-(this.x + this.w / 2), 0);
      }

      for (let i = 1; i < framesByLayer.length; i++) {
        let layerFrames = framesByLayer[i];
        let img = layerFrames[this.frameIndex];
        if (img) {
          let frameWidth = img.width / framesByLayer[0].length;
          image(
            img,
            this.x, this.y, this.w, this.h,
            frameWidth * this.frameIndex, 0,
            frameWidth, img.height
          );
        }
      }

      pop();
    } else {
    fill(this.col);
    rect(this.x, this.y, this.w, this.h);
  }

  fill(255);
  textSize(12);
  textAlign(CENTER);
  text(stateText, this.x + this.w / 2, this.y - 10);
}




  handleInput(k, isPressed) {
    if (this.id === 'p1') {
      if (k === 'a') this.keys.left = isPressed;
      if (k === 'd') this.keys.right = isPressed;
      if (k === 'w' && isPressed && this.onGround) {
        this.vy = this.jumpStrength;
        this.onGround = false;
      }
      if (k === 'q' && isPressed) this.shoot();
    }

    if (this.id === 'p2') {
      if (keyCode === LEFT_ARROW) this.keys.left = isPressed;
      if (keyCode === RIGHT_ARROW) this.keys.right = isPressed;
      if (keyCode === UP_ARROW && isPressed && this.onGround) {
        this.vy = this.jumpStrength;
        this.onGround = false;
      }
      if (k === 'm' && isPressed) this.shoot();
    }
  }

  shoot() {
    let dir = this.keys.right ? 1 : (this.keys.left ? -1 : (this.id === 'p1' ? 1 : -1));
    projectiles.push(new Projectile(this.x + this.w / 2, this.y + this.h / 2, dir, this.id));
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
