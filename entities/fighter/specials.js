// entities/fighter/specials.js
import { Projectile, spawnProjectileFromType } from '../../entities/projectile.js';
import { projectiles } from '../../core/main.js';
import * as Hitbox from './hitbox.js';
import * as Buffer from './buffer.js';

// Se definen las secuencias base asumiendo facing = 1 (mirando a la derecha).
// Cada movimiento puede declarar direction: 'forward'|'backward'|'any' para reglas futuras
const defaultSpecialDefs = {
  hadouken: { seq: ['↓','↘','→','P'], direction: 'forward' },
  shoryuken: { seq: ['←','→','P'], direction: 'forward' },
  bun: { seq: ['←','→','P'], direction: 'forward' },
  supersalto: { seq: ['↓','↑'], direction: 'any' },
  dash: { seq: ['→','→'], direction: 'any' },
  ty_tats: { seq: ['↓','↙','←','K'], direction: 'backward' },
  taunt: { seq: ['T'], direction: 'any' }
};

// mapa opcional por personaje (charId -> defs)
const specialDefsByChar = Object.create(null);

// función helper para registrar specials por personaje desde main.js u otro módulo
export function registerSpecialsForChar(charId, defs) {
  if (!charId || typeof defs !== 'object') return;
  specialDefsByChar[charId] = Object.assign({}, specialDefsByChar[charId] || {}, defs);
}

// NEW: getter para mostrar specials desde UI (expuesto para pause menu)
export function getSpecialDefsForChar(charId, self = null) {
  // prioridad: instance override > char map > default
  if (self && self.specialDefs && typeof self.specialDefs === 'object') return self.specialDefs;
  return specialDefsByChar[charId] || defaultSpecialDefs;
}

// expose to window so legacy/global callers can read the table if needed
if (typeof window !== 'undefined') {
  window.getSpecialDefsForChar = getSpecialDefsForChar;
  window.registerSpecialsForChar = registerSpecialsForChar;
  window._SPECIALS_TABLE = specialDefsByChar;
}

// obtiene el conjunto efectivo de specials para un fighter (instancia override > charId > default)
function getEffectiveSpecialDefs(self) {
  if (self && self.specialDefs && typeof self.specialDefs === 'object') return self.specialDefs;
  if (self && self.charId && specialDefsByChar[self.charId]) return specialDefsByChar[self.charId];
  return defaultSpecialDefs;
}

