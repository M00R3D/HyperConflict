// entities/fighter.js
import { Projectile } from './projectile.js';
import { projectiles, keysDown, keysUp, keysPressed } from '../core/main.js';

class Fighter {
  constructor(
    x, col, id,
    idleFramesByLayer = [], walkFramesByLayer = [], jumpFramesByLayer = [],
    fallFramesByLayer = [], runFramesByLayer = [], 
    punchFramesByLayer = [], punch2FramesByLayer = [], punch3FramesByLayer = [], 
    kickFramesByLayer = [], kick2FramesByLayer = [], kick3FramesByLayer = [],
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

    // frames por acción (por capas)
    this.idleFramesByLayer = idleFramesByLayer;
    this.walkFramesByLayer = walkFramesByLayer;
    this.jumpFramesByLayer = jumpFramesByLayer;
    this.fallFramesByLayer = fallFramesByLayer;
    this.runFramesByLayer = runFramesByLayer;
    this.punchFramesByLayer = punchFramesByLayer;
    this.punch2FramesByLayer = punch2FramesByLayer;
    this.punch3FramesByLayer = punch3FramesByLayer;
    this.kickFramesByLayer = kickFramesByLayer;
    this.kick2FramesByLayer = kick2FramesByLayer || kickFramesByLayer; // fallback si no pasas frames
    this.kick3FramesByLayer = kick3FramesByLayer || kickFramesByLayer;
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

    // combos por tecla (cada entrada es el nombre de la acción en this.actions)
    this.comboChainsByKey = {
      // p1
      i: ['punch', 'punch2', 'punch3'],
      o: ['kick', 'kick2', 'kick3'],
      // p2 (mapeo a las mismas acciones)
      b: ['punch', 'punch2', 'punch3'],
      n: ['kick', 'kick2', 'kick3']
    };

    // estado de combo por tecla
    this.comboStepByKey = {};          // ejemplo { i: 0, o: 0, b:0, n:0 } (llena dinámicamente)
    this.lastAttackTimeByKey = {};     // último timestamp por tecla
    this.inputLockedByKey = {};        // bloqueo por tecla (espera que termine animación)
    // inicializar keys
    for (const k in this.comboChainsByKey) {
      this.comboStepByKey[k] = 0;
      this.lastAttackTimeByKey[k] = 0;
      this.inputLockedByKey[k] = false;
    }

    this.comboWindow = 250; // ms para encadenar

    // Estado y ataques
    this.state = { current: "idle", timer: 0, canCancel: true };
    this.actions = {
      idle:    { anim: idleFramesByLayer, frameDelay: 10 },
      walk:    { anim: walkFramesByLayer, frameDelay: 10 },
      run:     { anim: runFramesByLayer, frameDelay: this.runFrameDelay },
      jump:    { anim: jumpFramesByLayer, frameDelay: 10 },
      fall:    { anim: fallFramesByLayer, frameDelay: 10 },
      // punches
      punch:   { anim: punchFramesByLayer, frameDelay: 6, duration: 400 },
      punch2:  { anim: punch2FramesByLayer, frameDelay: 6, duration: 400 },
      punch3:  { anim: punch3FramesByLayer, frameDelay: 5, duration: 800 },
      // kicks (aseguro que existen kick2/kick3)
      kick:    { anim: kickFramesByLayer, frameDelay: 6, duration: 400 },
      kick2:   { anim: this.kick2FramesByLayer, frameDelay: 6, duration: 400 },
      kick3:   { anim: this.kick3FramesByLayer, frameDelay: 6, duration: 600 },
      // otros
      crouch:  { anim: crouchFramesByLayer, frameDelay: 10 },
      crouchwalk: { anim: crouchWalkFramesByLayer, frameDelay: 10 },
      hit:     { anim: hitFramesByLayer, frameDelay: 10 },
      hadouken: { anim: [], frameDelay: 6, duration: 600 }
    };

    // hitboxes (igual que tenías)
    this.hitboxes = {
      idle:   { offsetX: 7, offsetY: 0, w: 22, h: 32 },
      walk:   { offsetX: 7, offsetY: 0, w: 22, h: 32 },
      run:    { offsetX: 7, offsetY: 0, w: 22, h: 32 },
      jump:   { offsetX: 7, offsetY: 0, w: 22, h: 32 },
      fall:   { offsetX: 7, offsetY: 0, w: 22, h: 32 },
      crouch: { offsetX: 0, offsetY: 16, w: 32, h: 16 },
      crouchwalk: { offsetX: 0, offsetY: 16, w: 32, h: 16 },
      punch:  { offsetX: -4, offsetY: 0, w: 32, h: 29 },
      punch2: { offsetX: -4, offsetY: 0, w: 32, h: 29 },
      punch3: { offsetX: -4, offsetY: 0, w: 32, h: 29 },
      kick:   { offsetX: 0, offsetY: 1, w: 32, h: 34 },
      hit:    { offsetX: 7, offsetY: 0, w: 22, h: 32 },
      hadouken: { offsetX: 10, offsetY: 10, w: 12, h: 12 }
    };
    this.attackHitboxes = {
      punch: { offsetX: 28, offsetY: 13, w: 10, h: 10 },
      punch2: { offsetX: 28, offsetY: 13, w: 10, h: 10 },
      punch3: { offsetX: 28, offsetY: 13, w: 10, h: 10 },
      kick:  { offsetX: 25, offsetY: 10, w: 30, h: 15 },
      hadouken: { offsetX: 0, offsetY: 0, w: 20, h: 20 }
    };

    this.attacking = false;
    this.attackStartTime = 0;
    this.attackDuration = 400;
    this.attackType = null;
    this.isHit = false;
    this.hitStartTime = 0;
    this.hitDuration = 600;
  }

