// entities/fighter/attacks/hit.js
import * as Anim from '../animation.js';
import { getKnockbackForAttack } from '../../../core/knockback.js';
import { state } from '../../../core/state.js';
import { keysDown } from '../../../core/input.js';

export function attackHits(self, opponent) {
  if (!self.attacking) return false;
  if (!self._hitTargets) self._hitTargets = new Set();
  if (opponent && opponent.id && self._hitTargets.has(opponent.id)) return false;

  if (self.attackType === 'grab') {
    const action = self.actions.grab || {};
    const totalFrames = (self.grabFramesByLayer && self.grabFramesByLayer[0]?.length) || 1;
    const elapsed = millis() - (self.attackStartTime || 0);
    let approxFrameIndex = 0;
    if (totalFrames > 1 && action.duration) {
      approxFrameIndex = Math.floor((elapsed / Math.max(1, action.duration)) * totalFrames);
      approxFrameIndex = Math.max(0, Math.min(totalFrames - 1, approxFrameIndex));
    }
    const effectiveFrameIndex = Math.max((self.frameIndex || 0), approxFrameIndex);
    if ((effectiveFrameIndex + 1) < totalFrames) return false;
    const atkHB = self.getAttackHitbox(); if (!atkHB) return false;
    const oppHB = opponent.getCurrentHitbox();
    const collided = (atkHB.x < oppHB.x + oppHB.w && atkHB.x + atkHB.w > oppHB.x && atkHB.y < oppHB.y + oppHB.h && atkHB.y + atkHB.h > oppHB.y);
    if (collided && !opponent.blocking && (!opponent.state || (opponent.state.current !== 'block' && opponent.state.current !== 'crouchBlock'))) {
      if (opponent && opponent.id) self._hitTargets.add(opponent.id);
      opponent.attacking = false; opponent.attackType = null; opponent.attackStartTime = 0; opponent._hitTargets = null;
      if (opponent.inputLockedByKey) { for (const k in opponent.inputLockedByKey) opponent.inputLockedByKey[k] = false; }
      opponent.isHit = false; opponent.hitLevel = 0;
      const offsetX = (self.facing === 1) ? (self.w - 6) : (-opponent.w + 6);
      opponent.x = self.x + offsetX; opponent.y = self.y; opponent.vx = 0; opponent.vy = 0;
      if (opponent.state) opponent.state.timer = 0; opponent.frameIndex = 0;
      opponent.setState('grabbed'); opponent.grabbedBy = self; opponent._grabLock = true;
      self._grabHolding = true; self._grabVictimOffsetX = offsetX; self._grabHolding = true; self.vx = 0; self.vy = 0;
      self.attacking = true; self.attackType = 'grab';
      return true;
    }
    return false;
  }

  const atkHB = self.getAttackHitbox(); if (!atkHB) return false;
  const oppHB = opponent.getCurrentHitbox();
  const collided = (atkHB.x < oppHB.x + oppHB.w && atkHB.x + atkHB.w > oppHB.x && atkHB.y < oppHB.y + oppHB.h && atkHB.y + atkHB.h > oppHB.y);
  if (collided) {
    if (opponent && opponent.id) self._hitTargets.add(opponent.id);
    // Advance combo now that we confirmed a hit
    _maybeAdvanceComboOnHit(self);
    return true;
  }
  return false;
}

// Advance combo step only when an attack actually hits.
function _maybeAdvanceComboOnHit(self) {
  try {
    const key = self._comboKeyForCurrentAttack;
    if (!key) return;
    if (self._comboAdvancedThisAttack) return;
    const chain = (self.comboChainsByKey && self.comboChainsByKey[key]) ? self.comboChainsByKey[key] : null;
    if (!chain || chain.length === 0) return;
    if (self._comboAdvanceResetIfCrouch) {
      self.comboStepByKey[key] = 0;
    } else {
      const cur = Number(self.comboStepByKey[key] || 0);
      let next = cur + 1;
      if (next >= chain.length) next = 0;
      self.comboStepByKey[key] = next;
    }
    self._comboAdvancedThisAttack = true;
  } catch (e) { /* silent */ }
}



import { applyDamage } from '../../../core/health.js';