export function checkSpecialMoves(self) {
  // Respect a short special lock to avoid repeated activations from buffered spam
  const now = millis();
  const lockUntil = (self && typeof self._specialLockUntil === 'number') ? self._specialLockUntil : 0;
  if (now < lockUntil) return;
  // global per-fighter special cooldown to avoid chaining different specials too quickly
  const globalUntil = (self && typeof self._specialGlobalCooldownUntil === 'number') ? self._specialGlobalCooldownUntil : 0;
  if (now < globalUntil) {
    // record blocked event for debugging
    try {
      const r = (typeof window !== 'undefined') ? window._bufferRecorder : null;
      if (r && r.active) r.pushEvent({ type: 'specialBlocked', reason: 'globalCooldown', time: Math.max(0, now - (r.startedAt || 0)), fighterId: self.id });
    } catch (e) {}
    return;
  }
  const defsMap = getEffectiveSpecialDefs(self);
  const bufSymbols = (self.inputBuffer || []).map(i => i.symbol || '');
  // identificar el último símbolo direccional (si existe)
  const directionalSet = new Set(['←','→','↑','↓','↖','↗','↘','↙']);
  let lastDirInBuffer = null;
  for (let i = bufSymbols.length - 1; i >= 0; i--) {
    if (directionalSet.has(bufSymbols[i])) { lastDirInBuffer = bufSymbols[i]; break; }
  }

  for (const moveName in defsMap) {
    const def = defsMap[moveName];
    if (!def || !Array.isArray(def.seq)) continue;

    // construir secuencia efectiva según facing (si facing === -1, espejar)
    let seq = def.seq.slice();
    if (self.facing === -1) seq = seq.map(s => Hitbox.mirrorSymbol(s));

    // opción: exigir direction (forward/backward) — pero al espejar la secuencia ya queda correcta
    if (def.direction === 'forward') {
      if (lastDirInBuffer) {
        const forwardSet = (self.facing === 1) ? new Set(['→','↘','↗']) : new Set(['←','↙','↖']);
        if (!forwardSet.has(lastDirInBuffer)) continue;
      }
    } else if (def.direction === 'backward') {
      if (lastDirInBuffer) {
        const backSet = (self.facing === 1) ? new Set(['←','↙','↖']) : new Set(['→','↘','↗']);
        if (!backSet.has(lastDirInBuffer)) continue;
      }
    }

    if (Buffer.bufferEndsWith(self, seq)) {
      // per-move debounce: prevent the same special from firing repeatedly
      const debounceMs = (typeof self.specialDebounceMs === 'number') ? Math.max(0, Number(self.specialDebounceMs)) : 120;
      self._lastSpecialAt = self._lastSpecialAt || Object.create(null);
      const lastAt = (typeof self._lastSpecialAt[moveName] === 'number') ? self._lastSpecialAt[moveName] : 0;
      if ((now - lastAt) < debounceMs) {
        // skip this trigger as it is within debounce window
        continue;
      }

      // Strict-window check (Option A): ensure the matched sequence was entered quickly
      const strictMs = (typeof self.specialStrictWindowMs === 'number') ? Math.max(0, Number(self.specialStrictWindowMs)) : 300;
      const buf = self.inputBuffer || [];
      const len = buf.length;
      const firstIdx = len - seq.length;
      if (firstIdx < 0) continue; // safety
      const firstTime = buf[firstIdx] && buf[firstIdx].time ? buf[firstIdx].time : now;
      const lastTime = (buf[len - 1] && buf[len - 1].time) ? buf[len - 1].time : now;
      if ((lastTime - firstTime) > strictMs) {
        // too slow — record blocked attempt for diagnostics
        try {
          const r = (typeof window !== 'undefined') ? window._bufferRecorder : null;
          if (r && r.active) r.pushEvent({ type: 'specialBlocked', reason: 'tooSlow', move: moveName, time: Math.max(0, now - (r.startedAt || 0)), fighterId: self.id, span: lastTime - firstTime, allowedMs: strictMs });
        } catch (e) {}
        continue;
      }

      // Passed timing checks — execute special and clear the entire buffer to avoid chained triggers
      doSpecial(self, moveName);
      try { Buffer.bufferClear(self); } catch (e) { Buffer.bufferConsumeLast(self, seq.length); }
      // impose a short global cooldown after any special to avoid immediate chaining
      const globalMs = (typeof self.specialGlobalCooldownMs === 'number') ? Math.max(0, Number(self.specialGlobalCooldownMs)) : 300;
      try { self._specialGlobalCooldownUntil = millis() + globalMs; } catch (e) { self._specialGlobalCooldownUntil = now + globalMs; }
      // set a short lock so the same buffer can't trigger another special immediately
      const dur = (typeof self.specialLockDuration === 'number') ? Math.max(0, Number(self.specialLockDuration)) : 240;
      try { self._specialLockUntil = millis() + dur; } catch (e) { self._specialLockUntil = now + dur; }
      try { self._lastSpecialAt[moveName] = millis(); } catch (e) { self._lastSpecialAt[moveName] = now; }
      return;
    }
  }
}

