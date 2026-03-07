// entities/fighter/hitbox.js
import { getAttackHitboxForChar, getBodyHitboxForChar, getAttackHitboxMotionForChar } from '../../core/hitboxConfig.js';

export function getCurrentHitbox(self) {
  // 1) intentar override por personaje para el estado actual
  try {
    const stateName = (self && self.state && typeof self.state.current === 'string') ? self.state.current : 'idle';
    const reg = getBodyHitboxForChar(self.charId, stateName);
    if (reg && typeof reg === 'object' && reg.w !== undefined) {
      return {
        x: self.facing === 1 ? self.x + reg.offsetX : self.x + self.w - (reg.offsetX || 0) - reg.w,
        y: self.y + (reg.offsetY || 0),
        w: reg.w,
        h: reg.h
      };
    }
  } catch (e) {
    // no romper si hay error en consulta
  }

  // si no hay override, comportamiento legacy
  // si no existe hitbox para el estado exacto, y el estado es "hit1/2/3", usar la hitbox de 'hit'
  let box = self.hitboxes[self.state.current];
  if (!box && typeof self.state?.current === 'string' && self.state.current.startsWith('hit')) {
    box = self.hitboxes['hit'];
  }
  box = box || self.hitboxes["idle"];
  return {
    x: self.facing === 1 ? self.x + box.offsetX : self.x + self.w - box.offsetX - box.w,
    y: self.y + box.offsetY,
    w: box.w, h: box.h
  };
}

export function getAttackHitbox(self) {
  if (!self.attacking || !self.attackType) return null;

  // 1) intentar leer hitbox registrada por personaje para este ataque
  try {
    const reg = getAttackHitboxForChar(self.charId, self.attackType);
    if (reg && typeof reg === 'object' && reg.w !== undefined) {
      try { if (self && self.charId === 'fernando') console.log('[getAttackHitbox] fernando reg found', { attackType: self.attackType, reg }); } catch(e) {}
      // permitir defs compactos: { offsetX, offsetY, w, h }
      // compute normal attack box (target/extended position)
      const normalBox = {
        x: self.facing === 1 ? self.x + reg.offsetX : self.x + self.w - (reg.offsetX || 0) - reg.w,
        y: self.y + (reg.offsetY || 0),
        w: reg.w,
        h: reg.h
      };
      // allow per-attack/per-character temporal motion configs
      try {
        const atkName = String(self.attackType || '').toLowerCase();
        const motion = getAttackHitboxMotionForChar(self.charId, self.attackType);
        const shouldDefaultMotion = (!motion && (atkName.startsWith('punch') || atkName.startsWith('kick')));
        const cfg = motion || (shouldDefaultMotion ? { insideEnd: 0.1, outEnd: 0.6 } : null);
        if (cfg && typeof self.attackStartTime === 'number' && typeof self.attackDuration === 'number') {
          const now = millis();
          const elapsed = Math.max(0, now - (self.attackStartTime || 0));
          const t = Math.min(1, elapsed / Math.max(1, self.attackDuration));

          // compute a starting X inside the owner's body centered horizontally
          let insidePos = normalBox.x;
          try {
            const ownerBox = getCurrentHitbox(self);
            insidePos = ownerBox.x + Math.max(0, (ownerBox.w - reg.w) / 2);
          } catch (e) { /* keep normalBox.x */ }

          const insideEnd = Number(cfg.insideEnd ?? 0.1);
          const outEnd = Number(cfg.outEnd ?? 0.6);
          const holdEnd = Number(cfg.holdEnd ?? outEnd);
          if (t < insideEnd) {
            return { x: insidePos, y: normalBox.y, w: normalBox.w, h: normalBox.h };
          } else if (t < outEnd) {
            const p = (t - insideEnd) / Math.max(0.0001, (outEnd - insideEnd));
            const x = insidePos + (normalBox.x - insidePos) * p;
            return { x, y: normalBox.y, w: normalBox.w, h: normalBox.h };
          } else if (t < holdEnd) {
            // hold at max distance
            return { x: normalBox.x, y: normalBox.y, w: normalBox.w, h: normalBox.h };
          } else {
            const p2 = Math.min(1, (t - holdEnd) / Math.max(0.0001, (1 - holdEnd)));
            const x = normalBox.x + (insidePos - normalBox.x) * p2;
            return { x, y: normalBox.y, w: normalBox.w, h: normalBox.h };
          }
        }
      } catch (e) {
        // fall back to normalBox on error
      }

      const box = normalBox;
      try { if (self && self.charId === 'fernando') console.log('[getAttackHitbox] fernando computed atkHB', JSON.stringify({ attackType: self.attackType, box, selfX: self.x, selfW: self.w, facing: self.facing })); } catch(e) {}
      return box;
    }
  } catch (e) {
    // si falla la consulta, continuar con fallback (no romper)
  }

  // 2) fallback a las hitboxes definidas en la instancia (legacy)
  const raw = self.attackHitboxes[self.attackType] || self.attackHitboxes[self.attackType.replace(/\d+$/, '')];
  if (!raw) return null;
  try { if (self && self.charId === 'fernando') console.log('[getAttackHitbox] fernando fallback raw', { attackType: self.attackType, raw }); } catch(e) {}
  const box = {
    x: self.facing === 1 ? self.x + raw.offsetX : self.x + self.w - raw.offsetX - raw.w,
    y: self.y + raw.offsetY,
    w: raw.w, h: raw.h
  };
  try { if (self && self.charId === 'fernando') console.log('[getAttackHitbox] fernando computed atkHB fallback', JSON.stringify({ attackType: self.attackType, box, selfX: self.x, selfW: self.w, facing: self.facing })); } catch(e) {}
  return box;
}

export function getKeysForSymbol(self, sym) {
  const mapP1 = {
    '↑': ['w'], '↓': ['s'], '←': ['a'], '→': ['d'],
    '↘': ['s','d'], '↙': ['s','a'], '↗': ['w','d'], '↖': ['w','a']
  };
  const mapP2 = {
    '↑': ['arrowup'], '↓': ['arrowdown'], '←': ['arrowleft'], '→': ['arrowright'],
    '↘': ['arrowdown','arrowright'], '↙': ['arrowdown','arrowleft'],
    '↗': ['arrowup','arrowright'], '↖': ['arrowup','arrowleft']
  };
  return (self.id === 'p1' ? mapP1 : mapP2)[sym] || [];
}

export function mirrorSymbol(sym) {
  const map = { '→':'←','←':'→','↘':'↙','↙':'↘','↗':'↖','↖':'↗' };
  return map[sym] || sym;
}