  setState(newState) {
    if (this.state.current !== newState) {
      this.state.current = newState;
      this.state.timer = 0;
      const action = this.actions[newState];
      if (action && action.anim && action.anim.length > 0) {
        this.currentFramesByLayer = action.anim;
        this.frameIndex = 0;
        this.frameDelay = action.frameDelay || 10;
      } else {
        // si no hay animación por capas usamos rect de color
        this.currentFramesByLayer = [];
        this.frameIndex = 0;
      }
    }
  }

  update() {
    // terminar ataque basado en attackDuration actual
    if (this.attacking) {
      if (millis() - this.attackStartTime > this.attackDuration) {
        this.attacking = false;
        this.attackType = null;
      }
    }

    // desbloquear inputs por tecla si la animación terminó
    for (const key in this.inputLockedByKey) {
      if (this.inputLockedByKey[key]) {
        // si no estamos atacando con esa acción o el tiempo pasó, desbloquear
        const last = this.lastAttackTimeByKey[key] || 0;
        if (!this.attacking || (millis() - last > this.attackDuration + 10)) {
          this.inputLockedByKey[key] = false;
        }
      }
    }

    // reset combos vencidos
    for (const key in this.lastAttackTimeByKey) {
      if (this.lastAttackTimeByKey[key] && (millis() - this.lastAttackTimeByKey[key] > this.comboWindow)) {
        this.comboStepByKey[key] = 0;
      }
    }

    // Movimiento horizontal
    const acc = this.runActive ? this.runAcceleration : this.acceleration;
    const maxSpd = this.runActive ? this.runMaxSpeed : this.maxSpeed;
    const friction = this.runActive ? this.runFriction : this.friction;

    if (this.keys.left && this.state.current !== "fall" && this.state.current !== "jump") this.vx -= acc;
    if (this.keys.right && this.state.current !== "fall" && this.state.current !== "jump") this.vx += acc;

    if (!this.keys.left && !this.keys.right && this.state.current !== "fall" && this.state.current !== "jump") {
      if (this.vx > 0) this.vx = Math.max(0, this.vx - friction);
      if (this.vx < 0) this.vx = Math.min(0, this.vx + friction);
    }

    if (this.keys.left) this.facing = -1;
    if (this.keys.right) this.facing = 1;

    this.vx = constrain(this.vx, -maxSpd, maxSpd);
    this.x += this.vx;

    // gravedad y salto
    this.vy += this.gravity;
    this.y += this.vy;
    if (this.y >= height - 72) { this.y = height - 72; this.vy = 0; this.onGround = true; }
    else this.onGround = false;

    this.x = constrain(this.x, 0, width - this.w);

    // cambiar estado visual según prioridad
    if (this.isHit) this.setState("hit");
    else if (this.attacking && this.attackType) this.setState(this.attackType);
    else if (!this.onGround) this.setState(this.vy < 0 ? "jump" : "fall");
    else if (this.crouching && this.vx === 0) this.setState("crouch");
    else if (this.crouching && this.vx !== 0) this.setState("crouchwalk");
    else if (this.runActive && (this.keys.left || this.keys.right)) this.setState("run");
    else if (this.keys.left || this.keys.right) this.setState("walk");
    else this.setState("idle");

    // animación por frames
    const framesByLayer = this.currentFramesByLayer || [];
    if (framesByLayer.length > 0 && framesByLayer[0]?.length > 0) {
      if (frameCount % this.frameDelay === 0) {
        if (this.crouching) {
          if (this.frameIndex < framesByLayer[0].length - 1) this.frameIndex++;
          else if (this.state.current === "crouchwalk") this.frameIndex = (this.frameIndex + 1) % framesByLayer[0].length;
        } else if (this.onGround || this.attacking) {
          this.frameIndex = (this.frameIndex + 1) % framesByLayer[0].length;
        } else if (this.frameIndex < framesByLayer[0].length - 1) this.frameIndex++;
      }
    } else this.frameIndex = 0;

    if (this.opponent) this.autoFace(this.opponent);
    this.state.timer++;

    // salir de hit
    if (this.isHit && millis() - this.hitStartTime >= this.hitDuration) {
      this.isHit = false;
      this.setState("idle");
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
    } else {
      fill(this.col);
      rect(this.x, this.y, this.w, this.h);
    }

    // hitbox personaje
    const hb = this.getCurrentHitbox();
    noFill();
    stroke(255, 0, 0);
    strokeWeight(2);
    rect(hb.x, hb.y, hb.w, hb.h);

    // hitbox ataque
    if (this.attacking) {
      const atkHB = this.getAttackHitbox();
      if (atkHB) {
        noFill();
        stroke(0, 200, 255);
        strokeWeight(2);
        rect(atkHB.x, atkHB.y, atkHB.w, atkHB.h);
      }
    }

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

    // P1
    if (this.id === 'p1') {
      setRunTap('left', 'a');
      setRunTap('right', 'd');

      if (keysDown['w'] && this.onGround) {
        this.vy = this.jumpStrength;
        this.onGround = false;
        this.runActive = false;
      }
      this.crouching = keysDown['s'];

      if (keysPressed['i']) this.attack('i'); // combo punch p1
      if (keysPressed['o']) this.attack('o'); // combo kick p1

      if (keysUp['i'] || keysUp['o']) {
        // liberar bloqueos por soltado (seguro)
        this.inputLockedByKey['i'] = false;
        this.inputLockedByKey['o'] = false;
      }
    }

    // P2
    if (this.id === 'p2') {
      setRunTap('left', 'arrowleft');
      setRunTap('right', 'arrowright');

      if (keysDown['arrowup'] && this.onGround) {
        this.vy = this.jumpStrength;
        this.onGround = false;
        this.runActive = false;
      }
      this.crouching = keysDown['arrowdown'];

      if (keysPressed['b']) this.attack('b'); // punch p2 mapped to same chain
      if (keysPressed['n']) this.attack('n'); // kick p2 mapped

      if (keysUp['b'] || keysUp['n']) {
        this.inputLockedByKey['b'] = false;
        this.inputLockedByKey['n'] = false;
      }
    }
  }

