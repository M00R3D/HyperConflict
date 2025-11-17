// entities/fighter/specials.js
import { Projectile } from '../../entities/projectile.js';
import { projectiles } from '../../core/main.js';
import * as Hitbox from './hitbox.js';
import * as Buffer from './buffer.js';

// Se definen las secuencias base asumiendo facing = 1 (mirando a la derecha).
// Cada movimiento puede declarar direction: 'forward'|'backward'|'any' para reglas futuras
const defaultSpecialDefs = {
  hadouken: { seq: ['↓','↘','→','P'], direction: 'forward' },
  shoryuken: { seq: ['→','↓','↘','P'], direction: 'forward' },
  bun: { seq: ['→','↓','↘','P'], direction: 'forward' },
  supersalto: { seq: ['↓','↑'], direction: 'any' },
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
      doSpecial(self, moveName);
      Buffer.bufferConsumeLast(self, seq.length);
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
    const p = new Projectile(px, py, dir, 1, self.id, self.id, {}, self.projectileFramesByLayer);
    projectiles.push(p);
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
      const p = new Projectile(px, py, dir, 4, self.id, {}, opts, tatsProj);
      p._barrierIndex = k;
      projectiles.push(p);
    }

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

    // RECARGA: recuperar alrededor de 4 cuartos de stamina al hacer taunt
    try {
      if (typeof self.stamina === 'number' && typeof self.staminaMax === 'number') {
        const regain = 4; // cuartos a recuperar
        self.stamina = Math.min(self.staminaMax, (self.stamina || 0) + regain);
        // reset acumulador de regen para evitar acumulaciones instantáneas
        self._staminaRegenAccum = 0;
        self._staminaRegenLastTime = millis();
        self._staminaConsumedAt = millis(); // pausa breve de regen si hay lógica dependiente
      }
    } catch (e) { /* silent */ }
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

    // opts: alcance maximo antes de dar vuelta, velocidad, etc.
    const opts = {
      speed: 8,
      maxRange: 380,
      persistent: false,
      w: 18, h: 6,
      frameDelay: 6,
      spriteScale: 1.0,
      stringW: 6,
      stringH: 2,
      stringFrameDelay: 6,
      offsetX: defaultOffsetX +(-14*self.facing),
      offsetY: defaultOffsetY+6
    };

    const px = Math.round(self.x + (opts.offsetX || 0));
    const py = Math.round(self.y + (opts.offsetY || 0));

    const bunFrames = (self.bunProjFramesByLayer && self.bunProjFramesByLayer.length) ? self.bunProjFramesByLayer : null;
    const stringFrames = (self.bunStringFramesByLayer && self.bunStringFramesByLayer.length) ? self.bunStringFramesByLayer : null;
    const p = new Projectile(px, py, dir, 5, self.id, { string: stringFrames }, opts, bunFrames);
    p._ownerRef = self;
    projectiles.push(p);
    return;
  }
}
