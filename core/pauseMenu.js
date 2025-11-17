// Prefer to import the specials getter directly so the menu reads the registered moves reliably
import { getSpecialDefsForChar } from '../entities/fighter/specials.js';
import { mirrorSymbol } from '../entities/fighter/hitbox.js';

// core/pauseMenu.js
// Simple Pause Menu: navegar con arriba/abajo (↑/↓ o W/S) y seleccionar/volver con golpe/patada (P/K):
// P1: i/o  P2: b/n
let _menu = {
  items: ['Resume', 'Character Select', 'Moveset'], // renamed Specials -> Moveset
  idx: 0,
  view: 'menu', // 'menu' | 'moveset'
  specialsCharIdx: 0,
  lastInputAt: 0,
  inputDebounceMs: 120
};
let _callbacks = { onResume: null, onReturnToCharSelect: null };

// NEW: owner of the pause menu ('p1'|'p2'|null). Only owner can navigate/select.
let _owner = null;

// NEW: moveset-mode: 'combos' or 'specials'
let _movesetMode = 'combos';

export function initPauseMenu(callbacks = {}) {
  _callbacks.onResume = callbacks.onResume || (() => {});
  _callbacks.onReturnToCharSelect = callbacks.onReturnToCharSelect || (() => {});
}

// open pause for a specific player id ('p1' or 'p2')
export function openPauseFor(playerId = 'p1') {
  _owner = (playerId === 'p2') ? 'p2' : 'p1';
  _menu.view = 'menu';
  _menu.idx = 0;
  _menu.specialsCharIdx = 0;
  _menu.lastInputAt = 0;
  _movesetMode = 'combos';
  // set global PAUSED externally (main should set PAUSED = true before calling openPauseFor)
}

// close pause and clear owner
export function closePause() {
  _owner = null;
  _menu.view = 'menu';
  _menu.idx = 0;
  _menu.lastInputAt = 0;
  _movesetMode = 'combos';
}

// helper to get owner player object from players map
function _ownerPlayer(players) {
  if (!_owner) return null;
  if (_owner === 'p1') return players.p1 || null;
  if (_owner === 'p2') return players.p2 || null;
  return null;
}

function canAcceptInput() {
  return (millis() - (_menu.lastInputAt || 0)) >= (_menu.inputDebounceMs || 120);
}

// keysPressed: from core/input.js ; players: { p1, p2 }
export function handlePauseInput(keysPressed = {}, players = {}) {
  if (!canAcceptInput()) return;
  const owner = _ownerPlayer(players);
  if (!owner) return; // nobody can control menu

  const isP1 = (_owner === 'p1');

  // NAVIGATION KEYS: owner-specific mapping (strict)
  // - If P1 opened pause: navigation = W / S
  // - If P2 opened pause: navigation = ArrowUp / ArrowDown
  const up = !!(isP1 ? keysPressed['w'] : keysPressed['arrowup']);
  const down = !!(isP1 ? keysPressed['s'] : keysPressed['arrowdown']);

  // select/back keys mapped to punch/kick for each player
  const select = isP1
    ? !!(keysPressed['i'] || keysPressed['o'] || keysPressed['enter'])
    : !!(keysPressed['b'] || keysPressed['n'] || keysPressed['shift']);

  if (_menu.view === 'menu') {
    if (up) { _menu.idx = Math.max(0, _menu.idx - 1); _menu.lastInputAt = millis(); }
    if (down) { _menu.idx = Math.min(_menu.items.length - 1, _menu.idx + 1); _menu.lastInputAt = millis(); }
    if (select) {
      _menu.lastInputAt = millis();
      const cur = _menu.items[_menu.idx];
      if (cur === 'Resume') {
        if (typeof _callbacks.onResume === 'function') _callbacks.onResume();
        closePause();
      } else if (cur === 'Character Select') {
        if (typeof _callbacks.onReturnToCharSelect === 'function') _callbacks.onReturnToCharSelect();
        closePause();
      } else if (cur === 'Moveset') {
        _menu.view = 'moveset';
        _menu.specialsCharIdx = 0;
        _movesetMode = 'combos';
      }
      // consume the select key for the owner so it doesn't leak
      if (isP1) { if (keysPressed['i']) keysPressed['i'] = false; if (keysPressed['o']) keysPressed['o'] = false; if (keysPressed['enter']) keysPressed['enter'] = false; }
      else { if (keysPressed['b']) keysPressed['b'] = false; if (keysPressed['n']) keysPressed['n'] = false; if (keysPressed['shift']) keysPressed['shift'] = false; }
    }
  } else if (_menu.view === 'moveset') {
    // In moveset view: up/down toggle between 'combos' and 'specials' (owner only)
    if (up || down) {
      _movesetMode = (_movesetMode === 'combos') ? 'specials' : 'combos';
      _menu.lastInputAt = millis();
    }
    if (select) {
      // back to menu
      _menu.view = 'menu';
      _menu.lastInputAt = millis();
      if (isP1) { if (keysPressed['i']) keysPressed['i'] = false; if (keysPressed['o']) keysPressed['o'] = false; if (keysPressed['enter']) keysPressed['enter'] = false; }
      else { if (keysPressed['b']) keysPressed['b'] = false; if (keysPressed['n']) keysPressed['n'] = false; if (keysPressed['shift']) keysPressed['shift'] = false; }
    }
  }
}

