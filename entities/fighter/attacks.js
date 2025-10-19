// entities/fighter/attacks.js
import * as Anim from './animation.js';
export function attack(self, key) {
  const now = millis();
  const chain = self.comboChainsByKey[key];
  if (!chain || chain.length === 0) return;
  if (self.inputLockedByKey[key]) return;

  const last = self.lastAttackTimeByKey[key] || 0;
  let step = self.comboStepByKey[key] || 0;
  if (now - last > self.comboWindow) step = 0;

  const attackName = chain[step] || chain[0];
  const action = self.actions[attackName];
  if (!action) { console.warn('Acción no definida en actions:', attackName); return; }

  self.attackType = attackName;
  self.setState(attackName);
  self.attacking = true;
  self.attackStartTime = now;
  self.attackDuration = action.duration || 400;
  // inicializar set de objetivos golpeados por esta activación (evita multi-hit repetido)
  self._hitTargets = new Set();
  self.lastAttackTimeByKey[key] = now;
  self.inputLockedByKey[key] = true;
  self.comboStepByKey[key] = (step + 1);
  if (self.comboStepByKey[key] >= chain.length) self.comboStepByKey[key] = 0;
}

export function attackHits(self, opponent) {
  if (!self.attacking) return false;
  if (!self._hitTargets) self._hitTargets = new Set();
  if (opponent && opponent.id && self._hitTargets.has(opponent.id)) return false;

  // --- GRAB: solo en el último frame (mejorado para sincronía temporal) ---
  if (self.attackType === 'grab') {
    const action = self.actions.grab || {};
    const totalFrames = (self.grabFramesByLayer && self.grabFramesByLayer[0]?.length) || 1;

    // calcular frame aproximado a partir del tiempo transcurrido para cubrir el caso
    // en que el main loop pregunta por colisiones antes de que anim.update haya incrementado frameIndex.
    const elapsed = millis() - (self.attackStartTime || 0);
    let approxFrameIndex = 0;
    if (totalFrames > 1 && action.duration) {
      approxFrameIndex = Math.floor((elapsed / Math.max(1, action.duration)) * totalFrames);
      approxFrameIndex = Math.max(0, Math.min(totalFrames - 1, approxFrameIndex));
    }

    const effectiveFrameIndex = Math.max((self.frameIndex || 0), approxFrameIndex);

    // sólo activo cuando alcanzamos el último frame efectivo
    if ((effectiveFrameIndex + 1) < totalFrames) return false;

    const atkHB = self.getAttackHitbox();
    if (!atkHB) return false;
    const oppHB = opponent.getCurrentHitbox();
    const collided = (
      atkHB.x < oppHB.x + oppHB.w &&
      atkHB.x + atkHB.w > oppHB.x &&
      atkHB.y < oppHB.y + oppHB.h &&
      atkHB.y + atkHB.h > oppHB.y
    );
    // Solo si el oponente NO está bloqueando ni en crouchBlock
    if (
      collided &&
      !opponent.blocking &&
      (!opponent.state || (opponent.state.current !== 'block' && opponent.state.current !== 'crouchBlock'))
    ) {
      // Marcar como agarrado (evita multi-hit)
      if (opponent && opponent.id) self._hitTargets.add(opponent.id);

      // LIMPIAR flags previos del oponente para evitar caer en hit
      opponent.attacking = false;
      opponent.attackType = null;
      opponent.attackStartTime = 0;
      opponent._hitTargets = null;
      // liberar locks de inputs previas del oponente
      if (opponent.inputLockedByKey) {
        for (const k in opponent.inputLockedByKey) opponent.inputLockedByKey[k] = false;
      }
      opponent.isHit = false; opponent.hitLevel = 0;

      // Posicionar al rival junto al agarrador (visual de levantar)
      const offsetX = (self.facing === 1) ? (self.w - 6) : (-opponent.w + 6);
      opponent.x = self.x + offsetX;
      opponent.y = self.y;
      opponent.vx = 0;
      opponent.vy = 0;

      // forzar timer / frame para que la animación grabbed empiece consistente
      if (opponent.state) opponent.state.timer = 0;
      opponent.frameIndex = 0;

      // Cambiar estado del oponente a grabbed y bloquearlo
      opponent.setState('grabbed');
      opponent.grabbedBy = self;
      opponent._grabLock = true;

      // además guardar referencia clara para que el grabber pueda mantener la posición
      self._grabHolding = true;
      self._grabVictimOffsetX = offsetX;

      // El que agarra queda en el último frame y en holding
      self._grabHolding = true;
      self.vx = 0;
      self.vy = 0;
      // prevenir que el grabber pierda su attacking flag hasta que suelte
      self.attacking = true;
      self.attackType = 'grab';
      return true;
    }
    return false;
  }

  const atkHB = self.getAttackHitbox();
  if (!atkHB) return false;
  const oppHB = opponent.getCurrentHitbox();
  const collided = (
    atkHB.x < oppHB.x + oppHB.w &&
    atkHB.x + atkHB.w > oppHB.x &&
    atkHB.y < oppHB.y + oppHB.h &&
    atkHB.y + atkHB.h > oppHB.y
  );

  if (collided) {
    // marcar como golpeado por esta activación para evitar múltiples hits
    if (opponent && opponent.id) self._hitTargets.add(opponent.id);
    return true;
  }
  return false;
}

