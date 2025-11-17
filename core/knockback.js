/*
  Knockback config module
  - registerKnockbacksForChar(charId, table)
  - setKnockbackForAttack(charId, attackName, { h, v })
  - getKnockbackForAttack(charId, attackName) -> { h, v }
*/
const _kb = Object.create(null);

// defaults (fallback)
_kb['default'] = {
  default: { h: 5, v: 5 } // horizontal (px) and up (px)
};

// example per-char defaults (edit values)
_kb['tyeman'] = Object.assign({}, _kb['default'], {
  punch:  { h: 1, v: 1 },
  punch2: { h: 3, v: 2 },
  punch3: { h: 4, v: 3 },
  kick:   { h: 1, v: 2 },
  kick2:  { h: 1, v: 6 },
  kick3:  { h: 2, v: 14 },
  hadouken:{ h: 7, v: 3 }
});

_kb['sbluer'] = Object.assign({}, _kb['default'], {
  punch:  { h: 4, v: 4 },
  punch2: { h: 5, v: 5 },
  punch3: { h: 8, v: 7 },
  kick:   { h: 5, v: 4 },
  hadouken:{ h: 6, v: 3 }
});

export function registerKnockbacksForChar(charId, table) {
  if (!charId || typeof table !== 'object') return;
  _kb[charId] = Object.assign({}, _kb[charId] || {}, table);
}

export function setKnockbackForAttack(charId, attackName, values = {}) {
  if (!charId || !attackName) return;
  _kb[charId] = _kb[charId] || {};
  _kb[charId][attackName] = { h: Number(values.h || 0), v: Number(values.v || 0) };
}

export function getKnockbackForAttack(charId, attackName) {
  const ch = (_kb[charId] || _kb['default']);
  const atk = (ch[attackName] || ch.default || _kb['default'].default || { h: 0, v: 0 });
  return { h: Math.abs(Number(atk.h || 0)), v: Math.abs(Number(atk.v || 0)) };
}

// expose for dev console
if (typeof window !== 'undefined') {
  window._KNOCKBACK_TABLE = _kb;
  window.registerKnockbacksForChar = registerKnockbacksForChar;
  window.setKnockbackForAttack = setKnockbackForAttack;
  window.getKnockbackForAttack = getKnockbackForAttack;
}