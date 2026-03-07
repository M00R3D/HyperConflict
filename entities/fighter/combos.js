// entities/fighter/combos.js
// Módulo para centralizar definiciones y inicialización de cadenas de combo

const _combosByChar = Object.create(null);

export function registerComboChainsForChar(charId, table = {}) {
  if (!charId || typeof table !== 'object') return;
  _combosByChar[charId] = Object.assign({}, _combosByChar[charId] || {}, table);
}

export function getComboChainsForChar(charId) {
  // retorna copia defensiva
  if (!charId) return null;
  const v = _combosByChar[charId];
  return v ? Object.assign({}, v) : null;
}

function _defaultChainsForChar(charId) {
  return {
    i: ['punch', 'punch2', 'punch3'],
    o: ['kick', 'kick2', 'kick3'],
    b: ['punch', 'punch2', 'punch3'],
    n: ['kick', 'kick2', 'kick3'],
    p: charId === 'tyeman' ? ['stapler'] : charId === 'sbluer' ? ['spit'] : charId === 'fernando' ? ['thin_laser'] : [],
    m: charId === 'tyeman' ? ['stapler'] : charId === 'sbluer' ? ['spit'] : charId === 'fernando' ? ['thin_laser'] : []
  };
}

export function initCombos(self) {
  if (!self) return;
  const charId = self.charId || null;
  const fromChar = getComboChainsForChar(charId);
  const chains = fromChar || _defaultChainsForChar(charId);

  // defensive copy
  self.comboChainsByKey = Object.assign({}, chains);

  self.comboStepByKey = {};
  self.lastAttackTimeByKey = {};
  self.inputLockedByKey = {};
  for (const k in self.comboChainsByKey) {
    if (!Object.prototype.hasOwnProperty.call(self.comboChainsByKey, k)) continue;
    self.comboStepByKey[k] = 0;
    self.lastAttackTimeByKey[k] = 0;
    self.inputLockedByKey[k] = false;
  }

  self.comboWindow = (typeof self.comboWindow === 'number') ? self.comboWindow : 250;
}

// expose for debugging
if (typeof window !== 'undefined') {
  window.registerComboChainsForChar = registerComboChainsForChar;
  window._COMBOS_BY_CHAR = _combosByChar;
}

export default {
  registerComboChainsForChar,
  getComboChainsForChar,
  initCombos
};
