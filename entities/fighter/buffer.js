// entities/fighter/buffer.js
// Gestión del input buffer y helpers para diagonales / combinaciones.

import { keysDown, keysPressed, keysUp, keysDownTime, keysUpTime } from '../../core/input.js';

// Nota: no importamos Fighter para evitar ciclos. Todas las utilidades necesarias se definen aquí.

export function trimBuffer(self) {
  const now = millis();
  self.inputBuffer = (self.inputBuffer || []).filter(i => now - i.time <= (self.inputBufferDuration || 1400));
  if (self.inputBuffer.length > (self.inputBufferMax || 20)) {
    self.inputBuffer.splice(0, self.inputBuffer.length - (self.inputBufferMax || 20));
  }
}

export function bufferConsumeLast(self, n) {
  if (!n || n <= 0) return;
  const len = self.inputBuffer ? self.inputBuffer.length : 0;
  const start = Math.max(0, len - n);
  self.inputBuffer.splice(start, Math.min(n, len));
}

export function addInput(self, symbol) {
  if (!symbol) return;
  const now = millis();
  const last = self.inputBuffer.length > 0 ? self.inputBuffer[self.inputBuffer.length - 1] : null;
  if (last && last.symbol === symbol) return;
  self.inputBuffer.push({ symbol, time: now });
  normalizeDiagonals(self);
  trimBuffer(self);
}

export function normalizeDiagonals(self) {
  const now = millis();
  const maxGap = self.oppositeDiagInsertWindow || 200;
  const buf = self.inputBuffer;
  if (!buf || buf.length < 2) return;

  let i = 0;
  while (i < buf.length - 1) {
    const s_i = buf[i].symbol;
    if (!isDiagonal(s_i)) { i++; continue; }
    let found = false;
    const maxJ = Math.min(buf.length - 1, i + 3);
    for (let j = i + 1; j <= maxJ; j++) {
      const s_j = buf[j].symbol;
      if (!isDiagonal(s_j)) continue;
      if (!oppositeDiag(s_i, s_j)) continue;
      const timeDiff = Math.abs(buf[j].time - buf[i].time);
      if (timeDiff <= maxGap) {
        let hasDown = false;
        for (let k = i + 1; k < j; k++) if (buf[k].symbol === '↓') { hasDown = true; break; }
        if (!hasDown) {
          const downTime = Math.round((buf[i].time + buf[j].time) / 2);
          const removeCount = Math.max(0, j - i - 1);
          buf.splice(i + 1, removeCount, { symbol: '↓', time: downTime });
          i = i + 2;
          found = true;
          break;
        } else {
          i = j;
          found = true;
          break;
        }
      }
    }
    if (!found) i++;
  }
  trimBuffer(self);
}

