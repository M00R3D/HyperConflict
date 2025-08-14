import { projectiles } from '../core/main.js';

class Fighter {
  constructor(
    x, col, id,
    idleFramesByLayer = [], walkFramesByLayer = [], jumpFramesByLayer = [],
    fallFramesByLayer = [], runFramesByLayer = [], punchFramesByLayer = [],
    crouchFramesByLayer = []
  ) {
    // Posición y físicas
    this.x = x;
    this.y = height - 72;
    this.w = 32;
    this.h = 32;
    this.col = col;
    this.hp = 10;
    this.id = id;

    this.vx = 0;
    this.vy = 0;
    this.gravity = 0.3;
    this.jumpStrength = -10;
    this.onGround = true;

    this.acceleration = 1.3;
    this.runAcceleration = 1.1;
    this.maxSpeed = 4;
    this.runMaxSpeed = 10;
    this.friction = 0.1;
    this.runFriction = 0.051;
    this.runActive = false;

    // Doble tap
    this.lastTapTime = { left: 0, right: 0 };

    // Animaciones
    this.idleFramesByLayer = idleFramesByLayer;
    this.walkFramesByLayer = walkFramesByLayer;
    this.jumpFramesByLayer = jumpFramesByLayer;
    this.fallFramesByLayer = fallFramesByLayer;
    this.runFramesByLayer = runFramesByLayer;
    this.punchFramesByLayer = punchFramesByLayer;
    this.crouchFramesByLayer = crouchFramesByLayer;

    this.frameIndex = 0;
    this.frameDelay = 10;
    this.runFrameDelay = 5;
    this.facing = 1;
    this.keys = { left: false, right: false, up: false };
    this.currentFramesByLayer = idleFramesByLayer;
    this.crouching = false;

    // Estado y ataques
    this.state = {
      current: "idle",
      timer: 0,
      canCancel: true
    };

    this.actions = {
      idle: { anim: idleFramesByLayer, frameDelay: 10 },
      walk: { anim: walkFramesByLayer, frameDelay: 10 },
      run: { anim: runFramesByLayer, frameDelay: this.runFrameDelay },
      jump: { anim: jumpFramesByLayer, frameDelay: 10 },
      fall: { anim: fallFramesByLayer, frameDelay: 10 },
      punch: { anim: punchFramesByLayer, frameDelay: 6, duration: 400 },
      crouch: { anim: crouchFramesByLayer, frameDelay: 10 }
    };

    // Ataque
    this.attacking = false;
    this.attackStartTime = 0;
    this.attackDuration = 400;
  }

  setState(newState) {
    if (this.state.current !== newState) {
      this.state.current = newState;
      this.state.timer = 0;
      const action = this.actions[newState];
      if (action && action.anim.length > 0) {
        this.currentFramesByLayer = action.anim;
        this.frameIndex = 0;
        this.frameDelay = action.frameDelay || 10;
      }
    }
  }

  update() {
    // Ataque termina
    if (this.attacking && millis() - this.attackStartTime > this.attackDuration) {
      this.attacking = false;
    }

    // Movimiento horizontal
    let acc = this.runActive ? this.runAcceleration : this.acceleration;
    let maxSpd = this.runActive ? this.runMaxSpeed : this.maxSpeed;
    let friction = this.runActive ? this.runFriction : this.friction;

    if (this.keys.left) {
      this.vx -= acc;
      this.facing = -1;
    } else if (this.keys.right) {
      this.vx += acc;
      this.facing = 1;
    } else {
      if (this.vx > 0) { this.vx -= friction; if (this.vx < 0) this.vx = 0; }
      else if (this.vx < 0) { this.vx += friction; if (this.vx > 0) this.vx = 0; }
    }

    this.vx = constrain(this.vx, -maxSpd, maxSpd);
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
    this.x = constrain(this.x, 0, width - this.w);

    // Cambiar estado según situación
    if (this.attacking) {
      this.setState("punch");
    } else if (!this.onGround) {
      this.setState(this.vy < 0 ? "jump" : "fall");
    } else if (this.crouching) {
      this.setState("crouch"); // 🆕 agachado tiene prioridad sobre idle
    } else if (this.runActive && (this.keys.left || this.keys.right)) {
      this.setState("run");
    } else if (this.keys.left || this.keys.right) {
      this.setState("walk");
    } else {
      this.setState("idle");
    }

    // Avanzar animación
    let framesByLayer = this.currentFramesByLayer || [];
    if (framesByLayer.length > 0 && framesByLayer[0]?.length > 0) {
      if (frameCount % this.frameDelay === 0) {
        if (this.crouching) {
          // Si está agachado, avanzar hasta el último frame y detenerse ahí
          if (this.frameIndex < framesByLayer[0].length - 1) {
            this.frameIndex++;
          }
        } else if (this.onGround || this.attacking) {
          // Animaciones normales con loop
          this.frameIndex = (this.frameIndex + 1) % framesByLayer[0].length;
        } else {
          // En aire, no hacer loop
          if (this.frameIndex < framesByLayer[0].length - 1) {
            this.frameIndex++;
          }
        }
      }
    } else {
      this.frameIndex = 0;
    }

    this.state.timer++;
  }

  display() {
    let stateText = this.state.current;
    let framesByLayer = this.currentFramesByLayer || this.idleFramesByLayer;

    // Dibujar sprite
    if (framesByLayer.length > 0 && framesByLayer[0]?.length > 0) {
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
            img, this.x, this.y, this.w, this.h,
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

    // 🔴 Hitbox del personaje
    noFill();
    stroke(255, 0, 0);
    strokeWeight(2);
    rect(this.x, this.y, this.w, this.h);

    // 🔵 Hitbox del golpe
    if (this.attacking) {
      noFill();
      stroke(0, 200, 255);
      strokeWeight(2);
      let attackX = this.facing === 1 ? this.x + this.w : this.x - this.w / 2;
      let attackY = this.y + this.h * 0.2;
      let attackW = this.w / 2;
      let attackH = this.h * 0.6;
      rect(attackX, attackY, attackW, attackH);
    }

    // Texto de estado
    fill(255);
    textSize(12);
    textAlign(CENTER);
    text(stateText, this.x + this.w / 2, this.y - 10);
  }

  handleInput(k, isPressed) {
    const now = millis();
    const setRunTap = dir => {
      if (isPressed) {
        if (now - this.lastTapTime[dir] < 300) this.runActive = true;
        this.lastTapTime[dir] = now;
      }
      this.keys[dir] = isPressed;
      if (!isPressed && !this.keys.left && !this.keys.right) this.runActive = false;
    };

    if (this.id === 'p1') {
      if (k === 'a') setRunTap('left');
      if (k === 'd') setRunTap('right');
      if (k === 'w' && isPressed && this.onGround) {
        this.vy = this.jumpStrength;
        this.onGround = false;
        this.runActive = false;
      }
      if (k === 'q' && isPressed) this.shoot();
      if (k === "s") this.crouching = isPressed;
      if (k === 'i' && isPressed) this.punch();
    }

    if (this.id === 'p2') {
      if (keyCode === LEFT_ARROW) setRunTap('left');
      if (keyCode === RIGHT_ARROW) setRunTap('right');
      if (keyCode === UP_ARROW && isPressed && this.onGround) {
        this.vy = this.jumpStrength;
        this.onGround = false;
        this.runActive = false;
      }
      if (keyCode === DOWN_ARROW) this.crouching = isPressed;
      if (k === 'm' && isPressed) this.shoot();
    }
  }

  punch() {
    this.attacking = true;
    this.attackStartTime = millis();
    this.setState("punch");
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
