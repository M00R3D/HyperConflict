// entities/fighter/hitbox.js
export function getCurrentHitbox(self) {
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
  const raw = self.attackHitboxes[self.attackType] || self.attackHitboxes[self.attackType.replace(/\d+$/, '')];
  if (!raw) return null;
  return {
    x: self.facing === 1 ? self.x + raw.offsetX : self.x + self.w - raw.offsetX - raw.w,
    y: self.y + raw.offsetY,
    w: raw.w, h: raw.h
  };
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
