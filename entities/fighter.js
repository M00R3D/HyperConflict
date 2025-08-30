// entities\fighter.js
import { projectiles, keysDown, keysUp } from '../core/main.js';

class Fighter {
  constructor(
    x, col, id,
    idleFramesByLayer = [], walkFramesByLayer = [], jumpFramesByLayer = [],
    fallFramesByLayer = [], runFramesByLayer = [], punchFramesByLayer = [], kickFramesByLayer = [],
    crouchFramesByLayer = [], crouchWalkFramesByLayer = [], hitFramesByLayer = []
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
    this.runMaxSpeed = 6;
    this.friction = 0.1;
    this.runFriction = 0.051;
    this.runActive = false;

    this.lastTapTime = { left: 0, right: 0 };

    this.idleFramesByLayer = idleFramesByLayer;
    this.walkFramesByLayer = walkFramesByLayer;
    this.jumpFramesByLayer = jumpFramesByLayer;
    this.fallFramesByLayer = fallFramesByLayer;
    this.runFramesByLayer = runFramesByLayer;
    this.punchFramesByLayer = punchFramesByLayer;
    this.kickFramesByLayer = kickFramesByLayer;
    this.crouchFramesByLayer = crouchFramesByLayer;
    this.crouchWalkFramesByLayer = crouchWalkFramesByLayer;
    this.hitFramesByLayer = hitFramesByLayer;

    this.frameIndex = 0;
    this.frameDelay = 10;
    this.runFrameDelay = 5;
    this.facing = 1;
    this.keys = { left: false, right: false, up: false };
    this.currentFramesByLayer = idleFramesByLayer;
    this.crouching = false;

    // Estado y ataques
    this.state = { current: "idle", timer: 0, canCancel: true };
    this.actions = {
      idle: { anim: idleFramesByLayer, frameDelay: 10 },
      walk: { anim: walkFramesByLayer, frameDelay: 10 },
      run: { anim: runFramesByLayer, frameDelay: this.runFrameDelay },
      jump: { anim: jumpFramesByLayer, frameDelay: 10 },
      fall: { anim: fallFramesByLayer, frameDelay: 10 },
      punch: { anim: punchFramesByLayer, frameDelay: 6, duration: 400 },
      kick: { anim: kickFramesByLayer, frameDelay: 6, duration: 400 },
      crouch: { anim: crouchFramesByLayer, frameDelay: 10 },
      crouchwalk: { anim: crouchWalkFramesByLayer, frameDelay: 10 },
      hit: { anim: hitFramesByLayer, frameDelay: 10 }
    };

    this.attacking = false;
    this.attackStartTime = 0;
    this.attackDuration = 400;
    this.attackType = null; // <-- Tipo de ataque: "punch" o "kick"
    this.isHit = false;      
    this.hitStartTime = 0;   
    this.hitDuration = 600; // 0.6 segundos

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
    // Terminar ataque
    if (this.attacking && millis() - this.attackStartTime > this.attackDuration) {
      this.attacking = false;
      this.attackType = null;
    }

    // Movimiento horizontal
    const acc = this.runActive ? this.runAcceleration : this.acceleration;
    const maxSpd = this.runActive ? this.runMaxSpeed : this.maxSpeed;
    const friction = this.runActive ? this.runFriction : this.friction;

    if (this.keys.left && this.state.current!="fall" && this.state.current!="jump") this.vx -= acc;
    if (this.keys.right && this.state.current!="fall" && this.state.current!="jump") this.vx += acc;

    if (!this.keys.left && !this.keys.right && this.state.current!="fall" && this.state.current!="jump") {
      if (this.vx > 0) this.vx = Math.max(0, this.vx - friction);
      if (this.vx < 0) this.vx = Math.min(0, this.vx + friction);
    }

    if (this.keys.left) this.facing = -1;
    if (this.keys.right) this.facing = 1;

    this.vx = constrain(this.vx, -maxSpd, maxSpd);
    
    this.x += this.vx;

    // Gravedad y salto
    this.vy += this.gravity;
    this.y += this.vy;
    if (this.y >= height - 72) { this.y = height - 72; this.vy = 0; this.onGround = true; }
    else this.onGround = false;

    this.x = constrain(this.x, 0, width - this.w);

    // Cambiar estado según situación
    if (this.isHit ) this.setState("hit");
    else if (this.attacking && this.attackType) this.setState(this.attackType);
    else if (!this.onGround) this.setState(this.vy < 0 ? "jump" : "fall");
    else if (this.crouching && this.vx === 0) this.setState("crouch");
    else if (this.crouching && this.vx !== 0) this.setState("crouchwalk");
    else if (this.runActive && (this.keys.left || this.keys.right)) this.setState("run");
    else if (this.keys.left || this.keys.right) this.setState("walk");
    else this.setState("idle");

    // Avanzar animación
    const framesByLayer = this.currentFramesByLayer || [];
    if (framesByLayer.length > 0 && framesByLayer[0]?.length > 0) {
      if (frameCount % this.frameDelay === 0) {
        if (this.crouching) {
          if (this.frameIndex < framesByLayer[0].length - 1) this.frameIndex++;
          else if (this.state.current === "crouchwalk")
            this.frameIndex = (this.frameIndex + 1) % framesByLayer[0].length;
        } else if (this.onGround || this.attacking) {
          this.frameIndex = (this.frameIndex + 1) % framesByLayer[0].length;
        } else if (this.frameIndex < framesByLayer[0].length - 1) this.frameIndex++;
      }
    } else this.frameIndex = 0;

    if (this.opponent) this.autoFace(this.opponent);
    
    this.state.timer++;

    // Gestionar estado de hit
    if (this.isHit) {
      if (millis() - this.hitStartTime >= this.hitDuration) {
        this.isHit = false;
        this.setState("idle");
      }
    }

  }