export function addInputFromKey(self, keyName) {
  const now = millis();
  const dirMapP1 = { 'w': '↑', 's': '↓', 'a': '←', 'd': '→' };
  const dirMapP2 = { 'arrowup': '↑', 'arrowdown': '↓', 'arrowleft': '←', 'arrowright': '→' };

  if (self.id === 'p1') {
    if (keyName === 'i') { addInput(self, 'P'); return; }
    if (keyName === 'o') { addInput(self, 'K'); return; }
    if (keyName === ' ') { addInput(self, 'T'); return; }
  } else {
    if (keyName === 'b') { addInput(self, 'P'); return; }
    if (keyName === 'n') { addInput(self, 'K'); return; }
    if (keyName === 'backspace') { addInput(self, 'T'); return; }
  }

  const thisSym = (self.id === 'p1') ? dirMapP1[keyName] : dirMapP2[keyName];
  if (!thisSym) return;

  const diagCombineWindow = self.diagonalWindow || 160;
  const releaseTolerance = self.releaseTolerance || 180;
  const recentDuplicateWindow = 40;
  const otherDirKeys = (self.id === 'p1') ? ['w','s','a','d'].filter(k => k !== keyName)
                                         : ['arrowup','arrowdown','arrowleft','arrowright'].filter(k => k !== keyName);

  let foundOther = null;
  let foundOtherKey = null;

  for (const k of otherDirKeys) {
    if (keysDown[k]) {
      const otherSym = (self.id === 'p1') ? ({w:'↑', s:'↓', a:'←', d:'→'})[k]
                                          : ({arrowup:'↑', arrowdown:'↓', arrowleft:'←', arrowright:'→'})[k];
      foundOther = otherSym; foundOtherKey = k; break;
    }
  }

  if (!foundOther) {
    const buf = self.inputBuffer || [];
    for (let i = buf.length - 1; i >= 0; i--) {
      const s = buf[i].symbol;
      if (['↑','↓','←','→','↗','↖','↘','↙'].includes(s)) {
        if (now - buf[i].time <= diagCombineWindow) foundOther = s;
        break;
      }
    }
  }

  if (foundOther) {
    const diag = combineDirections(foundOther, thisSym);
    if (diag) {
      const vertical = ['↑','↓'], horizontal = ['←','→'];
      let fromHeldRecent = false;
      if (foundOtherKey) {
        const downTime = keysDownTime[foundOtherKey] || 0;
        fromHeldRecent = (now - downTime) <= releaseTolerance;
      } else {
        const candidateKeys = (self.id === 'p1')
          ? {'w':'↑','s':'↓','a':'←','d':'→'}
          : {'arrowup':'↑','arrowdown':'↓','arrowleft':'←','arrowright':'→'};
        for (const k in candidateKeys) {
          if (candidateKeys[k] === foundOther) {
            const upT = keysUpTime[k] || 0;
            if (now - upT <= releaseTolerance) { fromHeldRecent = true; foundOtherKey = k; break; }
          }
        }
      }

      let fromBufferRecent = false;
      for (let i = (self.inputBuffer||[]).length - 1; i >= 0; i--) {
        if (self.inputBuffer[i].symbol === foundOther && (now - self.inputBuffer[i].time) <= diagCombineWindow) {
          fromBufferRecent = true; break;
        }
      }

      if (fromHeldRecent || fromBufferRecent) {
        const buf = self.inputBuffer || [];
        if (buf.length > 0) {
          const last = buf[buf.length - 1];
          if (last.symbol === thisSym && (now - last.time) <= recentDuplicateWindow) buf.splice(buf.length - 1, 1);
        }

        const diagKeys = Hitbox?.getKeysForSymbol ? Hitbox.getKeysForSymbol(self, diag) : [];
        const isDiagHeld = (diagKeys.length === 2) && diagKeys.every(k => keysDown[k]);

        if (isDiagHeld) {
          addInput(self, diag);
          if (vertical.includes(thisSym) && horizontal.includes(foundOther)) self.pendingSimple = foundOther;
          else if (horizontal.includes(thisSym) && vertical.includes(foundOther)) self.pendingSimple = thisSym;
          else self.pendingSimple = horizontal.includes(foundOther) ? foundOther : thisSym;

          self.pendingDiag = diag;
          self.pendingSimpleTime = now;
          self.waitingForDiagRelease = true;
          normalizeDiagonals(self);
          trimBuffer(self);
          return;
        } else {
          if (vertical.includes(thisSym) && horizontal.includes(foundOther)) {
            addInput(self, thisSym); addInput(self, diag); addInput(self, foundOther);
          } else if (horizontal.includes(thisSym) && vertical.includes(foundOther)) {
            addInput(self, foundOther); addInput(self, diag); addInput(self, thisSym);
          } else {
            addInput(self, diag); addInput(self, thisSym);
          }
          normalizeDiagonals(self);
          trimBuffer(self);
          return;
        }
      }
    }
  }

  // fallback
  addInput(self, thisSym);
}

// helpers used inside this file but need hitbox module - import lazily to avoid circular tries
import * as Hitbox from './hitbox.js';

// small helpers used at update
export function handlePendingDiagRelease(self) {
  const now = millis();
  if (!self.waitingForDiagRelease || !self.pendingDiag) return;
  const diagKeys = Hitbox.getKeysForSymbol(self, self.pendingDiag);
  const stillHeld = (diagKeys.length === 2) && diagKeys.every(k => keysDown[k]);
  if (!stillHeld || (now - self.pendingSimpleTime) > self.pendingSimpleTimeout) {
    if (self.pendingSimple) addInput(self, self.pendingSimple);
    self.waitingForDiagRelease = false;
    self.pendingSimple = null; self.pendingDiag = null; self.pendingSimpleTime = 0;
  }
}

export function unlockInputsIfNeeded(self) {
  const now = millis();
  for (const key in self.inputLockedByKey) {
    if (!self.inputLockedByKey[key]) continue;
    const last = self.lastAttackTimeByKey[key] || 0;
    if (!self.attacking || (now - last > self.attackDuration + 10)) self.inputLockedByKey[key] = false;
  }
}

export function resetCombosIfExpired(self) {
  const now = millis();
  for (const key in self.lastAttackTimeByKey) {
    if (self.lastAttackTimeByKey[key] && (now - self.lastAttackTimeByKey[key] > self.comboWindow)) {
      self.comboStepByKey[key] = 0;
    }
  }
}

