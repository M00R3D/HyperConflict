// entities/fighter/specials.js
import { Projectile } from '../../entities/projectile.js';
import { projectiles } from '../../core/main.js';

export const specialMoves = {
  hadouken: ['↓','↘','→','P'],
  shoryuken: ['→','↓','↘','P'],
  tatsumaki: ['↓','↙','←','K'],
  // supersalto: agacharse y saltar rápido (down, up)
  supersalto: ['↓','↑']
};

import * as Hitbox from './hitbox.js';
import * as Buffer from './buffer.js';

export function checkSpecialMoves(self) {
  const bufSymbols = (self.inputBuffer || []).map(i => i.symbol);
  for (const moveName in specialMoves) {
    let seq = specialMoves[moveName];
    if (self.facing === -1) seq = seq.map(s => Hitbox.mirrorSymbol(s));
    if (Buffer.flexibleEndsWith(self, bufSymbols, seq)) {
      doSpecial(self, moveName);
      Buffer.bufferConsumeLast(self, seq.length);
      return;
    }
    if (Buffer.bufferEndsWith(self, seq)) {
      doSpecial(self, moveName);
      Buffer.bufferConsumeLast(self, seq.length);
      return;
    }
  }
}

export function doSpecial(self, moveName) {
  if (moveName === 'hadouken') {
    self.setState('hadouken');
    self.attackType = 'hadouken';
    self.attacking = true;
    self.attackStartTime = millis();
    self.attackDuration = self.actions?.hadouken?.duration || 600;

    const dir = self.facing === 1 ? 1 : -1;
    const px = Math.round(self.x + (dir === 1 ? self.w + 4 : -4));
    const py = Math.round(self.y + self.h / 2 - 6);
    const p = new Projectile(px, py, dir, 1, self.id, null, {}, self.projectileFramesByLayer);
    projectiles.push(p);
  } else if (moveName === 'shoryuken') {
    self.setState('punch3'); self.attackType = 'punch3'; self.attacking = true;
    self.attackStartTime = millis(); self.attackDuration = self.actions.punch3.duration || 800;
  } else if (moveName === 'tatsumaki') {
    self.setState('kick3'); self.attackType = 'kick3'; self.attacking = true;
    self.attackStartTime = millis(); self.attackDuration = self.actions.kick3.duration || 600;
  } else if (moveName === 'supersalto') {
    // Supersalto: impulso vertical más fuerte y "float" temporal (menor gravedad).
    // Activar solo cuando estaba en suelo justo antes del input (evita doble activación en aire)
    const wasOnGround = (typeof self._prevOnGround === 'boolean') ? self._prevOnGround : !!self.onGround;
    if (!wasOnGround) return;

    // Estado visual: salto
    self.setState('jump');
    self.onGround = false;

    // Velocidad vertical aumentada (jumpStrength es negativo)
    const boostFactor = 1.2;
    self.vy = (self.jumpStrength || -5.67) * boostFactor;

    // Efecto de "float": bajar gravedad temporalmente para más hang-time
    if (typeof self.gravity === 'number') {
      self._supersaltoOriginalGravity = self.gravity;
      self.gravity = Math.max(0.08, (self.gravity || 0.3) * 0.55); // reducir gravedad
      self._supersaltoStart = millis();
      self._supersaltoDuration = 520; // ms de reducción de gravedad (ajustable)
      self._supersaltoActive = true;
    }
    // opcional: reproducir sonido / particle spawn si tienes sistema
    return;
  }
}
