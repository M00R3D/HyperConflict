// Registro central de hitboxes de ataque por personaje (charId -> { attackName -> hitboxDef })
const _attackHitboxesByChar = Object.create(null);

export function registerAttackHitboxesForChar(charId, table = {}) {
  if (!charId || typeof table !== 'object') return;
  _attackHitboxesByChar[charId] = Object.assign({}, _attackHitboxesByChar[charId] || {}, table);
}

export function getAttackHitboxForChar(charId, attackName) {
  if (!charId || !attackName) return null;
  const table = _attackHitboxesByChar[charId];
  if (!table) return null;
    // buscar nombre exacto; si no existe intentar varias normalizaciones
    //  - exacto
    //  - todo en minúsculas (registro legacy puede usar lowercase)
    //  - sin número final (p.e. punch3 -> punch)
    //  - minúsculas sin número final
    const exact = table[attackName];
    const lower = table[String(attackName).toLowerCase()];
    const stripNum = table[String(attackName).replace(/\d+$/, '')];
    const lowerStrip = table[String(attackName).toLowerCase().replace(/\d+$/, '')];
    let def = exact || lower || stripNum || lowerStrip || null;
  return def || null;
}

// Registro central de hitboxes del cuerpo por personaje (charId -> { stateName -> hitboxDef })
const _bodyHitboxesByChar = Object.create(null);

/**
 * Registrar hitboxes del cuerpo por personaje.
 * table: { stateName: { offsetX, offsetY, w, h }, ... }
 */
export function registerBodyHitboxesForChar(charId, table = {}) {
  if (!charId || typeof table !== 'object') return;
  _bodyHitboxesByChar[charId] = Object.assign({}, _bodyHitboxesByChar[charId] || {}, table);
}

/**
 * Obtener hitbox de cuerpo para charId/state.
 * Si no existe, intenta normalizar estados 'hit1/2/3' -> 'hit' y devuelve null si no hay override.
 */
export function getBodyHitboxForChar(charId, stateName) {
  if (!charId || !stateName) return null;
  const table = _bodyHitboxesByChar[charId];
  if (!table) return null;
  let def = table[stateName] || null;
  if (!def && /^hit\d$/.test(stateName)) def = table['hit'] || null;
  if (!def && stateName === 'idle') def = table['idle'] || null;
  return def || null;
}

// expose for debugging / runtime tweaks (merge with existing exposes)
if (typeof window !== 'undefined') {
  window.registerBodyHitboxesForChar = registerBodyHitboxesForChar;
  window._BODY_HITBOXES_BY_CHAR = _bodyHitboxesByChar;
}

// --- Motion / temporal hitbox behavior registry (per-character)
// Cada entrada: charId -> { attackName: motionSpec }
// motionSpec puede ser:
//  - Array [insideEndPct, outEndPct] (valores 0..1, inside 0..insideEnd, out moves until outEnd, return after)
//  - Object { insideEnd:0.1, outEnd:0.6 }
const _attackHitboxMotionByChar = Object.create(null);

export function registerAttackHitboxMotionForChar(charId, table = {}) {
  if (!charId || typeof table !== 'object') return;
  _attackHitboxMotionByChar[charId] = Object.assign({}, _attackHitboxMotionByChar[charId] || {}, table);
}

export function getAttackHitboxMotionForChar(charId, attackName) {
  if (!charId || !attackName) return null;
  const table = _attackHitboxMotionByChar[charId];
  if (!table) return null;
  const v = table[attackName] || table[attackName.toLowerCase()] || null;
  if (!v) return null;
  // normalize array -> object
  if (Array.isArray(v)) {
    // support [insideEnd, outEnd, holdEnd?]
    const inside = Number(v[0] || 0);
    const out = Number(v[1] || 0.6);
    const hold = (typeof v[2] !== 'undefined') ? Number(v[2]) : out;
    return { insideEnd: inside, outEnd: out, holdEnd: hold };
  }
  if (typeof v === 'object') {
    const inside = Number(v.insideEnd || 0);
    const out = Number(v.outEnd || 0.6);
    const hold = (typeof v.holdEnd !== 'undefined') ? Number(v.holdEnd) : (typeof v.holdPct !== 'undefined' ? Number(v.holdPct) : out);
    return { insideEnd: inside, outEnd: out, holdEnd: hold };
  }
  return null;
}

// expose registry for debugging/runtime tweaks
if (typeof window !== 'undefined') {
  window.registerAttackHitboxMotionForChar = registerAttackHitboxMotionForChar;
  window._ATTACK_HITBOX_MOTION_BY_CHAR = _attackHitboxMotionByChar;
}

// --- Easy-to-edit presets for per-character attack hitbox motion
// Use arrays for compactness: [insideEndPct, outEndPct, holdEndPct?]
// Example: 'sbluer': { punch: [0.05,0.12,0.9], kick: [0.05,0.12,0.9] }
export const HITBOX_MOTION_PRESETS = {
  sbluer: {
    punch: [0.05, 0.12, 0.9],
    punch2: [0.05, 0.12, 0.9],
    punch3: [0.05, 0.12, 0.9],
    crouchPunch: [0.05, 0.12, 0.9],
    kick: [0.05, 0.12, 0.9],
    kick2: [0.05, 0.12, 0.9],
    kick3: [0.05, 0.12, 0.9],
    crouchKick: [0.05, 0.12, 0.9]
  },
  tyeman: {
    punch: [0.05, 0.12, 0.9],
    punch2: [0.05, 0.12, 0.9],
    punch3: [0.05, 0.12, 0.9],
    crouchPunch: [0.05, 0.12, 0.9],
    kick: [0.05, 0.12, 0.9],
    kick2: [0.05, 0.12, 0.9],
    kick3: [0.05, 0.12, 0.9],
    crouchKick: [0.05, 0.12, 0.9]
  },
  fernando: {
    punch: [0.05, 0.12, 0.9],
    punch2: [0.05, 0.12, 0.9],
    punch3: [0.05, 0.12, 0.9],
    crouchPunch: [0.05, 0.12, 0.9],
    kick: [0.05, 0.12, 0.9],
    kick2: [0.05, 0.12, 0.9],
    kick3: [0.05, 0.12, 0.9],
    crouchKick: [0.05, 0.12, 0.9]
  }
};

// Apply a presets object to the runtime registry. Useful for a single place to tweak.
export function applyHitboxMotionPresets(presets = HITBOX_MOTION_PRESETS) {
  if (!presets || typeof presets !== 'object') return;
  for (const charId in presets) {
    if (!Object.prototype.hasOwnProperty.call(presets, charId)) continue;
    const table = presets[charId];
    if (!table || typeof table !== 'object') continue;
    try {
      registerAttackHitboxMotionForChar(charId, table);
    } catch (e) {
      // ignore registration errors in environments where registrar isn't available
    }
  }
}

if (typeof window !== 'undefined') {
  window.HITBOX_MOTION_PRESETS = HITBOX_MOTION_PRESETS;
  window.applyHitboxMotionPresets = applyHitboxMotionPresets;
}