  // attack invoked with key identifier: 'i','o','b','n'
  attack(key) {
    const now = millis();
    const chain = this.comboChainsByKey[key];
    if (!chain || chain.length === 0) return;

    // si input bloqueado por esa tecla, ignorar
    if (this.inputLockedByKey[key]) return;

    // comprobar si estamos dentro de ventana para encadenar
    const last = this.lastAttackTimeByKey[key] || 0;
    let step = this.comboStepByKey[key] || 0;
    if (now - last > this.comboWindow) {
      // expiró -> empezar desde 0
      step = 0;
    }

    // seleccionar ataque actual
    const attackName = chain[step] || chain[0];
    const action = this.actions[attackName];
    if (!action) {
      // seguridad: si acción no definida, no hacemos nada
      console.warn('Acción no definida en actions:', attackName);
      return;
    }

    // aplicar ataque
    this.attackType = attackName;
    this.setState(attackName);
    this.attacking = true;
    this.attackStartTime = now;
    this.attackDuration = action.duration || 400; // importante: evita undefined
    this.lastAttackTimeByKey[key] = now;

    // bloquear input para esa tecla hasta que termine animación
    this.inputLockedByKey[key] = true;

    // avanzar paso de combo para la próxima vez
    this.comboStepByKey[key] = (step + 1);
    // Si llegó al final, dejar listo para reiniciar (no modificado hasta que expira la ventana)
    if (this.comboStepByKey[key] >= chain.length) {
      this.comboStepByKey[key] = 0;
    }
  }

  // permitir liberar bloqueo manual (si lo necesitas)
  handleInputRelease(type) {
    if (this.inputLockedByKey[type] !== undefined) this.inputLockedByKey[type] = false;
  }

  autoFace(opponent) {
    if (!opponent) return;
    const towardOpponent = (opponent.x > this.x) ? 1 : -1;
    const runningBackwards =
      this.runActive &&
      ((this.keys.right && towardOpponent === -1) || (this.keys.left && towardOpponent === 1));
    if (!runningBackwards) this.facing = towardOpponent;
  }

  attackHits(opponent) {
    if (!this.attacking) return false;
    const atkHB = this.getAttackHitbox();
    if (!atkHB) return false;
    const oppHB = opponent.getCurrentHitbox();
    return (
      atkHB.x < oppHB.x + oppHB.w &&
      atkHB.x + atkHB.w > oppHB.x &&
      atkHB.y < oppHB.y + oppHB.h &&
      atkHB.y + atkHB.h > oppHB.y
    );
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

  getCurrentHitbox() {
    const box = this.hitboxes[this.state.current] || this.hitboxes["idle"];
    return {
      x: this.facing === 1 ? this.x + box.offsetX : this.x + this.w - box.offsetX - box.w,
      y: this.y + box.offsetY,
      w: box.w,
      h: box.h
    };
  }

  getAttackHitbox() {
    if (!this.attacking || !this.attackType) return null;
    const box = this.attackHitboxes[this.attackType] || this.attackHitboxes[this.attackType.replace(/\d+$/, '')];
    // si no hay uno específico, intenta devolver el base (punch/kick)
    if (!box) return null;
    return {
      x: this.facing === 1 ? this.x + box.offsetX : this.x + this.w - box.offsetX - box.w,
      y: this.y + box.offsetY,
      w: box.w,
      h: box.h
    };
  }
}

export { Fighter };
