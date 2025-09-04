// entities/fighter/specials.js
import { Projectile } from '../../entities/projectile.js';
import { projectiles } from '../../core/main.js';

export const specialMoves = {
  hadouken: ['↓','↘','→','P'],
  shoryuken: ['→','↓','↘','P'],
  tatsumaki: ['↓','↙','←','K']
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
  }
}
