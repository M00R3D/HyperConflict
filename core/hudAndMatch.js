// core/hudAndMatch.js
// Extraído desde main.js: manejo del HUD, detección de pérdida de vida, menú de "match over" y reset a selección.

export function _drawMatchOverOverlay(menu = null, ctx = {}) {
  // usa p5 globals
  push();
  noStroke();
  fill(0, 200);
  rect(0, 0, width, height);

  const w = Math.min(520, width - 80);
  const h = 220;
  const x = (width - w) / 2;
  const y = (height - h) / 2;
  fill(28, 34, 42, 230);
  stroke(255, 28);
  rect(x, y, w, h, 8);

  noStroke();
  fill(255);
  textAlign(CENTER, TOP);
  textSize(28);
  text('MATCH OVER', x + w / 2, y + 12);

  textSize(18);
  const MATCH_WINNER = ctx.MATCH_WINNER;
  const player1 = ctx.player1;
  const player2 = ctx.player2;
  const winnerLabel = MATCH_WINNER === 'p1' ? (player1?.charId || 'P1') : (MATCH_WINNER === 'p2' ? (player2?.charId || 'P2') : '—');
  text(`Winner: ${winnerLabel}`, x + w / 2, y + 56);

  // draw menu options (like pause menu) and highlight selected
  const items = (menu && Array.isArray(menu.items)) ? menu.items : ['Rematch','Character Select'];
  const selIdx = menu ? (menu.idx || 0) : 0;
  textSize(16);
  const menuX = x + w / 2;
  let menuY = y + 96;
  for (let i = 0; i < items.length; i++) {
    const ty = menuY + i * 36;
    if (i === selIdx) {
      fill(80,200,255);
      rect(x + 36, ty - 8, w - 72, 30, 6);
      fill(10);
    } else {
      fill(220);
    }
    textAlign(CENTER, CENTER);
    text(items[i], menuX, ty + 6);
  }

  textSize(12);
  fill(200);
  textAlign(CENTER, TOP);
  text('Navega con W/S (P1) o ↑/↓ (P2). Selecciona con I/O (P1) o B/N (P2).', x + w/2, y + h - 36);

  pop();
}

