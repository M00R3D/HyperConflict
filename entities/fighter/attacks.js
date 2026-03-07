// entities/fighter/attacks.js
import * as Anim from './animation.js';
import { getKnockbackForAttack } from '../../core/knockback.js';
import { state } from '../../core/state.js';
import { keysDown } from '../../core/input.js';
import { handleStaplerSpawn, handleThinLaserSpawn, shoot as shootSpawn } from './attacks/spawn.js';
import { attackHits as attackHitsImpl, hit as hitImpl, updateAttackState as updateAttackStateImpl } from './attacks/hit.js';
export function attack(self, key) {
  const now = millis();
  // Prevent starting new attacks while game is paused or during hitstop
  if (typeof window !== 'undefined' && (window.PAUSED || window.HITSTOP_ACTIVE)) return;
  const chain = self.comboChainsByKey[key];
  if (!chain || chain.length === 0) return;
  if (self.inputLockedByKey[key]) return;

  // --- Cooldown check per attack name ---
  // use action.cooldown when provided; otherwise use sensible defaults
  // punches/kicks: short cooldown to avoid spamming/cancels
  // keys 'p'/'m' (typically specials/projectiles): longer cooldown
  // store per-attack last-used timestamps on `self._lastAttackUsedByName`

  const last = self.lastAttackTimeByKey[key] || 0;
  let step = self.comboStepByKey[key] || 0;
  if (now - last > self.comboWindow) step = 0;

  let attackName = chain[step] || chain[0];

  // lazy-init last-used map
  if (!self._lastAttackUsedByName) self._lastAttackUsedByName = Object.create(null);

  // Debug: show requested attack and crouch state
  // try { console.log('[attack] request', { id: self.id, char: self.charId, key, attackName, crouching: !!self.crouching }); } catch (e) {}

  // If crouching, prefer a crouch-specific variant if defined.
  // Example: when `punch` is requested while crouching, prefer `crouchpunch` or `crouchPunch2`.
  if (self.crouching && typeof attackName === 'string') {
    const m = attackName.match(/^(\D+)(\d*)$/);
    if (m) {
      const base = m[1];
      // Only map to a single crouch variant (no numbered escalation)
      const lowerCrouch = ('crouch' + base).toLowerCase();
      const camelCrouch = 'crouch' + base.charAt(0).toUpperCase() + base.slice(1);
      // Prefer camelCase if provided by char-specific actions (registerCharData uses camel),
      // fall back to lowercase legacy keys if necessary.
      if (self.actions && self.actions[camelCrouch]) {
        attackName = camelCrouch;
      } else if (self.actions && self.actions[lowerCrouch]) {
        attackName = lowerCrouch;
      }
    }
  }

  // If we're already mid-attack, only allow this new attack when it is
  // a legitimate combo continuation (next element in the chain). This
  // prevents spamming single attacks like crouchpunch while an attack
  // (or hitstop) is still active.
  if (self.attacking) {
    try {
      const currentAtk = (self.attackType || '').toString();
      // Determine the *expected* next combo index. Prefer the stored
      // `comboStepByKey` (which is updated at attack start) because
      // `chain.indexOf()` returns the first matching index and breaks
      // when the chain contains duplicate attack names.
      let nextName = null;
      if (Array.isArray(chain)) {
        const expectedNextIdx = (typeof self.comboStepByKey[key] === 'number')
          ? self.comboStepByKey[key]
          : (currentAtk && chain.indexOf(currentAtk) >= 0 ? chain.indexOf(currentAtk) + 1 : -1);
        nextName = (expectedNextIdx >= 0 && chain[expectedNextIdx]) ? chain[expectedNextIdx] : null;
      }
      // allow only when the requested attack matches the next combo element
      if (!(nextName && nextName === attackName)) {
        return;
      }
    } catch (e) {
      return;
    }
  }

  const action = self.actions[attackName];
  if (!action) { console.warn('Acción no definida en actions:', attackName); return; }

  // determine cooldown for this attack
  const explicitCd = (action && typeof action.cooldown === 'number') ? Number(action.cooldown) : null;
  let cooldownMs = explicitCd !== null ? explicitCd : null;
  if (cooldownMs === null) {
    if (/^punch/i.test(attackName) || /^kick/i.test(attackName)) cooldownMs = 320;
    else if (key === 'p' || key === 'm') cooldownMs = 420;
    else cooldownMs = 0;
  }
  const lastUsed = Number(self._lastAttackUsedByName[attackName] || 0);
  if (cooldownMs > 0 && (millis() - lastUsed) < cooldownMs) {
    // still cooling down — ignore this attack request
    return;
  }

  self.attackType = attackName;
  self.setState(attackName);
  self.attacking = true;
  self.attackStartTime = now;
  self.attackDuration = action.duration || 400;
  // inicializar set de objetivos golpeados por esta activación (evita multi-hit repetido)
  self._hitTargets = new Set();
  self.lastAttackTimeByKey[key] = now;
  // record last-used for this specific attack name to enforce cooldowns
  try { self._lastAttackUsedByName[attackName] = now; } catch (e) {}
  self.inputLockedByKey[key] = true;
  // Defer combo advancement until the attack actually hits.
  // Store the key that initiated this attack and whether it should reset on hit (crouch variants).
  self._comboKeyForCurrentAttack = key;
  self._comboAdvancedThisAttack = false;
  self._comboAdvanceResetIfCrouch = (
    attackName === 'crouchpunch' || attackName === 'crouchPunch' ||
    attackName === 'crouchkick' || attackName === 'crouchKick'
  );
  // Diagnostic: log start for Fernando to help debug timing/hitbox issues
  try {
    if (self && self.charId === 'fernando') {
      console.log('[Attacks.attack] started', { id: self.id, char: self.charId, attackName, attackDuration: self.attackDuration });
    }
  } catch (e) {}

  // --- Special: spawn staple projectile for Tyeman's stapler attack ---
  try { handleStaplerSpawn(self, attackName); } catch (e) { try { console.warn('[Attacks.attack] stapler spawn failed', e); } catch (ee) {} }
  // --- Special: spawn or renew thin_laser projectile for Fernando ---
  try { handleThinLaserSpawn(self, attackName); } catch (e) { try { console.warn('[Attacks.attack] thin_laser spawn failed', e); } catch (ee) {} }
}