// input handling lite (delegates)
export function handleInput(self) {
  if (self.isHit) return;

  const setRunTap = (dir, keyName) => {
    if (keysDown[keyName] && !self.keys[dir] && !self.isHit) {
      // Solo activa runActive si NO está en dash
      if (millis() - self.lastTapTime[dir] < 250 && self.state.current !== "dash") {
        self.runActive = true;
      }
      self.lastTapTime[dir] = millis();
    }
    self.keys[dir] = keysDown[keyName];
    if (!self.keys.left && !self.keys.right && !self.isHit) self.runActive = false;
    // Si está en dash, fuerza runActive a false
    if (self.state.current === "dash") self.runActive = false;
  };

  if (self.id === 'p1') {
    setRunTap('left', 'a'); setRunTap('right', 'd');
    if (keysDown['w'] && self.onGround) { self.vy = self.jumpStrength; self.onGround = false; self.runActive = false; }
    self.crouching = keysDown['s'];
    if (keysPressed['i']) self.attack('i');
    if (keysPressed['o']) self.attack('o');
    if (keysUp['i'] || keysUp['o']) { self.inputLockedByKey['i'] = false; self.inputLockedByKey['o'] = false; }
  } else {
    setRunTap('left', 'arrowleft'); setRunTap('right', 'arrowright');
    if (keysDown['arrowup'] && self.onGround) { self.vy = self.jumpStrength; self.onGround = false; self.runActive = false; }
    self.crouching = keysDown['arrowdown'];
    if (keysPressed['b']) self.attack('b');
    if (keysPressed['n']) self.attack('n');
    if (keysUp['b'] || keysUp['n']) { self.inputLockedByKey['b'] = false; self.inputLockedByKey['n'] = false; }
  }
}

export function handleInputRelease(self, type) {
  if (self.inputLockedByKey[type] !== undefined) self.inputLockedByKey[type] = false;
}

export function bufferEndsWith(self, seq) {
  const bufSymbols = (self.inputBuffer || []).map(i => i.symbol);
  if (seq.length > bufSymbols.length) return false;
  return bufSymbols.slice(-seq.length).every((s, i) => s === seq[i]);
}

// versión flexible: permite inputs extra pero conserva orden
export function flexibleEndsWith(self, bufSymbols, seq) {
  if (!Array.isArray(bufSymbols) || !Array.isArray(seq)) return false;
  if (seq.length > bufSymbols.length) return false;

  // busca de derecha a izquierda
  let j = seq.length - 1;
  for (let i = bufSymbols.length - 1; i >= 0 && j >= 0; i--) {
    if (bufSymbols[i] === seq[j]) j--;
  }
  return j < 0; // si terminó, significa que todos los símbolos se matchearon en orden
}

// --- Detectar si un input es diagonal ---
export function isDiagonal(symbol) {
  return ['↘','↙','↖','↗'].includes(symbol);
}

// --- Expandir un símbolo diagonal en sus direcciones base ---
export function expandDiagonal(symbol) {
  switch (symbol) {
    case '↘': return ['↓','→'];
    case '↙': return ['↓','←'];
    case '↖': return ['↑','←'];
    case '↗': return ['↑','→'];
    default:  return [symbol];
  }
}

// --- Combinar dos direcciones/símbolos en una diagonal (si aplicable) ---
export function combineDirections(a, b) {
  const partsOf = sym => {
    if (sym === '↘') return ['↓','→'];
    if (sym === '↙') return ['↓','←'];
    if (sym === '↗') return ['↑','→'];
    if (sym === '↖') return ['↑','←'];
    return [sym];
  };
  const A = partsOf(a);
  const B = partsOf(b);

  for (const ca of A) {
    for (const cb of B) {
      if ((ca === '↓' && cb === '→') || (ca === '→' && cb === '↓')) return '↘';
      if ((ca === '↓' && cb === '←') || (ca === '←' && cb === '↓')) return '↙';
      if ((ca === '↑' && cb === '→') || (ca === '→' && cb === '↑')) return '↗';
      if ((ca === '↑' && cb === '←') || (ca === '←' && cb === '↑')) return '↖';
    }
  }
  return null;
}

// Opposite diagonal check used por normalizeDiagonals
function oppositeDiag(a, b) {
  return (a === '↙' && b === '↘') || (a === '↘' && b === '↙') ||
         (a === '↖' && b === '↗') || (a === '↗' && b === '↖');
}
