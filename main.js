let player1, player2;
let projectiles = [];
let playersReady = false;

function preload() {
  // Preload solo para evitar que setup corra antes de que las animaciones estén listas
  // Pero cargaremos en setup usando await y promesas para mejor control
}

async function setup() {
  createCanvas(800, 400);

  // Cargamos animaciones .piskel para idle y walk (solo uso idle aquí para demo)
  const tyemanIdleLayers = await new Promise(resolve => loadPiskel('src/tyeman/tyeman_idle.piskel', resolve));
  // Puedes cargar otras animaciones igual, ejemplo:
  // const tyemanWalkLayers = await new Promise(resolve => loadPiskel('src/tyeman/tyeman_walk.piskel', resolve));

  player1 = new Fighter(100, color(255, 100, 100), 'p1', tyemanIdleLayers);
  player2 = new Fighter(600, color(100, 100, 255), 'p2'); // sin animación por ahora

  playersReady = true;
}

function draw() {
  if (!playersReady) {
    background(0);
    fill(255);
    textSize(24);
    textAlign(CENTER, CENTER);
    text("Cargando animaciones...", width/2, height/2);
    return;
  }

  background(50, 180, 50);
  fill(80, 50, 20);
  rect(0, height - 40, width, 40);

  player1.update();
  player2.update();

  player1.display();
  player2.display();

  // Actualizar y dibujar proyectiles
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

// ----------------------------------------
// Función para cargar .piskel JSON y parsear a array de capas con frames (p5.Image)
// ----------------------------------------
function loadPiskel(jsonPath, callback) {
  loadJSON(jsonPath,
    (data) => {
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
          console.warn(`No se encontraron 'chunks' en layer ${idx}`);
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
                console.warn(`Frame ${frameIndex} no tiene base64PNG`);
                loadedCount++;
                if (loadedCount === totalFrames) {
                  allLayersFrames[idx] = frames;
                  layersLoaded++;
                  if (layersLoaded === layers.length) callback(allLayersFrames);
                }
                return;
              }

              loadImage(base64,
                (img) => {
                  frames[frameIndex] = img;
                  loadedCount++;
                  if (loadedCount === totalFrames) {
                    allLayersFrames[idx] = frames;
                    layersLoaded++;
                    if (layersLoaded === layers.length) callback(allLayersFrames);
                  }
                },
                (err) => {
                  console.error("Error cargando frame:", err);
                  loadedCount++;
                  if (loadedCount === totalFrames) {
                    allLayersFrames[idx] = frames;
                    layersLoaded++;
                    if (layersLoaded === layers.length) callback(allLayersFrames);
                  }
                }
              );
            });
          });
        });
      });
    },
    (err) => {
      console.error("Error cargando JSON .piskel:", err);
      callback([]);
    }
  );
}

// ----------------------------------------
// Clases Fighter y Projectile
// ----------------------------------------
class Fighter {
  constructor(x, col, id, idleFramesByLayer = []) {
    this.x = x;
    this.y = height - 52;
    this.w = 32;
    this.h = 32;
    this.col = col;
    this.speed = 5;
    this.hp = 10;
    this.id = id;
    this.action = 'idle';

    this.idleFramesByLayer = idleFramesByLayer; // array de arrays de frames
    this.frameIndex = 0;
    this.frameDelay = 10;
  }

  update() {
    if (this.action === 'moveLeft') this.x -= this.speed;
    else if (this.action === 'moveRight') this.x += this.speed;

    this.x = constrain(this.x, 0, width - this.w);

    if (this.action === 'idle' && this.idleFramesByLayer.length > 0) {
      if (frameCount % this.frameDelay === 0) {
        this.frameIndex = (this.frameIndex + 1) % this.idleFramesByLayer[0].length;
      }
    }
  }

  display() {
  if (this.idleFramesByLayer.length > 0) {
    for (let i = 1; i < this.idleFramesByLayer.length; i++) {
  let layerFrames = this.idleFramesByLayer[i];
  let img = layerFrames[this.frameIndex];
  if (img) {
    let frameWidth = img.width / this.idleFramesByLayer[0].length;
    image(
      img,
      this.x, this.y, this.w, this.h,
      frameWidth * this.frameIndex, 0,
      frameWidth, img.height
    );
  }
}

  } else {
    fill(this.col);
    rect(this.x, this.y, this.w, this.h);
  }

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
        if (keyCode === LEFT_ARROW) this.action = 'moveLeft';
        else if (keyCode === RIGHT_ARROW) this.action = 'moveRight';
        else if (keyCode === UP_ARROW) this.punch();
        else if (keyCode === DOWN_ARROW) this.kick();
        else if (k === 'm') this.shoot();
      } else {
        if (keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW) this.action = 'idle';
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
class PiskelSprite {
  constructor(data, x, y, w, h) {
    this.data = data;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.frameActual = 0;
    this.totalFrames = data.frames.length;
    this.frameRate = 10;
    this.ultimaAnimacion = millis();
  }

  actualizarAnimacion() {
    if (millis() - this.ultimaAnimacion > 1000 / this.frameRate) {
      this.frameActual = (this.frameActual + 1) % this.totalFrames;
      this.ultimaAnimacion = millis();
    }
  }

  dibujar() {
    const frame = this.data.frames[this.frameActual];
    const layers = this.data.layers;

    for (let layer of layers) {
      const img = layer.image;
      const sx = frame.x;
      const sy = frame.y;
      const sWidth = frame.width;
      const sHeight = frame.height;
      image(img, this.x, this.y, this.w, this.h, sx, sy, sWidth, sHeight);
    }
  }
}
