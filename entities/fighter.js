import { projectiles } from '../core/main.js';
class Fighter {
  constructor(x, col, id, idleFramesByLayer = [], walkFramesByLayer = [], jumpFramesByLayer = [], fallFramesByLayer = [], runFramesByLayer = []) {
    this.x = x;
    this.y = height - 72;
    this.w = 32;
    this.h = 32;
    this.col = col;
    this.hp = 10;
    this.id = id;

    // físicas
    this.vx = 0;
    this.vy = 0;
    this.gravity = 0.1;
    this.jumpStrength = -6;
    this.onGround = true;

    // movimiento y derrape
    this.acceleration = 1;
    this.runAcceleration = 2.5;
    this.maxSpeed = 3;
    this.runMaxSpeed = 6;
    this.friction = 0.1;
    this.runFriction = 0.051;

    this.runActive = false;

    // doble tap para correr
    this.lastTapTime = { left: 0, right: 0 };

    // animaciones
    this.idleFramesByLayer = idleFramesByLayer;
    this.walkFramesByLayer = walkFramesByLayer;
    this.jumpFramesByLayer = jumpFramesByLayer;
    this.fallFramesByLayer = fallFramesByLayer;
    this.runFramesByLayer = runFramesByLayer;

    this.frameIndex = 0;

    // velocidad de animación (frameDelay)
    this.frameDelay = 10;       // para idle y caminar
    this.runFrameDelay = 5;     // más rápido para correr

    this.facing = 1;

    this.keys = { left: false, right: false, up: false };

    this.currentFramesByLayer = null;
  }

  update() {
    // Ajustar aceleración, velocidad máxima y fricción según correr o no
    let acc = this.runActive ? this.runAcceleration : this.acceleration;
    let maxSpd = this.runActive ? this.runMaxSpeed : this.maxSpeed;
    let friction = this.runActive ? this.runFriction : this.friction;

    // Movimiento horizontal y derrape
    if (this.keys.left) {
      this.vx -= acc;
      this.facing = -1;
    } else if (this.keys.right) {
      this.vx += acc;
      this.facing = 1;
    } else {
      if (this.vx > 0) {
        this.vx -= friction;
        if (this.vx < 0) this.vx = 0;
      } else if (this.vx < 0) {
        this.vx += friction;
        if (this.vx > 0) this.vx = 0;
      }
    }

    // Limitar velocidad horizontal
    this.vx = constrain(this.vx, -maxSpd, maxSpd);

    // Aplicar velocidad a posición
    this.x += this.vx;

    // Gravedad y salto
    this.vy += this.gravity;
    this.y += this.vy;

    if (this.y >= height - 72) {
      this.y = height - 72;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // Limitar dentro de pantalla
    this.x = constrain(this.x, 0, width - this.w);

    // Selección de animación según estado
    let framesByLayer;
    if (!this.onGround) {
      framesByLayer = this.vy < 0 ? this.jumpFramesByLayer : this.fallFramesByLayer;
      this.frameDelay = 10;
    } else {
      if (this.runActive && this.runFramesByLayer.length > 0) {
        framesByLayer = this.runFramesByLayer;
        this.frameDelay = this.runFrameDelay; // correr más rápido
      } else if (this.keys.left || this.keys.right) {
        framesByLayer = this.walkFramesByLayer;
        this.frameDelay = 10;
      } else {
        framesByLayer = this.idleFramesByLayer;
        this.frameDelay = 10;
      }
    }

    // Cambiar animación si es diferente la actual
    if (this.currentFramesByLayer !== framesByLayer) {
      this.frameIndex = 0;
      this.currentFramesByLayer = framesByLayer;
    }

    // Actualizar frameIndex según frameDelay y animación
    if (framesByLayer.length > 0 && framesByLayer[0] && framesByLayer[0].length > 0) {
      if (frameCount % this.frameDelay === 0) {
        if (this.onGround) {
          // Ciclo continuo en tierra (idle, caminar, correr)
          this.frameIndex = (this.frameIndex + 1) % framesByLayer[0].length;
        } else {
          // Avanza hasta último frame en salto o caída
          if (this.frameIndex < framesByLayer[0].length - 1) {
            this.frameIndex++;
          }
        }
      }
    } else {
      this.frameIndex = 0;
    }
  }

  display() {
    let stateText;
    let framesByLayer = this.currentFramesByLayer;

    if (!framesByLayer) {
      framesByLayer = this.idleFramesByLayer;
    }

    if (!this.onGround) {
      stateText = this.vy < 0 ? "jumping" : "falling";
    } else if (this.keys.left) {
      stateText = this.runActive ? "running left" : "moving left";
    } else if (this.keys.right) {
      stateText = this.runActive ? "running right" : "moving right";
    } else {
      stateText = "idle";
    }

    if (framesByLayer.length > 0 && framesByLayer[0] && framesByLayer[0].length > 0) {
      push();

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
    const now = millis();

    if (this.id === 'p1') {
      if (k === 'a') {
        if (isPressed) {
          if (now - this.lastTapTime.left < 300) this.runActive = true;
          this.lastTapTime.left = now;
        }
        this.keys.left = isPressed;
        if (!isPressed && !this.keys.right) this.runActive = false;
      }
      if (k === 'd') {
        if (isPressed) {
          if (now - this.lastTapTime.right < 300) this.runActive = true;
          this.lastTapTime.right = now;
        }
        this.keys.right = isPressed;
        if (!isPressed && !this.keys.left) this.runActive = false;
      }
      if (k === 'w' && isPressed && this.onGround) {
        this.vy = this.jumpStrength;
        this.onGround = false;
        this.runActive = false;
      }
      if (k === 'q' && isPressed) this.shoot();
    }

    if (this.id === 'p2') {
      if (keyCode === LEFT_ARROW) {
        if (isPressed) {
          if (now - this.lastTapTime.left < 300) this.runActive = true;
          this.lastTapTime.left = now;
        }
        this.keys.left = isPressed;
        if (!isPressed && !this.keys.right) this.runActive = false;
      }
      if (keyCode === RIGHT_ARROW) {
        if (isPressed) {
          if (now - this.lastTapTime.right < 300) this.runActive = true;
          this.lastTapTime.right = now;
        }
        this.keys.right = isPressed;
        if (!isPressed && !this.keys.left) this.runActive = false;
      }
      if (keyCode === UP_ARROW && isPressed && this.onGround) {
        this.vy = this.jumpStrength;
        this.onGround = false;
        this.runActive = false;
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

export { Fighter };
