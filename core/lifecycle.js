// core/lifecycle.js
import { state as gameState, assignFrom as assignGameState } from './gameState.js';
import { Fighter } from '../../entities/fighter.js';
import { getStatsForChar, getActionsForChar } from './charConfig.js';
import { registerSpecials } from './registerCharData.js';
import { initInput } from './input.js';
import { loadStageItems } from '../ui/stageEditor.js';

export function clearMatchOverState() {
  gameState.MATCH_OVER = false;
  gameState.MATCH_WINNER = null;
  try { if (typeof window !== 'undefined') { window.MATCH_OVER = false; window.MATCH_WINNER = null; } } catch(e){}

  if (gameState._matchMenu) {
    gameState._matchMenu.active = false;
    gameState._matchMenu.idx = 0;
    gameState._matchMenu.lastInputAt = 0;
  }

  // clear per-player life-processing flags
  ['player1','player2'].forEach(k => {
    const p = gameState[k];
    if (!p) return;
    p._lifeProcessing = false;
    p._lifeHandled = false;
    if (p._lifeHandledAt) delete p._lifeHandledAt;
  });

  assignGameState(gameState);
}

export function tryCreatePlayers() {
  const win = (typeof window !== 'undefined') ? window : {};
  const p1c = (win && typeof win.p1Confirmed === 'boolean') ? win.p1Confirmed : gameState.p1Confirmed;
  const p2c = (win && typeof win.p2Confirmed === 'boolean') ? win.p2Confirmed : gameState.p2Confirmed;
//   console.log('[lifecycle] tryCreatePlayers called', { p1c, p2c, assetsTyeman: !!gameState._tyemanAssets, assetsSbluer: !!gameState._sbluerAssets });
  if (!p1c || !p2c) {
    // console.log('[lifecycle] tryCreatePlayers early return: confirmations missing', { p1c, p2c });
    return false;
  }
  if (gameState.player1 || gameState.player2) {
    // console.log('[lifecycle] players already exist, skipping creation');
    return false;
  }

  try {
    if (win && typeof win.stageGetSaved === 'function') {
      const saved = win.stageGetSaved();
      if (Array.isArray(saved) && saved.length && !win._stageSelectionDone) {
        gameState.selectionActive = false;
        if (typeof win.stageShowPicker === 'function') {
          win.stageShowPicker(function(selected) {
            win._selectedStageRecord = selected || null;
            win._stageSelectionDone = true;
            tryCreatePlayers();
          });
          assignGameState(gameState);
          return false;
        }
      }
    }
  } catch (e) { console.warn('stage picker errored, continuing', e); }

  // proceed to create players
  const tyeman = gameState._tyemanAssets;
  const sbluer = gameState._sbluerAssets;
  const fernando = gameState._fernandoAssets;
  const choicesLocal = (win && Array.isArray(win.choices)) ? win.choices : gameState.choices;
  const p1ChoiceLocal = (win && typeof win.p1Choice === 'number') ? win.p1Choice : gameState.p1Choice;
  const p2ChoiceLocal = (win && typeof win.p2Choice === 'number') ? win.p2Choice : gameState.p2Choice;

  const p1Stats = getStatsForChar(choicesLocal[p1ChoiceLocal]);
  const p2Stats = getStatsForChar(choicesLocal[p2ChoiceLocal]);
  const p1Actions = getActionsForChar(choicesLocal[p1ChoiceLocal]);
  const p2Actions = getActionsForChar(choicesLocal[p2ChoiceLocal]);

  function assetsForChar(charId) {
    if (charId === 'tyeman') return tyeman;
    if (charId === 'sbluer') return sbluer;
    if (charId === 'fernando') return fernando;
    // fallback: try gameState lookup or null
    return gameState[`_${charId}Assets`] || null;
  }

  const p1 = new Fighter({
    x: 100, col: color(255,100,100), id: 'p1', charId: choicesLocal[p1ChoiceLocal],
    assets: assetsForChar(choicesLocal[p1ChoiceLocal]),
    actions: p1Actions, ...p1Stats
  });
  const p2 = new Fighter({
    x: 600, col: color(100,100,255), id: 'p2', charId: choicesLocal[p2ChoiceLocal],
    assets: assetsForChar(choicesLocal[p2ChoiceLocal]),
    actions: p2Actions, ...p2Stats
  });

  p1.opponent = p2; p2.opponent = p1;

  try {
    if (win && win._selectedStageRecord) {
      const rec = win._selectedStageRecord;
      if (rec && rec.json) {
        try { loadStageItems(JSON.parse(rec.json)); } catch (e) { console.warn('failed to load selected stage json', e); }
      }
      win._selectedStageRecord = null;
    }
  } catch (e) {}

  console.log('[lifecycle] players created', { p1Char: p1.charId, p2Char: p2.charId });
  clearMatchOverState();
  try { registerSpecials(); } catch (e) {}

  p1.facing = (p1.x < p2.x) ? 1 : -1;
  p2.facing = (p2.x < p1.x) ? 1 : -1;

  try {
    gameState.PAUSED = false; if (typeof win !== 'undefined') win.PAUSED = false;
    p1.setState && p1.setState('idle'); p1.frameIndex = 0; p1.frameTimer = 0;
    p2.setState && p2.setState('idle'); p2.frameIndex = 0; p2.frameTimer = 0;
  } catch (e) {}

  try {
    initInput({ p1, p2, ready: true });
    gameState.playersReady = true;
    gameState.selectionActive = false;
    gameState.player1 = p1;
    gameState.player2 = p2;
    gameState._prevHp = { p1: p1.hp, p2: p2.hp };
    assignGameState(gameState);
  } catch (e) { console.warn('tryCreatePlayers initInput failed', e); }

  return true;
}