export function resetToSelection(ctx = {}) {
  // defensive: ctx may contain references to variables and functions from main
  const win = (typeof window !== 'undefined') ? window : {};

  // Stop pause/hitstop and clear globals
  // Ensure PAUSED is cleared everywhere (ctx, window, shared gameState)
  try { ctx.PAUSED = false; } catch (e) {}
  try { if (win) win.PAUSED = false; } catch (e) {}
  try { if (typeof gameState !== 'undefined') gameState.PAUSED = false; } catch (e) {}
  try { if (win) { win.HITSTOP_ACTIVE = false; win.HITSTOP_PENDING = false; win.HITSTOP_REMAINING_MS = 0; } } catch(e){}

  // Ensure match-over menu cleared as we leave gameplay
  try { if (typeof ctx.clearMatchOverState === 'function') ctx.clearMatchOverState(); } catch(e){}

  // clear players / projectiles / ready flag
  try { if (ctx.player1) ctx.player1 = null; } catch(e){}
  try { if (ctx.player2) ctx.player2 = null; } catch(e){}
  try { if (Array.isArray(ctx.projectiles)) ctx.projectiles.length = 0; } catch(e){}
  if (typeof ctx.playersReady !== 'undefined') ctx.playersReady = false;
  if (typeof ctx.selectionActive !== 'undefined') ctx.selectionActive = true;

  // reset selection indexes & confirmations
  if (typeof ctx.p1Confirmed !== 'undefined') ctx.p1Confirmed = false;
  if (typeof ctx.p2Confirmed !== 'undefined') ctx.p2Confirmed = false;
  if (typeof ctx.p1SelIndex !== 'undefined') ctx.p1SelIndex = 0;
  if (typeof ctx.p2SelIndex !== 'undefined') ctx.p2SelIndex = 1;
  if (typeof ctx.p1Choice !== 'undefined') ctx.p1Choice = 0;
  if (typeof ctx.p2Choice !== 'undefined') ctx.p2Choice = 1;

  // also clear any selection state stored on window by selectionManager
  try {
    if (win) {
      if (win.choices) delete win.choices;
      if (typeof win.p1Confirmed !== 'undefined') win.p1Confirmed = false;
      if (typeof win.p2Confirmed !== 'undefined') win.p2Confirmed = false;
      if (typeof win.p1Choice !== 'undefined') win.p1Choice = 0;
      if (typeof win.p2Choice !== 'undefined') win.p2Choice = 1;
      if (typeof win.p1SelIndex !== 'undefined') win.p1SelIndex = 0;
      if (typeof win.p2SelIndex !== 'undefined') win.p2SelIndex = 1;
      if (typeof win._stageSelectionDone !== 'undefined') win._stageSelectionDone = false;
      if (typeof win._selectedStageRecord !== 'undefined') win._selectedStageRecord = null;
    }
  } catch (e) {}

  // reset camera / hud / effects (safely merge)
  ctx.cam = { x: 0, y: 0, zoom: 1 };
  ctx.appliedCamZoom = ctx.cam.zoom || 1;
  ctx.appliedHUDAlpha = 1;
  ctx._hitEffect = { active: false, start: 0, end: 0, duration: 0, mag: 0, zoom: 0, targetPlayerId: null };
  ctx._prevHp = { p1: null, p2: null };
  ctx._hsPrevActive = false;
  ctx._hsStartedAt = 0;
  ctx._prevBlockstun = { p1: false, p2: false };
  ctx._blockstunZoom = { active: false, start: 0, duration: 360, targetAdd: 0.16, playerId: null };

  // clear input flags (defensive)
  try {
    if (typeof ctx.keysPressed === 'object') for (const k in ctx.keysPressed) ctx.keysPressed[k] = false;
    if (typeof ctx.keysDown === 'object') for (const k in ctx.keysDown) ctx.keysDown[k] = false;
    if (typeof ctx.keysUp === 'object') for (const k in ctx.keysUp) ctx.keysUp[k] = false;
  } catch (e) {}

  // re-init input module without players
  try { if (typeof ctx.initInput === 'function') ctx.initInput({ p1: null, p2: null, ready: false }); } catch (e) {}

  // clear any per-player HUD state maps (safe)
  try {
    if (typeof win !== 'undefined') {
      if (win._heartStateByPlayer && typeof win._heartStateByPlayer.clear === 'function') win._heartStateByPlayer.clear();
      if (win._bootStateByPlayer && typeof win._bootStateByPlayer.clear === 'function') win._bootStateByPlayer.clear();
    }
  } catch(e){}

  console.log('[RESET] returned to character select and fully reset state');
}