  display() {
    const stateText = this.state.current;
    const framesByLayer = this.currentFramesByLayer || this.idleFramesByLayer;

    if (framesByLayer.length > 0 && framesByLayer[0]?.length > 0) {
      push();
      if (this.facing === -1) {
        translate(this.x + this.w / 2, 0);
        scale(-1, 1);
        translate(-(this.x + this.w / 2), 0);
      }
      for (let i = 1; i < framesByLayer.length; i++) {
        const layerFrames = framesByLayer[i];
        const img = layerFrames[this.frameIndex];
        if (img) {
          const frameWidth = img.width / framesByLayer[0].length;
          image(
            img, this.x, this.y, this.w, this.h,
            frameWidth * this.frameIndex, 0,
            frameWidth, img.height
          );
        }
      }
      pop();
    } else fill(this.col), rect(this.x, this.y, this.w, this.h);

    // 🔴 Hitbox personaje
    noFill();
    stroke(255, 0, 0);
    strokeWeight(2);
    rect(this.x, this.y, this.w, this.h);

    // 🔵 Hitbox ataque
    if (this.attacking) {
      noFill();
      stroke(0, 200, 255);
      strokeWeight(2);
      const attackX = this.facing === 1 ? this.x + this.w : this.x - this.w / 2;
      const attackY = this.y + this.h * 0.2;
      const attackW = this.w / 2;
      const attackH = this.h * 0.6;
      rect(attackX, attackY, attackW, attackH);
    }

    // Texto estado
    fill(255);
    textSize(12);
    textAlign(CENTER);
    text(stateText, this.x + this.w / 2, this.y - 10);
  }

  handleInput() {
    if (this.isHit) return;
    const setRunTap = (dir, keyName) => {
      if (keysDown[keyName] && !this.keys[dir] && !this.isHit) {
        if (millis() - this.lastTapTime[dir] < 400) this.runActive = true;
        this.lastTapTime[dir] = millis();
      }
      this.keys[dir] = keysDown[keyName];
      if (!this.keys.left && !this.keys.right && !this.isHit) this.runActive = false;
    };

    if (this.id === 'p1') {
      setRunTap('left', 'a');
      setRunTap('right', 'd');

      if (keysDown['w'] && this.onGround) {
        this.vy = this.jumpStrength;
        this.onGround = false;
        this.runActive = false;
      }

      this.crouching = keysDown['s'];

      if (keysDown['i']) this.punch();
      if (keysDown['o']) this.kick();
    }

    if (this.id === 'p2') {
      setRunTap('left', 'arrowleft');
      setRunTap('right', 'arrowright');

      if (keysDown['arrowup'] && this.onGround) {
        this.vy = this.jumpStrength;
        this.onGround = false;
        this.runActive = false;
      }

      this.crouching = keysDown['arrowdown'];

      // if (keysDown['m']) this.shoot();
      if (keysDown['b']) this.punch();
      if (keysDown['n']) this.kick();
    }
  }

  punch() {
    this.attacking = true;
    this.attackStartTime = millis();
    this.attackType = "punch";
    this.setState("punch");
  }

  kick() {
    this.attacking = true;
    this.attackStartTime = millis();
    this.attackType = "kick";
    this.setState("kick");
  }
  autoFace(opponent) {
  if (!opponent) return;
  const towardOpponent = (opponent.x > this.x) ? 1 : -1;
  const runningBackwards =
    this.runActive &&
    ((this.keys.right && towardOpponent === -1) || (this.keys.left && towardOpponent === 1));
  if (!runningBackwards) {
    this.facing = towardOpponent;
  }
}

  attackHits(opponent) {
    if (!this.attacking) return false;

    const attackX = this.facing === 1 ? this.x + this.w : this.x - this.w / 2;
    const attackY = this.y + this.h * 0.2;
    const attackW = this.w / 2;
    const attackH = this.h * 0.6;

    const hit = attackX < opponent.x + opponent.w &&
                attackX + attackW > opponent.x &&
                attackY < opponent.y + opponent.h &&
                attackY + attackH > opponent.y;
    
    return hit;
  }

  shoot() {
    const dir = this.keys.right ? 1 : (this.keys.left ? -1 : (this.id === 'p1' ? 1 : -1));
    projectiles.push(new Projectile(this.x + this.w / 2, this.y + this.h / 2, dir, this.id));
  }

  hit() {
  if (this.isHit) return; 
  this.hp -= 1;
  this.isHit = true;
  this.hitStartTime = millis();
  this.setState("hit");

  this.vx = -this.facing * 5; 
  this.vy = -3;
}

}

export { Fighter };