export function shoot(self) {
  const dir = self.keys.right ? 1 : (self.keys.left ? -1 : (self.id === 'p1' ? 1 : -1));
  const Projectile = require('../../entities/projectile.js').Projectile;
  // en módulos ESM usar import; para simplicidad (evitar ciclos) puedes usar la clase que ya pasaste en constructor
  const p = new (require('../../entities/projectile.js').Projectile)(self.x + self.w / 2, self.y + self.h / 2, dir, 0, self.id);
  // push via projectiles global (preservando tu patrón original)
  const proj = require('../../core/main.js').projectiles;
  proj.push(p);
}

export function hit(self, attacker = null) {
  // seguridad: nada que procesar
  if (!attacker) return;
  try { console.log(`[Attacks.hit] ${self.id || '?'} hit by ${attacker.id || '?'} attack=${attacker.attackType}`); } catch(e){}
  // TRACE: nivel de hit previo (si existe) — nos interesa detectar recibir golpe adicional sobre hit3
  const prevHitLevel = (typeof self.hitLevel === 'number') ? self.hitLevel : 0;

  // guardar hp antes de delegados externos por si acaso (otros módulos podrían modificar hp)
  const hpBefore = (typeof self.hp === 'number') ? self.hp : null;

  // delegar a Attacks.hit si existe (efectos/partículas/sonidos)
  try { if (typeof Attacks !== 'undefined' && typeof Attacks.hit === 'function') Attacks.hit(this, attacker); } catch (e) {}

  // sanity: el atacante debe declarar tipo de ataque para decidir comportamiento
  if (!attacker || typeof attacker.attackType !== 'string') return;
  const atk = String(attacker.attackType || '').toLowerCase();
  const attackIsBlockable = (attacker.unblockable !== true);

  // considerar estados que actúan como bloqueo: bandera blocking + estados block / crouchBlock
  // y también blockStun / crouchBlockStun: mientras esté en cualquiera de estos NO debe recibir daño.
  const inBlockingState = !!(
    self.blocking ||
    self.state?.current === 'block' ||
    self.state?.current === 'crouchBlock' ||
    self.state?.current === 'blockStun' ||
    self.state?.current === 'crouchBlockStun'
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

  // Si YA estábamos en hit3 y recibimos otro golpe, forzar knocked inmediatamente.
  if (prevHitLevel === 3) {
    try {
      console.log(`[Attacks.hit] ${self.id || '?'} was in hit3 and got hit again -> forcing knocked`);
      Anim.forceSetState(self, 'knocked');
    } catch (e) {
      console.warn('[Attacks.hit] failed to force knocked, marking _forceKnocked', self.id, e);
      self._forceKnocked = true;
    }
    // limpieza/early exit
    self.attacking = false; self.attackType = null; self._hitTargets = null;
    self.vx = 0; self.vy = 0;
    return;
  }

  // --- NEW: If defender is already exhausted (stamina <= 0), any successful hit forces knocked ---
  try {
    if (typeof this.stamina === 'number' && this.stamina <= 0) {
      // Always use forceSetState so knocked visual/state applies immediately (no PAUSE/HITSTOP dependence)
      try {
        console.log(`[Attacks.hit] ${self.id || '?'} is EXHAUSTED -> forcing knocked`);
        Anim.forceSetState(this, 'knocked');
      } catch (e) {
        console.warn('[Attacks.hit] forceSetState failed, marking _forceKnocked', this.id, e);
        this._forceKnocked = true;
      }
      // clean up and early return
      this.attacking = false; this.attackType = null; this._hitTargets = null;
      this.vx = 0; this.vy = 0;
      return;
    }
  } catch (e) { /* silent */ }

  // Si Attacks.hit ya aplicó daño externamente, no volver a aplicarlo.
  // Si no se aplicó daño (hpBefore === this.hp), aplicamos daño básico desde attacker.damageQuarters o fallback 1.
  if (hpBefore !== null && typeof this.hp === 'number' && this.hp === hpBefore) {
    const damageQuarters = (typeof attacker.damageQuarters === 'number') ? attacker.damageQuarters : 1;
    this.hp = Math.max(0, this.hp - damageQuarters);
  }

  // --- NUEVO: Si el ataque es un punch/kick, el golpeado pierde 2 STA
  try {
    const meleeHits = ['punch','punch2','punch3','kick','kick2','kick3'];
    if (meleeHits.includes(atk)) {
      if (typeof this.stamina === 'number') {
        this.stamina = Math.max(0, (this.stamina || 0) - 2); // restar 2 STA al golpeado
        this._staminaConsumedAt = millis();
      }
    }
  } catch (e) { /* silent */ }

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
    return;
  }

  // --- NEW: if we were already in hit3 and get another hit forcibly, convert to knocked ---
  // (this covers cases where earlier code returned due to being in isHit; ensure this runs when a new hit lands)
  try {
    // If we just received this hit but previously were already in hit3 (rare path), force knock
    if ((this.hitLevel || 0) >= 3 && typeof this.stamina === 'number' && this.stamina <= 0) {
      // already handled above; redundant safety
      if (window.PAUSED || window.HITSTOP_ACTIVE) {
        this._forceKnocked = true;
      } else {
        try { this.setState('knocked'); } catch (e) {}
      }
      this.attacking = false; this.attackType = null; this._hitTargets = null;
      this.vx = 0; this.vy = 0;
      return;
    }
  } catch (e) { /* silent */ }
}

export function updateAttackState(self) {
  const now = millis();
  if (self.attacking && (now - self.attackStartTime > self.attackDuration)) {
    // Mantener el estado de ataque mientras el grab esté en holding,
    // para que el grabber permanezca en el último frame hasta soltarlo.
    if (self.attackType === 'grab' && self._grabHolding) {
      return;
    }

    const endedAttackType = self.attackType;

    self.attacking = false;
    self.attackType = null;
    // limpiar lista de objetivos al terminar la activación
    if (self._hitTargets) { self._hitTargets.clear(); self._hitTargets = null; }

    // Si el ataque terminado era un taunt y el fighter sigue en ese estado visual,
    // forzamos la vuelta a 'idle' para que la entropía del loop no deje al fighter bloqueado.
    // (Solo aplicamos esto para 'taunt' porque otros ataques pueden manejar su propia recovery)
    try {
      if (endedAttackType === 'taunt' && self.state && self.state.current === 'taunt') {
        self.setState('idle');
      }
    } catch (e) { /* silent */ }
  }
}