export function handleHUDAndMatch(ctx = {}) {
  // ctx: container for variables/functions; caller may supply or rely on global-like values
  ctx = ctx || {};

  // HUD opacity smoothing
  const hudTarget = (typeof ctx.PAUSED !== 'undefined') ? (ctx.PAUSED ? 0 : 1) : (window.PAUSED ? 0 : 1);
  ctx.appliedHUDAlpha = lerp((typeof ctx.appliedHUDAlpha === 'number') ? ctx.appliedHUDAlpha : 1, hudTarget, 0.12);

  // dim / fade overlay sobre el área del HUD
  if (ctx.appliedHUDAlpha < 0.999) {
    push();
    noStroke();
    const hudHeight = 60;
    const coverAlpha = Math.round((1 - ctx.appliedHUDAlpha) * 220);
    fill(0, coverAlpha);
    rect(0, 0, width, hudHeight);
    pop();
  }

  // life -> portrait transitions
  try {
    const player1 = ctx.player1;
    const player2 = ctx.player2;
    const MATCH_OVER = !!ctx.MATCH_OVER;
    if (player1 && typeof player1.hp === 'number' && player1.hp <= 0 && !MATCH_OVER) {
      if (!player1._lifeHandled) {
        player1._lifeHandled = true;
        if (typeof ctx.handlePlayerLifeLost === 'function') ctx.handlePlayerLifeLost(player1);
      }
    } else if (player1 && typeof player1.hp === 'number' && player1.hp > 0) {
      player1._lifeHandled = false;
    }

    if (player2 && typeof player2.hp === 'number' && player2.hp <= 0 && !MATCH_OVER) {
      if (!player2._lifeHandled) {
        player2._lifeHandled = true;
        if (typeof ctx.handlePlayerLifeLost === 'function') ctx.handlePlayerLifeLost(player2);
      }
    } else if (player2 && typeof player2.hp === 'number' && player2.hp > 0) {
      player2._lifeHandled = false;
    }
  } catch (e) {
    console.warn('[life detect] error', e);
  }

  // If match over, draw overlay and accept rematch/return input with menu navigation
  if (ctx.MATCH_OVER) {
    _drawMatchOverOverlay(ctx._matchMenu, ctx);

    const now = millis();
    const canInput = (now - (ctx._matchMenu.lastInputAt || 0)) >= (ctx._matchMenu.debounceMs || 220);

    const keys = ctx.keysPressed || (typeof keysPressed !== 'undefined' ? keysPressed : {});
    const up = !!(canInput && (keys['w'] || keys['arrowup']));
    const down = !!(canInput && (keys['s'] || keys['arrowdown']));

    if (up) {
      ctx._matchMenu.idx = Math.max(0, (ctx._matchMenu.idx || 0) - 1);
      ctx._matchMenu.lastInputAt = now;
      if (keys['w']) keys['w'] = false;
      if (keys['arrowup']) keys['arrowup'] = false;
    } else if (down) {
      ctx._matchMenu.idx = Math.min((ctx._matchMenu.items.length - 1), (ctx._matchMenu.idx || 0) + 1);
      ctx._matchMenu.lastInputAt = now;
      if (keys['s']) keys['s'] = false;
      if (keys['arrowdown']) keys['arrowdown'] = false;
    }

    const selP1 = !!(canInput && (keys['i'] || keys['o']));
    const selP2 = !!(canInput && (keys['b'] || keys['n']));
    const selEnter = !!(canInput && (keys['enter'] || keys[' ']));

    if (selP1 || selP2 || selEnter) {
      const choice = ctx._matchMenu.items[ctx._matchMenu.idx || 0] || 'Rematch';
      ctx._matchMenu.lastInputAt = now;
      if (keys['i']) keys['i'] = false;
      if (keys['o']) keys['o'] = false;
      if (keys['b']) keys['b'] = false;
      if (keys['n']) keys['n'] = false;
      if (keys['enter']) keys['enter'] = false;
      if (keys[' ']) keys[' '] = false;

      if (choice === 'Rematch') {
        try {
          if (ctx.player1) {
            ctx.player1.lives = ctx.player1.livesMax || 2;
            if (typeof ctx._respawnPlayer === 'function') ctx._respawnPlayer(ctx.player1);
            ctx.player1._lifeProcessing = false;
            ctx.player1._lifeHandled = false;
          }
          if (ctx.player2) {
            ctx.player2.lives = ctx.player2.livesMax || 2;
            if (typeof ctx._respawnPlayer === 'function') ctx._respawnPlayer(ctx.player2);
            ctx.player2._lifeProcessing = false;
            ctx.player2._lifeHandled = false;
          }
          if (Array.isArray(ctx.projectiles)) ctx.projectiles.length = 0;
          if (typeof ctx.clearMatchOverState === 'function') ctx.clearMatchOverState();
        } catch (e) {}
      } else {
        try {
          if (typeof ctx.clearMatchOverState === 'function') ctx.clearMatchOverState();
          if (typeof ctx.resetToSelectionFn === 'function') ctx.resetToSelectionFn(ctx);
        } catch (e) {}
      }
    }
  }

  // finally, clear frame flags if provided
  try { if (typeof ctx.clearFrameFlags === 'function') ctx.clearFrameFlags(); else if (typeof clearFrameFlags === 'function') clearFrameFlags(); } catch (e) {}

  return ctx;
}
