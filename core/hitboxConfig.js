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
  // buscar nombre exacto; si no existe intentar versión sin número final (p.e. punch3 -> punch)
  let def = table[attackName] || table[attackName.replace(/\d+$/, '')] || null;
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