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
    this.jumpStrength = -5.67;
    this.onGround = true;

    this.acceleration = 1.1;
    this.runAcceleration = 1.01;
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
    this.kick2FramesByLayer = kick2FramesByLayer || kickFramesByLayer;
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
      i: ['punch', 'punch2', 'punch3'],
      o: ['kick', 'kick2', 'kick3'],
      b: ['punch', 'punch2', 'punch3'],
      n: ['kick', 'kick2', 'kick3']
    };

    // estado de combo por tecla
    this.comboStepByKey = {};
    this.lastAttackTimeByKey = {};
    this.inputLockedByKey = {};
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
      punch:   { anim: punchFramesByLayer, frameDelay: 6, duration: 400 },
      punch2:  { anim: punch2FramesByLayer, frameDelay: 6, duration: 400 },
      punch3:  { anim: punch3FramesByLayer, frameDelay: 5, duration: 800 },
      kick:    { anim: kickFramesByLayer, frameDelay: 6, duration: 400 },
      kick2:   { anim: this.kick2FramesByLayer, frameDelay: 6, duration: 400 },
      kick3:   { anim: this.kick3FramesByLayer, frameDelay: 6, duration: 600 },
      crouch:  { anim: crouchFramesByLayer, frameDelay: 10 },
      crouchwalk: { anim: crouchWalkFramesByLayer, frameDelay: 10 },
      hit:     { anim: hitFramesByLayer, frameDelay: 10 },
      hadouken: { anim: [], frameDelay: 6, duration: 600 }
    };

    // hitboxes
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

    // Input buffer (cola) para detectar movimientos
    this.inputBuffer = []; // { symbol: '↓'|'↘'|'P'..., time: millis() }
    this.inputBufferDuration = 1400; // ms
    this.inputBufferMax = 20;

    // ventana para detectar diagonales y near-simultaneous
    this.diagonalWindow = 160; // ms
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
        this.currentFramesByLayer = [];
        this.frameIndex = 0;
      }
    }
  }

  addInput(symbol) {
    if (!symbol) return;
    const now = millis();
    this.inputBuffer.push({ symbol, time: now });
    this.trimBuffer();
  }

  trimBuffer() {
    const now = millis();
    this.inputBuffer = this.inputBuffer.filter(i => now - i.time <= this.inputBufferDuration);
    if (this.inputBuffer.length > this.inputBufferMax) {
      this.inputBuffer.splice(0, this.inputBuffer.length - this.inputBufferMax);
    }
  }

  // Nuevo comportamiento: insertar diagonal ANTES de la dirección nueva (si aplica),
  // manteniendo las direcciones individuales.
  addInputFromKey(keyName) {
    const now = millis();

    const dirMapP1 = { 'w': '↑', 's': '↓', 'a': '←', 'd': '→' };
    const dirMapP2 = { 'arrowup': '↑', 'arrowdown': '↓', 'arrowleft': '←', 'arrowright': '→' };

    // botones ataque
    if (this.id === 'p1') {
      if (keyName === 'i') { this.addInput('P'); return; }
      if (keyName === 'o') { this.addInput('K'); return; }
    } else {
      if (keyName === 'b') { this.addInput('P'); return; }
      if (keyName === 'n') { this.addInput('K'); return; }
    }

    const thisSym = (this.id === 'p1') ? dirMapP1[keyName] : dirMapP2[keyName];
    if (!thisSym) return;

    // Buscar otra direccional mantenida (keysDown) distinta a la actual
    const otherDirKeys = (this.id === 'p1')
      ? ['w','s','a','d'].filter(k => k !== keyName)
      : ['arrowup','arrowdown','arrowleft','arrowright'].filter(k => k !== keyName);

    let foundOther = null;
    for (const k of otherDirKeys) {
      if (keysDown[k]) {
        const otherSym = (this.id === 'p1') ? dirMapP1[k] : dirMapP2[k];
        foundOther = otherSym;
        break;
      }
    }

    // Si no hay otra tecla mantenida, buscar en buffer la última direccional dentro de diagonalWindow
    if (!foundOther) {
      const buf = this.inputBuffer;
      for (let i = buf.length - 1; i >= 0; i--) {
        const s = buf[i].symbol;
        if (['↑','↓','←','→','↗','↖','↘','↙'].includes(s)) {
          if (now - buf[i].time <= this.diagonalWindow) {
            foundOther = s;
          }
          break;
        }
      }
    }

    // Si encontramos otra direccional candidata, combinamos y añadimos DIAGONAL antes de la dirección nueva.
    if (foundOther) {
      const diag = Fighter.combineDirections(foundOther, thisSym);
      if (diag) {
        // evitar duplicados inmediatos de la misma diagonal
        const alreadyRecent = this.inputBuffer.some(i => i.symbol === diag && (now - i.time) <= 120);
        if (!alreadyRecent) {
          // insertar diagonal (antes de la dirección nueva)
          this.inputBuffer.push({ symbol: diag, time: now });
        }
        // siempre añadir la dirección simple (tras la diagonal) — mantiene el orden ↓,↘,→
        this.inputBuffer.push({ symbol: thisSym, time: now + 1 }); // +1 para que aparezca justo después
        this.trimBuffer();
        return;
      }
    }

    // si no hay diagonal, comportamiento normal: añadir la dirección
    this.addInput(thisSym);
  }

  static combineDirections(a, b) {
    const partsOf = sym => {
      if (sym === '↘') return ['↓','→'];
      if (sym === '↙') return ['↓','←'];
      if (sym === '↗') return ['↑','→'];
      if (sym === '↖') return ['↑','←'];
      return [sym];
    };
    const A = partsOf(a);
    const B = partsOf(b);

    for (const ca of A) {
      for (const cb of B) {
        if ((ca === '↓' && cb === '→') || (ca === '→' && cb === '↓')) return '↘';
        if ((ca === '↓' && cb === '←') || (ca === '←' && cb === '↓')) return '↙';
        if ((ca === '↑' && cb === '→') || (ca === '→' && cb === '↑')) return '↗';
        if ((ca === '↑' && cb === '←') || (ca === '←' && cb === '↑')) return '↖';
      }
    }
    return null;
  }

  bufferEndsWith(sequence) {
    if (!sequence || sequence.length === 0) return false;
    const buf = this.inputBuffer.map(i => i.symbol);
    if (buf.length < sequence.length) return false;
    for (let i = 0; i < sequence.length; i++) {
      if (buf[buf.length - sequence.length + i] !== sequence[i]) return false;
    }
    return true;
  }

  bufferConsumeLast(n) {
    if (n <= 0) return;
    this.inputBuffer.splice(Math.max(0, this.inputBuffer.length - n), n);
  }

  specialMoves = {
    hadouken: ['↓','↘','→','P'],
    shoryuken: ['→','↓','↘','P'],
    tatsumaki: ['↓','↙','←','K']
  };

  checkSpecialMoves() {
    for (const moveName in this.specialMoves) {
      const seq = this.specialMoves[moveName];
      if (this.bufferEndsWith(seq)) {
        this.doSpecial(moveName);
        this.bufferConsumeLast(seq.length);
        break;
      }
    }
  }

  doSpecial(moveName) {
    if (moveName === 'hadouken') {
      this.setState('hadouken');
      this.attackType = 'hadouken';
      this.attacking = true;
      this.attackStartTime = millis();
      this.attackDuration = this.actions.hadouken.duration || 600;
      const dir = this.facing === 1 ? 1 : -1;
      const px = Math.round(this.x + (dir === 1 ? this.w : 0));
      const py = Math.round(this.y + this.h / 2);
      projectiles.push(new Projectile(px, py, dir, this.id));
    } else if (moveName === 'shoryuken') {
      this.setState('punch3');
      this.attackType = 'punch3';
      this.attacking = true;
      this.attackStartTime = millis();
      this.attackDuration = this.actions.punch3.duration || 800;
    } else if (moveName === 'tatsumaki') {
      this.setState('kick3');
      this.attackType = 'kick3';
      this.attacking = true;
      this.attackStartTime = millis();
      this.attackDuration = this.actions.kick3.duration || 600;
    }
  }

  update() {
    const now = millis();
    this.trimBuffer();

    // terminar ataque
    if (this.attacking) {
      if (now - this.attackStartTime > this.attackDuration) {
        this.attacking = false;
        this.attackType = null;
      }
    }

    // desbloquear inputs por tecla si la animación terminó
    for (const key in this.inputLockedByKey) {
      if (this.inputLockedByKey[key]) {
        const last = this.lastAttackTimeByKey[key] || 0;
        if (!this.attacking || (now - last > this.attackDuration + 10)) {
          this.inputLockedByKey[key] = false;
        }
      }
    }

    // reset combos vencidos
    for (const key in this.lastAttackTimeByKey) {
      if (this.lastAttackTimeByKey[key] && (now - this.lastAttackTimeByKey[key] > this.comboWindow)) {
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

    // push para evitar superposición con oponente
    if (this.opponent) {
      const myHB = this.getCurrentHitbox();
      const oppHB = this.opponent.getCurrentHitbox();

      if (
        myHB.x < oppHB.x + oppHB.w &&
        myHB.x + myHB.w > oppHB.x &&
        myHB.y < oppHB.y + oppHB.h &&
        myHB.y + myHB.h > oppHB.y
      ) {
        const myCenter = myHB.x + myHB.w / 2;
        const oppCenter = oppHB.x + oppHB.w / 2;
        const halfSum = myHB.w / 2 + oppHB.w / 2;
        const dist = Math.abs(myCenter - oppCenter);
        const overlap = Math.max(0, halfSum - dist);

        if (overlap > 0.0001) {
          const pushAmount = overlap / 2 + 0.5;
          if (myCenter < oppCenter) {
            this.x = constrain(this.x - pushAmount, 0, width - this.w);
            this.opponent.x = constrain(this.opponent.x + pushAmount, 0, width - this.opponent.w);
          } else {
            this.x = constrain(this.x + pushAmount, 0, width - this.w);
            this.opponent.x = constrain(this.opponent.x - pushAmount, 0, width - this.opponent.w);
          }
        }
      }
    }

    // gravedad y salto
    this.vy += this.gravity;
    this.y += this.vy;
    if (this.y >= height - 72) { this.y = height - 72; this.vy = 0; this.onGround = true; }
    else this.onGround = false;

    this.x = constrain(this.x, 0, width - this.w);

    // revisar especiales
    this.checkSpecialMoves();

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
        if (millis() - this.lastTapTime[dir] < 250) this.runActive = true;
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

      if (keysPressed['i']) this.attack('i');
      if (keysPressed['o']) this.attack('o');

      if (keysUp['i'] || keysUp['o']) {
        this.inputLockedByKey['i'] = false;
        this.inputLockedByKey['o'] = false;
      }
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

      if (keysPressed['b']) this.attack('b');
      if (keysPressed['n']) this.attack('n');

      if (keysUp['b'] || keysUp['n']) {
        this.inputLockedByKey['b'] = false;
        this.inputLockedByKey['n'] = false;
      }
    }
  }

  attack(key) {
    const now = millis();
    const chain = this.comboChainsByKey[key];
    if (!chain || chain.length === 0) return;
    if (this.inputLockedByKey[key]) return;

    const last = this.lastAttackTimeByKey[key] || 0;
    let step = this.comboStepByKey[key] || 0;
    if (now - last > this.comboWindow) step = 0;

    const attackName = chain[step] || chain[0];
    const action = this.actions[attackName];
    if (!action) {
      console.warn('Acción no definida en actions:', attackName);
      return;
    }

    this.attackType = attackName;
    this.setState(attackName);
    this.attacking = true;
    this.attackStartTime = now;
    this.attackDuration = action.duration || 400;
    this.lastAttackTimeByKey[key] = now;
    this.inputLockedByKey[key] = true;
    this.comboStepByKey[key] = (step + 1);
    if (this.comboStepByKey[key] >= chain.length) this.comboStepByKey[key] = 0;
  }

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