export function doSpecial(self, moveName) {
  if (moveName === 'grab') {
    // No permitir grab si ya estamos atacando, en hit, ya en grab, o si estamos siendo agarrados
    if (self.attacking || self.isHit || self._grabLock || (self.state && (self.state.current === 'grab' || self.state.current === 'grabbed'))) return;
    self.setState('grab');
    self.attacking = true;
    self.attackType = 'grab';
    self.attackStartTime = millis();
    self.attackDuration = (self.actions.grab && self.actions.grab.duration) || 500;
    // asegurar set de objetivos para esta activación
    self._hitTargets = new Set();
    // consume stamina for grab
    try { if (self.consumeStaminaFor) self.consumeStaminaFor('grab'); } catch (e) {}
    return;
  }
  if (moveName === 'hadouken') {
    // require stamina before starting special (hadouken costs 4 quarters)
    if (typeof self.consumeStaminaFor === 'function' && !self.consumeStaminaFor('hadouken')) return;
    self.setState('hadouken');
    self.attackType = 'hadouken';
    self.attacking = true;
    self.attackStartTime = millis();
    self.attackDuration = self.actions?.hadouken?.duration || 600;

    const dir = self.facing === 1 ? 1 : -1;
    const px = Math.round(self.x + (dir === 1 ? self.w + 4 : -4));
    const py = Math.round(self.y + self.h / 2 - 6);
    const p = spawnProjectileFromType(1, px, py, dir, self.id, {}, {}, self.projectileFramesByLayer);
    projectiles.push(p);
    try {
      const r = (typeof window !== 'undefined') ? window._bufferRecorder : null;
      if (r && r.active) {
        r.pushEvent({ type: 'special', move: 'hadouken', time: Math.max(0, millis() - (r.startedAt || 0)), fighterId: self.id, projectiles: [{ typeId: p.typeId, x: p.x, y: p.y, dir: p.dir, ownerId: p.ownerId, damageQuarters: p.damageQuarters }] });
      }
    } catch (e) {}
  } else if (moveName === 'shoryuken') {
    self.setState('punch3'); self.attackType = 'punch3'; self.attacking = true;
    self.attackStartTime = millis(); self.attackDuration = self.actions.punch3.duration || 800;
    try { if (self.consumeStaminaFor) self.consumeStaminaFor('heavy'); } catch (e) {}
  } else if (moveName === 'tatsumaki') {
    self.setState('kick3'); self.attackType = 'kick3'; self.attacking = true;
    self.attackStartTime = millis(); self.attackDuration = self.actions.kick3.duration || 600;
  } else if (moveName === 'supersalto') {
    // Supersalto: impulso vertical más fuerte y "float" temporal (menor gravedad).
    // Activar solo cuando estaba en suelo justo antes del input (evita doble activación en aire)
    const wasOnGround = (typeof self._prevOnGround === 'boolean') ? self._prevOnGround : !!self.onGround;
    if (!wasOnGround) return;

    // Estado visual: salto
    self.setState('jump');
    self.onGround = false;

    // Velocidad vertical aumentada (jumpStrength es negativo)
    const boostFactor = 1.5;
    self.vy = (self.jumpStrength || -5.67) * boostFactor;

    // Efecto de "float": bajar gravedad temporalmente para más hang-time
    if (typeof self.gravity === 'number') {
      self._supersaltoOriginalGravity = self.gravity;
      self.gravity = Math.max(0.08, (self.gravity || 0.3) * 0.55); // reducir gravedad
      self._supersaltoStart = millis();
      self._supersaltoDuration = 520; // ms de reducción de gravedad (ajustable)
      self._supersaltoActive = true;
    }
    // opcional: reproducir sonido / particle spawn si tienes sistema
    return;
  } else if (moveName === 'ty_tats') {
    // ty_tats: reproducir la animación 'tats' en el personaje y crear una BARRERA de 4 proyectiles
    try {
      if (self.tatsFramesByLayer && self.tatsFramesByLayer.length) {
        self.setState('tats');
      } else {
        self.setState('punch3');
      }
    } catch (e) {}

    // marcar como ataque (usa 'tats' para anim/hitbox)
    self.attacking = true;
    self.attackType = 'tats';
    self.attackStartTime = millis();
    self.attackDuration = (self.actions && self.actions.tats && self.actions.tats.duration) || 420;

    // parámetros base del proyectil barrier
    const baseOpts = {
      duration: 3000,    // duración visible más larga
      upSpeed: 2.1,
      targetScale: 2.6,
      w: 20, h: 36,
      frameDelay: 6,
      persistent: true   // IMPORTANT: no se destruyen al golpear
    };

    // Crear 4 proyectiles con spawnDelay secuencial y pequeños offsets
    const gap = 110; // ms entre apariciones
    const initialOffset = Math.round(self.w / 2); // offset base desde el centro
    const step = 18; // px entre piezas
    const centerX = Math.round(self.x + self.w / 2);
    const created = [];
    for (let k = 0; k < 4; k++) {
      const dir = self.facing === 1 ? 1 : -1;
      // offset relativo al centro del fighter; para facing=-1 offset será negativo
      const offsetX = (dir === 1)
        ? (initialOffset + 6 + k * step)
        : -(initialOffset + 6 + k * step);
      const px = Math.round(centerX + offsetX);
      const py = Math.round(self.y + self.h / 2 - 6);
      const opts = Object.assign({}, baseOpts, { spawnDelay: k * gap });
      const tatsProj = (self.tatsProjFramesByLayer && self.tatsProjFramesByLayer.length) ? self.tatsProjFramesByLayer : null;
      const p = spawnProjectileFromType(4, px, py, dir, self.id, {}, opts, tatsProj);
      p._barrierIndex = k;
      projectiles.push(p);
      created.push({ typeId: p.typeId, x: p.x, y: p.y, dir: p.dir, ownerId: p.ownerId, barrierIndex: p._barrierIndex });
    }
    // single recorder event for the multi-projectile special
    try {
      const r = (typeof window !== 'undefined') ? window._bufferRecorder : null;
      if (r && r.active) {
        r.pushEvent({ type: 'special', move: 'ty_tats', time: Math.max(0, millis() - (r.startedAt || 0)), fighterId: self.id, projectiles: created });
      }
    } catch (e) {}

    return;
  } else if (moveName === 'taunt') {
    // Si ya estamos ejecutando un taunt activo, no volver a activarlo
    if (self.attacking && self.attackType === 'taunt') return;
    // También proteger caso en que el estado visual ya esté en 'taunt'
    if (self.state && self.state.current === 'taunt' && self.attacking) return;

    self.setState('taunt');
    // mantener la animación durante ~1.7s usando la mecánica de "attacking"
    self.attacking = true;
    self.attackType = 'taunt';
    self.attackStartTime = millis();
    self.attackDuration = 1700; // 1700 ms = 1.7s

    // Stamina removed: no regen on taunt.
    return;
  } else if (moveName === 'bun') {
    // require stamina before bun (4 quarters)
    if (typeof self.consumeStaminaFor === 'function' && !self.consumeStaminaFor('bun')) return;
    // visual: usar anim 'bun' (shor-like) si existe
    try { if (self.shorFramesByLayer && self.shorFramesByLayer.length) self.setState('bun'); else self.setState('punch3'); } catch(e){}

    self.attacking = true;
    self.attackType = 'bun';
    self.attackStartTime = millis();
    self.attackDuration = (self.actions && self.actions.bun && self.actions.bun.duration) || 700;

    const dir = self.facing === 1 ? 1 : -1;

    // valores por defecto del origen relativos al fighter (puedes cambiar en opts)
    const defaultOffsetX = dir === 1 ? (self.w + 6) : -6;
    const defaultOffsetY = Math.round(self.h / 2 - 6);

    // opts: keep minimal overrides so PROJECTILE_TYPES defaults win.
    // We only pass persistence and spawn offsets here; visual/physics
    // params (speed, size, lifespan, spriteScale, etc.) should come
    // from the central `PROJECTILE_TYPES` preset unless explicitly
    // required to change per-call.
    const opts = {
      persistent: false,
      offsetX: defaultOffsetX + (-14 * self.facing),
      offsetY: defaultOffsetY + 6
    };

    const px = Math.round(self.x + (opts.offsetX || 0));
    const py = Math.round(self.y + (opts.offsetY || 0));

    const bunFrames = (self.bunProjFramesByLayer && self.bunProjFramesByLayer.length) ? self.bunProjFramesByLayer : null;
    const stringFrames = (self.bunStringFramesByLayer && self.bunStringFramesByLayer.length) ? self.bunStringFramesByLayer : null;
    const p = spawnProjectileFromType(5, px, py, dir, self.id, { string: stringFrames }, opts, bunFrames);
    p._ownerRef = self;
    projectiles.push(p);
    try {
      const r = (typeof window !== 'undefined') ? window._bufferRecorder : null;
      if (r && r.active) {
        r.pushEvent({ type: 'special', move: 'bun', time: Math.max(0, millis() - (r.startedAt || 0)), fighterId: self.id, projectiles: [{ typeId: p.typeId, x: p.x, y: p.y, dir: p.dir, ownerId: p.ownerId, damageQuarters: p.damageQuarters }] });
      }
    } catch (e) {}
    return;
  } else if (moveName === 'dash') {
    // Determine last directional symbol in buffer to decide dash direction
    const buf = self.inputBuffer || [];
    if (!buf || buf.length === 0) return;
    const lastSym = buf[buf.length - 1] && buf[buf.length - 1].symbol;
    const rightSet = new Set(['→','↗','↘']);
    const leftSet = new Set(['←','↖','↙']);
    let dir = 1;
    if (leftSet.has(lastSym)) dir = -1;
    else if (rightSet.has(lastSym)) dir = 1;
    else return;

    // Only dash on ground and when not in hit/attacking/grab etc
    const canDash = (!!self.onGround) && !self.isHit && !self.attacking && !self._grabLock;
    if (!canDash) return;

    try { self.dash(dir); } catch (e) { /* silent */ }
    return;
  }
}
