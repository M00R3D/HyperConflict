// entities/fighter/hitbox.js
import { getAttackHitboxForChar, getBodyHitboxForChar } from '../../core/hitboxConfig.js';

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
      const box = {
        x: self.facing === 1 ? self.x + reg.offsetX : self.x + self.w - (reg.offsetX || 0) - reg.w,
        y: self.y + (reg.offsetY || 0),
        w: reg.w,
        h: reg.h
      };
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
