// entities/fighter.js
import * as Init from './fighter/init.js';
import * as Buffer from './fighter/buffer.js';
import * as Specials from './fighter/specials.js';
import * as Movement from './fighter/movement.js';
import * as Attacks from './fighter/attacks.js';
import * as Hitbox from './fighter/hitbox.js';
import * as Anim from './fighter/animation.js';
import * as Display from './fighter/display.js';
import { keysPressed, keysUp } from '../core/input.js';

class Fighter {
  constructor(
    x, col, id,
    idleFramesByLayer = [], walkFramesByLayer = [], jumpFramesByLayer = [],
    fallFramesByLayer = [], runFramesByLayer = [], punchFramesByLayer = [],
    punch2FramesByLayer = [], punch3FramesByLayer = [], kickFramesByLayer = [],
    kick2FramesByLayer = [], kick3FramesByLayer = [], crouchFramesByLayer = [],
    crouchWalkFramesByLayer = [], hitFramesByLayer = [], shootFramesByLayer = [],
    projectileFramesByLayer = [], dashFramesByLayer = [] // <-- agregado
  ) {
    // delegar inicialización
    Init.initBase(this, x, col, id);
    Init.initFrames(this, {
      idleFramesByLayer, walkFramesByLayer, jumpFramesByLayer,
      fallFramesByLayer, runFramesByLayer, punchFramesByLayer,
      punch2FramesByLayer, punch3FramesByLayer, kickFramesByLayer,
      kick2FramesByLayer, kick3FramesByLayer, crouchFramesByLayer,
      crouchWalkFramesByLayer, hitFramesByLayer, shootFramesByLayer, projectileFramesByLayer,
      dashFramesByLayer // <-- agregado
    });
    Init.initComboAndInput(this);
    Init.initHitboxes(this);

    // actions (puedes ajustar frameDelay aquí si quieres)
    this.actions = {
      idle:    { anim: this.idleFramesByLayer, frameDelay: 10 },
      walk:    { anim: this.walkFramesByLayer, frameDelay: 10 },
      run:     { anim: this.runFramesByLayer, frameDelay: this.runFrameDelay },
      jump:    { anim: this.jumpFramesByLayer, frameDelay: 10 },
      fall:    { anim: this.fallFramesByLayer, frameDelay: 10 },
      punch:   { anim: this.punchFramesByLayer, frameDelay: 6, duration: 400 },
      punch2:  { anim: this.punch2FramesByLayer, frameDelay: 6, duration: 400 },
      punch3:  { anim: this.punch3FramesByLayer, frameDelay: 5, duration: 800 },
      kick:    { anim: this.kickFramesByLayer, frameDelay: 6, duration: 400 },
      kick2:   { anim: this.kick2FramesByLayer, frameDelay: 6, duration: 400 },
      kick3:   { anim: this.kick3FramesByLayer, frameDelay: 6, duration: 600 },
      crouch:  { anim: this.crouchFramesByLayer, frameDelay: 10 },
      crouchwalk: { anim: this.crouchWalkFramesByLayer, frameDelay: 10 },
      hit:     { anim: this.hitFramesByLayer, frameDelay: 10 },
      hadouken: { anim: this.shootFramesByLayer, frameDelay: 6, duration: 600 },
      dash:    { anim: this.dashFramesByLayer, frameDelay: 4, duration: 1000 } // <-- agregado
    };

    // estado inicial
    this.state = { current: "idle", timer: 0, canCancel: true };

    this.lastTapTime = { left: 0, right: 0 };
    this.lastReleaseTime = { left: 0, right: 0 }; // <-- nuevo
    this.dashDirection = 0;

    this.setState('idle');
    if (!this.currentFramesByLayer.length) {
    // usa crouch si existe o cualquier anim cargada
    if (this.crouchFramesByLayer?.length) {
        this.setState('crouch');
    } else if (this.idleFramesByLayer?.length) {
        this.setState('idle');
    }
}
  }

  // delegados
  setState(newState) { Anim.setState(this, newState); }
  addInput(symbol) { Buffer.addInput(this, symbol); }
  addInputFromKey(keyName) { Buffer.addInputFromKey(this, keyName); }
  trimBuffer() { Buffer.trimBuffer(this); }
  normalizeDiagonals() { Buffer.normalizeDiagonals(this); }

  checkSpecialMoves() { Specials.checkSpecialMoves(this); }

  attack(key) { Attacks.attack(this, key); }
  attackHits(opponent) { return Attacks.attackHits(this, opponent); }
  shoot() { Attacks.shoot(this); }
  hit() { Attacks.hit(this); }

