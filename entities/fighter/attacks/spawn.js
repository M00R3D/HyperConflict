// entities/fighter/attacks/spawn.js
import { spawnProjectileFromType } from '../../projectile.js';
import { state } from '../../../core/state.js';
import { keysDown } from '../../../core/input.js';

export function handleStaplerSpawn(self, attackName) {
  try {
    if (attackName !== 'stapler') return;
    const projArr = (typeof window !== 'undefined' && Array.isArray(window.projectiles)) ? window.projectiles : (state && Array.isArray(state.projectiles) ? state.projectiles : null);
    const dir = (self.facing === -1) ? -1 : 1;
    const sx = Math.round(self.x + (dir === 1 ? self.w : 0));
    const sy = Math.round(self.y + self.h / 2);
    const p = spawnProjectileFromType(6, sx, sy, dir, self.id, {}, {}, (self.stapleFramesByLayer || null));
    p.attackType = 'stapler';
    p.damageQuarters = (typeof p.damageQuarters === 'number') ? p.damageQuarters : 1;
    p.ownerRef = self; p._ownerRef = self; p.ownerId = self.id; p.charId = self.charId;
    if (projArr && Array.isArray(projArr)) projArr.push(p);
  } catch (e) { try { console.warn('[spawnStapler] failed', e); } catch (ee) {} }
}

export function handleThinLaserSpawn(self, attackName) {
  try {
    if (attackName !== 'thin_laser') return;
    const projArr = (typeof window !== 'undefined' && Array.isArray(window.projectiles)) ? window.projectiles : (state && Array.isArray(state.projectiles) ? state.projectiles : null);
    const dir = (self.facing === -1) ? -1 : 1;
    const sx = Math.round(self.x + (dir === 1 ? self.w : 0));
    const sy = Math.round(self.y + self.h / 2);

    let existing = null;
    if (projArr && Array.isArray(projArr)) {
      for (let i = projArr.length - 1; i >= 0; i--) {
        const q = projArr[i];
        if (!q) continue;
        if (q.ownerId === self.id && q.typeId === 8) { existing = q; break; }
      }
    }

    if (existing) {
      existing.age = 0; existing.lifespan = existing.lifespan || 4000; existing.toRemove = false; existing._visible = true;
      existing._originX = sx; existing._originY = sy; try { existing._beamLength = existing.w || 6; existing._beamTargetLength = existing.w || 6; } catch (e) {}
      existing.frameIndex = 0; existing._frameTimer = millis();
    } else {
      const p = spawnProjectileFromType(8, sx, sy, dir, self.id, {}, {}, (self.thinLaserProjFramesByLayer || null));
      p.attackType = 'thin_laser';
      p.damageQuarters = (typeof p.damageQuarters === 'number') ? p.damageQuarters : 4;
      p.ownerRef = self; p._ownerRef = self; p.ownerId = self.id; p.charId = self.charId;
      if (projArr && Array.isArray(projArr)) projArr.push(p);
    }

    self._suppressThinLaserOverlay = true;
  } catch (e) { try { console.warn('[spawnThinLaser] failed', e); } catch (ee) {} }
}

export function shoot(self) {
  try {
    const dir = self.keys.right ? 1 : (self.keys.left ? -1 : (self.id === 'p1' ? 1 : -1));
    const sx = Math.round(self.x + self.w / 2);
    const sy = Math.round(self.y + self.h / 2);
    const p = spawnProjectileFromType(0, sx, sy, dir, self.id, {}, { speed: 8, w: 16, h: 16 }, (self.projectileFramesByLayer || null));
    const projArr = (typeof window !== 'undefined' && Array.isArray(window.projectiles)) ? window.projectiles : (state && Array.isArray(state.projectiles) ? state.projectiles : null);
    if (projArr && Array.isArray(projArr)) projArr.push(p);
  } catch (e) { try { console.warn('[spawnShoot] failed', e); } catch (ee) {} }
}

export default { handleStaplerSpawn, handleThinLaserSpawn, shoot };
