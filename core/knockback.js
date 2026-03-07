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

// --- Hit-level duration registry (per-character)
// Specifies how long each hit level (1..3) should last before transitioning
// to the next state. Values are milliseconds. Accepts arrays [d1,d2,d3]
// or objects {1: d1, 2: d2, 3: d3} when registering.
const _hitLevelDurationsByChar = Object.create(null);
_hitLevelDurationsByChar['default'] = { 1: 500, 2: 700, 3: 1000 };
_hitLevelDurationsByChar['tyeman'] = { 1: 450, 2: 650, 3: 1200 };
_hitLevelDurationsByChar['sbluer'] = { 1: 400, 2: 600, 3: 1100 };
_hitLevelDurationsByChar['fernando'] = { 1: 100, 2: 600, 3: 1100 };
export function registerHitLevelDurationsForChar(charId, table = {}) {
  if (!charId) return;
  let normalized = {};
  if (Array.isArray(table)) {
    normalized[1] = Number(table[0]) || _hitLevelDurationsByChar['default'][1];
    normalized[2] = Number(table[1]) || _hitLevelDurationsByChar['default'][2];
    normalized[3] = Number(table[2]) || _hitLevelDurationsByChar['default'][3];
  } else if (table && typeof table === 'object') {
    normalized[1] = Number(table[1] ?? table['1']) || _hitLevelDurationsByChar['default'][1];
    normalized[2] = Number(table[2] ?? table['2']) || _hitLevelDurationsByChar['default'][2];
    normalized[3] = Number(table[3] ?? table['3']) || _hitLevelDurationsByChar['default'][3];
  } else return;
  _hitLevelDurationsByChar[charId] = Object.assign({}, _hitLevelDurationsByChar[charId] || {}, normalized);
}

export function getHitLevelDuration(charId, level) {
  const cid = charId || 'default';
  const table = _hitLevelDurationsByChar[cid] || _hitLevelDurationsByChar['default'];
  const lvl = Math.max(1, Math.min(3, Number(level || 1)));
  return Number(table[lvl]) || Number(_hitLevelDurationsByChar['default'][lvl]);
}

// expose helpers globally for modules that avoid importing to prevent cycles
if (typeof window !== 'undefined') {
  window.registerHitLevelDurationsForChar = registerHitLevelDurationsForChar;
  window.getHitLevelDuration = getHitLevelDuration;
}

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