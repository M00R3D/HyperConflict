// core/gameState.js
// Centraliza el estado global del juego para facilitar refactors.

export const state = {
  player1: null,
  player2: null,
  projectiles: [],
  playersReady: false,
  cam: { x: 0, y: 0, zoom: 1 },
  PAUSED: false,
  appliedCamZoom: 1,
  appliedHUDAlpha: 1,
  MATCH_OVER: false,
  MATCH_WINNER: null,
  _matchMenu: {
    items: ['Rematch', 'Character Select'],
    idx: 0,
    lastInputAt: 0,
    debounceMs: 220,
    active: false
  },
  MAX_HP_QUARTERS: 24,
  _hitEffect: { active: false, start: 0, end: 0, duration: 0, mag: 0, zoom: 0, targetPlayerId: null },
  _prevHp: { p1: null, p2: null },
  _hsPrevActive: false,
  _hsStartedAt: 0,
  _prevBlockstun: { p1: false, p2: false },
  _blockstunZoom: { active: false, start: 0, duration: 360, targetAdd: 0.16, playerId: null },
  _tyemanAssets: null,
  _sbluerAssets: null,
  _heartFrames: null,
  _slotAssets: null,
  _bootFrames: null,
  selectionActive: false,
  choices: ['tyeman', 'sbluer'],
  p1Choice: 0,
  p2Choice: 1,
  p1Confirmed: false,
  p2Confirmed: false,
  p1SelIndex: 0,
  p2SelIndex: 1
};

export function applyToWindow() {
  if (typeof window === 'undefined') return;
  // Mirror a subset of state to window for compatibility con código legacy.
  window.player1 = state.player1;
  window.player2 = state.player2;
  window.projectiles = state.projectiles;
  window.playersReady = state.playersReady;
  window.cam = state.cam;
  window.PAUSED = state.PAUSED;
  window.MATCH_OVER = state.MATCH_OVER;
  window.MATCH_WINNER = state.MATCH_WINNER;
  window._matchMenu = state._matchMenu;
  window.MAX_HP_QUARTERS = state.MAX_HP_QUARTERS;
  window._hitEffect = state._hitEffect;
  window._tyemanAssets = state._tyemanAssets;
  window._sbluerAssets = state._sbluerAssets;
  window._heartFrames = state._heartFrames;
  window._bootFrames = state._bootFrames;
}

export function assignFrom(obj = {}) {
  // Merge provided object into state (shallow) and mirror to window.
  Object.assign(state, obj);
  applyToWindow();
}