export function attackHits(self, opponent) {
  return attackHitsImpl(self, opponent);
}

export function shoot(self) {
  return shootSpawn(self);
}

export function hit(self, attacker = null) {
  return hitImpl(self, attacker);
  // try { console.log(`[Attacks.hit] ${self.id || '?'} hit by ${attacker.id || '?'} attack=${attacker.attackType}`); } catch(e){}

  // (Se eliminó el bloqueo que forzaba un knockback por defecto aquí)
  // La aplicación del knockback se realiza más abajo usando la tabla por-ataque (getKnockbackForAttack).

  // TRACE: nivel de hit previo (si existe) — nos interesa detectar recibir golpe adicional sobre hit3
  const prevHitLevel = (typeof self.hitLevel === 'number') ? self.hitLevel : 0;
  // mark previous in-air hit for multiplier decisions
  const wasInAirAndHit = (!self.onGround && prevHitLevel > 0);

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

  // SPECIAL: si el defensor estaba ejecutando un `crouchpunch`, convertir el resultado
  // en un hit3 y aplicar un knockback moderado/consistente.
  try {
    if (this.state && (this.state.current === 'crouchpunch' || this.state.current === 'crouchPunch')) {
      resolvedHitLevel = 3;
      // marcar flag temporal para que la sección de knockback aplique una fuerza media
      this._receivedHitWhileCrouchPunch = true;
    }
  } catch (e) { /* silent */ }

  // Si YA estábamos en hit3 y recibimos otro golpe, forzar knocked inmediatamente.
  if (prevHitLevel === 3) {
    try {
      // console.log(`[Attacks.hit] ${self.id || '?'} was in hit3 and got hit again -> forcing knocked`);
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

  // Stamina system removed: ignore exhausted checks.

  // Si Attacks.hit ya aplicó daño externamente, no volver a aplicarlo.
  // Si no se aplicó daño (hpBefore === this.hp), aplicamos daño básico desde attacker.damageQuarters o fallback 1.
  if (hpBefore !== null && typeof this.hp === 'number' && this.hp === hpBefore) {
    const damageQuarters = (typeof attacker.damageQuarters === 'number') ? attacker.damageQuarters : 1;
    this.hp = Math.max(0, this.hp - damageQuarters);
  }

  // Stamina system removed: do not modify stamina on hit.

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

  // --- FORZAR KNOCKBACK UNIFORME: todos los golpes empujan hacia la dirección CONTRARIA
  try {
    // resolver charId robustamente (soporta proyectiles con ownerRef/ownerId)
    let charId = attacker && (attacker.charId || attacker.char || attacker._charId || attacker.charName) || null;
    if (!charId && attacker && attacker.ownerRef && attacker.ownerRef.charId) charId = attacker.ownerRef.charId;
    if (!charId && attacker && attacker.owner && attacker.owner.charId) charId = attacker.owner.charId;
    if (!charId && attacker && attacker.ownerId && typeof window !== 'undefined') {
      if (window.player1 && window.player1.id === attacker.ownerId) charId = window.player1.charId;
      else if (window.player2 && window.player2.id === attacker.ownerId) charId = window.player2.charId;
    }
    if (!charId) charId = (attacker && attacker.ownerRef && attacker.ownerRef.charId) ? attacker.ownerRef.charId : 'default';

    const attackName = String((attacker && attacker.attackType) || 'default').toLowerCase();

    // obtener configuración por personaje/ataque
    // si el objetivo recibió el golpe mientras ejecutaba crouchpunch, forzamos
    // una configuración de knockback media (override local)
    let cfg = getKnockbackForAttack(charId, attackName) || { h: 5, v: 5 };
    if (this._receivedHitWhileCrouchPunch) {
      cfg = { h: 8, v: 8 };
      delete this._receivedHitWhileCrouchPunch;
    }

    // determinar dirección "away" (1 => a la derecha, -1 => a la izquierda)
    const away = Math.sign((self.x || 0) - (attacker.x || 0)) || ((attacker.facing || 1) * -1) || 1;

    // si el defensor ya estaba EN EL AIRE y YA estaba en hit (re-hit en aire), duplicar la fuerza.
    // Si es el primer impacto en aire no multiplicamos aquí (evita exagerar fuerza del primer aire-hit).
    const airMult = (wasInAirAndHit) ? 2 : 1;

    const finalH = Math.round((cfg.h || 0) * airMult);
    const finalV = Math.round((cfg.v || 0) * airMult);

    // crear knockback persistente (se consumirá en update/updateDuranteHitstop)
    const kb = {
      vx: finalH * away,   // horizontal signed velocity
      vy: -finalV,         // negative = up
      decay: 1,
      frames: 101,
      sourceId: attacker?.id || null
    };

    this._knockback = Object.assign({}, kb);
    this._pendingKnockback = { magX: Math.abs(kb.vx), y: kb.vy, away, applied: false, _markLaunched: { start: millis(), duration: 600 } };

    // Exponer flags adicionales para UI/display:
    // true2 = mostrar hit2 sprite, true3 = mostrar hit3 sprite (permanece mientras isHit === true)
    this.isHit2 = (this.hitLevel >= 2);
    this.isHit3 = (this.hitLevel >= 3);

    // asegurar que quede marcado como hit y mostrar la animación adecuada
    this.isHit = true;
    this.hitStartTime = millis();
    // preserve already computed hitLevel/hitDuration if present; otherwise set default 1
    this.hitLevel = this.hitLevel || 1;
    this.hitDuration = this.hitDuration || (this.actions?.hit1?.duration || 260);
    try {
      const s = (this.hitLevel === 1 ? 'hit1' : this.hitLevel === 2 ? 'hit2' : 'hit3');
      Anim.forceSetState(this, s);
    } catch (e) {}

    // marcar launched para ajustar física
    this._launched = true;
    this._launchedStart = millis();
    this._launchedDuration = Math.max(this._launchedDuration || 0, 600);

    // no forzar borrar pending; se consumirá en update/updateDuranteHitstop
    // console.log('[KB APPLY CONFIG]', { target: this.id, from: attacker?.id, charId, attackName, cfg, finalH, finalV, away });
  } catch (e) {
    console.warn('[KB FORCE] failed to set persistent knockback', e);
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
    return;
  }

  // --- NEW: if we were already in hit3 and get another hit forcibly, convert to knocked ---
  // (this covers cases where earlier code returned due to being in isHit; ensure this runs when a new hit lands)
  try {
    // If we just received this hit but previously were already in hit3 (rare path), force knock
    if ((this.hitLevel || 0) >= 3) {
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
  return updateAttackStateImpl(self);
}
