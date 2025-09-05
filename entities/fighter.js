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
    crouchWalkFramesByLayer = [], hitFramesByLayer = [], hit2FramesByLayer = [], hit3FramesByLayer = [],
    shootFramesByLayer = [], projectileFramesByLayer = [],
    dashLightFramesByLayer = [], // <-- nuevo parámetro antes del dash final
    dashFramesByLayer = [] // <-- existente
  ) {
    // delegar inicialización
    Init.initBase(this, x, col, id);
    Init.initFrames(this, {
      idleFramesByLayer, walkFramesByLayer, jumpFramesByLayer,
      fallFramesByLayer, runFramesByLayer, punchFramesByLayer,
      punch2FramesByLayer, punch3FramesByLayer, kickFramesByLayer,
      kick2FramesByLayer, kick3FramesByLayer, crouchFramesByLayer,
      crouchWalkFramesByLayer, hitFramesByLayer,
      hit1FramesByLayer: hit2FramesByLayer /* temp */,
      hit2FramesByLayer, hit3FramesByLayer,
      shootFramesByLayer, projectileFramesByLayer,
      dashLightFramesByLayer, // <-- pasar al init
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
      kick2:   { anim: this.kick2FramesByLayer, frameDelay: 6, duration: 700 },
      kick3:   { anim: this.kick3FramesByLayer, frameDelay: 6, duration: 1000 },
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
  // forward attacker optional param so attacks logic knows who hit us
  hit(attacker = null) { Attacks.hit(this, attacker); }

  getCurrentHitbox() { return Hitbox.getCurrentHitbox(this); }
  getAttackHitbox() { return Hitbox.getAttackHitbox(this); }
  getKeysForSymbol(sym) { return Hitbox.getKeysForSymbol(this, sym); }

  handleInput() {
    // guardar si estábamos en suelo antes de procesar inputs,
    // para que specials puedan detectar supersalto aún cuando Buffer ponga onGround=false
    this._prevOnGround = !!this.onGround;
    Buffer.handleInput(this);
    // detectar specials inmediatamente después de que el buffer reciba el input
    // (permite activar supersalto antes de que la asignación de vy "normal" quede final)
    this.checkSpecialMoves();
    // limpiar flag auxiliar (opcional, se recalculará en la siguiente frame)
    delete this._prevOnGround;

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
    // Manejo de supersalto: restaurar gravedad cuando expire el efecto
    if (this._supersaltoActive) {
      const elapsed = millis() - (this._supersaltoStart || 0);
      if (elapsed >= (this._supersaltoDuration || 0)) {
        if (typeof this._supersaltoOriginalGravity === 'number') this.gravity = this._supersaltoOriginalGravity;
        this._supersaltoOriginalGravity = undefined;
        this._supersaltoStart = 0;
        this._supersaltoDuration = 0;
        this._supersaltoActive = false;
      }
    }

    // pequeñas responsabilidades delegadas:
    Buffer.handlePendingDiagRelease(this);
    this.trimBuffer();
    Attacks.updateAttackState(this);
    Buffer.unlockInputsIfNeeded(this);
    Buffer.resetCombosIfExpired(this);

    Movement.updateMovement(this);

    this.checkSpecialMoves();

    // limpiar dashLight cuando su duración expire (evita overlays "fantasma")
    if (this.dashLightStart && (millis() - this.dashLightStart >= (this.dashLightDuration || 0))) {
      this.dashLightStart = 0;
      this.dashLightDuration = 0;
      delete this.dashLightAnchorX;
      delete this.dashLightAnchorY;
      delete this.dashLightFacing;
    }

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
      // respetar niveles de hit: hit1 / hit2 / hit3 si existen
      const lvl = this.hitLevel || 1;
      const stateName = 'hit' + Math.max(1, Math.min(3, lvl));
      this.setState(stateName);
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

  // llamada ligera durante hitstop: avanza timers de ataque/hit sin ejecutar movimiento completo
  updateDuringHitstop() {
    // avanzar estado de ataque para que startup/active/recovery cierren
    if (typeof Attacks !== 'undefined' && Attacks.updateAttackState) {
      Attacks.updateAttackState(this);
    }

    // permitir salir de hit si elapsed (asegura que Anim exista y tenga exitHitIfElapsed)
    if (typeof Anim !== 'undefined' && Anim.exitHitIfElapsed) {
      Anim.exitHitIfElapsed(this);
    }

    // Forzar salida de isHit si por alguna razón no se limpió (protección)
    if (this.isHit && (millis() - (this.hitStartTime || 0) >= (this.hitDuration || 0))) {
      this.isHit = false;
      // restablecer estado base según direcciones sostenidas
      const stillDir = this.keys && (this.keys.left || this.keys.right);
      this.runActive = !!stillDir;
      if (this.runActive && stillDir) this.setState('run');
      else this.setState('idle');
    }

    // aplicar física mínima para que el golpeado reciba knockback y no quede inmóvil.
    // no ejecutamos full Movement.updateMovement para mantener "congelación" de hitstop feel,
    // pero sí dejamos avanzar la posición por la velocidad actual y la gravedad.
    this.vx = this.vx || 0;
    this.vy = this.vy || 0;
    // aplicar fricción ligera horizontal (para evitar drift infinito)
    // reducir fricción horizontal si es hit3 (menos desaceleración)
    let minFriction = 0.04;
    if (this.hitLevel === 3) minFriction *= 0.15; // 15% de la fricción normal -> vuela más
    if (this.vx > 0.01) this.vx = Math.max(0, this.vx - minFriction);
    if (this.vx < -0.01) this.vx = Math.min(0, this.vx + minFriction);

    this.x += this.vx;
    this.vy += (this.gravity || 0.3);
    this.y += this.vy;

    if (this.y >= height - 72) { this.y = height - 72; this.vy = 0; this.onGround = true; }
    else this.onGround = false;

    this.x = constrain(this.x, 0, width - this.w);

    // avanzar contadores de estado/animación para evitar bloqueos visuales
    if (this.state) this.state.timer = (this.state.timer || 0) + 1;
    this.frameTimer = (this.frameTimer || 0) + 1;
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
    // Desactiva run durante el dash para evitar conflictos; al acabar se reevalúa runActive
    this.runActive = false;
    // fuerza un pequeño impulso inicial para responsividad (mejora feel)
    const initialBoost = (this.dashSpeed || 14) * 0.6;
    this.vx = initialBoost * this.dashDirection;

    // dash light: dura un poco más que el dash y sirve para el overlay visual
    this.dashLightStart = this.dashStartTime;
    // duración total de la luz (incluye fase post-dash donde se encoge verticalmente)
    this.dashLightDuration = Math.max(1, this.dashDuration + 220); // ajustar si quieres más/menos

    // Guardar facing y ancla visual para la dashLight (no debe seguir cambios de facing/posición)
    // anchorX se fija en el momento del dash para que la luz "permanezca" delante del punto inicial
    const centerX = this.x + this.w / 2;
    const centerY = this.y + this.h / 2 - 6;
    // menor forwardPeak para que no parezca "proyectil" (ajústalo si quieres)
    const forwardPeak = 18;
    this.dashLightFacing = this.dashDirection || this.facing || 1;
    // anchor en coordenadas del mundo (no se recalcula después)
    this.dashLightAnchorX = Math.round(centerX + forwardPeak * this.dashLightFacing);
    this.dashLightAnchorY = Math.round(centerY);
  }
}

export { Fighter };
