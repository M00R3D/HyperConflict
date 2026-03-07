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
  punch:  { h: 0, v: 0 },
  punch2: { h: 0.5, v: 1 },
  punch3: { h: 4, v: 3 },
  kick:   { h: 0.1, v: 0.5 },
  kick2:  { h: 0.3, v: 0.6 },
  kick3:  { h: 2, v: 7.4 },
  hadouken:{ h: 7, v: 3 }
});

_kb['sbluer'] = Object.assign({}, _kb['default'], {
  punch:  { h: 0, v: 0 },
  punch2: { h: 0.5, v: 1 },
  punch3: { h: 8, v: 7 },
  kick:   { h: 0.5, v: 0.4 },
  kick2:  { h: 0.6, v: 0.5 },
  kick3:  { h: 2.7, v: 7.6 },
  hadouken:{ h: 6, v: 3 }
});

_kb['fernando'] = Object.assign({}, _kb['default'], {
  punch:  { h: 0, v: 0 },
  punch2: { h: 0.5, v: 1 },
  punch3: { h: 7, v: 8 },
  kick:   { h: 0.4, v: 0.23 },
  kick2:  { h: 0.5, v: 0.4 },
  kick3:  { h: 1, v: 5 },
  hadouken:{ h: 6, v: 3 }
});

// --- Damage registry (per-character, per-attack)
const _damageByChar = Object.create(null);

// sensible defaults (damage measured in "quarters" like HP quarters)
_damageByChar['default'] = {
  punch: 1,
  punch2: 2,
  punch3: 3,
  kick: 1,
  kick2: 2,
  kick3: 3
};

export function registerDamageForChar(charId, table = {}) {
  if (!charId || typeof table !== 'object') return;
  _damageByChar[charId] = Object.assign({}, _damageByChar[charId] || {}, table);
}

export function setDamageForAttack(charId, attackName, value = 0) {
  if (!charId || !attackName) return;
  _damageByChar[charId] = _damageByChar[charId] || {};
  _damageByChar[charId][attackName] = Number(value || 0);
}

export function getDamageForAttack(charId, attackName) {
  const ch = (_damageByChar[charId] || _damageByChar['default'] || {});
  if (!attackName) return null;
  const exact = ch[attackName];
  const lower = ch[String(attackName).toLowerCase()];
  const stripNum = ch[String(attackName).replace(/\d+$/, '')];
  const lowerStrip = ch[String(attackName).toLowerCase().replace(/\d+$/, '')];
  const v = (typeof exact !== 'undefined') ? exact : (typeof lower !== 'undefined' ? lower : (typeof stripNum !== 'undefined' ? stripNum : (typeof lowerStrip !== 'undefined' ? lowerStrip : null)));
  return (typeof v === 'number') ? v : null;
}

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
  if (!attackName) return ch['default'] || null;
  const exact = ch[attackName];
  const lower = ch[String(attackName).toLowerCase()];
  const stripNum = ch[String(attackName).replace(/\d+$/, '')];
  const lowerStrip = ch[String(attackName).toLowerCase().replace(/\d+$/, '')];
  const def = exact || lower || stripNum || lowerStrip || ch['default'] || null;
  return def ? { h: Number(def.h || 0), v: Number(def.v || 0) } : null;
}

// expose for dev console
if (typeof window !== 'undefined') {
  window._KNOCKBACK_TABLE = _kb;
  window.registerKnockbacksForChar = registerKnockbacksForChar;
  window.setKnockbackForAttack = setKnockbackForAttack;
  window.getKnockbackForAttack = getKnockbackForAttack;
}

// expose damage helpers for runtime tweaks
if (typeof window !== 'undefined') {
  window.registerDamageForChar = registerDamageForChar;
  window.getDamageForAttack = getDamageForAttack;
  window.setDamageForAttack = setDamageForAttack;
}