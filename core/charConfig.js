// Registro de stats y acciones por personaje

const statsByChar = {};
const actionsByChar = {};

export function registerStatsForChar(charId, stats) {
  if (!charId || typeof stats !== 'object') return;
  statsByChar[charId] = Object.assign({}, statsByChar[charId] || {}, stats);
}

export function getStatsForChar(charId) {
  return statsByChar[charId] || {};
}

export function registerActionsForChar(charId, actions) {
  if (!charId || typeof actions !== 'object') return;
  actionsByChar[charId] = Object.assign({}, actionsByChar[charId] || {}, actions);
}

export function getActionsForChar(charId) {
  return actionsByChar[charId] || {};
}