  getCurrentHitbox() { return Hitbox.getCurrentHitbox(this); }
  getAttackHitbox() { return Hitbox.getAttackHitbox(this); }
  getKeysForSymbol(sym) { return Hitbox.getKeysForSymbol(this, sym); }

  handleInput() {
    Buffer.handleInput(this);

    const now = millis();

    // Detecta el evento de pulsación (solo cuando la tecla se presiona, no mantenida)
    // Para P1
    if (this.id === 'p1') {
      // Izquierda
      if (keysPressed['a']) {
        if (now - this.lastReleaseTime.left < 250 && this.state.current !== "dash") {
          this.dash(-1);
        }
        this.lastTapTime.left = now;
      }
      if (keysUp['a']) {
        this.lastReleaseTime.left = now;
      }
      // Derecha
      if (keysPressed['d']) {
        if (now - this.lastReleaseTime.right < 250 && this.state.current !== "dash") {
          this.dash(1);
        }
        this.lastTapTime.right = now;
      }
      if (keysUp['d']) {
        this.lastReleaseTime.right = now;
      }
    } else {
      // Izquierda
      if (keysPressed['arrowleft']) {
        if (now - this.lastReleaseTime.left < 250 && this.state.current !== "dash") {
          this.dash(-1);
        }
        this.lastTapTime.left = now;
      }
      if (keysUp['arrowleft']) {
        this.lastReleaseTime.left = now;
      }
      // Derecha
      if (keysPressed['arrowright']) {
        if (now - this.lastReleaseTime.right < 250 && this.state.current !== "dash") {
          this.dash(1);
        }
        this.lastTapTime.right = now;
      }
      if (keysUp['arrowright']) {
        this.lastReleaseTime.right = now;
      }
    }
  }
  handleInputRelease(type) { return Buffer.handleInputRelease(this, type); }

  update() {
    // pequeñas responsabilidades delegadas:
    Buffer.handlePendingDiagRelease(this);
    this.trimBuffer();
    Attacks.updateAttackState(this);
    Buffer.unlockInputsIfNeeded(this);
    Buffer.resetCombosIfExpired(this);

    Movement.updateMovement(this);

    this.checkSpecialMoves();

    // prioridad de estados + anim
    if (this.state.current === "dash") {
      if (millis() - this.dashStartTime > this.dashDuration) {
        // al terminar el dash, si mantiene cualquier dirección, pasa a run
        const stillDir = this.keys.left || this.keys.right;
        this.runActive = !!stillDir;
        // estado base: run si runActive + dirección, sino idle
        if (this.runActive && stillDir) this.setState("run");
        else this.setState("idle");
      }
      // actualizar animación durante el dash para que avance frames y se muestre dashFramesByLayer
      Anim.updateAnimation(this);
      if (this.opponent) Movement.autoFace(this, this.opponent);
      this.state.timer++;
      Anim.exitHitIfElapsed(this);
      return; // Salta el resto de la prioridad de estados
    } else if (this.isHit) {
      this.setState("hit");
    } else if (this.attacking && this.attackType) {
      this.setState(this.attackType);
    } else if (!this.onGround) {
      this.setState(this.vy < 0 ? "jump" : "fall");
    } else if (this.crouching && this.vx === 0) {
      this.setState("crouch");
    } else if (this.crouching && this.vx !== 0) {
      this.setState("crouchwalk");
    } else if (this.runActive && (this.keys.left || this.keys.right)) {
      this.setState("run");
    } else if (this.keys.left || this.keys.right) {
      this.setState("walk");
    } else {
      this.setState("idle");
    }

    Anim.updateAnimation(this);

    if (this.opponent) Movement.autoFace(this, this.opponent);

    this.state.timer++;
    Anim.exitHitIfElapsed(this);
  }

  display() { Display.display(this); }

  dash(dir) {
    // small cooldown guard (opcional)
    if (millis() - (this.lastDashTime || 0) < (this.dashCooldown || 0)) return;
    this.lastDashTime = millis();

    this.setState("dash");
    this.dashDirection = dir || this.facing || 1;
    this.dashStartTime = millis();
    this.dashDuration = 100; // más corto para sensación más "snappy" (ajusta: 120..200)
    // desactiva run durante el dash para evitar conflictos; al acabar se reevalúa runActive
    this.runActive = false;
    // fuerza un pequeño impulso inicial para responsividad (mejora feel)
    const initialBoost = (this.dashSpeed || 14) * 0.6;
    this.vx = initialBoost * this.dashDirection;
  }
}

export { Fighter };