export function hit(self, attacker = null) {
  if (!attacker) return;
  const prevHitLevel = (typeof self.hitLevel === 'number') ? self.hitLevel : 0;
  const wasInAirAndHit = (!self.onGround && prevHitLevel > 0);
  const hpBefore = (typeof self.hp === 'number') ? self.hp : null;
  try { if (typeof Attacks !== 'undefined' && typeof Attacks.hit === 'function') Attacks.hit(this, attacker); } catch (e) {}
  if (!attacker || typeof attacker.attackType !== 'string') return;
  const atk = String(attacker.attackType || '').toLowerCase();
  const attackIsBlockable = (attacker.unblockable !== true);
  const inBlockingState = !!(self.blocking || self.state?.current === 'block' || self.state?.current === 'crouchBlock' || self.state?.current === 'blockStun' || self.state?.current === 'crouchBlockStun');
  if (inBlockingState && attackIsBlockable) {
    if (hpBefore !== null && typeof this.hp === 'number') { this.hp = hpBefore; }
    this.blockStunStartTime = millis();
    const dur = (this.crouching ? (this.crouchBlockStunDuration || 540) : (this.blockStunDuration || 540));
    this.blockStunDuration = Math.max(this.blockStunDuration || 0, dur);
    try { if (this.crouching) this.setState('crouchBlockStun'); else this.setState('blockStun'); } catch (e) {}
    try { if (typeof Attacks !== 'undefined' && typeof Attacks.onBlock === 'function') Attacks.onBlock(this, attacker); } catch (e) {}
    this._consecutiveHits = 0; this._consecutiveHitAt = 0;
    return;
  }
  if (typeof this.hp !== 'number') return;
  const now = millis(); const chainWindow = 800;
  if (!this._consecutiveHitAt || (now - (this._consecutiveHitAt || 0)) > chainWindow) { this._consecutiveHits = 0; }
  let resolvedHitLevel = null;
  if (typeof attacker.forcedHitLevel === 'number') { resolvedHitLevel = Math.max(1, Math.min(4, Math.floor(attacker.forcedHitLevel))); this._consecutiveHits = resolvedHitLevel; this._consecutiveHitAt = now; }
  else { this._consecutiveHits = (this._consecutiveHits || 0) + 1; if (this._consecutiveHits > 3) this._consecutiveHits = 3; this._consecutiveHitAt = now; resolvedHitLevel = this._consecutiveHits; }
  try { if (this.state && (this.state.current === 'crouchpunch' || this.state.current === 'crouchPunch')) { resolvedHitLevel = 3; this._receivedHitWhileCrouchPunch = true; } } catch (e) {}
  if (prevHitLevel === 3) { try { Anim.forceSetState(self, 'knocked'); } catch (e) { console.warn('[Attacks.hit] failed to force knocked', self.id, e); self._forceKnocked = true; } self.attacking = false; self.attackType = null; self._hitTargets = null; self.vx = 0; self.vy = 0; return; }
  if (hpBefore !== null && typeof this.hp === 'number' && this.hp === hpBefore) { const damageQuarters = (typeof attacker.damageQuarters === 'number') ? attacker.damageQuarters : 1; try { applyDamage(this, damageQuarters, 2, 4); } catch (e) { this.hp = Math.max(0, this.hp - damageQuarters); } }

  // marcar hit state y tiempos
  this.isHit = true; this.hitStartTime = millis(); this.hitLevel = resolvedHitLevel || 1;
  // support optional centralized durations (level 1..4)
  const getterAvailable = (typeof window !== 'undefined' && typeof window.getHitLevelDuration === 'function');
  const levelDurMap = {
    1: getterAvailable ? window.getHitLevelDuration(this.charId || 'default', 1) : (this.actions?.hit1?.duration || 500),
    2: getterAvailable ? window.getHitLevelDuration(this.charId || 'default', 2) : (this.actions?.hit2?.duration || 700),
    3: getterAvailable ? window.getHitLevelDuration(this.charId || 'default', 3) : (this.actions?.hit3?.duration || 1000),
    4: getterAvailable ? window.getHitLevelDuration(this.charId || 'default', 4) : (this.actions?.hit3?.duration || 1600)
  };
  this.hitDuration = levelDurMap[this.hitLevel] || (this.hitDuration || 260);
  try { const s = (this.hitLevel === 1 ? 'hit1' : this.hitLevel === 2 ? 'hit2' : 'hit3'); this.setState(s); } catch (e) {}

  // knockback
  try {
    let charId = attacker && (attacker.charId || attacker.char || attacker._charId || attacker.charName) || null;
    if (!charId && attacker && attacker.ownerRef && attacker.ownerRef.charId) charId = attacker.ownerRef.charId;
    if (!charId && attacker && attacker.owner && attacker.owner.charId) charId = attacker.owner.charId;
    if (!charId && attacker && attacker.ownerId && typeof window !== 'undefined') {
      if (window.player1 && window.player1.id === attacker.ownerId) charId = window.player1.charId;
      else if (window.player2 && window.player2.id === attacker.ownerId) charId = window.player2.charId;
    }
    if (!charId) charId = (attacker && attacker.ownerRef && attacker.ownerRef.charId) ? attacker.ownerRef.charId : 'default';
    const attackName = String((attacker && attacker.attackType) || 'default').toLowerCase();
    let cfg = getKnockbackForAttack(charId, attackName) || { h: 5, v: 5 };
    if (this._receivedHitWhileCrouchPunch) { cfg = { h: 8, v: 8 }; delete this._receivedHitWhileCrouchPunch; }
    const away = Math.sign((self.x || 0) - (attacker.x || 0)) || ((attacker.facing || 1) * -1) || 1;
    const airMult = (wasInAirAndHit) ? 2 : 1;
    const finalH = Math.round((cfg.h || 0) * airMult);
    const finalV = Math.round((cfg.v || 0) * airMult);
    const kb = { vx: finalH * away, vy: -finalV, decay: 1, frames: 101, sourceId: attacker?.id || null };
    this._knockback = Object.assign({}, kb);
    this._pendingKnockback = { magX: Math.abs(kb.vx), y: kb.vy, away, applied: false, _markLaunched: { start: millis(), duration: 600 } };
    // Debug: log detailed coords/knockback for heavy launches (punch3/kick3)
    try {
      const atkName = String(attackName || '').toLowerCase();
      let shouldTrace = false;
      try {
        if (atkName === 'punch3' || atkName === 'kick3') shouldTrace = true;
        const m = atkName.match(/(punch|kick)(\d+)/);
        if (m && Number(m[2]) >= 3) shouldTrace = true;
        if (!shouldTrace && typeof finalH === 'number' && Math.abs(finalH) >= 6) shouldTrace = true;
      } catch (e) {}
      if (shouldTrace) {
        const snap = (n) => (typeof n === 'number' ? Math.round(n * 100) / 100 : n);
        console.log('[KB-TRACE]', {
          t: millis(),
          attack: atkName,
          throwerChar: charId,
          throwerPos: { x: snap(attacker.x), y: snap(attacker.y), vx: snap(attacker.vx), vy: snap(attacker.vy) },
          victimChar: (self.charId || self.id),
          victimPos: { x: snap(self.x), y: snap(self.y), vx: snap(self.vx), vy: snap(self.vy) },
          cfg: cfg,
          finalH: finalH,
          finalV: finalV,
          kb: kb
        });
      }
    } catch (e) {}
    this.isHit2 = (this.hitLevel >= 2); this.isHit3 = (this.hitLevel >= 3);
    this.isHit = true; this.hitStartTime = millis(); this.hitLevel = this.hitLevel || 1; this.hitDuration = this.hitDuration || (this.actions?.hit1?.duration || 260);
    try { const s = (this.hitLevel === 1 ? 'hit1' : this.hitLevel === 2 ? 'hit2' : 'hit3'); Anim.forceSetState(this, s); } catch (e) {}
    this._launched = true; this._launchedStart = millis(); this._launchedDuration = Math.max(this._launchedDuration || 0, 600);
  } catch (e) { console.warn('[KB FORCE] failed to set persistent knockback', e); }

  if (this.hp <= 0) {
    this.hp = 0;
    this.hearts = 0;
    this.lifebar = 0;
    this.alive = false; this.blocking = false; this.blockStunStartTime = 0; this.attacking = false; this.isHit = false; this._consecutiveHits = 0; this._consecutiveHitAt = 0; try { this.setState('knocked'); } catch (e) {} return;
  }

  try {
    // If hitLevel is 3 -> convert to knocked (shorter knocked as configured).
    // If hitLevel is 4 -> it's a special launch (grab/throw), do NOT force knocked here.
    const hl = Number(this.hitLevel || 0);
    if (hl >= 3 && hl < 4) {
      if (window.PAUSED || window.HITSTOP_ACTIVE) { this._forceKnocked = true; }
      else { try { this.setState('knocked'); } catch (e) {} }
      this.attacking = false; this.attackType = null; this._hitTargets = null; this.vx = 0; this.vy = 0; return;
    }
  } catch (e) {}
}