function _getCharsFromPlayers(players) {
  const out = [];
  if (players.p1 && players.p1.charId) out.push(players.p1.charId);
  if (players.p2 && players.p2.charId && players.p2.charId !== out[0]) out.push(players.p2.charId);
  return out;
}

export function drawPauseMenu(p1 = null, p2 = null) {
  push();
  noStroke();
  fill(0, 180);
  rect(0, 0, width, height);
  const w = 420, h = 240;
  const x = (width - w) / 2, y = (height - h) / 2;
  fill(28, 34, 42, 230);
  stroke(255, 18);
  rect(x, y, w, h, 8);
  noStroke(); fill(255); textAlign(CENTER, TOP); textSize(20);

  // show which player owns the pause
  const ownerLabel = _owner ? (_owner === 'p1' ? 'P1' : 'P2') : '—';
  text(`PAUSA — ${ownerLabel}`, x + w/2, y + 12);

  if (_menu.view === 'menu') {
    textSize(16);
    for (let i = 0; i < _menu.items.length; i++) {
      const ty = y + 56 + i * 36;
      if (i === _menu.idx) { fill(80,200,255); rect(x + 16, ty - 6, w - 32, 28, 6); fill(10); } else fill(240);
      textAlign(LEFT, CENTER); textSize(14); text(_menu.items[i], x + 28, ty + 8);
    }
    fill(180); textSize(12); textAlign(CENTER, BOTTOM);
    text('Usa W/S (P1) o ↑/↓ (P2) para navegar. Golpe/Patada para seleccionar/volver (solo tu pausa).', x + w/2, y + h - 10);
  } else if (_menu.view === 'moveset') {
    // show moveset for owner player only
    const ownerPlayer = _owner === 'p1' ? p1 : p2;
    if (!ownerPlayer) {
      fill(240); textSize(14); textAlign(CENTER, CENTER); text('No hay personaje para mostrar', x + w/2, y + h/2);
    } else {
      fill(240); textSize(16); textAlign(LEFT, TOP);
      text(`Moveset — ${String(ownerPlayer.charId || ownerPlayer.id).toUpperCase()}`, x + 20, y + 48);

      // header showing current sub-mode
      const modeLabel = (_movesetMode === 'combos') ? 'Combos' : 'Specials';
      fill(200); textSize(12); textAlign(LEFT, TOP);
      text(`Mostrando: ${modeLabel} (↑/↓ para alternar)`, x + 20, y + 76);

      const listX = x + 22; let ly = y + 96; textSize(12);

      if (_movesetMode === 'combos') {
        const combos = ownerPlayer.comboChainsByKey || null;
        if (combos && Object.keys(combos).length > 0) {
          fill(200); text('Combos (por key):', listX, ly); ly += 18;
          for (const k in combos) {
            const seq = (combos[k] || []).join(' ');
            fill(220); text(`${k.toUpperCase()}: ${seq}`, listX, ly); ly += 16;
            if (ly > y + h - 28) break;
          }
        } else {
          fill(180); text('No combos registrados para este personaje.', listX, ly); ly += 18;
        }
      } else {
        // specials mode: read registered specials for this char (prefer imported getter if available)
        let specials = null;
        try { specials = getSpecialDefsForChar(ownerPlayer.charId, ownerPlayer); } catch (e) { specials = null; }
        // fallback to any global table if present
        if (!specials && typeof window !== 'undefined' && window._SPECIALS_TABLE) {
          try { specials = window._SPECIALS_TABLE[ownerPlayer.charId] || null; } catch(e){ specials = null; }
        }

        if (specials && typeof specials === 'object' && Object.keys(specials).length > 0) {
          fill(200); text('Specials:', listX, ly); ly += 18;
          for (const name in specials) {
            const def = specials[name];
            // show mirrored sequence if the owner is facing left
            let seqArr = Array.isArray(def.seq) ? def.seq.slice() : [String(def.seq || '')];
            if (ownerPlayer && ownerPlayer.facing === -1) {
              try { seqArr = seqArr.map(s => mirrorSymbol(s)); } catch (e) { /* fallback: keep original */ }
            }
            const seq = seqArr.join(' ');
            fill(220); text(`${name}: ${seq}`, listX, ly); ly += 16;
            if (ly > y + h - 28) break;
          }
        } else {
          fill(180); text('No specials registrados para este personaje.', listX, ly); ly += 18;
        }
      }

      fill(160); textAlign(CENTER, BOTTOM);
      text('↑/↓ para alternar Combos/Specials, Golpe/Patada para volver', x + w/2, y + h - 10);
    }
  }
  pop();
}