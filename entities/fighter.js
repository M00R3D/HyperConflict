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
  constructor(opts = {}) {
    // opts: { x, col, id, charId, assets, actions }
    const { x = 0, col = color(255), id = 'p?', charId = 'default', assets = {}, actions = {} } = opts;
    Init.initBase(this, x, col, id);
    // aplicar stats personalizados si vienen en opts
    Object.assign(this, opts);
    this.charId = charId;
    try {
      console.log('[Fighter ctor] creating', id, 'charId=', charId, 'assetsKeys=', Object.keys(assets || {}));
      try { console.log('[Fighter ctor] assets.spit present=', !!assets.spit, 'len=', Array.isArray(assets.spit) ? assets.spit.length : String(assets.spit)); } catch (e) {}
      try { console.log('[Fighter ctor] assets.spitProj present=', !!assets.spitProj, 'len=', Array.isArray(assets.spitProj) ? assets.spitProj.length : String(assets.spitProj)); } catch (e) {}
    } catch (e) {}
    // usar assets y actions provistos
    Init.initFrames(this, {
      idleFramesByLayer: assets.idle, walkFramesByLayer: assets.walk, jumpFramesByLayer: assets.jump,
      fallFramesByLayer: assets.fall, runFramesByLayer: assets.run, punchFramesByLayer: assets.punch,
      punch2FramesByLayer: assets.punch2, punch3FramesByLayer: assets.punch3, kickFramesByLayer: assets.kick,
      kick2FramesByLayer: assets.kick2, kick3FramesByLayer: assets.kick3, crouchFramesByLayer: assets.crouch,
      crouchWalkFramesByLayer: assets.crouchWalk, hitFramesByLayer: assets.hit, hit2FramesByLayer: assets.hit2, hit3FramesByLayer: assets.hit3,
      flybackFramesByLayer: assets.flyback, flyupFramesByLayer: assets.flyup,
      shootFramesByLayer: assets.shoot, projectileFramesByLayer: assets.projectile,
      tatsFramesByLayer: assets.tats, tatsProjFramesByLayer: assets.tatsProjFramesByLayer,
      // sbluer spit overlay and spit projectile frames
      spitFramesByLayer: assets.spit,
      spitProjFramesByLayer: assets.spitProj,
      dashLightFramesByLayer: assets.dashLight,
      dashFramesByLayer: assets.dash,
      tauntFramesByLayer: assets.taunt, blockFramesByLayer: assets.block, crouchBlockFramesByLayer: assets.crouchBlock,
      shor: assets.shor,
      bunProj: assets.bunProj,
      bunString: assets.bunString,
      grabFramesByLayer: assets.grab,           // <-- CORRECTO
      grabbedFramesByLayer: assets.grabbed,     // <-- CORRECTO
      knockingFramesByLayer: assets.knocking, // <-- AGREGADO
      knockedFramesByLayer: assets.knocked,   // <-- AGREGADO
      recoveryFramesByLayer: assets.recovery, // <-- AGREGADO
      crouchPunchFramesByLayer: assets.crouchpunch, // <-- AGREGADO
      crouchKickFramesByLayer: assets.crouchkick, // <-- AGREGADO
      staplerFramesByLayer: assets.stapler,
      stapleProjFramesByLayer: assets.staple,
      
    });
    // Diagnostic: log presence/lengths of crouchpunch-related assets/frames
    try {
      const hasAsset = !!(assets && assets.crouchpunch);
      const lenCamel = (this.crouchPunchFramesByLayer && this.crouchPunchFramesByLayer[0]) ? this.crouchPunchFramesByLayer[0].length : 0;
      const lenLower = (this.crouchpunchFramesByLayer && this.crouchpunchFramesByLayer[0]) ? this.crouchpunchFramesByLayer[0].length : 0;
      // console.log('[Fighter ctor]', { id: this.id, charId: this.charId, assetsHasCrouchpunch: hasAsset, crouchPunch_len_camel: lenCamel, crouchpunch_len_lower: lenLower });
    } catch (e) {}
    // weapon (optional overlay) — no forma parte de la animación principal
    this.weaponFramesByLayer = assets.weapon || null;
    // recibir `actions` desde opts pero aplicarlos después de crear el mapping por defecto
    // (se fusionarán por llave con las acciones por defecto más abajo)
    this._incomingActions = actions || {};
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
      // "tats" animation (personaje) - si no hay frames se ignora
      tats:    { anim: this.tatsFramesByLayer, frameDelay: 4, duration: 820 },
      crouch:  { anim: this.crouchFramesByLayer, frameDelay: 10 },
      crouchwalk: { anim: this.crouchWalkFramesByLayer, frameDelay: 10 },
      hit:     { anim: this.hitFramesByLayer, frameDelay: 10 },
      hit1:    { anim: this.hit1FramesByLayer || this.hitFramesByLayer, frameDelay: 6, duration: 200 },
      hit2:    { anim: this.hit2FramesByLayer || this.hitFramesByLayer, frameDelay: 6, duration: 200 },
      hit3:    { anim: this.hit3FramesByLayer || this.hitFramesByLayer, frameDelay: 6, duration: 200 },
      flyback: { anim: this.flybackFramesByLayer || this.hitFramesByLayer, frameDelay: 10, duration: 800 },
      flyup:   { anim: this.flyupFramesByLayer || this.hitFramesByLayer, frameDelay: 10, duration: 800 },
      hadouken: { anim: this.shootFramesByLayer, frameDelay: 6, duration: 600 },
      dash:    { anim: this.dashFramesByLayer, frameDelay: 10, duration: 1200 }, // <-- agregado
      taunt:  { anim: this.tauntFramesByLayer, frameDelay: 10, duration: 800 }, // <-- agregado
      block:  { anim: this.blockFramesByLayer, frameDelay: 10, duration: 800 } ,// <-- agregado
      crouchBlock:  { anim: this.crouchBlockFramesByLayer, frameDelay: 10, duration: 800 } ,// <-- agregado
      blockStun: { anim: this.blockFramesByLayer, frameDelay: 10, duration: 540 }, // <-- agregado
      crouchBlockStun: { anim: this.crouchBlockFramesByLayer, frameDelay: 10, duration: 540 }, // <-- agregado
      // NEW: bun special visual using shor frames
      bun: { anim: this.shorFramesByLayer, frameDelay: 6, duration: 700 },
      grab: { anim: this.grabFramesByLayer, frameDelay: 6, duration: 500 },
      grabbed: { anim: this.grabbedFramesByLayer, frameDelay: 6, duration: 500 },
      knocking: { anim: this.knockingFramesByLayer, frameDelay: 10, duration: 600 }, // <-- nuevo estado intermedio (no usado)
      // usar las duraciones configurables creadas en initBase y aumentar ligeramente frameDelay
      knocked: { anim: this.knockedFramesByLayer, frameDelay: 7, duration: (this.knockedDurationMs || 800) },
      recovery: { anim: this.recoveryFramesByLayer, frameDelay: 7, duration: (this.recoveryDurationMs || 1200) },
      // dashLight: { anim: this.dashLightFramesByLayer, frameDelay: 10, duration: 300 }, // <-- nuevo estado intermedio (no usado)
      crouchpunch: { anim: this.crouchPunchFramesByLayer, frameDelay: 6, duration: 500 }, // <-- nuevo ataque de ejemplo
      crouchkick: { anim: this.crouchKickFramesByLayer, frameDelay: 6, duration: 500 },
      crouchKick: { anim: this.crouchKickFramesByLayer, frameDelay: 6, duration: 500 },
      stapler: { anim: this.staplerFramesByLayer, frameDelay: 5, duration: 360 },
    };

    // aplicar overrides pasados en opts.actions: fusionar por llave (no eliminar campos por defecto)
    if (this._incomingActions && typeof this._incomingActions === 'object') {
      for (const k in this._incomingActions) {
        this.actions[k] = Object.assign({}, this.actions[k] || {}, this._incomingActions[k]);
      }
    }
    // create aliases between camelCase and lowercase crouch action keys so incoming
    // per-character configs (which may use `crouchKick`) override defaults regardless of casing
    try {
      if (this.actions) {
        if (this.actions.crouchKick && !this.actions.crouchkick) this.actions.crouchkick = Object.assign({}, this.actions.crouchKick);
        if (this.actions.crouchkick && !this.actions.crouchKick) this.actions.crouchKick = Object.assign({}, this.actions.crouchkick);
        if (this.actions.crouchPunch && !this.actions.crouchpunch) this.actions.crouchpunch = Object.assign({}, this.actions.crouchPunch);
        if (this.actions.crouchpunch && !this.actions.crouchPunch) this.actions.crouchPunch = Object.assign({}, this.actions.crouchpunch);
      }
    } catch (e) {}
    delete this._incomingActions;
    
    // estado inicial
    this.state = { current: "idle", timer: 0, canCancel: true };

    this.lastTapTime = { left: 0, right: 0 };
    this.lastReleaseTime = { left: 0, right: 0 };
    // New: pendingTap is set on key release and can be invalidated by intervening keys
    this.pendingTap = { left: { time: 0, valid: false }, right: { time: 0, valid: false } };
    // Track when the current key press started per side (used to validate pendingTap on release)
    this.lastPressStart = { left: 0, right: 0 };
    // When any cancelling key (non-dir or opposite) occurs we set this timestamp; releases check it
    this.lastCancelAt = 0;
    this.lastNonDirPress = 0;
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
    this.grab = () => {
      // Prevent starting a grab if already grabbed/locked/hit/attacking
      if (this.state.current === 'grab' || this.state.current === 'grabbed' || this.isHit || this._grabLock || this.attacking) return;
      this.setState('grab');
      this.attacking = true;
      this.attackType = 'grab';
      this.attackStartTime = millis();
      this.attackDuration = (this.actions.grab && this.actions.grab.duration) || 500;
    };
  }

  // delegados
  setState(newState) { Anim.setState(this, newState); }
  addInput(symbol) { Buffer.addInput(this, symbol); }
  addInputFromKey(keyName) { Buffer.addInputFromKey(this, keyName); }
  trimBuffer() { Buffer.trimBuffer(this); }
  normalizeDiagonals() { Buffer.normalizeDiagonals(this); }

  checkSpecialMoves() { Specials.checkSpecialMoves(this); }

  attack(key) {
    // Delegar a módulo Attacks si existe (seguridad)
    try {
      if (typeof Attacks !== 'undefined' && typeof Attacks.attack === 'function') {
        Attacks.attack(this, key);
      }
    } catch (e) { /* silent */ }

    // Stamina system removed: no consumption on melee attack start.
  }

  attackHits(opponent) { return (typeof Attacks !== 'undefined' && typeof Attacks.attackHits === 'function') ? Attacks.attackHits(this, opponent) : false; }
  shoot() { try { if (typeof Attacks !== 'undefined' && typeof Attacks.shoot === 'function') Attacks.shoot(this); } catch (e) {} }

  // unified hit handler: delega a Attacks.hit (si existe) y procesa bloqueo/hit localmente
  hit(attacker = null) {
    // seguridad: nada que procesar
    if (!attacker) return;

    // guardar hp antes de delegados externos por si acaso (otros módulos podrían modificar hp)
    const hpBefore = (typeof this.hp === 'number') ? this.hp : null;

    // delegar a Attacks.hit si existe (efectos/partículas/sonidos)
    try { if (typeof Attacks !== 'undefined' && typeof Attacks.hit === 'function') Attacks.hit(this, attacker); } catch (e) {}

    // sanity: el atacante debe declarar tipo de ataque para decidir comportamiento
    if (!attacker || typeof attacker.attackType !== 'string') return;
    const atk = String(attacker.attackType || '').toLowerCase();
    const attackIsBlockable = (attacker.unblockable !== true);

    // considerar estados que actúan como bloqueo: bandera blocking + estados block / crouchBlock
    // y también blockStun / crouchBlockStun: mientras esté en cualquiera de estos NO debe recibir daño.
    const inBlockingState = !!(
      this.blocking ||
      this.state?.current === 'block' ||
      this.state?.current === 'crouchBlock' ||
      this.state?.current === 'blockStun' ||
      this.state?.current === 'crouchBlockStun'
    );

    // Si está en bloqueo y el ataque puede bloquearse, ANULA cualquier daño aplicado y aplica block-stun.
    if (inBlockingState && attackIsBlockable) {
      // revertir HP si algún otro código lo redujo
      if (hpBefore !== null && typeof this.hp === 'number') {
        this.hp = hpBefore;
      }
      // refrescar/establecer blockStun timers sin marcar isHit
      this.blockStunStartTime = millis();
      const dur = (this.crouching ? (this.crouchBlockStunDuration || 540) : (this.blockStunDuration || 540));
      this.blockStunDuration = Math.max(this.blockStunDuration || 0, dur);
      try {
        if (this.crouching) this.setState('crouchBlockStun');
        else this.setState('blockStun');
      } catch (e) {}
      // notificar al atacante/attacks que fue bloqueado (si existe hook)
      try { if (typeof Attacks !== 'undefined' && typeof Attacks.onBlock === 'function') Attacks.onBlock(this, attacker); } catch (e) {}
      // interrumpe cadena de hits (block rompe el combo que escala hitLevel)
      this._consecutiveHits = 0;
      this._consecutiveHitAt = 0;
      return;
    }

    // --- No está bloqueando -> procesar hit normal ---
    if (typeof this.hp !== 'number') return;

    const now = millis();
    const chainWindow = 800; // ms: ventana para considerar golpes "consecutivos" (ajusta a gusto)

    // resetar cadena si pasó mucho tiempo desde el último golpe
    if (!this._consecutiveHitAt || (now - (this._consecutiveHitAt || 0)) > chainWindow) {
      this._consecutiveHits = 0;
    }

    // Si el atacante forzó un nivel (p. ej. shoryuken), respetarlo; si no, incrementar por cadena
    let resolvedHitLevel = null;
    if (typeof attacker.forcedHitLevel === 'number') {
      resolvedHitLevel = Math.max(1, Math.min(3, Math.floor(attacker.forcedHitLevel)));
      // reset or set consecutive tracking to match forced level
      this._consecutiveHits = resolvedHitLevel;
      this._consecutiveHitAt = now;
    } else {
      // incrementar la cuenta de golpes consecutivos del defensor
      this._consecutiveHits = (this._consecutiveHits || 0) + 1;
      if (this._consecutiveHits > 3) this._consecutiveHits = 3;
      this._consecutiveHitAt = now;
      resolvedHitLevel = this._consecutiveHits;
    }

    // Si Attacks.hit ya aplicó daño externamente, no volver a aplicarlo.
    // Si no se aplicó daño (hpBefore === this.hp), aplicamos daño básico desde attacker.damageQuarters o fallback 1.
    if (hpBefore !== null && typeof this.hp === 'number' && this.hp === hpBefore) {
      const damageQuarters = (typeof attacker.damageQuarters === 'number') ? attacker.damageQuarters : 1;
      this.hp = Math.max(0, this.hp - damageQuarters);
    }

    // Stamina system removed: do not modify stamina when hit.

    // marcar hit state y tiempos
    this.isHit = true;
    this.hitStartTime = millis();
    this.hitLevel = resolvedHitLevel || 1;

    const levelDurMap = {
      1: (this.actions?.hit1?.duration || 500),
      2: (this.actions?.hit2?.duration || 700),
      3: (this.actions?.hit3?.duration || 1000)
    };
    this.hitDuration = levelDurMap[this.hitLevel] || (this.hitDuration || 260);

    // set animation state correspondiente (hit1/2/3 preferido)
    try {
      const s = (this.hitLevel === 1 ? 'hit1' : this.hitLevel === 2 ? 'hit2' : 'hit3');
      this.setState(s);
    } catch (e) {}

    // --- NUEVO: asegurar aplicación inmediata y determinista del knockback usando la tabla por-ataque ---
    try {
      // resolver charId/attackName de forma robusta (soporta proyectiles con ownerRef/ownerId)
      const attackName = String((attacker && attacker.attackType) || 'default').toLowerCase();
      let charId = attacker && (attacker.charId || attacker.char || attacker._charId || attacker.charName) || null;
      if (!charId && attacker && attacker.ownerRef && attacker.ownerRef.charId) charId = attacker.ownerRef.charId;
      if (!charId && attacker && attacker.owner && attacker.owner.charId) charId = attacker.owner.charId;
      if (!charId && attacker && attacker.ownerId && typeof window !== 'undefined') {
        if (window.player1 && window.player1.id === attacker.ownerId) charId = window.player1.charId;
        else if (window.player2 && window.player2.id === attacker.ownerId) charId = window.player2.charId;
      }
      if (!charId) charId = 'default';

      // obtener cfg desde el módulo de knockback (se expone en window para evitar ciclos)
      const cfg = (typeof window !== 'undefined' && typeof window.getKnockbackForAttack === 'function')
        ? window.getKnockbackForAttack(charId, attackName)
        : ({ h: 5, v: 1 });

      // dirección "away" (signed)
      const away = Math.sign((this.x || 0) - (attacker.x || 0)) || ((attacker && attacker.facing ? attacker.facing : 1) * -1) || 1;

      // si ya hay knockback activo y estamos en el aire -> duplicar la magnitud (re-hit)
      if (this._knockback && !this.onGround) {
        // multiplicar magnitud existente
        try {
          this._knockback.vx = (this._knockback.vx || 0) * 2;
          this._knockback.vy = (this._knockback.vy || 0) * 2;
        } catch (e) { /* silent */ }
        // console.log('[KB FORCE APPLY] doubled existing knockback (re-hit in air)', { target: this.id, from: attacker?.id, now: this._knockback });
      } else {
        // crear/rewire knockback persistente según la tabla
        const finalH = Math.round(Math.abs(cfg.h || 0));
        const finalV = Math.round(Math.abs(cfg.v || 0));
        const kb = {
          vx: finalH * away,
          vy: -(finalV), // vy negative = up
          decay: 1,
          frames: 1,
          sourceId: attacker?.id || null
        };
        this._knockback = Object.assign({}, kb);
        // pending para hitstop consumption
        this._pendingKnockback = { magX: Math.abs(kb.vx), y: kb.vy, away, applied: false, _markLaunched: { start: millis(), duration: 600 } };

        // marcar launched/onGround false para asegurar física
        this._launched = true;
        this._launchedStart = millis();
        this._launchedDuration = Math.max(this._launchedDuration || 0, 600);
        this.onGround = false;

        // console.log('[KB FORCE APPLY] applied per-attack knockback', { target: this.id, from: attacker?.id, charId, attackName, cfg, kb });
      }
    } catch (e) {
      console.warn('[KB FORCE APPLY] failed', e);
    }

    // Si HP llega a 0 forzar knockdown y limpiar estados que podrían bloquear transiciones
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.blocking = false;
      this.blockStunStartTime = 0;
      this.attacking = false;
      this.isHit = false;
      // reset consecutive hits on death
      this._consecutiveHits = 0;
      this._consecutiveHitAt = 0;
      try { this.setState('knocked'); } catch (e) {}
    }
  }
  getCurrentHitbox() { return Hitbox.getCurrentHitbox(this); }
  getAttackHitbox() { return Hitbox.getAttackHitbox(this); }
  getKeysForSymbol(sym) { return Hitbox.getKeysForSymbol(this, sym); }

  handleInput() {
    // guardar si estábamos en suelo antes de procesar inputs,
    // para que specials puedan detectar supersalto aún cuando Buffer ponga onGround=false
    this._prevOnGround = !!this.onGround;

    // NEW: si estamos ejecutando un taunt (animación/lock), IGNORAR todos los inputs hasta que termine.
    // Esto evita que mover/atacar o specials reemplacen el estado taunt mientras su animación/tiempo está activo.
    if (this.state && this.state.current === 'taunt' && this.attacking) {
      return;
    }

    // Si estamos técnicamente "muertos" (HP <= 0) no procesar inputs ni permitir bloqueo.
    // Evita que un actor sin HP entre en block u otros estados de control.
    if (typeof this.hp === 'number' && this.hp <= 0) return;

    // Si estamos en block-stun forzado, IGNORAR completamente inputs (movimiento/ataque/dash).
    // Esto asegura que el stun dure exactamente la duración declarada en init, independientemente
    // de teclas presionadas/soltadas.
    if (this.state && (this.state.current === 'blockStun' || this.state.current === 'crouchBlockStun')) {
      // no procesar buffer ni specials; conservar _prevOnGround para compatibilidad y salir.
      return;
    }

    // Si somos EL QUE AGARRÓ y estamos en holding, no permitir caminar ni cambiar facing.
    // Esto impide dash/walk/facing changes mientras mantiene la espera del botón de soltar
    // (la lógica de liberación usa keysPressed[ 'u' | 'v' ] en update()).
    if (this.state && this.state.current === 'grab' && this._grabHolding) {
      // aún llamamos a Buffer.trimBuffer para mantener limpieza, pero no procesamos inputs
      this.trimBuffer();
      return;
    }

    // NEW: si salimos recientemente de un grab, bloquear inputs/movimiento durante un breve cooldown
    // Esto evita que el que lanzó pueda moverse inmediatamente y que inputs residuales interfieran con el lanzamiento.
    const grabExitStart = this._grabExitCooldownStart || 0;
    const grabExitDur = this._grabExitCooldownDuration || 220; // ms por defecto
    if (grabExitStart && (millis() - grabExitStart) < grabExitDur) {
      // mantener buffer limpio y no procesar nuevos inputs hasta que expire el cooldown
      this.trimBuffer();
      return;
    }
    
    Buffer.handleInput(this);
    // detectar specials inmediatamente después de que el buffer reciba el input
    // (permite activar supersalto antes de que la asignación de vy "normal" quede final)
    this.checkSpecialMoves();
    // track cancelling presses (non-directional or opposite-direction) and mark lastCancelAt
    try {
      const nowKs = millis();
      if (this.id === 'p1') {
        for (const k in keysPressed) {
          if (!keysPressed[k]) continue;
          if (k !== 'a' && k !== 'd') {
            this.lastCancelAt = nowKs; // non-direction cancels pending taps
            this.pendingTap.left.valid = false; this.pendingTap.right.valid = false;
            break;
          }
        }
      } else {
        for (const k in keysPressed) {
          if (!keysPressed[k]) continue;
          if (k !== 'arrowleft' && k !== 'arrowright') {
            this.lastCancelAt = nowKs;
            this.pendingTap.left.valid = false; this.pendingTap.right.valid = false;
            break;
          }
        }
      }
    } catch (e) {}
    // limpiar flag auxiliar (opcional, se recalculará en la siguiente frame)
    delete this._prevOnGround;
    
    const now = millis();

    // Detecta el evento de pulsación (solo cuando la tecla se presiona, no mantenida)
    // Para P1
    if (this.id === 'p1') {
      // Izquierda
      if (keysPressed['a']) {
        // pressing opposite direction should cancel any pending double-tap from the other side
        try { this.lastReleaseTime.right = 0; } catch (e) {}
        // require two adjacent '←' entries in the input buffer within the double-tap window
        const bufAllL = this.inputBuffer || [];
        const lastL = bufAllL[bufAllL.length - 1];
        const prevL = bufAllL[bufAllL.length - 2];
        const lastTwoLeft = lastL && prevL && lastL.symbol === '←' && prevL.symbol === '←' && (lastL.time - prevL.time) <= 250;
        if (lastTwoLeft && this.state.current !== "dash" && this.lastCancelAt <= prevL.time) {
          this.dash(-1);
        }
        this.lastTapTime.left = now;
        // cambiar facing en el evento de pulsación (solo al iniciar la pulsación)
        this.facing = -1;
      }
      if (keysUp['a']) {
        this.lastReleaseTime.left = now;
      }
      // Derecha
      if (keysPressed['d']) {
        // pressing opposite direction should cancel any pending double-tap from the other side
        try { this.lastReleaseTime.left = 0; } catch (e) {}
        // require two adjacent '→' entries in the input buffer within the double-tap window
        const bufAllR = this.inputBuffer || [];
        const lastR = bufAllR[bufAllR.length - 1];
        const prevR = bufAllR[bufAllR.length - 2];
        const lastTwoRight = lastR && prevR && lastR.symbol === '→' && prevR.symbol === '→' && (lastR.time - prevR.time) <= 250;
        if (lastTwoRight && this.state.current !== "dash" && this.lastCancelAt <= prevR.time) {
          this.dash(1);
        }
        this.lastTapTime.right = now;
        // cambiar facing en el evento de pulsación (solo al iniciar la pulsación)
        this.facing = 1;
      }
      if (keysUp['d']) {
        this.lastReleaseTime.right = now;
      }
    } else {
      // P2 (arrow keys)
      if (keysPressed['arrowleft']) {
        try { this.lastReleaseTime.right = 0; } catch (e) {}
        const bufAllL2 = this.inputBuffer || [];
        const lastL2 = bufAllL2[bufAllL2.length - 1];
        const prevL2 = bufAllL2[bufAllL2.length - 2];
        const lastTwoLeft2 = lastL2 && prevL2 && lastL2.symbol === '←' && prevL2.symbol === '←' && (lastL2.time - prevL2.time) <= 250;
        if (lastTwoLeft2 && this.state.current !== "dash" && this.lastCancelAt <= prevL2.time) {
          this.dash(-1);
        }
        this.lastTapTime.left = now;
        this.facing = -1;
      }
      if (keysUp['arrowleft']) {
        this.lastReleaseTime.left = now;
      }
      if (keysPressed['arrowright']) {
        try { this.lastReleaseTime.left = 0; } catch (e) {}
        const bufAllR2 = this.inputBuffer || [];
        const lastR2 = bufAllR2[bufAllR2.length - 1];
        const prevR2 = bufAllR2[bufAllR2.length - 2];
        const lastTwoRight2 = lastR2 && prevR2 && lastR2.symbol === '→' && prevR2.symbol === '→' && (lastR2.time - prevR2.time) <= 250;
        if (lastTwoRight2 && this.state.current !== "dash" && this.lastCancelAt <= prevR2.time) {
          this.dash(1);
        }
        this.lastTapTime.right = now;
        this.facing = 1;
      }
      if (keysUp['arrowright']) {
        this.lastReleaseTime.right = now;
      }
    }

    // --- bloqueo: mantener "back" relativo al facing activa bloqueo ---
    // back = izquierda cuando facing === 1 ; back = derecha cuando facing === -1
    const holdingBack = (this.facing === 1 && this.keys.left) || (this.facing === -1 && this.keys.right);

    // determinar amenaza del oponente:
    let opponentThreat = false;
    if (this.opponent) {
      try {
        const opp = this.opponent;
        const now2 = millis();
        const attackActive = !!opp.attacking;
        const recentAttack = !!(opp.attackStartTime && (now2 - opp.attackStartTime) < ((opp.attackDuration || 400) + 250));
        opponentThreat = attackActive || recentAttack;
      } catch (e) {
        opponentThreat = !!(this.opponent && this.opponent.attacking);
      }
    }
    // determinar bloqueo (back + en suelo + no hit/attacking + amenaza)
    this.blocking = !!(holdingBack && this.onGround && !this.isHit && !this.attacking && opponentThreat);
  }
   
   update() {
    // antes de todo, consumir pending knockback si existe y no estamos en hitstop/pause
    if (!window.PAUSED && !window.HITSTOP_ACTIVE && this._pendingKnockback && !this._pendingKnockback.applied) {
      try {
        const pk = this._pendingKnockback;
        this.vx = (pk.magX || 0) * (pk.away || 1);
        this.vy = (typeof pk.y === 'number') ? pk.y : 0;
        this._pendingKnockback.applied = true;
        if (pk._markLaunched) {
          this._launched = true;
          this._launchedStart = pk._markLaunched.start || millis();
          this._launchedDuration = pk._markLaunched.duration || 600;
        }
        // console.log('[KB APPLIED DURING UPDATE]', { target: this.id, vx: this.vx, vy: this.vy });
      } catch (e) { console.warn('[KB APPLY] during update failed', e); }
    }

    // Si estamos siendo agarrados, congelar en 'grabbed' y no procesar lógica normal
    if (this._grabLock) {
      this.vx = 0; this.vy = 0;
      // mantener estado grabbed y animación
      this.setState('grabbed');
      Anim.updateAnimation(this);
      if (this.grabbedBy) {
        // mantener posición relativa al quien agarro (si existe referencia)
        const grabber = this.grabbedBy;
        const offsetX = (typeof grabber._grabVictimOffsetX === 'number') ? grabber._grabVictimOffsetX : ((grabber.facing === 1) ? (grabber.w - 6) : (-this.w + 6));
        this.x = grabber.x + offsetX;
        this.y = grabber.y;
        this.vx = 0; this.vy = 0;
      }
      // avanzar timers mínimos para evitar que todo quede congelado por siempre
      if (this.state) this.state.timer = (this.state.timer || 0) + 1;
      this.frameTimer = (this.frameTimer || 0) + 1;
      return;
    }

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
    // Priorizar block-stun para que ninguna otra rama sobreescriba el estado
    if (this.state && (this.state.current === 'blockStun' || this.state.current === 'crouchBlockStun')) {
      // mantener animación/timers hasta que exitHitIfElapsed determine el fin
      Anim.updateAnimation(this);
      this.state.timer = (this.state.timer || 0) + 1;
      // permitir que exitHitIfElapsed haga la transición cuando corresponda
      Anim.exitHitIfElapsed(this);
      return;
    }

    // APLICAR KNOCK/RECOVERY PRIORITARIO (mostrar visual y evitar ser sobreescrito)
    // Si existía un knock forzado mientras estábamos en pausa/hitstop, aplicarlo ahora
    if (this._forceKnocked && !window.PAUSED && !window.HITSTOP_ACTIVE) {
      try {
        // console.log(`[Fighter.update] applying _forceKnocked -> setState('knocked') for ${this.id}`);
        this.setState('knocked');
      } catch (e) {
        console.warn(`[Fighter.update] failed to apply forced knocked for ${this.id}`, e);
      } finally {
        delete this._forceKnocked;
      }
    }

    if (this.state && (this.state.current === 'knocked' || this.state.current === 'recovery' || this.state.current === 'knocking')) {
      // Mantener la animación y dejar que exitHitIfElapsed haga las transiciones temporales
      Anim.updateAnimation(this);
      this.state.timer = (this.state.timer || 0) + 1;
      Anim.exitHitIfElapsed(this);
      return;
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
    } else if (this._launched) {
      // mostrar la animación de lanzamiento (flyup/flyback) mientras dure el lanzamiento
      this.setState(this._launched);
      // opcional: si el tiempo de lanzamiento expiró, quitar la marca (se limpiará definitivamente en exitHitIfElapsed)
      if (this._launchedStart && this._launchedDuration && (millis() - this._launchedStart >= this._launchedDuration)) {
        delete this._launched;
        delete this._launchedStart;
        delete this._launchedDuration;
      }
    } else if (this.isHit) {
      // respetar niveles de hit: hit1 / hit2 / hit3 si existen (caso normal)
      const lvl = this.hitLevel || 1;
      const stateName = 'hit' + Math.max(1, Math.min(3, lvl));
      this.setState(stateName);
    } else if (this.attacking && this.attackType) {
      // normalize attack state name to lowercase to match asset keys (avoid casing mismatches)
      try {
        this.setState(String(this.attackType).toLowerCase());
      } catch (e) {
        this.setState(this.attackType);
      }
    } else if (this.blocking && this.onGround) {
      // bloqueo en pie o agachado: si además estamos agachando, usar crouchBlock
      if (this.crouching) this.setState('crouchBlock');
      else this.setState('block');
      // detener desplazamiento horizontal al bloquear
      this.vx = 0;
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

    // --- lógica de agarre (grab) ---
    if (this.state.current === 'grab' && this._grabHolding) {
      // Congelar en último frame
      if (this.grabFramesByLayer && this.grabFramesByLayer[0]?.length) {
        this.frameIndex = this.grabFramesByLayer[0].length - 1;
      } else {
        this.frameIndex = 0;
      }

      // Mantener al oponente pegado cada frame si existe
      if (this.opponent && this.opponent._grabLock) {
        const offsetX = (typeof this._grabVictimOffsetX === 'number') ? this._grabVictimOffsetX : ((this.facing === 1) ? (this.w - 6) : (-this.opponent.w + 6));
        this.opponent.x = this.x + offsetX;
        this.opponent.y = this.y;
        this.opponent.vx = 0;
        this.opponent.vy = 0;
        // asegurar estado grabbed
        this.opponent.setState('grabbed');
      }

      // Asegurar que el que agarra no pueda moverse hasta que termine el grab
      // (evita jump/run/walk justo antes/durante de aventar)
      this.vx = 0;
      this.vy = 0;
      this.keys.left = false;
      this.keys.right = false;
      this.keys.up = false;
      this.runActive = false;

      // Permitir "aventar" al rival mientras se mantiene el botón de grab:
      // - tecla IZQ/DER -> flyback (horizontal) con mayor knockback
      // - tecla ARRIBA   -> flyup (vertical) con mayor loft
      let throwDir = null;
      if (this.id === 'p1') {
        if (keysPressed['a']) throwDir = 'left';
        else if (keysPressed['w']) throwDir = 'up';
        else if (keysPressed['d']) throwDir = 'right';
      } else {
        if (keysPressed['arrowleft']) throwDir = 'left';
        else if (keysPressed['arrowup']) throwDir = 'up';
        else if (keysPressed['arrowright']) throwDir = 'right';
      }

      if (throwDir) {
        // consumir el input para evitar retriggers
        if (this.id === 'p1') {
          keysPressed['a'] = false; keysPressed['w'] = false; keysPressed['d'] = false;
        } else {
          keysPressed['arrowleft'] = false; keysPressed['arrowup'] = false; keysPressed['arrowright'] = false;
        }

        // bloquear movimiento adicional del lanzador durante el frame del throw
        this.vx = 0;
        this.vy = 0;
        this.keys.left = false;
        this.keys.right = false;
        this.keys.up = false;
        this.runActive = false;

        // marcar que dejamos de sostener antes de aplicar efectos (pero ya congelados)
        this._grabHolding = false;

        // Liberar y aplicar lanzamiento exagerado al oponente si existe
        if (this.opponent && this.opponent.state.current === 'grabbed') {
          const victim = this.opponent;
          victim._grabLock = false;
          victim.grabbedBy = null;

          // efectos comunes de lanzamiento
          victim.isHit = true;
          victim.hitLevel = 3;
          victim.hitStartTime = millis();
          // duración de hit/launch muy ampliada para que la animación y movimiento persistan
          victim.hitDuration = Math.max(victim.hitDuration || 760, 1400);

          // marcar que se le lanzó para evitar que la lógica de hit sobrescriba la animación
          victim._suppressHitState = true;

          if (throwDir === 'up') {
            // lanzamiento vertical fuerte -> usar flyup
            try { victim.setState('flyup'); } catch (e) {}
            // velocidades muy exageradas (ajusta si lo deseas)
            victim.vx = 0;
            victim.vy = -6; // loft muy alto
            // marcar lanzamiento para que update() priorice flyup animation
            victim._launched = 'flyup';
            victim._launchedStart = millis();
            victim._launchedDuration = victim.hitDuration || 1600;
            // mantener isHit = true para hitstop/colisiones pero suprimir cambio a hit3
            victim.isHit = true;

            // evitar que otras rutinas reemplacen la animación por hit1/2/3
            victim._suppressHitState = true;
            // orientar sprite hacia dirección del impulso vertical por consistencia
            // no forzamos facing horizontal aquí
          } else {
            // lanzamiento horizontal exagerado -> usar flyback
            try { victim.setState('flyback'); } catch (e) {}
            // decidir signo en base a la tecla presionada (left/right)
            const dir = (throwDir === 'left') ? -1 : 1;
            // velocidades muy exageradas (ajusta si lo deseas)
            // horizontal fuerte para notarse claramente (se permite un pico alto)
            victim.vx = dir * 16;
            // loft también mayor para efecto dramático
            victim.vy = -6;
            // marcar lanzamiento para que update() priorice flyback animation y dure más
            victim._launched = 'flyback';
            victim._launchedStart = millis();
            victim._launchedDuration = victim.hitDuration || 1600;
            // asegurar que el estado visual no se reemplace por hit3
            victim._suppressHitState = true;
            // ajustar facing para que la animación "flyback" se vea correcta (girada si es hacia adelante)
            victim.facing = (victim.vx >= 0) ? 1 : -1;
          }
        }

        // LIMPIEZA COMPLETA DEL ESTADO DEL AGARRADOR para permitir reintentar inmediatamente
        this.setState('idle');
        this.attacking = false;
        this.attackType = null;
        this.attackStartTime = 0;
        this.attackDuration = 0;
        if (this._hitTargets) { this._hitTargets.clear(); this._hitTargets = null; }
        // desbloquear inputs y combos residuales
        if (this.inputLockedByKey) for (const k in this.inputLockedByKey) this.inputLockedByKey[k] = false;
        // quitar cualquier 'G' sobrante del buffer (evita que el primer intento tras soltar sea ignorado)
        try { Buffer.bufferConsumeLast(this, 1); } catch (e) {}
        this.setState('idle');
        this.attacking = false;
        this.attackType = null;
        delete this._grabVictimOffsetX;

        // START grab exit cooldown: evita movimiento/inputs inmediatos tras soltar/aventar
        this._grabExitCooldownStart = millis();
        this._grabExitCooldownDuration = this._grabExitCooldownDuration || 260; // ms (ajustable)

        // salir sin procesar la espera normal por boton de liberacion
        return;
      }

      // Esperar botón de grab para soltar (comportamiento por defecto)
      const grabKey = this.id === 'p1' ? 'u' : 'v';
      if (keysPressed[grabKey]) {
        this._grabHolding = false;
        // Asegurar limpieza de movimiento del que suelta
        this.vx = 0;
        this.vy = 0;
        this.keys.left = false; this.keys.right = false; this.keys.up = false; this.runActive = false;

        // Liberar al oponente si está agarrado
        if (this.opponent && this.opponent.state.current === 'grabbed') {
          this.opponent._grabLock = false;
          this.opponent.grabbedBy = null;
          // lanzar como hit3 (comportamiento existente)
          this.opponent.setState('hit3');
          this.opponent.isHit = true;
          this.opponent.hitLevel = 3;
          this.opponent.hitStartTime = millis();
          this.opponent.hitDuration = 520;
          const pushDir = this.facing || 1;
          this.opponent.vx = 7 * pushDir;
          this.opponent.vy = -5;
        }
        // LIMPIEZA COMPLETA DEL ESTADO DEL AGARRADOR para permitir reintentar inmediatamente
        this.setState('idle');
        this.attacking = false;
        this.attackType = null;
        this.attackStartTime = 0;
        this.attackDuration = 0;
        if (this._hitTargets) { this._hitTargets.clear(); this._hitTargets = null; }
        if (this.inputLockedByKey) for (const k in this.inputLockedByKey) this.inputLockedByKey[k] = false;
        try { Buffer.bufferConsumeLast(this, 1); } catch (e) {}
        this.setState('idle');
        this.attacking = false;
        this.attackType = null;
        delete this._grabVictimOffsetX;
        // START grab exit cooldown for normal release as well
        this._grabExitCooldownStart = millis();
        this._grabExitCooldownDuration = this._grabExitCooldownDuration || 260; // ms
      }
      // No avanzar animación ni lógica normal
      return;
    }

    Anim.updateAnimation(this);

    if (this.opponent) Movement.autoFace(this, this.opponent);

    this.state.timer++;
    Anim.exitHitIfElapsed(this);
  }

  // llamada ligera durante hitstop: avanza timers de ataque/hit sin ejecutar movimiento completo
  updateDuringHitstop() {
    // aplicar pending knockback (si existe) para que el golpeado se mueva durante hitstop
    if (this._pendingKnockback && !this._pendingKnockback.applied) {
      try {
        const pk = this._pendingKnockback;
        // aplicar away: magX * away (away = sign away from attacker)
        this.vx = (pk.magX || 0) * (pk.away || 1);
        this.vy = (typeof pk.y === 'number') ? pk.y : 0;
        // marcar aplicado y transferir launched mark
        this._pendingKnockback.applied = true;
        if (pk._markLaunched) {
          this._launched = true;
          this._launchedStart = pk._markLaunched.start || millis();
          this._launchedDuration = pk._markLaunched.duration || 600;
        }
        // console.log('[KB APPLIED DURING HITSTOP]', { target: this.id, vx: this.vx, vy: this.vy });
        // no borrar inmediatamente: keep applied=true to signal consumed
      } catch (e) { console.warn('[KB APPLY] during hitstop failed', e); }
    }

    // aplicar física mínima para que el golpeado reciba knockback y no quede inmóvil.
    // no ejecutamos full Movement.updateMovement para mantener "congelación" de hitstop feel,
    // pero sí dejamos avanzar la posición por la velocidad actual y la gravedad.
    this.vx = this.vx || 0;
    this.vy = this.vy || 0;
    // aplicar fricción ligera horizontal (para evitar drift infinito)
    // reducir fricción horizontal si es hit3 (menos desaceleración)
    let minFriction = 0.04;
    if (this.hitLevel === 3) minFriction = minFriction * 0.25;
    if (this._launched) minFriction = minFriction * 0.5;

    if (this.vx > 0.01) this.vx = Math.max(0, this.vx - minFriction);
    if (this.vx < -0.01) this.vx = Math.min(0, this.vx + minFriction);

    this.x += this.vx;
    this.vy += (this.gravity || 0.3);
    this.y += this.vy;

    if (this.y >= height - 72) {
      this.y = height - 72;
      this.vy = 0;
      this.onGround = true;
      // limpiar pendingKnockback después de tocar suelo si fue aplicado
      if (this._pendingKnockback && this._pendingKnockback.applied) {
        delete this._pendingKnockback;
        // console.log('[KB CLEARED ON LAND]', { target: this.id });
      }
    } else {
      this.onGround = false;
    }

    this.x = constrain(this.x, 0, width - this.w);

    // avanzar contadores de estado/animación para evitar bloqueos visuales
    if (this.state) this.frameTimer = (this.frameTimer || 0) + 1;
  }

  display() { Display.display(this); }

  // Stamina removed: compatibility stub for legacy calls — always allow actions.
  consumeStaminaFor(actionName) {
    return true;
  }

  dash(dir) {
    // small cooldown guard (opcional)
    if (millis() - (this.lastDashTime || 0) < (this.dashCooldown || 0)) return;
    // comprobar stamina suficiente para dash (8 cuartos)
    const ok = (typeof this.consumeStaminaFor === 'function') ? this.consumeStaminaFor('dash') : true;
    if (!ok) return; // no hay stamina suficiente -> no dash
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
    // (la stamina ya se consumió en la comprobación previa)
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