export function updateAttackState(self) {
  const now = millis();
  if (self.attacking && (now - self.attackStartTime > self.attackDuration)) {
    if (self.attackType === 'grab' && self._grabHolding) return;
    const endedAttackType = self.attackType;
    if (endedAttackType === 'spit') {
      try { const holdKey = (self.id === 'p1') ? 'p' : 'm'; if (keysDown && keysDown[holdKey]) { self._spitHold = true; self.attacking = false; self.attackType = null; try { self.setState('spit'); } catch (e) {} self.frameIndex = 7; self.frameTimer = 0; return; } } catch (e) {}
    }
    self.attacking = false; self.attackType = null; if (self._hitTargets) { self._hitTargets.clear(); self._hitTargets = null; }
    // cleanup any pending combo state stored at attack start
    try { delete self._comboKeyForCurrentAttack; delete self._comboAdvancedThisAttack; delete self._comboAdvanceResetIfCrouch; } catch (e) {}
    try {
      if (endedAttackType === 'taunt' && self.state && self.state.current === 'taunt') { self.setState('idle'); }
      if ((endedAttackType === 'crouchpunch' || endedAttackType === 'crouchPunch' || endedAttackType === 'crouchkick' || endedAttackType === 'crouchKick') && self.state && (self.state.current === 'crouchpunch' || self.state.current === 'crouchPunch' || self.state.current === 'crouchkick' || self.state.current === 'crouchKick')) { self.setState('idle'); }
    } catch (e) {}
  }
}

export default { attackHits, hit, updateAttackState };
